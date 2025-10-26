#!/usr/bin/env node

/**
 * Script pour attribuer le plan gratuit à un utilisateur existant
 * Usage: node scripts/assign-plan-to-user.js <userId>
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignDefaultPlan(userId) {
  // Trouver le plan gratuit (tier 0)
  const freePlan = await prisma.subscriptionPlan.findFirst({
    where: {
      tier: 0,
    },
  });

  if (!freePlan) {
    throw new Error('Aucun plan gratuit (tier 0) trouvé');
  }

  console.log(`   📋 Plan gratuit trouvé: ${freePlan.name} (ID: ${freePlan.id})`);

  // Vérifier si l'utilisateur a déjà un abonnement
  const existingSub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSub) {
    console.log(`   🔄 Mise à jour de l'abonnement existant...`);
    // Mettre à jour l'abonnement existant
    await prisma.subscription.update({
      where: { userId },
      data: {
        planId: freePlan.id,
        status: 'active',
        billingPeriod: 'monthly',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      },
    });
  } else {
    console.log(`   ➕ Création d'un nouvel abonnement...`);
    // Créer un nouvel abonnement
    await prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: 'active',
        billingPeriod: 'monthly',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      },
    });
  }

  // Vérifier si l'utilisateur a déjà une balance de crédits
  const existingBalance = await prisma.creditBalance.findUnique({
    where: { userId },
  });

  if (!existingBalance) {
    console.log(`   💎 Création de la balance de crédits...`);
    await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
      },
    });
  } else {
    console.log(`   💎 Balance de crédits existante: ${existingBalance.balance}`);
  }

  console.log(`   ✅ Plan gratuit attribué avec succès`);
}

async function main() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('❌ Usage: node scripts/assign-plan-to-user.js <userId>');
    process.exit(1);
  }

  try {
    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      console.error(`❌ Utilisateur ${userId} introuvable`);
      process.exit(1);
    }

    console.log(`\n✅ Utilisateur trouvé: ${user.email} (${user.name || 'Sans nom'})`);

    // Vérifier l'abonnement actuel
    const existingSub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (existingSub) {
      console.log(`ℹ️  Abonnement actuel: ${existingSub.plan.name} (tier ${existingSub.plan.tier})`);
    } else {
      console.log(`ℹ️  Aucun abonnement actuel`);
    }

    // Attribuer le plan gratuit
    console.log('\n🔄 Attribution du plan gratuit...');
    await assignDefaultPlan(userId);

    // Vérifier le résultat
    const newSub = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (newSub) {
      console.log(`\n✅ Plan final: ${newSub.plan.name} (tier ${newSub.plan.tier})`);
      console.log(`   - Période: ${newSub.billingPeriod}`);
      console.log(`   - Statut: ${newSub.status}`);
      console.log(`   - Début: ${newSub.currentPeriodStart.toISOString().split('T')[0]}`);
      console.log(`   - Fin: ${newSub.currentPeriodEnd.toISOString().split('T')[0]}\n`);
    } else {
      console.error('\n❌ Erreur: aucun abonnement trouvé après attribution\n');
    }

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
