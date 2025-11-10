/**
 * Script de diagnostic pour vérifier l'état d'abonnement d'un utilisateur
 *
 * Usage: node scripts/check-user-subscription.js <email>
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Usage: node scripts/check-user-subscription.js <email>');
    process.exit(1);
  }

  console.log(`🔍 Recherche de l'utilisateur: ${email}\n`);

  try {
    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        subscription: {
          include: {
            plan: {
              include: {
                featureLimits: true,
              },
            },
          },
        },
        creditBalance: true,
      },
    });

    if (!user) {
      console.error(`❌ Utilisateur non trouvé: ${email}`);
      process.exit(1);
    }

    console.log('👤 Utilisateur trouvé:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nom: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Créé le: ${user.createdAt.toLocaleString('fr-FR')}`);
    console.log(`   Email vérifié: ${user.emailVerified ? '✅ Oui' : '❌ Non'}`);

    console.log('\n💳 Abonnement:');
    if (!user.subscription) {
      console.log('   ❌ AUCUN ABONNEMENT');
      console.log('\n🔧 Solution:');
      console.log('   Exécutez: node scripts/assign-free-plan-to-users.js');
    } else {
      const sub = user.subscription;
      console.log(`   ✅ Abonnement actif`);
      console.log(`   Plan: ${sub.plan.name} (ID: ${sub.planId})`);
      console.log(`   Statut: ${sub.status}`);
      console.log(`   Période de facturation: ${sub.billingPeriod}`);
      console.log(`   Période actuelle: ${sub.currentPeriodStart.toLocaleDateString('fr-FR')} → ${sub.currentPeriodEnd.toLocaleDateString('fr-FR')}`);
      console.log(`   Stripe Customer ID: ${sub.stripeCustomerId}`);
      console.log(`   Stripe Subscription ID: ${sub.stripeSubscriptionId || 'N/A (plan gratuit)'}`);
      console.log(`   Annulation programmée: ${sub.cancelAtPeriodEnd ? '⚠️ Oui' : '✅ Non'}`);

      console.log('\n📋 Features disponibles:');
      const features = sub.plan.featureLimits;
      features.forEach((feature) => {
        const status = feature.isEnabled ? '✅' : '❌';
        const limit = feature.usageLimit === -1 ? 'Illimité' : `${feature.usageLimit}/mois`;
        const levels = feature.allowedAnalysisLevels ? ` (${JSON.parse(feature.allowedAnalysisLevels).join(', ')})` : '';
        console.log(`   ${status} ${feature.featureName}: ${limit}${levels}`);
      });
    }

    console.log('\n💰 Crédits:');
    if (!user.creditBalance) {
      console.log('   ❌ Aucune balance de crédits (sera créée automatiquement si nécessaire)');
    } else {
      const balance = user.creditBalance;
      console.log(`   Disponibles: ${balance.balance} crédits`);
      console.log(`   Total acheté: ${balance.totalPurchased}`);
      console.log(`   Total utilisé: ${balance.totalUsed}`);
      console.log(`   Total remboursé: ${balance.totalRefunded}`);
      console.log(`   Total reçu en cadeau: ${balance.totalGifted}`);
    }

    console.log('\n✅ Diagnostic terminé');

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('❌ Erreur lors de l\'exécution:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
