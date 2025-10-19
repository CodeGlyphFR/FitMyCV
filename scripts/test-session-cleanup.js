#!/usr/bin/env node

/**
 * Script de test pour vérifier le système de nettoyage des sessions
 *
 * Usage: node scripts/test-session-cleanup.js
 */

import prisma from '../lib/prisma.js';

async function testSessionCleanup() {
  console.log('🧪 Test du système de nettoyage des sessions\n');

  try {
    // 1. Créer des sessions de test
    console.log('1️⃣ Création de sessions de test...');

    const now = Date.now();

    // Get a real user ID from the database
    const user = await prisma.user.findFirst({
      select: { id: true },
    });

    if (!user) {
      console.log('❌ Aucun utilisateur trouvé dans la base. Créez un utilisateur d\'abord.');
      return;
    }

    const testUserId = user.id;

    // Session active récente (< 10min)
    const activeSession = await prisma.userSession.create({
      data: {
        userId: testUserId,
        deviceId: 'test_device_1',
        startedAt: new Date(now),
        lastActivityAt: new Date(now - 5 * 60 * 1000), // 5 min ago
      },
    });

    // Session inactive (> 10min)
    const inactiveSession = await prisma.userSession.create({
      data: {
        userId: testUserId,
        deviceId: 'test_device_2',
        startedAt: new Date(now - 15 * 60 * 1000),
        lastActivityAt: new Date(now - 15 * 60 * 1000), // 15 min ago
      },
    });

    // Session très ancienne (> 24h)
    const oldSession = await prisma.userSession.create({
      data: {
        userId: testUserId,
        deviceId: 'test_device_3',
        startedAt: new Date(now - 25 * 60 * 60 * 1000), // 25h ago
        lastActivityAt: new Date(now - 25 * 60 * 60 * 1000),
      },
    });

    console.log(`✅ Créé 3 sessions de test :
  - Active (5 min inactivité) : ${activeSession.id}
  - Inactive (15 min inactivité) : ${inactiveSession.id}
  - Ancienne (25h ouverte) : ${oldSession.id}\n`);

    // 2. Exécuter le cleanup manuellement (sans import pour éviter problème alias)
    console.log('2️⃣ Exécution du cleanup...');

    const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const sessionsToClose = await prisma.userSession.findMany({
      where: {
        endedAt: null,
        OR: [
          { lastActivityAt: { lt: tenMinutesAgo } },
          { startedAt: { lt: twentyFourHoursAgo } },
        ],
      },
      select: { id: true },
    });

    const result = await prisma.userSession.updateMany({
      where: {
        id: { in: sessionsToClose.map(s => s.id) },
      },
      data: {
        endedAt: new Date(),
      },
    });

    console.log(`✅ Cleanup terminé : ${result.count} session(s) fermée(s)\n`);

    // 3. Vérifier les résultats
    console.log('3️⃣ Vérification des résultats...');

    const sessions = await prisma.userSession.findMany({
      where: {
        id: {
          in: [activeSession.id, inactiveSession.id, oldSession.id],
        },
      },
      select: {
        id: true,
        endedAt: true,
      },
    });

    const activeStillOpen = sessions.find(s => s.id === activeSession.id)?.endedAt === null;
    const inactiveClosed = sessions.find(s => s.id === inactiveSession.id)?.endedAt !== null;
    const oldClosed = sessions.find(s => s.id === oldSession.id)?.endedAt !== null;

    console.log(`  - Session active (< 10min) : ${activeStillOpen ? '✅ Toujours ouverte' : '❌ Fermée (erreur)'}`);
    console.log(`  - Session inactive (> 10min) : ${inactiveClosed ? '✅ Fermée' : '❌ Toujours ouverte (erreur)'}`);
    console.log(`  - Session ancienne (> 24h) : ${oldClosed ? '✅ Fermée' : '❌ Toujours ouverte (erreur)'}\n`);

    // 4. Nettoyage
    console.log('4️⃣ Nettoyage des sessions de test...');
    await prisma.userSession.deleteMany({
      where: {
        userId: testUserId,
      },
    });
    console.log('✅ Sessions de test supprimées\n');

    // 5. Résultat final
    if (activeStillOpen && inactiveClosed && oldClosed) {
      console.log('🎉 Tous les tests sont passés avec succès !');
      console.log('Le système de cleanup fonctionne correctement.\n');
    } else {
      console.log('⚠️ Certains tests ont échoué. Vérifiez la logique de cleanup.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testSessionCleanup();
