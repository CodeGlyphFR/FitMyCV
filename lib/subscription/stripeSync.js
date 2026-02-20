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
 * @param {Object} options - Options de synchronisation
 * @param {boolean} options.quiet - Si true, supprime les logs (défaut: false)
 * @returns {Promise<{success: boolean, results: object, message: string}>}
 */
export async function syncStripeProductsInternal({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
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
        // IMPORTANT: Les plans gratuits ne doivent PAS être synchronisés avec Stripe
        // Ils restent uniquement en local dans notre base de données
        if (plan.isFree) {
          log(`[Sync] Plan gratuit détecté: ${plan.name} - Pas de synchronisation Stripe nécessaire`);
          results.plans.skipped++;
          continue;
        }

        let stripeProduct;

        // Vérifier si le produit existe
        if (plan.stripeProductId) {
          try {
            stripeProduct = await stripe.products.retrieve(plan.stripeProductId);
            log(`[Sync] Produit Stripe trouvé pour plan ${plan.name}`);
          } catch {
            stripeProduct = null;
          }
        }

        // Créer le produit si nécessaire
        if (!stripeProduct) {
          stripeProduct = await stripe.products.create({
            name: plan.name,
            description: plan.description || `Plan ${plan.name}`,
            tax_code: 'txcd_1.1.5.01', // SaaS - Services fournis par voie électronique
            metadata: { planId: plan.id.toString() },
          });
          log(`[Sync] Produit Stripe créé pour plan ${plan.name}`);
        } else {
          // Mettre à jour le nom, la description et le tax_code si nécessaire
          const expectedDescription = plan.description || `Plan ${plan.name}`;
          if (stripeProduct.name !== plan.name || stripeProduct.description !== expectedDescription || stripeProduct.tax_code !== 'txcd_1.1.5.01') {
            stripeProduct = await stripe.products.update(stripeProduct.id, {
              name: plan.name,
              description: expectedDescription,
              tax_code: 'txcd_1.1.5.01',
              metadata: { planId: plan.id.toString() },
            });
            log(`[Sync] Produit Stripe mis à jour pour plan ${plan.name}`);
          }
        }

        // Créer/mettre à jour les prix (mensuel et annuel)
        const priceUpdates = {};

        // Prix mensuel
        if (plan.priceMonthly > 0) {
          const existingMonthlyPrice = plan.stripePriceIdMonthly
            ? await stripe.prices.retrieve(plan.stripePriceIdMonthly).catch(() => null)
            : null;

          const needsMonthlyRecreate = !existingMonthlyPrice
            || existingMonthlyPrice.unit_amount !== Math.round(plan.priceMonthly * 100)
            || existingMonthlyPrice.tax_behavior !== 'exclusive';

          if (needsMonthlyRecreate) {
            // Archiver l'ancien prix s'il existe
            if (existingMonthlyPrice && plan.stripePriceIdMonthly) {
              await stripe.prices.update(plan.stripePriceIdMonthly, { active: false });
              log(`[Sync] Ancien prix mensuel archivé pour plan ${plan.name}`);
            }

            const monthlyPrice = await stripe.prices.create({
              product: stripeProduct.id,
              currency: plan.priceCurrency || 'eur',
              unit_amount: Math.round(plan.priceMonthly * 100),
              tax_behavior: 'exclusive',
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

          const needsYearlyRecreate = !existingYearlyPrice
            || existingYearlyPrice.unit_amount !== Math.round(plan.priceYearly * 100)
            || existingYearlyPrice.tax_behavior !== 'exclusive';

          if (needsYearlyRecreate) {
            // Archiver l'ancien prix s'il existe
            if (existingYearlyPrice && plan.stripePriceIdYearly) {
              await stripe.prices.update(plan.stripePriceIdYearly, { active: false });
              log(`[Sync] Ancien prix annuel archivé pour plan ${plan.name}`);
            }

            const yearlyPrice = await stripe.prices.create({
              product: stripeProduct.id,
              currency: plan.priceCurrency || 'eur',
              unit_amount: Math.round(plan.priceYearly * 100),
              tax_behavior: 'exclusive',
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
            log(`[Sync] Produit Stripe trouvé pour pack ${pack.name}`);
          } catch {
            stripeProduct = null;
          }
        }

        // Créer le produit si nécessaire
        if (!stripeProduct) {
          stripeProduct = await stripe.products.create({
            name: pack.name,
            description: pack.description || `${pack.creditAmount} crédits`,
            tax_code: 'txcd_1.1.5.01', // SaaS - Services fournis par voie électronique
            metadata: { packId: pack.id.toString(), creditAmount: pack.creditAmount.toString() },
          });
          log(`[Sync] Produit Stripe créé pour pack ${pack.name}`);
        } else {
          // Mettre à jour le nom, la description et le tax_code si nécessaire
          const expectedDescription = pack.description || `${pack.creditAmount} crédits`;
          if (stripeProduct.name !== pack.name || stripeProduct.description !== expectedDescription || stripeProduct.tax_code !== 'txcd_1.1.5.01') {
            stripeProduct = await stripe.products.update(stripeProduct.id, {
              name: pack.name,
              description: expectedDescription,
              tax_code: 'txcd_1.1.5.01',
              metadata: { packId: pack.id.toString(), creditAmount: pack.creditAmount.toString() },
            });
            log(`[Sync] Produit Stripe mis à jour pour pack ${pack.name}`);
          }
        }

        // Créer/mettre à jour le prix
        const existingPrice = pack.stripePriceId
          ? await stripe.prices.retrieve(pack.stripePriceId).catch(() => null)
          : null;

        let priceId = pack.stripePriceId;
        const oldPriceId = pack.stripePriceId;

        const needsPackPriceRecreate = !existingPrice
          || existingPrice.unit_amount !== Math.round(pack.price * 100)
          || existingPrice.tax_behavior !== 'exclusive';

        if (needsPackPriceRecreate) {
          // 1. Créer le nouveau prix
          const price = await stripe.prices.create({
            product: stripeProduct.id,
            currency: pack.priceCurrency || 'eur',
            unit_amount: Math.round(pack.price * 100),
            tax_behavior: 'exclusive',
            metadata: { packId: pack.id.toString(), creditAmount: pack.creditAmount.toString() },
          });
          priceId = price.id;

          // 2. Définir le nouveau prix comme default_price sur le produit (libère l'ancien)
          await stripe.products.update(stripeProduct.id, {
            default_price: priceId,
          });
          log(`[Sync] Prix défini comme default_price pour pack ${pack.name}`);

          // 3. Archiver l'ancien prix maintenant qu'il n'est plus le default_price
          if (existingPrice && oldPriceId) {
            await stripe.prices.update(oldPriceId, { active: false });
            log(`[Sync] Ancien prix archivé pour pack ${pack.name}`);
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

    log('[Sync] Synchronisation terminée:', results);

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
