#!/usr/bin/env node

/**
 * Script de nettoyage one-shot pour fermer toutes les sessions orphelines
 *
 * Usage: node scripts/cleanup-open-sessions.js
 */

import prisma from '../lib/prisma.js';

async function cleanupOrphanedSessions() {
  console.log('🧹 Nettoyage des sessions orphelines...\n');

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // 1. Statistiques avant nettoyage
    const stats = await prisma.userSession.groupBy({
      by: ['endedAt'],
      _count: {
        id: true,
      },
    });

    const totalOpen = stats.find(s => s.endedAt === null)?._count.id || 0;
    const totalClosed = stats.find(s => s.endedAt !== null)?._count.id || 0;

    console.log('📊 État actuel :');
    console.log(`  - Sessions ouvertes : ${totalOpen}`);
    console.log(`  - Sessions fermées : ${totalClosed}`);
    console.log(`  - Total : ${totalOpen + totalClosed}\n`);

    // 2. Trouver les sessions inactives (> 10 minutes)
    const inactiveSessions = await prisma.userSession.findMany({
      where: {
        endedAt: null,
        lastActivityAt: { lt: tenMinutesAgo },
      },
      select: {
        id: true,
        lastActivityAt: true,
      },
    });

    console.log(`🔍 Trouvé ${inactiveSessions.length} session(s) inactive(s) (> 10 min)\n`);

    if (inactiveSessions.length === 0) {
      console.log('✅ Aucune session à nettoyer !');
      return;
    }

    // 3. Fermer toutes les sessions inactives
    const result = await prisma.userSession.updateMany({
      where: {
        id: { in: inactiveSessions.map(s => s.id) },
      },
      data: {
        endedAt: new Date(),
      },
    });

    console.log(`✅ ${result.count} session(s) fermée(s) avec succès !`);

    // 4. Statistiques après nettoyage
    const remainingOpen = await prisma.userSession.count({
      where: { endedAt: null },
    });

    console.log(`\n📈 Résultat :`);
    console.log(`  - Sessions encore ouvertes : ${remainingOpen}`);
    console.log(`  - Sessions nettoyées : ${result.count}`);

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
cleanupOrphanedSessions();
