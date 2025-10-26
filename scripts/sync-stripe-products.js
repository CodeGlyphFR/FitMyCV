/**
 * Script de synchronisation des produits et prix Stripe
 *
 * Ce script parcourt tous les plans d'abonnement et packs de crédits en BDD,
 * crée les produits et prix correspondants dans Stripe (Mode Test),
 * et met à jour les IDs Stripe en base de données.
 *
 * Usage: node scripts/sync-stripe-products.js
 */

require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const prisma = new PrismaClient();

// Vérifier que Stripe est configuré
if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_TODO') {
  console.error('❌ STRIPE_SECRET_KEY non configuré dans .env.local');
  console.error('⚠️  Veuillez configurer vos clés Stripe Test avant d\'exécuter ce script.');
  console.error('   1. Créer un compte Stripe: https://dashboard.stripe.com/register');
  console.error('   2. Récupérer les clés Test: https://dashboard.stripe.com/test/apikeys');
  console.error('   3. Ajouter STRIPE_SECRET_KEY dans .env.local');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

async function syncSubscriptionPlans() {
  console.log('\n📋 Synchronisation des plans d\'abonnement...\n');

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { id: 'asc' },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const plan of plans) {
    try {
      // IMPORTANT: Les plans gratuits (0€) ne doivent PAS être synchronisés avec Stripe
      // Ils restent uniquement en local dans notre base de données
      const isFreeplan = plan.priceMonthly === 0 && plan.priceYearly === 0;

      if (isFreeplan) {
        console.log(`⏭️  Plan gratuit détecté: ${plan.name} - Pas de synchronisation Stripe nécessaire`);
        skipped++;
        continue;
      }

      // Vérifier si le produit existe déjà dans Stripe
      let stripeProduct;

      if (plan.stripeProductId) {
        try {
          stripeProduct = await stripe.products.retrieve(plan.stripeProductId);
          console.log(`✓ Produit Stripe existant trouvé: ${plan.name} (${stripeProduct.id})`);
        } catch (error) {
          if (error.code === 'resource_missing') {
            console.log(`⚠️  Produit Stripe ${plan.stripeProductId} introuvable, création d'un nouveau...`);
            stripeProduct = null;
          } else {
            throw error;
          }
        }
      }

      // Créer le produit Stripe si nécessaire
      if (!stripeProduct) {
        stripeProduct = await stripe.products.create({
          name: `[${plan.name}] Abonnement FitMyCv.ai`,
          description: plan.description || `Plan ${plan.name} - ${plan.maxCvCount === -1 ? 'CV illimités' : `${plan.maxCvCount} CV max`}`,
          metadata: {
            plan_id: plan.id.toString(),
            plan_name: plan.name,
            source: 'fitmycv_sync',
          },
        });
        console.log(`✅ Produit Stripe créé: ${plan.name} (${stripeProduct.id})`);
        created++;
      }

      // Créer ou récupérer le prix mensuel
      let stripePriceMonthly;
      if (plan.stripePriceIdMonthly) {
        try {
          stripePriceMonthly = await stripe.prices.retrieve(plan.stripePriceIdMonthly);
        } catch (error) {
          stripePriceMonthly = null;
        }
      }

      if (!stripePriceMonthly && plan.priceMonthly > 0) {
        stripePriceMonthly = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: Math.round(plan.priceMonthly * 100), // Convertir en centimes
          currency: plan.priceCurrency.toLowerCase(),
          recurring: {
            interval: 'month',
            interval_count: 1,
          },
          metadata: {
            plan_id: plan.id.toString(),
            billing_period: 'monthly',
          },
        });
        console.log(`  ├─ Prix mensuel créé: ${plan.priceMonthly} ${plan.priceCurrency}/mois`);
      }

      // Créer ou récupérer le prix annuel
      let stripePriceYearly;
      if (plan.stripePriceIdYearly) {
        try {
          stripePriceYearly = await stripe.prices.retrieve(plan.stripePriceIdYearly);
        } catch (error) {
          stripePriceYearly = null;
        }
      }

      if (!stripePriceYearly && plan.priceYearly > 0) {
        stripePriceYearly = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: Math.round(plan.priceYearly * 100), // Convertir en centimes
          currency: plan.priceCurrency.toLowerCase(),
          recurring: {
            interval: 'year',
            interval_count: 1,
          },
          metadata: {
            plan_id: plan.id.toString(),
            billing_period: 'yearly',
            discount_percent: plan.yearlyDiscountPercent.toString(),
          },
        });
        console.log(`  ├─ Prix annuel créé: ${plan.priceYearly} ${plan.priceCurrency}/an (-${plan.yearlyDiscountPercent}%)`);
      }

      // Mettre à jour la BDD avec les IDs Stripe
      await prisma.subscriptionPlan.update({
        where: { id: plan.id },
        data: {
          stripeProductId: stripeProduct.id,
          stripePriceIdMonthly: stripePriceMonthly?.id || null,
          stripePriceIdYearly: stripePriceYearly?.id || null,
        },
      });

      console.log(`  └─ BDD mise à jour pour le plan ${plan.name}\n`);
      updated++;

    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation du plan "${plan.name}":`, error.message);
      skipped++;
    }
  }

  console.log(`\n📊 Résumé plans d'abonnement:`);
  console.log(`   - Produits créés: ${created}`);
  console.log(`   - Plans mis à jour: ${updated}`);
  console.log(`   - Erreurs: ${skipped}`);
}

async function syncCreditPacks() {
  console.log('\n🎫 Synchronisation des packs de crédits...\n');

  const packs = await prisma.creditPack.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const pack of packs) {
    try {
      // Vérifier si le produit existe déjà dans Stripe
      let stripeProduct;

      if (pack.stripeProductId) {
        try {
          stripeProduct = await stripe.products.retrieve(pack.stripeProductId);
          console.log(`✓ Produit Stripe existant trouvé: ${pack.name} (${stripeProduct.id})`);
        } catch (error) {
          if (error.code === 'resource_missing') {
            console.log(`⚠️  Produit Stripe ${pack.stripeProductId} introuvable, création d'un nouveau...`);
            stripeProduct = null;
          } else {
            throw error;
          }
        }
      }

      // Créer le produit Stripe si nécessaire
      if (!stripeProduct) {
        stripeProduct = await stripe.products.create({
          name: `${pack.name} - ${pack.creditAmount} crédits`,
          description: pack.description || `Pack de ${pack.creditAmount} crédits pour FitMyCv.ai`,
          metadata: {
            pack_id: pack.id.toString(),
            pack_name: pack.name,
            credit_amount: pack.creditAmount.toString(),
            source: 'fitmycv_sync',
          },
        });
        console.log(`✅ Produit Stripe créé: ${pack.name} (${stripeProduct.id})`);
        created++;
      }

      // Créer ou récupérer le prix
      let stripePrice;
      if (pack.stripePriceId) {
        try {
          stripePrice = await stripe.prices.retrieve(pack.stripePriceId);
        } catch (error) {
          stripePrice = null;
        }
      }

      if (!stripePrice) {
        stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          unit_amount: Math.round(pack.price * 100), // Convertir en centimes
          currency: pack.priceCurrency.toLowerCase(),
          metadata: {
            pack_id: pack.id.toString(),
            credit_amount: pack.creditAmount.toString(),
          },
        });
        console.log(`  ├─ Prix créé: ${pack.price} ${pack.priceCurrency} (${(pack.price / pack.creditAmount).toFixed(2)} ${pack.priceCurrency}/crédit)`);
      }

      // Mettre à jour la BDD avec les IDs Stripe
      await prisma.creditPack.update({
        where: { id: pack.id },
        data: {
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePrice?.id || null,
        },
      });

      console.log(`  └─ BDD mise à jour pour le pack ${pack.name}\n`);
      updated++;

    } catch (error) {
      console.error(`❌ Erreur lors de la synchronisation du pack "${pack.name}":`, error.message);
      skipped++;
    }
  }

  console.log(`\n📊 Résumé packs de crédits:`);
  console.log(`   - Produits créés: ${created}`);
  console.log(`   - Packs mis à jour: ${updated}`);
  console.log(`   - Erreurs: ${skipped}`);
}

async function main() {
  console.log('🚀 Démarrage de la synchronisation Stripe...');
  console.log('🔑 Mode:', process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'TEST' : 'PRODUCTION');

  try {
    // Vérifier la connexion Stripe
    const account = await stripe.account.retrieve();
    console.log(`✅ Connecté au compte Stripe: ${account.business_profile?.name || account.email || account.id}\n`);

    // Synchroniser les plans d'abonnement
    await syncSubscriptionPlans();

    // Synchroniser les packs de crédits
    await syncCreditPacks();

    console.log('\n✨ Synchronisation terminée avec succès!');
    console.log('📍 Vérifiez vos produits: https://dashboard.stripe.com/test/products');

  } catch (error) {
    console.error('\n❌ Erreur fatale lors de la synchronisation:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
