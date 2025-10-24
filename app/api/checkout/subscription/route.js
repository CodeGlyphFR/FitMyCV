/**
 * POST /api/checkout/subscription
 * Créer une session de checkout Stripe pour un abonnement
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { planId, billingPeriod = 'monthly' } = body;

    // Validation
    if (!planId || typeof planId !== 'number') {
      return NextResponse.json(
        { error: 'planId requis' },
        { status: 400 }
      );
    }

    if (!['monthly', 'yearly'].includes(billingPeriod)) {
      return NextResponse.json(
        { error: 'billingPeriod invalide (monthly ou yearly)' },
        { status: 400 }
      );
    }

    // Récupérer le plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan introuvable' },
        { status: 404 }
      );
    }

    // Vérifier que le plan a un prix configuré
    const stripePriceId = billingPeriod === 'monthly'
      ? plan.stripePriceIdMonthly
      : plan.stripePriceIdYearly;

    if (!stripePriceId) {
      return NextResponse.json(
        { error: `Pas de prix ${billingPeriod} configuré pour ce plan` },
        { status: 400 }
      );
    }

    // Récupérer ou créer le customer Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    let stripeCustomerId = user?.stripeCustomerId;

    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      // Créer un nouveau customer Stripe
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId,
        },
      });

      stripeCustomerId = customer.id;

      // Mettre à jour la BDD
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // Créer la session de checkout
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?canceled=true`,
      metadata: {
        userId,
        planId: planId.toString(),
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          userId,
          planId: planId.toString(),
        },
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

  } catch (error) {
    console.error('[Checkout Subscription] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de la session' },
      { status: 500 }
    );
  }
}
