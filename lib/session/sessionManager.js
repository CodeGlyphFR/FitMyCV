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

// Terminer toutes les sessions d'un utilisateur avec notification (ex: déconnexion)
export async function endSessionsByUserId(userId) {
  for (const [id, session] of activeSessions) {
    if (session.userId === userId) {
      activeSessions.delete(id);
      console.log('[session] Déconnexion: session terminée pour userId', userId);
      const data = await aggregateSessionData(session);
      if (data) {
        sendSessionEndNotification(data).catch((err) =>
          console.error('[session] Erreur notification Telegram:', err)
        );
      }
    }
  }
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

  console.log('[session] aggregateSessionData:', { userId, startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), durationMs });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true, role: true },
  });

  if (!user || user.role === 'ADMIN') return null;

  // Nouvel user = compte créé pendant cette session
  const isNewUser = user.createdAt >= startedAt;

  // Dernière visite = lastLoginAt (mis à jour à chaque signIn)
  // Si le user revient via cookie (pas de signIn), lastLoginAt reste à la date du dernier vrai login
  const previousLoginAt = !isNewUser ? user.lastLoginAt : null;

  const telemetryEvents = await prisma.telemetryEvent.findMany({
    where: {
      userId,
      timestamp: { gte: startedAt, lte: endedAt },
      type: { in: Object.keys(FEATURE_EMOJI_MAP) },
    },
    select: { type: true },
    distinct: ['type'],
  });

  console.log('[session] telemetryEvents trouvés:', telemetryEvents);

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

  console.log('[session] apiCalls:', { sum: apiCalls._sum.estimatedCost, count: apiCalls._count });

  const latestCv = await prisma.cvFile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { content: true },
  });

  const jobTitle = latestCv?.content?.header?.current_title || null;

  return {
    user: { ...user, previousLoginAt, isNewUser },
    session: {
      durationMs,
      features,
      apiCost: apiCalls._sum.estimatedCost || 0,
      apiCalls: apiCalls._count || 0,
      jobTitle,
    },
  };
}
