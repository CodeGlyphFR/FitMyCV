/**
 * Script pour attribuer le plan Gratuit à tous les utilisateurs qui n'ont pas d'abonnement
 *
 * Usage: node scripts/assign-free-plan-to-users.js
 *
 * Ce script est utile pour :
 * - Corriger les comptes créés avant la mise en place du système d'abonnements
 * - Résoudre les cas où assignDefaultPlan() a échoué lors de l'inscription
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Recherche des utilisateurs sans abonnement...\n');

  try {
    // Trouver tous les utilisateurs sans abonnement
    const usersWithoutSubscription = await prisma.user.findMany({
      where: {
        subscription: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    if (usersWithoutSubscription.length === 0) {
      console.log('✅ Tous les utilisateurs ont déjà un abonnement !');
      return;
    }

    console.log(`📋 Trouvé ${usersWithoutSubscription.length} utilisateur(s) sans abonnement :\n`);
    usersWithoutSubscription.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.name}) - Inscrit le ${user.createdAt.toLocaleDateString('fr-FR')}`);
    });

    // Trouver le plan Gratuit
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: {
        priceMonthly: 0,
        priceYearly: 0,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (!freePlan) {
      console.error('\n❌ ERREUR: Aucun plan gratuit (0€) trouvé en base de données.');
      console.error('   Veuillez d\'abord exécuter: npx prisma db seed');
      process.exit(1);
    }

    console.log(`\n💳 Plan gratuit trouvé: "${freePlan.name}" (ID: ${freePlan.id})`);
    console.log('\n🚀 Attribution du plan gratuit en cours...\n');

    let successCount = 0;
    let failCount = 0;

    for (const user of usersWithoutSubscription) {
      try {
        // Créer un customer Stripe local (sera créé dans Stripe lors du premier paiement)
        const stripeCustomerId = `local_${user.id}`;

        // Créer l'abonnement
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setFullYear(periodEnd.getFullYear() + 10); // Gratuit = quasi permanent

        await prisma.subscription.create({
          data: {
            userId: user.id,
            stripeCustomerId,
            planId: freePlan.id,
            status: 'active',
            billingPeriod: 'monthly',
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });

        // Initialiser la balance de crédits
        const existingBalance = await prisma.creditBalance.findUnique({
          where: { userId: user.id },
        });

        if (!existingBalance) {
          await prisma.creditBalance.create({
            data: {
              userId: user.id,
              balance: 0,
            },
          });
        }

        console.log(`  ✅ ${user.email} → Plan Gratuit attribué`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ ${user.email} → Échec: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n📊 Résumé:');
    console.log(`   - Succès: ${successCount}`);
    console.log(`   - Échecs: ${failCount}`);
    console.log(`   - Total: ${usersWithoutSubscription.length}`);

    if (successCount > 0) {
      console.log('\n✨ Attribution terminée avec succès !');
    }

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error);
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
