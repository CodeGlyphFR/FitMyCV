/**
 * Script de diagnostic pour afficher l'état des compteurs de features
 *
 * Usage: node scripts/debug-feature-usage.js <email>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Usage: node scripts/debug-feature-usage.js <email>');
    process.exit(1);
  }

  console.log(`\n🔍 Diagnostic des features pour: ${email}\n`);
  console.log('═'.repeat(80));

  // 1. Trouver l'utilisateur
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) {
    console.error(`❌ Utilisateur non trouvé: ${email}`);
    process.exit(1);
  }

  console.log(`\n👤 Utilisateur:`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Nom: ${user.name || 'N/A'}`);
  console.log(`   Email: ${user.email}`);

  // 2. Récupérer l'abonnement
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
    console.log(`\n❌ Aucun abonnement trouvé`);
    process.exit(0);
  }

  console.log(`\n📋 Abonnement:`);
  console.log(`   Plan: ${subscription.plan.name}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Période: ${subscription.currentPeriodStart.toISOString().split('T')[0]} → ${subscription.currentPeriodEnd.toISOString().split('T')[0]}`);

  // 3. Calculer la période actuelle
  const now = new Date();
  const subscriptionStart = new Date(subscription.currentPeriodStart);
  const dayOfMonth = subscriptionStart.getDate();

  let periodStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 0, 0, 0, 0);
  if (periodStart > now) {
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 0, 0, 0, 0);
  }

  let periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setMilliseconds(-1);

  console.log(`   Période comptage: ${periodStart.toISOString().split('T')[0]} → ${periodEnd.toISOString().split('T')[0]}`);

  // 4. Récupérer les compteurs actuels
  const counters = await prisma.featureUsageCounter.findMany({
    where: {
      userId: user.id,
      periodStart: periodStart,
    },
  });

  // 5. Récupérer la balance de crédits
  const creditBalance = await prisma.creditBalance.findUnique({
    where: { userId: user.id },
  });

  console.log(`\n💰 Crédits disponibles: ${creditBalance?.balance || 0}`);

  // 6. Afficher les limites et compteurs
  console.log(`\n📊 Limites et compteurs:\n`);
  console.log('─'.repeat(80));
  console.log(`${'Feature'.padEnd(30)} | ${'Activée'.padEnd(8)} | ${'Limite'.padEnd(8)} | ${'Utilisé'.padEnd(8)} | Statut`);
  console.log('─'.repeat(80));

  for (const featureLimit of subscription.plan.featureLimits) {
    const counter = counters.find(c => c.featureName === featureLimit.featureName);
    const count = counter?.count || 0;
    const limit = featureLimit.usageLimit === -1 ? '∞' : featureLimit.usageLimit.toString();
    const enabled = featureLimit.isEnabled ? '✅' : '❌';

    let status;
    if (!featureLimit.isEnabled) {
      status = '🔒 Désactivée';
    } else if (featureLimit.usageLimit === -1) {
      status = '✅ Illimité';
    } else if (count < featureLimit.usageLimit) {
      status = `✅ OK (${count}/${featureLimit.usageLimit})`;
    } else {
      status = `⚠️ Limite atteinte (${count}/${featureLimit.usageLimit})`;
    }

    console.log(`${featureLimit.featureName.padEnd(30)} | ${enabled.padEnd(8)} | ${limit.padEnd(8)} | ${count.toString().padEnd(8)} | ${status}`);
  }

  console.log('─'.repeat(80));
  console.log(`\n✅ Diagnostic terminé\n`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
