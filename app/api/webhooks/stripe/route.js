/**
 * POST /api/webhooks/stripe
 * Handler unifié pour tous les webhooks Stripe
 *
 * Events gérés :
 * - customer.subscription.created/updated/deleted (abonnements)
 * - checkout.session.completed (achat crédits - PRIMARY)
 * - payment_intent.succeeded (achat crédits - FALLBACK)
 * - invoice.payment_failed (échec paiement abonnement)
 *
 * Note : checkout.session.completed est privilégié pour les achats de crédits
 * car il contient toujours les métadonnées du checkout, contrairement à
 * payment_intent.succeeded qui peut avoir un metadata vide.
 *
 * Protection contre duplication :
 * - Vérification si événement déjà traité (via StripeWebhookLog)
 * - Contrainte unique sur stripePaymentIntentId (CreditTransaction)
 * - Gestion des erreurs de contrainte unique (race condition)
 *
 * Factures :
 * - Abonnements : factures générées automatiquement par Stripe
 * - Crédits : factures créées programmatiquement après paiement
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
    // Vérifier si cet événement a déjà été traité (idempotence renforcée)
    const alreadyProcessed = await prisma.stripeWebhookLog.findFirst({
      where: {
        eventId: event.id,
        processed: true,
      },
    });

    if (alreadyProcessed) {
      console.log(`[Webhook] Événement ${event.id} déjà traité, ignoré`);
      return NextResponse.json({ received: true, message: 'Already processed' });
    }

    // Router selon le type d'event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
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

  // Récupérer le stripePriceId pour identifier le plan
  const stripePriceId = subscription.items.data[0]?.price?.id;

  if (!stripePriceId) {
    console.error('[Webhook] stripePriceId manquant dans subscription');
    return;
  }

  // Trouver le plan correspondant au stripePriceId
  const priceField = billingPeriod === 'yearly' ? 'stripePriceIdYearly' : 'stripePriceIdMonthly';
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { [priceField]: stripePriceId }
  });

  if (!plan) {
    console.error('[Webhook] Plan introuvable pour stripePriceId:', stripePriceId, 'billingPeriod:', billingPeriod);
    return;
  }

  const planId = plan.id;

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
 * Crée une facture Stripe pour un achat de crédits
 * @param {object} params - {customer, amount, currency, creditAmount, userId, paymentIntentId, session}
 * @param {string} transactionId - ID de la CreditTransaction à mettre à jour
 * @returns {Promise<string|null>} - ID de la facture créée ou null en cas d'erreur
 */
async function createInvoiceForCreditPurchase({ customer, amount, currency, creditAmount, userId, paymentIntentId, session }, transactionId) {
  try {
    // Récupérer les informations de facturation depuis la Checkout Session
    // (c'est là que billing_address_collection: 'required' collecte les infos)
    const customerDetails = session.customer_details;

    console.log(`[Webhook] → Récupération des billing details depuis checkout session:`, {
      name: customerDetails?.name || 'N/A',
      email: customerDetails?.email || 'N/A',
      address: customerDetails?.address ? `${customerDetails.address.city}, ${customerDetails.address.country}` : 'N/A',
    });

    // Mettre à jour le Customer Stripe avec les informations de facturation
    // (L'Invoice récupérera automatiquement ces infos du Customer)
    if (customerDetails) {
      await stripe.customers.update(customer, {
        name: customerDetails.name || undefined,
        email: customerDetails.email || undefined,
        address: customerDetails.address || undefined,
      });
      console.log(`[Webhook] ✓ Customer ${customer} mis à jour avec les billing details`);
    }

    // Créer un draft invoice (récupère automatiquement les infos du Customer)
    const invoice = await stripe.invoices.create({
      customer: customer,
      auto_advance: false, // Ne pas envoyer automatiquement
      collection_method: 'charge_automatically',
      description: `Achat de ${creditAmount} crédits FitMyCv.ai`,
      metadata: {
        userId: userId,
        creditAmount: creditAmount.toString(),
        paymentIntentId: paymentIntentId,
        source: 'credit_pack_purchase',
      },
    });

    // Ajouter l'item à la facture
    await stripe.invoiceItems.create({
      customer: customer,
      invoice: invoice.id,
      amount: amount,
      currency: currency,
      description: `Pack de ${creditAmount} crédits`,
    });

    // Finaliser la facture (génère le PDF immédiatement)
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    console.log(`[Webhook] ✓ Facture Stripe créée: ${finalizedInvoice.id} pour PaymentIntent ${paymentIntentId}`);
    console.log(`[Webhook]   → PDF URL: ${finalizedInvoice.invoice_pdf || 'NULL - PDF non généré'}`);

    // Marquer la facture comme payée (le paiement a déjà été effectué via checkout)
    const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id, {
      paid_out_of_band: true,
    });

    console.log(`[Webhook] ✓ Facture ${paidInvoice.id} marquée comme payée (status: ${paidInvoice.status})`);

    // Mettre à jour la transaction avec l'ID de la facture
    await prisma.creditTransaction.update({
      where: { id: transactionId },
      data: { stripeInvoiceId: paidInvoice.id },
    });

    return paidInvoice.id;
  } catch (invoiceError) {
    console.error('[Webhook] Erreur lors de la création de la facture:', invoiceError);
    return null;
  }
}

/**
 * Gère la completion d'une session Checkout (achat de crédits)
 */
async function handleCheckoutCompleted(session) {
  // Vérifier si c'est un achat de crédits (paiement one-time)
  if (session.mode !== 'payment' || session.metadata?.type !== 'credit_purchase') {
    return; // Abonnement (mode: subscription), géré par customer.subscription.*
  }

  const userId = session.metadata?.userId;
  const creditAmount = parseInt(session.metadata?.creditAmount, 10);
  const paymentIntentId = session.payment_intent;

  if (!userId || !creditAmount) {
    console.error('[Webhook] Métadonnées manquantes dans checkout.session');
    return;
  }

  // Vérifier si les crédits n'ont pas déjà été attribués (idempotence)
  const existingTransaction = await prisma.creditTransaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (existingTransaction) {
    console.log(`[Webhook] ✓ Anti-duplication: crédits déjà attribués par payment_intent.succeeded pour PaymentIntent ${paymentIntentId}`);

    // Si pas de facture, la créer maintenant (cas où payment_intent.succeeded est arrivé avant)
    if (!existingTransaction.stripeInvoiceId) {
      console.log(`[Webhook] → Création de la facture Stripe avec billing details (checkout.session a accès aux infos de facturation)`);
      await createInvoiceForCreditPurchase({
        customer: session.customer,
        amount: session.amount_total,
        currency: session.currency,
        creditAmount,
        userId,
        paymentIntentId,
        session, // Passer la session pour récupérer customer_details
      }, existingTransaction.id);
    } else {
      console.log(`[Webhook] Facture déjà créée: ${existingTransaction.stripeInvoiceId}`);
    }

    return;
  }

  // Attribuer les crédits
  let result;
  try {
    result = await grantCredits(userId, creditAmount, 'purchase', {
      stripePaymentIntentId: paymentIntentId,
      source: 'credit_pack_purchase',
    });

    if (!result.success) {
      console.error('[Webhook] Erreur attribution crédits:', result.error);
      return;
    }
  } catch (error) {
    // Gérer l'erreur de contrainte unique (race condition)
    if (error.code === 'P2002' && error.meta?.target?.includes('stripePaymentIntentId')) {
      console.log(`[Webhook] Contrainte unique violation pour PaymentIntent ${paymentIntentId} (race condition détectée)`);
      return;
    }
    throw error;
  }

  console.log(`[Webhook] ${creditAmount} crédits attribués à user ${userId} (checkout.session.completed)`);

  // Créer une facture Stripe pour l'achat de crédits
  await createInvoiceForCreditPurchase({
    customer: session.customer,
    amount: session.amount_total,
    currency: session.currency,
    creditAmount,
    userId,
    paymentIntentId,
    session, // Passer la session pour récupérer customer_details
  }, result.transaction.id);

  // TODO: Envoyer email de confirmation via Resend
}

/**
 * Gère le succès d'un paiement (FALLBACK - préférer checkout.session.completed)
 */
async function handlePaymentSuccess(paymentIntent) {
  // Vérifier si c'est un achat de crédits (pas un abonnement)
  if (paymentIntent.metadata?.type !== 'credit_purchase') {
    return; // Paiement d'abonnement, géré par invoice.paid
  }

  const userId = paymentIntent.metadata?.userId;
  const creditAmount = parseInt(paymentIntent.metadata?.creditAmount, 10);

  if (!userId || !creditAmount) {
    console.log('[Webhook] Métadonnées manquantes dans payment_intent (normal si checkout.session.completed a été traité)');
    return;
  }

  // Vérifier si les crédits n'ont pas déjà été attribués par checkout.session.completed
  const existingTransaction = await prisma.creditTransaction.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id },
  });

  if (existingTransaction) {
    console.log(`[Webhook] ✓ Anti-duplication: crédits déjà attribués par checkout.session.completed pour PaymentIntent ${paymentIntent.id}`);
    return;
  }

  // Attribuer les crédits
  let result;
  try {
    result = await grantCredits(userId, creditAmount, 'purchase', {
      stripePaymentIntentId: paymentIntent.id,
      source: 'credit_pack_purchase',
    });

    if (!result.success) {
      console.error('[Webhook] Erreur attribution crédits:', result.error);
      return;
    }
  } catch (error) {
    // Gérer l'erreur de contrainte unique (race condition)
    if (error.code === 'P2002' && error.meta?.target?.includes('stripePaymentIntentId')) {
      console.log(`[Webhook] Contrainte unique violation pour PaymentIntent ${paymentIntent.id} (race condition détectée - checkout.session.completed a déjà traité)`);
      return;
    }
    throw error;
  }

  console.log(`[Webhook] ${creditAmount} crédits attribués à user ${userId} (payment_intent.succeeded fallback)`);

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
