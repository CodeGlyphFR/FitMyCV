/**
 * Script de réinitialisation des états d'onboarding
 *
 * Réinitialise tous les onboardingState à null pour forcer
 * une nouvelle initialisation avec la structure corrigée.
 *
 * Usage:
 *   node scripts/reset-onboarding.js [--dry-run]
 *
 * Options:
 *   --dry-run : Afficher les changements sans les appliquer
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

async function resetOnboarding() {
  try {
    console.log('🔄 Démarrage du reset des onboardingState...\n');

    // Compter les users avec onboardingState non-null
    const usersWithState = await prisma.user.count({
      where: {
        onboardingState: {
          not: null
        }
      }
    });

    console.log(`📊 Statistiques actuelles:`);
    console.log(`   - Users avec onboardingState: ${usersWithState}`);

    if (usersWithState === 0) {
      console.log('\n✅ Aucun onboardingState à réinitialiser.');
      return;
    }

    if (isDryRun) {
      console.log(`\n🔍 Mode DRY-RUN: ${usersWithState} onboardingState seraient réinitialisés.`);
      console.log('   Pour appliquer les changements, relancez sans --dry-run');
      return;
    }

    // Confirmation de l'utilisateur
    console.log(`\n⚠️  Vous allez réinitialiser ${usersWithState} onboardingState à null.`);
    console.log('   Les utilisateurs devront recommencer l\'onboarding.');
    console.log('\n   Cette opération est IRRÉVERSIBLE.');

    // En mode non-interactif (CI/CD), ne pas demander confirmation
    if (process.env.CI !== 'true' && process.stdin.isTTY) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        readline.question('\n   Continuer ? (y/N) ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('\n❌ Opération annulée.');
        return;
      }
    }

    // Exécuter la réinitialisation
    console.log('\n🚀 Réinitialisation en cours...');

    const result = await prisma.user.updateMany({
      where: {
        onboardingState: {
          not: null
        }
      },
      data: {
        onboardingState: null
      }
    });

    console.log(`\n✅ Réinitialisation terminée avec succès!`);
    console.log(`   - ${result.count} onboardingState réinitialisés`);
    console.log('\n💡 Note: Les utilisateurs verront un nouvel onboarding avec la structure corrigée.');

  } catch (error) {
    console.error('\n❌ Erreur lors de la réinitialisation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
resetOnboarding()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
