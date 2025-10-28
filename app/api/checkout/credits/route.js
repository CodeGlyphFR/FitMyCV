/**
 * POST /api/checkout/credits
 * Créer une session de checkout Stripe pour un pack de crédits
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
    const { packId } = body;

    // Validation
    if (!packId || typeof packId !== 'number') {
      return NextResponse.json(
        { error: 'packId requis' },
        { status: 400 }
      );
    }

    // Récupérer le pack
    const pack = await prisma.creditPack.findUnique({
      where: { id: packId },
    });

    if (!pack) {
      return NextResponse.json(
        { error: 'Pack introuvable' },
        { status: 404 }
      );
    }

    if (!pack.isActive) {
      return NextResponse.json(
        { error: 'Pack non disponible' },
        { status: 400 }
      );
    }

    if (!pack.stripePriceId) {
      return NextResponse.json(
        { error: 'Prix Stripe non configuré pour ce pack' },
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
      mode: 'payment', // Paiement unique (pas abonnement)
      billing_address_collection: 'required',
      allow_promotion_codes: true, // Permettre les codes promo
      payment_method_types: ['card'],
      consent_collection: {
        terms_of_service: 'required', // Acceptation obligatoire des CGV
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: `J'accepte les [Conditions Générales de Vente](${process.env.NEXT_PUBLIC_SITE_URL}/terms).`,
        },
      },
      line_items: [
        {
          price: pack.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?credits_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?credits_canceled=true`,
      metadata: {
        userId,
        packId: packId.toString(),
        creditAmount: pack.creditAmount.toString(),
        type: 'credit_purchase',
      },
      payment_intent_data: {
        metadata: {
          userId,
          packId: packId.toString(),
          creditAmount: pack.creditAmount.toString(),
          type: 'credit_purchase',
        },
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

  } catch (error) {
    console.error('[Checkout Credits] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de la session' },
      { status: 500 }
    );
  }
}
