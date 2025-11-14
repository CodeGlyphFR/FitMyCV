#!/usr/bin/env node

/**
 * Script pour migrer manuellement l'abonnement manquant
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixSubscription() {
  console.log('🔧 Migration de l\'abonnement manquant...\n');

  try {
    // Données de l'abonnement depuis SQLite
    const subscriptionData = {
      id: 'cmh7wt9h10008u29caefv84qv',
      userId: 'cmh7wt9dz0004u29cqv6ggqnf',
      stripeCustomerId: 'cus_TJ9QJUINIW2Wue',
      stripeSubscriptionId: 'sub_1SMczsLZeJIkViPYXWj2uMxG',
      stripePriceId: 'price_1SMWPvLZeJIkViPYrgGanw3F',
      planId: 3,
      status: 'active',
      billingPeriod: 'yearly',
      currentPeriodStart: new Date(1762017823000),
      currentPeriodEnd: new Date(1793553823000),
      cancelAtPeriodEnd: false,  // 0 dans SQLite = false
      canceledAt: null,
      createdAt: new Date(1761495286070),
      updatedAt: new Date(1762159902971)
    };

    console.log('📋 Données à insérer :');
    console.log(`   - User: ${subscriptionData.userId}`);
    console.log(`   - Plan: ${subscriptionData.planId} (Premium)`);
    console.log(`   - Status: ${subscriptionData.status}`);
    console.log(`   - Period: ${subscriptionData.currentPeriodStart.toISOString()} → ${subscriptionData.currentPeriodEnd.toISOString()}`);

    // Vérifier si l'abonnement existe déjà
    const existing = await prisma.subscription.findUnique({
      where: { id: subscriptionData.id }
    });

    if (existing) {
      console.log('\n⚠️  L\'abonnement existe déjà, mise à jour...');
      await prisma.subscription.update({
        where: { id: subscriptionData.id },
        data: subscriptionData
      });
      console.log('✅ Abonnement mis à jour');
    } else {
      console.log('\n📝 Création de l\'abonnement...');
      await prisma.subscription.create({
        data: subscriptionData
      });
      console.log('✅ Abonnement créé avec succès');
    }

    // Vérification
    const subscription = await prisma.subscription.findUnique({
      where: { userId: subscriptionData.userId },
      include: {
        user: { select: { email: true } },
        plan: { select: { name: true } }
      }
    });

    console.log('\n🎉 Résultat :');
    console.log(`   - Email: ${subscription.user.email}`);
    console.log(`   - Plan: ${subscription.plan.name}`);
    console.log(`   - Status: ${subscription.status}`);
    console.log(`   - Stripe Sub ID: ${subscription.stripeSubscriptionId}`);

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixSubscription();
