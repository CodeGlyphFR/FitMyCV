import stripe from '@/lib/stripe';
import { NextResponse } from 'next/server';

const INACTIVE = { active: false };

export async function GET() {
  const promoId = process.env.STRIPE_PROMO_ID;
  if (!promoId) {
    return NextResponse.json(INACTIVE);
  }

  try {
    const promo = await stripe.promotionCodes.retrieve(promoId);

    const coupon = promo.coupon;
    const max = promo.max_redemptions ?? null;
    const used = promo.times_redeemed ?? 0;
    const remaining = max !== null ? max - used : null;

    const isActive =
      promo.active === true &&
      !coupon.deleted &&
      (max === null || remaining > 0);

    return NextResponse.json(
      {
        active: isActive,
        code: promo.code,
        percentOff: coupon.percent_off ?? null,
        amountOff: coupon.amount_off ?? null,
        remaining,
        max,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    console.error('[promo/status] Error fetching promo code:', error.message);
    return NextResponse.json(INACTIVE);
  }
}
