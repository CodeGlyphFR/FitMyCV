import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { sendSessionEndNotification } from '@/lib/telegram/notifications';

// Map en mémoire persistante au HMR (même pattern que Prisma client)
const activeSessions = globalThis.__activeSessions || (globalThis.__activeSessions = new Map());

const STALE_TIMEOUT = 2 * 60 * 1000; // 2 minutes sans heartbeat = session terminée

const FEATURE_EMOJI_MAP = {
  // Import
  CV_IMPORTED: '📄 Import PDF',
  CV_FIRST_IMPORTED: '📄 Premier import',
  // Génération pipeline
  CV_GENERATION_STARTED: '✨ Génération CV',
  CV_GENERATION_COMPLETED: '✅ Génération terminée',
  // Génération par source
  CV_GENERATED_URL: '🔗 CV depuis URL',
  CV_GENERATED_PDF: '📎 CV depuis PDF',
  CV_GENERATED_FROM_JOB_TITLE: '💼 CV depuis titre',
  CV_TEMPLATE_CREATED_URL: '🔗 Template depuis URL',
  CV_TEMPLATE_CREATED_PDF: '📎 Template depuis PDF',
  // Actions sur CV
  CV_EDITED: '✏️ Édition CV',
  CV_TRANSLATED: '🌍 Traduction',
  CV_EXPORTED: '📤 Export PDF',
  CV_CREATED_MANUAL: '📝 CV manuel',
  // Score & optimisation
  MATCH_SCORE_CALCULATED: '🎯 Score matching',
  CV_OPTIMIZED: '🔧 Optimisation CV',
  CV_CHANGES_REVIEWED: '👀 Review modifications',
};

// Cleanup automatique toutes les 30s — toujours recréer pour prendre les dernières fonctions (HMR)
if (globalThis.__sessionCleanupInterval) {
  clearInterval(globalThis.__sessionCleanupInterval);
}
globalThis.__sessionCleanupInterval = setInterval(async () => {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - session.lastHeartbeat.getTime() > STALE_TIMEOUT) {
      activeSessions.delete(id);
      try {
        const data = await aggregateSessionData(session);
        if (data) await sendSessionEndNotification(data);
      } catch (err) {
        console.error('[session] Erreur notification Telegram:', err);
      }
    }
  }
}, 30_000);

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

// Terminer toutes les sessions d'un utilisateur avec notification (ex: déconnexion)
export async function endSessionsByUserId(userId) {
  for (const [id, session] of activeSessions) {
    if (session.userId === userId) {
      activeSessions.delete(id);
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


  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true, role: true },
  });

  if (!user || user.role === 'ADMIN') return null;

  // Nouvel user = compte créé peu avant ou pendant cette session
  // Le compte est créé pendant le flow OAuth (avant le redirect),
  // puis la session démarre quand l'app charge (~quelques secondes après)
  const isNewUser = (startedAt.getTime() - new Date(user.createdAt).getTime()) < 60_000;

  // Dernière visite = lastLoginAt ou, à défaut, la date de création du compte
  // Pour les nouveaux users, on n'affiche pas de dernière visite
  let previousLoginAt = null;
  if (!isNewUser) {
    previousLoginAt = user.lastLoginAt || user.createdAt;
  }

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
