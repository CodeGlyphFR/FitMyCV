#!/usr/bin/env node
/**
 * Comprehensive Stripe synchronization for staging/pre-production
 *
 * Phase 1: Sync Products & Prices (Live → Test)
 * Phase 2: Update DB (SubscriptionPlan + CreditPack) from Stripe Test
 * Phase 3: Sync Coupons (Live → Test)
 * Phase 4: Sync Promotion Codes (Live → Test)
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      - Stripe TEST mode secret key (from staging .env)
 *   DATABASE_URL           - Staging database connection string
 * Optional:
 *   STRIPE_LIVE_SECRET_KEY - Stripe LIVE mode secret key (for full sync)
 */

const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

async function syncStaging() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY is required');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required');
    process.exit(1);
  }

  const stripeTest = new Stripe(process.env.STRIPE_SECRET_KEY);
  const stripeLive = process.env.STRIPE_LIVE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_LIVE_SECRET_KEY)
    : null;

  const prisma = new PrismaClient();
  const stats = { products: 0, prices: 0, plans: 0, packs: 0, coupons: 0, promos: 0, errors: [] };

  try {
    // ============================================
    // Phase 1: Sync Products & Prices (Live → Test)
    // ============================================
    if (stripeLive) {
      console.log('\n🔄 --- Phase 1: Syncing Products & Prices (Live → Test) ---\n');

      const liveProducts = await stripeLive.products.list({ active: true, limit: 100 });
      const testProducts = await stripeTest.products.list({ active: true, limit: 100 });
      const testProductsByName = new Map(testProducts.data.map((p) => [p.name, p]));

      for (const liveProd of liveProducts.data) {
        let testProd = testProductsByName.get(liveProd.name);

        if (!testProd) {
          testProd = await stripeTest.products.create({
            name: liveProd.name,
            ...(liveProd.description && { description: liveProd.description }),
          });
          console.log(`  ✅ Product created: ${liveProd.name}`);
          stats.products++;
        } else {
          console.log(`  ⏭️  Product exists: ${liveProd.name}`);
        }

        // Sync prices for this product
        const livePrices = await stripeLive.prices.list({
          product: liveProd.id,
          active: true,
          limit: 100,
        });
        const testPrices = await stripeTest.prices.list({
          product: testProd.id,
          active: true,
          limit: 100,
        });

        for (const livePrice of livePrices.data) {
          // Match by: amount + currency + type + interval
          const exists = testPrices.data.some(
            (tp) =>
              tp.unit_amount === livePrice.unit_amount &&
              tp.currency === livePrice.currency &&
              tp.type === livePrice.type &&
              (livePrice.type !== 'recurring' ||
                tp.recurring?.interval === livePrice.recurring?.interval)
          );

          if (!exists) {
            const params = {
              product: testProd.id,
              currency: livePrice.currency,
              unit_amount: livePrice.unit_amount,
            };
            if (livePrice.type === 'recurring') {
              params.recurring = {
                interval: livePrice.recurring.interval,
                interval_count: livePrice.recurring.interval_count,
              };
            }
            await stripeTest.prices.create(params);
            const label =
              livePrice.type === 'recurring'
                ? `${livePrice.recurring.interval}ly`
                : 'one_time';
            console.log(
              `    ✅ Price: ${livePrice.unit_amount / 100} ${livePrice.currency.toUpperCase()} (${label})`
            );
            stats.prices++;
          }
        }
      }
    } else {
      console.log('\n⚠️  STRIPE_LIVE_SECRET_KEY not set — skipping Live → Test product sync');
    }

    // ============================================
    // Phase 2: Update DB from Stripe Test
    // ============================================
    console.log('\n📦 --- Phase 2: Updating DB from Stripe Test ---\n');

    const dbPlans = await prisma.subscriptionPlan.findMany({ select: { name: true } });
    const dbPacks = await prisma.creditPack.findMany({ select: { name: true } });
    const dbNames = new Set([...dbPlans.map((p) => p.name), ...dbPacks.map((p) => p.name)]);

    console.log(`  DB SubscriptionPlan names: [${dbPlans.map((p) => `"${p.name}"`).join(', ')}]`);
    console.log(`  DB CreditPack names: [${dbPacks.map((p) => `"${p.name}"`).join(', ')}]`);

    // Fetch products from Test and match against DB names
    const testProducts = await stripeTest.products.list({ active: true, limit: 100 });
    const matched = new Map();
    for (const product of testProducts.data) {
      // Keep only the first (newest) product per name
      if (dbNames.has(product.name) && !matched.has(product.name)) {
        matched.set(product.name, product);
      }
    }

    console.log(
      `  Matched Stripe products: [${[...matched.keys()].map((n) => `"${n}"`).join(', ')}]`
    );
    console.log('');

    // For each matched product, fetch its prices and update DB
    for (const [name, product] of matched) {
      const productPrices = await stripeTest.prices.list({
        product: product.id,
        active: true,
        limit: 100,
      });

      let monthly = null;
      let yearly = null;
      let oneTime = null;

      for (const price of productPrices.data) {
        if (price.type === 'recurring') {
          if (price.recurring.interval === 'month' && !monthly) monthly = price.id;
          else if (price.recurring.interval === 'year' && !yearly) yearly = price.id;
        } else if (price.type === 'one_time' && !oneTime) {
          oneTime = price.id;
        }
      }

      // Update SubscriptionPlan (recurring prices)
      if (monthly || yearly) {
        try {
          const result = await prisma.subscriptionPlan.updateMany({
            where: { name },
            data: {
              stripeProductId: product.id,
              ...(monthly && { stripePriceIdMonthly: monthly }),
              ...(yearly && { stripePriceIdYearly: yearly }),
            },
          });
          if (result.count > 0) {
            console.log(
              `  ✅ Plan: ${name} (monthly: ${monthly || '—'}, yearly: ${yearly || '—'})`
            );
            stats.plans++;
          }
        } catch (err) {
          console.error(`  ❌ Plan ${name}: ${err.message}`);
          stats.errors.push(`plan:${name}`);
        }
      }

      // Update CreditPack (one-time price)
      if (oneTime) {
        try {
          const result = await prisma.creditPack.updateMany({
            where: { name },
            data: {
              stripeProductId: product.id,
              stripePriceId: oneTime,
            },
          });
          if (result.count > 0) {
            console.log(`  ✅ CreditPack: ${name} → ${oneTime}`);
            stats.packs++;
          }
        } catch (err) {
          console.error(`  ❌ CreditPack ${name}: ${err.message}`);
          stats.errors.push(`pack:${name}`);
        }
      }
    }

    // Warn about DB names not found in Stripe
    for (const plan of dbPlans) {
      if (plan.name !== 'Gratuit' && !matched.has(plan.name)) {
        console.log(`  ⚠️  Plan "${plan.name}" not found in Stripe Test`);
      }
    }
    for (const pack of dbPacks) {
      if (!matched.has(pack.name)) {
        console.log(`  ⚠️  CreditPack "${pack.name}" not found in Stripe Test`);
      }
    }

    // ============================================
    // Phase 3: Sync Coupons (Live → Test)
    // ============================================
    if (stripeLive) {
      console.log('\n🎫 --- Phase 3: Syncing Coupons (Live → Test) ---\n');

      const liveCoupons = await stripeLive.coupons.list({ limit: 100 });
      const testCoupons = await stripeTest.coupons.list({ limit: 100 });
      const testCouponIds = new Set(testCoupons.data.map((c) => c.id));

      for (const coupon of liveCoupons.data) {
        try {
          if (!testCouponIds.has(coupon.id)) {
            const params = {
              id: coupon.id,
              duration: coupon.duration,
            };
            if (coupon.name) params.name = coupon.name;
            if (coupon.percent_off) params.percent_off = coupon.percent_off;
            if (coupon.amount_off != null) {
              params.amount_off = coupon.amount_off;
              params.currency = coupon.currency;
            }
            if (coupon.duration_in_months) params.duration_in_months = coupon.duration_in_months;
            if (coupon.max_redemptions) params.max_redemptions = coupon.max_redemptions;

            await stripeTest.coupons.create(params);
            console.log(`  ✅ Coupon created: ${coupon.id} (${coupon.name || 'unnamed'})`);
            stats.coupons++;
          } else {
            console.log(`  ⏭️  Coupon exists: ${coupon.id}`);
          }
        } catch (err) {
          console.error(`  ❌ Coupon ${coupon.id}: ${err.message}`);
          stats.errors.push(`coupon:${coupon.id}`);
        }
      }

      // ============================================
      // Phase 4: Sync Promotion Codes (Live → Test)
      // ============================================
      console.log('\n🏷️  --- Phase 4: Syncing Promotion Codes (Live → Test) ---\n');

      const allLivePromos = await stripeLive.promotionCodes.list({ limit: 100 });
      const allTestPromos = await stripeTest.promotionCodes.list({ limit: 100 });

      // Helper: extract coupon ID (handles old + new Stripe API)
      // Old API: promo.coupon = string | { id }
      // New API (Clover 2025-09-30+): promo.promotion = { type: 'coupon', coupon: string | { id } }
      const getCouponId = (promo) => {
        if (promo.promotion?.coupon) {
          const c = promo.promotion.coupon;
          return typeof c === 'string' ? c : c?.id || null;
        }
        if (typeof promo.coupon === 'string') return promo.coupon;
        return promo.coupon?.id || null;
      };

      console.log(`  Found ${allLivePromos.data.length} promo codes in Live:`);
      for (const p of allLivePromos.data) {
        console.log(`    - code: "${p.code}" | coupon: ${getCouponId(p)} | active: ${p.active}`);
      }
      console.log(`  Found ${allTestPromos.data.length} promo codes in Test`);
      console.log('');

      // Refresh test coupons (includes newly created ones from Phase 3)
      const updatedTestCoupons = await stripeTest.coupons.list({ limit: 100 });
      const availableTestCouponIds = new Set(updatedTestCoupons.data.map((c) => c.id));

      for (const coupon of liveCoupons.data) {
        if (!availableTestCouponIds.has(coupon.id)) continue;

        try {
          const liveCouponPromos = allLivePromos.data.filter(
            (p) => getCouponId(p) === coupon.id
          );
          const testCouponPromos = allTestPromos.data.filter(
            (p) => getCouponId(p) === coupon.id
          );
          const testPromoCodes = new Set(testCouponPromos.map((p) => p.code));

          for (const promo of liveCouponPromos) {
            if (!testPromoCodes.has(promo.code)) {
              const params = {
                promotion: { type: 'coupon', coupon: coupon.id },
                code: promo.code,
                active: promo.active,
              };
              if (promo.max_redemptions) params.max_redemptions = promo.max_redemptions;
              if (promo.restrictions?.first_time_transaction) {
                params.restrictions = { first_time_transaction: true };
              }

              await stripeTest.promotionCodes.create(params);
              console.log(`  ✅ Promo: ${promo.code}`);
              stats.promos++;
            } else {
              console.log(`  ⏭️  Promo exists: ${promo.code}`);
            }
          }
        } catch (err) {
          console.error(`  ❌ Promos for ${coupon.id}: ${err.message}`);
          stats.errors.push(`promo:${coupon.id}`);
        }
      }
    } else {
      console.log('\n⚠️  STRIPE_LIVE_SECRET_KEY not set — skipping coupon/promo sync');
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Sync Summary:');
    console.log(`   Products:       ${stats.products}`);
    console.log(`   Prices:         ${stats.prices}`);
    console.log(`   Plans (DB):     ${stats.plans}`);
    console.log(`   Credit Packs:   ${stats.packs}`);
    console.log(`   Coupons:        ${stats.coupons}`);
    console.log(`   Promo Codes:    ${stats.promos}`);
    if (stats.errors.length > 0) {
      console.log(`   Errors:         ${stats.errors.length} (${stats.errors.join(', ')})`);
    }
    console.log('═'.repeat(50) + '\n');
  } catch (err) {
    console.error('❌ Fatal Sync Error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

syncStaging();
