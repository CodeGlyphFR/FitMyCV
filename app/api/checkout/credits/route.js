/**
 * POST /api/checkout/credits
 * Créer une session de checkout Stripe pour un pack de crédits
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { CommonErrors, SubscriptionErrors } from '@/lib/api/apiErrors';
import { getTermsMessage } from '@/lib/stripe/checkoutLocale';

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const userId = session.user.id;
    const body = await request.json();
    const { packId, locale = 'fr' } = body;

    // Validation
    if (!packId || typeof packId !== 'number') {
      return SubscriptionErrors.packRequired();
    }

    // Récupérer le pack
    const pack = await prisma.creditPack.findUnique({
      where: { id: packId },
    });

    if (!pack || !pack.isActive || !pack.stripePriceId) {
      return SubscriptionErrors.invalidPlan();
    }

    // Récupérer ou créer le customer Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    let stripeCustomerId = user?.stripeCustomerId;

    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      // Créer un nouveau customer Stripe
      const customerParams = {
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId,
        },
      };

      // Appliquer le modèle de rendu de facture si configuré
      if (process.env.STRIPE_INVOICE_TEMPLATE_ID) {
        customerParams.invoice_settings = {
          rendering_options: {
            template: process.env.STRIPE_INVOICE_TEMPLATE_ID,
          },
        };
      }

      let customer;
      try {
        customer = await stripe.customers.create(customerParams);
      } catch (templateError) {
        if (process.env.STRIPE_INVOICE_TEMPLATE_ID) {
          console.warn(`[Checkout Credits] Template facture invalide (${process.env.STRIPE_INVOICE_TEMPLATE_ID}), création client sans template:`, templateError.message);
          delete customerParams.invoice_settings;
          customer = await stripe.customers.create(customerParams);
        } else {
          throw templateError;
        }
      }

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
      customer_update: { address: 'auto' },
      mode: 'payment', // Paiement unique (pas abonnement)
      automatic_tax: { enabled: true },
      billing_address_collection: 'required',
      allow_promotion_codes: true, // Permettre les codes promo
      consent_collection: {
        terms_of_service: 'required', // Acceptation obligatoire des CGV
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: getTermsMessage(locale),
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
    return SubscriptionErrors.checkoutError();
  }
}
