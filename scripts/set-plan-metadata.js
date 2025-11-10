/**
 * Script pour définir les métadonnées des plans existants
 * - Plan Gratuit: isFree=true, tier=0
 * - Plan Pro: tier=1, isPopular=true
 * - Plan Premium: tier=2
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setPlanMetadata() {
  try {
    console.log('📊 Récupération des plans existants...');
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { id: 'asc' },
    });

    console.log(`Trouvé ${plans.length} plans:\n`);
    plans.forEach(p => {
      console.log(`  - ID: ${p.id}, Nom: ${p.name}, Prix mensuel: ${p.priceMonthly}€`);
    });

    console.log('\n🔧 Mise à jour des métadonnées...\n');

    for (const plan of plans) {
      let updates = {};

      // Déterminer les métadonnées basées sur le nom ou le prix
      if (plan.priceMonthly === 0 && plan.priceYearly === 0) {
        // Plan gratuit
        updates = {
          isFree: true,
          tier: 0,
          isPopular: false,
        };
        console.log(`  ✓ ${plan.name} → Plan gratuit (tier=0, isFree=true)`);
      } else if (plan.name.toLowerCase() === 'pro') {
        // Plan Pro
        updates = {
          isFree: false,
          tier: 1,
          isPopular: true, // Pro est le plan recommandé
        };
        console.log(`  ✓ ${plan.name} → Plan Pro (tier=1, isPopular=true)`);
      } else if (plan.name.toLowerCase() === 'premium') {
        // Plan Premium
        updates = {
          isFree: false,
          tier: 2,
          isPopular: false,
        };
        console.log(`  ✓ ${plan.name} → Plan Premium (tier=2)`);
      } else {
        // Autre plan (fallback basé sur le prix)
        updates = {
          isFree: false,
          tier: plan.priceMonthly > 20 ? 2 : 1,
          isPopular: false,
        };
        console.log(`  ✓ ${plan.name} → Plan générique (tier=${updates.tier})`);
      }

      await prisma.subscriptionPlan.update({
        where: { id: plan.id },
        data: updates,
      });
    }

    console.log('\n✅ Métadonnées des plans mises à jour avec succès !');

    // Afficher le résultat final
    console.log('\n📋 Plans après mise à jour:\n');
    const updatedPlans = await prisma.subscriptionPlan.findMany({
      orderBy: { tier: 'asc' },
    });

    updatedPlans.forEach(p => {
      console.log(`  ${p.name}:`);
      console.log(`    - tier: ${p.tier}`);
      console.log(`    - isFree: ${p.isFree}`);
      console.log(`    - isPopular: ${p.isPopular}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setPlanMetadata();
