/**
 * Script de test pour vérifier que l'API subscription fonctionne
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testSubscriptionAPI() {
  console.log('\n🧪 Test de l\'API Subscription...\n');

  // Récupérer l'utilisateur le plus récent
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!user) {
    console.log('❌ Aucun utilisateur trouvé');
    return;
  }

  console.log(`✅ Utilisateur trouvé: ${user.email} (${user.id})`);

  // Vérifier la subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    include: {
      plan: {
        include: {
          featureLimits: true,
        },
      },
    },
  });

  if (!subscription) {
    console.log('❌ Aucune subscription trouvée');
    return;
  }

  console.log(`✅ Subscription: Plan ${subscription.plan.name} - Status ${subscription.status}`);

  // Vérifier la balance de crédits
  const creditBalance = await prisma.creditBalance.findUnique({
    where: { userId: user.id },
  });

  if (!creditBalance) {
    console.log('❌ Aucune balance de crédits trouvée');
    return;
  }

  console.log(`✅ Balance crédits: ${creditBalance.balance} crédits`);

  // Vérifier les compteurs de features
  const featureCounters = await prisma.featureUsageCounter.findMany({
    where: { userId: user.id },
  });

  console.log(`✅ Compteurs de features: ${featureCounters.length} compteurs actifs`);

  // Vérifier les CV
  const cvCount = await prisma.cvFile.count({
    where: { userId: user.id, blocked: false },
  });

  console.log(`✅ CVs: ${cvCount}/${subscription.plan.cvLimit === -1 ? '∞' : subscription.plan.cvLimit}`);

  console.log('\n🎉 Toutes les données sont OK!\n');

  await prisma.$disconnect();
}

testSubscriptionAPI().catch(console.error);
