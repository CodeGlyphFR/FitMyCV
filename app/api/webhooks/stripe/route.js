/**
 * POST /api/webhooks/stripe
 * Handler unifié pour tous les webhooks Stripe
 *
 * Events gérés :
 * - customer.subscription.created/updated/deleted
 * - payment_intent.succeeded (achat crédits)
 * - invoice.payment_failed (échec paiement abonnement)
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { grantCredits } from '@/lib/subscription/credits';
import { changeSubscription, cancelSubscription } from '@/lib/subscription/subscriptions';

// Désactiver le parsing du body par Next.js (requis pour webhooks Stripe)
export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('[Webhook] Signature manquante');
    return NextResponse.json(
      { error: 'Signature manquante' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET === 'whsec_TODO') {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET non configuré');
    return NextResponse.json(
      { error: 'Webhook secret non configuré' },
      { status: 500 }
    );
  }

  let event;

  try {
    // Vérifier la signature Stripe
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('[Webhook] Signature invalide:', error.message);
    return NextResponse.json(
      { error: `Webhook signature invalide: ${error.message}` },
      { status: 400 }
    );
  }

  // Logger l'event
  try {
    await prisma.stripeWebhookLog.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        payload: JSON.stringify(event),
        processed: false,
      },
    });
  } catch (logError) {
    console.error('[Webhook] Erreur lors du logging:', logError);
  }

  console.log(`[Webhook] Reçu: ${event.type} (${event.id})`);

  try {
    // Router selon le type d'event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[Webhook] Event non géré: ${event.type}`);
    }

    // Marquer l'event comme traité
    await prisma.stripeWebhookLog.updateMany({
      where: { eventId: event.id },
      data: { processed: true },
    });

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error(`[Webhook] Erreur traitement ${event.type}:`, error);

    // Logger l'erreur
    await prisma.stripeWebhookLog.updateMany({
      where: { eventId: event.id },
      data: {
        processed: false,
        error: error.message,
      },
    });

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Gère la création/mise à jour d'un abonnement
 */
async function handleSubscriptionUpdate(subscriptionData) {
  const userId = subscriptionData.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans metadata subscription');
    return;
  }

  const planId = parseInt(subscriptionData.metadata?.planId, 10);

  if (!planId) {
    console.error('[Webhook] planId manquant dans metadata subscription');
    return;
  }

  // Récupérer l'objet subscription complet depuis Stripe API
  // car le webhook peut envoyer des données incomplètes
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionData.id);
  } catch (error) {
    console.error('[Webhook] Erreur récupération subscription:', error);
    subscription = subscriptionData; // Fallback sur les données du webhook
  }

  // Déterminer la période de facturation
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  const billingPeriod = interval === 'year' ? 'yearly' : 'monthly';

  // Vérifier les dates
  if (!subscription.current_period_start || !subscription.current_period_end) {
    console.error('[Webhook] Dates de période manquantes dans subscription');
    console.error('[Webhook] Subscription ID:', subscription.id);
    return;
  }

  // Convertir les timestamps Unix (secondes) en dates JavaScript (millisecondes)
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  // Mettre à jour ou créer l'abonnement
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (existingSubscription) {
    // Mise à jour
    await prisma.subscription.update({
      where: { userId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price?.id,
        planId,
        status: subscription.status,
        billingPeriod,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      },
    });
  } else {
    // Création
    await prisma.subscription.create({
      data: {
        userId,
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price?.id,
        planId,
        status: subscription.status,
        billingPeriod,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      },
    });
  }

  console.log(`[Webhook] Abonnement ${subscription.status} pour user ${userId}`);
}

/**
 * Gère la suppression d'un abonnement
 */
async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans metadata subscription');
    return;
  }

  // Annuler l'abonnement (downgrade vers Gratuit)
  await cancelSubscription(userId, true);

  console.log(`[Webhook] Abonnement supprimé pour user ${userId}, downgrade vers Gratuit`);
}

/**
 * Gère le succès d'un paiement (achat de crédits)
 */
async function handlePaymentSuccess(paymentIntent) {
  // Vérifier si c'est un achat de crédits (pas un abonnement)
  if (paymentIntent.metadata?.type !== 'credit_purchase') {
    return; // Paiement d'abonnement, géré par invoice.paid
  }

  const userId = paymentIntent.metadata?.userId;
  const creditAmount = parseInt(paymentIntent.metadata?.creditAmount, 10);

  if (!userId || !creditAmount) {
    console.error('[Webhook] Métadonnées manquantes dans payment_intent');
    return;
  }

  // Attribuer les crédits
  const result = await grantCredits(userId, creditAmount, 'purchase', {
    stripePaymentIntentId: paymentIntent.id,
    source: 'credit_pack_purchase',
  });

  if (!result.success) {
    console.error('[Webhook] Erreur attribution crédits:', result.error);
    return;
  }

  console.log(`[Webhook] ${creditAmount} crédits attribués à user ${userId}`);

  // TODO: Envoyer email de confirmation via Resend
}

/**
 * Gère l'échec de paiement d'une facture (abonnement)
 */
async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return; // Pas un paiement d'abonnement
  }

  // Récupérer l'abonnement Stripe pour avoir le userId
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans metadata subscription');
    return;
  }

  // Downgrade immédiat vers plan Gratuit (selon règles métier)
  await cancelSubscription(userId, true);

  console.log(`[Webhook] Échec paiement pour user ${userId}, downgrade immédiat vers Gratuit`);

  // TODO: Envoyer email notification échec paiement via Resend
}
