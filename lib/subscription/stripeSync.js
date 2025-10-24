/**
 * Logique de synchronisation Stripe (réutilisable)
 * Peut être appelée directement sans passer par HTTP
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Vérifier que Stripe est configuré
const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_TODO'
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
  : null;

/**
 * Synchronise tous les produits et prix Stripe avec la BDD
 * @returns {Promise<{success: boolean, results: object, message: string}>}
 */
export async function syncStripeProductsInternal() {
  if (!stripe) {
    throw new Error('Stripe non configuré - vérifiez STRIPE_SECRET_KEY');
  }

  const results = {
    plans: { created: 0, updated: 0, skipped: 0, errors: [] },
    packs: { created: 0, updated: 0, skipped: 0, errors: [] },
  };

  try {
    // Synchroniser les plans d'abonnement
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { id: 'asc' },
    });

    for (const plan of plans) {
      try {
        let stripeProduct;

        // Vérifier si le produit existe
        if (plan.stripeProductId) {
          try {
            stripeProduct = await stripe.products.retrieve(plan.stripeProductId);
            console.log(`[Sync] Produit Stripe trouvé pour plan ${plan.name}`);
          } catch {
            stripeProduct = null;
          }
        }

        // Créer le produit si nécessaire
        if (!stripeProduct) {
          stripeProduct = await stripe.products.create({
            name: plan.name,
            description: plan.description || `Plan ${plan.name}`,
            metadata: { planId: plan.id.toString() },
          });
          console.log(`[Sync] Produit Stripe créé pour plan ${plan.name}`);
        }

        // Créer/mettre à jour les prix (mensuel et annuel)
        const priceUpdates = {};

        // Prix mensuel
        if (plan.priceMonthly > 0) {
          const existingMonthlyPrice = plan.stripePriceIdMonthly
            ? await stripe.prices.retrieve(plan.stripePriceIdMonthly).catch(() => null)
            : null;

          if (!existingMonthlyPrice || existingMonthlyPrice.unit_amount !== Math.round(plan.priceMonthly * 100)) {
            // Archiver l'ancien prix s'il existe et que le montant a changé
            if (existingMonthlyPrice && existingMonthlyPrice.unit_amount !== Math.round(plan.priceMonthly * 100)) {
              await stripe.prices.update(plan.stripePriceIdMonthly, { active: false });
              console.log(`[Sync] Ancien prix mensuel archivé pour plan ${plan.name}`);
            }

            const monthlyPrice = await stripe.prices.create({
              product: stripeProduct.id,
              currency: plan.priceCurrency || 'eur',
              unit_amount: Math.round(plan.priceMonthly * 100),
              recurring: { interval: 'month' },
              metadata: { planId: plan.id.toString(), period: 'monthly' },
            });
            priceUpdates.stripePriceIdMonthly = monthlyPrice.id;
          }
        }

        // Prix annuel
        if (plan.priceYearly > 0) {
          const existingYearlyPrice = plan.stripePriceIdYearly
            ? await stripe.prices.retrieve(plan.stripePriceIdYearly).catch(() => null)
            : null;

          if (!existingYearlyPrice || existingYearlyPrice.unit_amount !== Math.round(plan.priceYearly * 100)) {
            // Archiver l'ancien prix s'il existe et que le montant a changé
            if (existingYearlyPrice && existingYearlyPrice.unit_amount !== Math.round(plan.priceYearly * 100)) {
              await stripe.prices.update(plan.stripePriceIdYearly, { active: false });
              console.log(`[Sync] Ancien prix annuel archivé pour plan ${plan.name}`);
            }

            const yearlyPrice = await stripe.prices.create({
              product: stripeProduct.id,
              currency: plan.priceCurrency || 'eur',
              unit_amount: Math.round(plan.priceYearly * 100),
              recurring: { interval: 'year' },
              metadata: { planId: plan.id.toString(), period: 'yearly' },
            });
            priceUpdates.stripePriceIdYearly = yearlyPrice.id;
          }
        }

        // Mettre à jour la BDD
        await prisma.subscriptionPlan.update({
          where: { id: plan.id },
          data: {
            stripeProductId: stripeProduct.id,
            ...priceUpdates,
          },
        });

        if (Object.keys(priceUpdates).length > 0) {
          results.plans.updated++;
        } else if (!plan.stripeProductId) {
          results.plans.created++;
        } else {
          results.plans.skipped++;
        }

      } catch (error) {
        console.error(`[Sync] Erreur pour plan ${plan.name}:`, error);
        results.plans.errors.push({ planName: plan.name, error: error.message });
      }
    }

    // Synchroniser les packs de crédits
    const packs = await prisma.creditPack.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    for (const pack of packs) {
      try {
        let stripeProduct;

        // Vérifier si le produit existe
        if (pack.stripeProductId) {
          try {
            stripeProduct = await stripe.products.retrieve(pack.stripeProductId);
            console.log(`[Sync] Produit Stripe trouvé pour pack ${pack.name}`);
          } catch {
            stripeProduct = null;
          }
        }

        // Créer le produit si nécessaire
        if (!stripeProduct) {
          stripeProduct = await stripe.products.create({
            name: pack.name,
            description: pack.description || `${pack.creditAmount} crédits`,
            metadata: { packId: pack.id.toString(), creditAmount: pack.creditAmount.toString() },
          });
          console.log(`[Sync] Produit Stripe créé pour pack ${pack.name}`);
        }

        // Créer/mettre à jour le prix
        const existingPrice = pack.stripePriceId
          ? await stripe.prices.retrieve(pack.stripePriceId).catch(() => null)
          : null;

        let priceId = pack.stripePriceId;
        const oldPriceId = pack.stripePriceId;

        if (!existingPrice || existingPrice.unit_amount !== Math.round(pack.price * 100)) {
          // 1. Créer le nouveau prix
          const price = await stripe.prices.create({
            product: stripeProduct.id,
            currency: pack.priceCurrency || 'eur',
            unit_amount: Math.round(pack.price * 100),
            metadata: { packId: pack.id.toString(), creditAmount: pack.creditAmount.toString() },
          });
          priceId = price.id;

          // 2. Définir le nouveau prix comme default_price sur le produit (libère l'ancien)
          await stripe.products.update(stripeProduct.id, {
            default_price: priceId,
          });
          console.log(`[Sync] Prix défini comme default_price pour pack ${pack.name}`);

          // 3. Archiver l'ancien prix maintenant qu'il n'est plus le default_price
          if (existingPrice && oldPriceId && existingPrice.unit_amount !== Math.round(pack.price * 100)) {
            await stripe.prices.update(oldPriceId, { active: false });
            console.log(`[Sync] Ancien prix archivé pour pack ${pack.name}`);
          }
        }

        // Mettre à jour la BDD
        await prisma.creditPack.update({
          where: { id: pack.id },
          data: {
            stripeProductId: stripeProduct.id,
            stripePriceId: priceId,
          },
        });

        if (priceId !== pack.stripePriceId) {
          results.packs.updated++;
        } else if (!pack.stripeProductId) {
          results.packs.created++;
        } else {
          results.packs.skipped++;
        }

      } catch (error) {
        console.error(`[Sync] Erreur pour pack ${pack.name}:`, error);
        results.packs.errors.push({ packName: pack.name, error: error.message });
      }
    }

    console.log('[Sync] Synchronisation terminée:', results);

    return {
      success: true,
      results,
      message: `Synchronisation réussie : ${results.plans.created + results.plans.updated} plans, ${results.packs.created + results.packs.updated} packs`,
    };

  } catch (error) {
    console.error('[Sync Stripe] Erreur:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
