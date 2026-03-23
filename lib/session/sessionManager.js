import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { sendSessionEndNotification } from '@/lib/telegram/notifications';

// Map en mémoire persistante au HMR (même pattern que Prisma client)
const activeSessions = globalThis.__activeSessions || (globalThis.__activeSessions = new Map());

const STALE_TIMEOUT = 2 * 60 * 1000; // 2 minutes sans heartbeat = session terminée

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

// Cleanup automatique toutes les 30s — détecte les sessions sans heartbeat
if (!globalThis.__sessionCleanupInterval) {
  globalThis.__sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of activeSessions) {
      if (now - session.lastHeartbeat.getTime() > STALE_TIMEOUT) {
        console.log('[session] Stale cleanup: session expirée pour userId', session.userId);
        activeSessions.delete(id);
        aggregateSessionData(session).then((data) => {
          if (data) {
            sendSessionEndNotification(data).catch((err) =>
              console.error('[session] Erreur notification Telegram:', err)
            );
          }
        }).catch(() => {});
      }
    }
  }, 30_000);
}

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

  console.log('[session] Nouvelle session démarrée pour userId', userId, '- sessionId:', sessionId);
  return sessionId;
}

export function heartbeat(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  session.lastHeartbeat = new Date();
  return true;
}

async function aggregateSessionData(session) {
  const { userId, startedAt } = session;
  const endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, role: true },
  });

  if (!user || user.role === 'ADMIN') return null;

  const previousLogin = await prisma.telemetryEvent.findFirst({
    where: { userId, type: 'USER_LOGIN', status: 'success' },
    orderBy: { timestamp: 'desc' },
    skip: 1,
    select: { timestamp: true },
  });

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

  const apiCalls = await prisma.openAICall.aggregate({
    where: {
      userId,
      createdAt: { gte: startedAt, lte: endedAt },
    },
    _sum: { estimatedCost: true },
    _count: true,
  });

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
