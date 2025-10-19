#!/usr/bin/env node

/**
 * Script de nettoyage des sessionIds orphelins dans TelemetryEvent
 * Met à NULL les sessionIds qui pointent vers des sessions supprimées
 *
 * Usage: node scripts/cleanup-orphaned-session-ids.js
 */

import prisma from '../lib/prisma.js';

async function cleanupOrphanedSessionIds() {
  console.log('🧹 Nettoyage des sessionIds orphelins dans TelemetryEvent...\n');

  try {
    // 1. Trouver tous les sessionIds uniques dans TelemetryEvent
    const eventsWithSessions = await prisma.telemetryEvent.groupBy({
      by: ['sessionId'],
      where: {
        sessionId: { not: null },
      },
      _count: {
        id: true,
      },
    });

    const totalSessionIds = eventsWithSessions.length;
    const totalEvents = eventsWithSessions.reduce((sum, g) => sum + g._count.id, 0);

    console.log('📊 État actuel :');
    console.log(`  - SessionIds distincts dans TelemetryEvent : ${totalSessionIds}`);
    console.log(`  - Événements avec sessionId : ${totalEvents}\n`);

    // 2. Vérifier quelles sessions existent encore
    const sessionIds = eventsWithSessions.map(e => e.sessionId);

    const existingSessions = await prisma.userSession.findMany({
      where: {
        id: { in: sessionIds },
      },
      select: {
        id: true,
      },
    });

    const existingSessionIds = new Set(existingSessions.map(s => s.id));

    // 3. Identifier les sessionIds orphelins
    const orphanedSessionIds = sessionIds.filter(id => !existingSessionIds.has(id));

    console.log(`🔍 Analyse :`);
    console.log(`  - Sessions existantes : ${existingSessionIds.size}`);
    console.log(`  - Sessions supprimées (orphelines) : ${orphanedSessionIds.length}\n`);

    if (orphanedSessionIds.length === 0) {
      console.log('✅ Aucun sessionId orphelin à nettoyer !');
      return;
    }

    // 4. Compter les événements concernés
    const orphanedEventsCount = eventsWithSessions
      .filter(e => orphanedSessionIds.includes(e.sessionId))
      .reduce((sum, g) => sum + g._count.id, 0);

    console.log(`📝 ${orphanedEventsCount} événements vont être nettoyés\n`);

    // 5. Mettre à NULL les sessionIds orphelins
    const result = await prisma.telemetryEvent.updateMany({
      where: {
        sessionId: { in: orphanedSessionIds },
      },
      data: {
        sessionId: null,
      },
    });

    console.log(`✅ ${result.count} événement(s) mis à jour (sessionId → NULL)\n`);

    // 6. Vérification finale
    const remainingOrphaned = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT te.sessionId) as count
      FROM TelemetryEvent te
      LEFT JOIN UserSession us ON te.sessionId = us.id
      WHERE te.sessionId IS NOT NULL AND us.id IS NULL
    `;

    console.log('📈 Résultat :');
    console.log(`  - SessionIds orphelins restants : ${remainingOrphaned[0].count}`);
    console.log(`  - Événements nettoyés : ${result.count}`);

    if (remainingOrphaned[0].count === 0) {
      console.log('\n🎉 Tous les sessionIds orphelins ont été nettoyés !');
    }

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
cleanupOrphanedSessionIds();
