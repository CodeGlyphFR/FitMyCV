import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { sendSessionEndNotification } from '@/lib/telegram/notifications';

// Map en mémoire persistante au HMR (même pattern que Prisma client)
const activeSessions = globalThis.__activeSessions || (globalThis.__activeSessions = new Map());

const STALE_TIMEOUT = 2 * 60 * 1000; // 2 minutes sans heartbeat = stale

const FEATURE_EMOJI_MAP = {
  CV_IMPORTED: '📄 Import PDF',
  CV_GENERATION_STARTED: '✨ Génération CV',
  CV_GENERATION_COMPLETED: '✅ Génération terminée',
  MATCH_SCORE_CALCULATED: '🎯 Score matching',
  CV_OPTIMIZED: '🔧 Optimisation CV',
  CV_TRANSLATED: '🌍 Traduction',
  CV_EXPORTED: '📤 Export PDF',
  CV_EDITED: '✏️ Édition CV',
  CV_CREATED_MANUAL: '📝 CV manuel',
};

export function startSession(userId) {
  // Fermer silencieusement les sessions existantes (pas de notification)
  for (const [id, session] of activeSessions) {
    if (session.userId === userId) {
      activeSessions.delete(id);
    }
  }

  const sessionId = randomUUID();
  activeSessions.set(sessionId, {
    userId,
    startedAt: new Date(),
    lastHeartbeat: new Date(),
  });

  return sessionId;
}

export function heartbeat(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  session.lastHeartbeat = new Date();
  return true;
}

export async function endSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    console.log('[session] endSession: session introuvable dans le Map pour', sessionId);
    return null;
  }

  activeSessions.delete(sessionId);
  console.log('[session] endSession: session terminée pour userId', session.userId);

  const sessionData = await aggregateSessionData(session);

  if (!sessionData) {
    console.log('[session] endSession: aggregateSessionData a retourné null (user admin ou introuvable)');
    return null;
  }

  sendSessionEndNotification(sessionData).catch((err) =>
    console.error('[session] Erreur notification Telegram:', err)
  );

  return sessionData;
}

async function aggregateSessionData(session) {
  const { userId, startedAt } = session;
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();

  // Charger l'utilisateur
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, role: true },
  });

  if (!user || user.role === 'ADMIN') return null;

  // Dernière visite précédente via TelemetryEvent (login avant le courant)
  const previousLogin = await prisma.telemetryEvent.findFirst({
    where: { userId, type: 'login', status: 'success' },
    orderBy: { timestamp: 'desc' },
    skip: 1,
    select: { timestamp: true },
  });

  // Features utilisées pendant la session
  const telemetryEvents = await prisma.telemetryEvent.findMany({
    where: {
      userId,
      timestamp: { gte: startedAt, lte: endedAt },
      type: { in: Object.keys(FEATURE_EMOJI_MAP) },
    },
    select: { type: true },
    distinct: ['type'],
  });

  const features = telemetryEvents
    .map((e) => FEATURE_EMOJI_MAP[e.type] || e.type)
    .filter(Boolean);

  // Coût API pendant la session
  const apiCalls = await prisma.openAICall.aggregate({
    where: {
      userId,
      createdAt: { gte: startedAt, lte: endedAt },
    },
    _sum: { estimatedCost: true },
    _count: true,
  });

  // Titre de poste depuis le dernier CV importé
  const latestCv = await prisma.cvFile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });

  const jobTitle = latestCv?.content?.header?.current_title || null;

  return {
    user: { ...user, previousLoginAt: previousLogin?.timestamp || null },
    session: {
      durationMs,
      features,
      apiCost: apiCalls._sum.estimatedCost || 0,
      apiCalls: apiCalls._count || 0,
      jobTitle,
    },
  };
}

// Nettoyage des sessions stale (appelé à chaque start)
export function cleanupStaleSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - session.lastHeartbeat.getTime() > STALE_TIMEOUT) {
      endSession(id).catch(() => {});
    }
  }
}
