/**
 * Script pour debugger l'abonnement d'un utilisateur
 */
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  // ID de l'utilisateur depuis les logs
  const userId = 'cmh4zgwp6002ou2gomg9pq2rm';

  console.log(`🔍 Debug pour userId: ${userId}\n`);

  // 1. Récupérer l'utilisateur
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  console.log('👤 Utilisateur:');
  console.log(user);
  console.log();

  // 2. Récupérer l'abonnement
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: {
        include: {
          featureLimits: true,
        },
      },
    },
  });

  if (!subscription) {
    console.log('❌ Aucun abonnement trouvé pour cet utilisateur');
    return;
  }

  console.log('📋 Abonnement:');
  console.log({
    id: subscription.id,
    planId: subscription.planId,
    planName: subscription.plan.name,
    status: subscription.status,
    billingPeriod: subscription.billingPeriod,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });
  console.log();

  console.log(`✨ Plan "${subscription.plan.name}" - Features:`);
  for (const feature of subscription.plan.featureLimits) {
    const limit = feature.usageLimit === -1 ? '∞' : feature.usageLimit;
    const status = feature.isEnabled ? '✅' : '❌';
    console.log(`   ${status} ${feature.featureName}: ${limit}`);
  }
  console.log();

  // 3. Vérifier export_cv spécifiquement
  const exportCvFeature = subscription.plan.featureLimits.find(f => f.featureName === 'export_cv');

  if (!exportCvFeature) {
    console.log('⚠️  PROBLÈME: export_cv n\'existe PAS dans les features du plan !');
  } else {
    console.log('✅ Feature export_cv trouvée:');
    console.log({
      id: exportCvFeature.id,
      featureName: exportCvFeature.featureName,
      isEnabled: exportCvFeature.isEnabled,
      usageLimit: exportCvFeature.usageLimit,
      allowedAnalysisLevels: exportCvFeature.allowedAnalysisLevels,
    });
  }
  console.log();

  // 4. Vérifier les compteurs actuels
  const now = new Date();
  const counters = await prisma.featureUsageCounter.findMany({
    where: {
      userId,
      periodEnd: { gte: now },
    },
  });

  console.log(`📊 Compteurs actifs (${counters.length}):`);
  for (const counter of counters) {
    console.log(`   ${counter.featureName}: ${counter.count}`);
  }
}

debug()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
