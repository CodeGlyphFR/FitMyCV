/**
 * Script de reset des compteurs de features expirés
 *
 * Ce script supprime les compteurs mensuels (FeatureUsageCounter) dont la période est terminée.
 * À exécuter quotidiennement via cron pour nettoyer les anciens compteurs.
 *
 * Usage: node scripts/reset-feature-counters.js
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetExpiredCounters() {
  try {
    console.log('🔄 Démarrage du reset des compteurs expirés...');

    const now = new Date();
    console.log(`📅 Date actuelle: ${now.toISOString()}`);

    // Supprimer les compteurs dont periodEnd < maintenant
    const result = await prisma.featureUsageCounter.deleteMany({
      where: {
        periodEnd: {
          lt: now,
        },
      },
    });

    console.log(`✅ ${result.count} compteur(s) expiré(s) supprimé(s)`);

    // Afficher les compteurs restants (statistiques)
    const remainingCounters = await prisma.featureUsageCounter.count();
    console.log(`📊 Compteurs actifs restants: ${remainingCounters}`);

    // Afficher le détail des compteurs actifs par feature
    const countersGrouped = await prisma.featureUsageCounter.groupBy({
      by: ['featureName'],
      _count: {
        featureName: true,
      },
      orderBy: {
        featureName: 'asc',
      },
    });

    if (countersGrouped.length > 0) {
      console.log('\n📈 Répartition des compteurs actifs:');
      countersGrouped.forEach(({ featureName, _count }) => {
        console.log(`   - ${featureName}: ${_count.featureName} utilisateur(s)`);
      });
    }

    console.log('\n✨ Reset terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors du reset des compteurs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
resetExpiredCounters();
