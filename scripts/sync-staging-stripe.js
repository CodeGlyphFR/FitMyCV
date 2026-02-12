#!/usr/bin/env node
/**
 * Comprehensive Stripe synchronization for staging/pre-production
 *
 * Syncs: Products & Prices (subscriptions + credit packs), Coupons, Promotion Codes
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      - Stripe TEST mode secret key (from staging .env)
 *   DATABASE_URL           - Staging database connection string
 * Optional:
 *   STRIPE_LIVE_SECRET_KEY - Stripe LIVE mode secret key (for coupon/promo sync)
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
  const stats = { plans: 0, packs: 0, coupons: 0, promos: 0, errors: [] };

  try {
    // ============================================
    // 1. Sync Products & Prices from Stripe Test
    // ============================================
    console.log('\n📦 --- Syncing Products & Prices ---\n');

    const prices = await stripeTest.prices.list({
      expand: ['data.product'],
      active: true,
      limit: 100,
    });

    // Group prices by product
    const productMap = {};
    for (const price of prices.data) {
      const productName = price.product.name;
      if (!productMap[productName]) {
        productMap[productName] = { productId: price.product.id };
      }

      if (price.type === 'recurring') {
        if (price.recurring.interval === 'month') {
          productMap[productName].monthly = price.id;
        } else if (price.recurring.interval === 'year') {
          productMap[productName].yearly = price.id;
        }
      } else if (price.type === 'one_time') {
        productMap[productName].oneTime = price.id;
      }
    }

    // Update SubscriptionPlan table (monthly + yearly prices)
    for (const [name, data] of Object.entries(productMap)) {
      if (data.monthly || data.yearly) {
        try {
          const result = await prisma.subscriptionPlan.updateMany({
            where: { name },
            data: {
              stripeProductId: data.productId,
              ...(data.monthly && { stripePriceIdMonthly: data.monthly }),
              ...(data.yearly && { stripePriceIdYearly: data.yearly }),
            },
          });
          if (result.count > 0) {
            console.log(`  ✅ Plan: ${name} (monthly: ${data.monthly || '—'}, yearly: ${data.yearly || '—'})`);
            stats.plans++;
          }
        } catch (err) {
          console.error(`  ❌ Plan ${name}: ${err.message}`);
          stats.errors.push(`plan:${name}`);
        }
      }
    }

    // Update CreditPack table (one-time prices)
    console.log('');
    for (const [name, data] of Object.entries(productMap)) {
      if (data.oneTime) {
        try {
          const result = await prisma.creditPack.updateMany({
            where: { name },
            data: {
              stripeProductId: data.productId,
              stripePriceId: data.oneTime,
            },
          });
          if (result.count > 0) {
            console.log(`  ✅ CreditPack: ${name} → ${data.oneTime}`);
            stats.packs++;
          }
        } catch (err) {
          console.error(`  ❌ CreditPack ${name}: ${err.message}`);
          stats.errors.push(`pack:${name}`);
        }
      }
    }

    // ============================================
    // 2. Sync Coupons & Promotion Codes (Live → Test)
    // ============================================
    if (stripeLive) {
      console.log('\n🎫 --- Syncing Coupons (Live → Test) ---\n');

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

      // Sync Promotion Codes
      console.log('\n🏷️  --- Syncing Promotion Codes (Live → Test) ---\n');

      // Refresh test coupons list (includes newly created ones)
      const updatedTestCoupons = await stripeTest.coupons.list({ limit: 100 });
      const availableTestCouponIds = new Set(updatedTestCoupons.data.map((c) => c.id));

      for (const coupon of liveCoupons.data) {
        if (!availableTestCouponIds.has(coupon.id)) continue;

        try {
          const livePromos = await stripeLive.promotionCodes.list({
            coupon: coupon.id,
            limit: 100,
          });
          const testPromos = await stripeTest.promotionCodes.list({
            coupon: coupon.id,
            limit: 100,
          });
          const testPromoCodes = new Set(testPromos.data.map((p) => p.code));

          for (const promo of livePromos.data) {
            if (!testPromoCodes.has(promo.code)) {
              const params = {
                coupon: coupon.id,
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
    console.log(`   Plans:          ${stats.plans}`);
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
