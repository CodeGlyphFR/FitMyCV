/**
 * POST /api/webhooks/stripe
 * Handler unifié pour tous les webhooks Stripe
 *
 * Events gérés :
 * - customer.subscription.created/updated/deleted (abonnements)
 * - checkout.session.completed (achat crédits - attribution crédits)
 * - payment_intent.succeeded (achat crédits - fallback attribution)
 * - charge.succeeded (achat crédits - CRÉATION FACTURES)
 * - invoice.paid (renouvellement abonnement)
 * - invoice.payment_failed (échec paiement abonnement)
 * - charge.dispute.created (chargebacks)
 *
 * Workflow achats de crédits :
 * 1. checkout.session.completed : Attribution des crédits (métadonnées complètes)
 * 2. payment_intent.succeeded : Fallback attribution si checkout raté
 * 3. charge.succeeded : Création de la facture (billing_details GARANTIS disponibles)
 *
 * IMPORTANT: Les factures de crédits sont créées dans charge.succeeded car :
 * - C'est le SEUL webhook où Stripe GARANTIT que billing_details est disponible
 * - checkout.session.completed arrive trop tôt (charges pas encore créées)
 * - payment_intent.succeeded arrive trop tôt aussi (charges pas encore créées)
 * - charge.succeeded arrive APRÈS la création de la charge avec billing_details complets
 *
 * Protection contre duplication :
 * - Vérification si événement déjà traité (via StripeWebhookLog)
 * - Contrainte unique sur stripePaymentIntentId (CreditTransaction)
 * - Gestion des erreurs de contrainte unique (race condition)
 *
 * Factures :
 * - Abonnements : factures générées automatiquement par Stripe
 * - Crédits : factures créées programmatiquement dans charge.succeeded
 *
 * Chargebacks :
 * - Crédits : retrait du montant (balance peut devenir négative)
 * - Abonnements : annulation immédiate de l'abonnement
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { grantCredits, debitCredits } from '@/lib/subscription/credits';
import { changeSubscription, cancelSubscription } from '@/lib/subscription/subscriptions';
import { resetFeatureCounters } from '@/lib/subscription/featureUsage';

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

      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleChargeDispute(event.data.object);
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
        stripeCustomerId: subscription.customer, // MAJ avec le vrai customer ID Stripe
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

  // Vérifier si l'utilisateur a un autre abonnement actif (cas upgrade)
  const currentSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, status: true },
  });

  // Si abonnement actif différent de celui supprimé = upgrade en cours
  if (currentSubscription?.stripeSubscriptionId &&
      currentSubscription.stripeSubscriptionId !== subscription.id &&
      currentSubscription.status === 'active') {
    console.log(`[Webhook] Suppression d'ancien abonnement (upgrade détecté), pas de downgrade`);
    return; // Ne rien faire
  }

  // Sinon, vraie suppression → downgrade vers Gratuit
  await cancelSubscription(userId, true);
  console.log(`[Webhook] Abonnement supprimé pour user ${userId}, downgrade vers Gratuit`);
}

/**
 * Crée une facture Stripe pour un achat de crédits
 * IMPORTANT: Cette fonction doit être appelée depuis payment_intent.succeeded (PAS checkout.session.completed)
 * car les charges avec billing_details ne sont disponibles qu'après payment_intent.succeeded
 *
 * @param {object} params - {customer, amount, currency, creditAmount, userId, paymentIntent}
 * @param {string} transactionId - ID de la CreditTransaction à mettre à jour
 * @returns {Promise<string|null>} - ID de la facture créée ou null en cas d'erreur
 */
async function createInvoiceForCreditPurchase({ customer, amount, currency, creditAmount, userId, paymentIntent }, transactionId) {
  try {
    // Récupérer les billing details depuis le PaymentIntent (TOUJOURS disponibles dans payment_intent.succeeded)
    const billingDetails = paymentIntent.charges?.data?.[0]?.billing_details;

    if (!billingDetails) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucun billing_details trouvé dans PaymentIntent ${paymentIntent.id} - impossible de créer facture`);
      return null;
    }

    console.log(`[Webhook] → Billing details PaymentIntent (garantis disponibles):`, {
      name: billingDetails.name || 'N/A',
      email: billingDetails.email || 'N/A',
      address: billingDetails.address ? `${billingDetails.address.line1 || ''}, ${billingDetails.address.city}, ${billingDetails.address.country}` : 'N/A',
    });

    // IMPORTANT : Vérifier qu'on a au moins une adresse (obligation légale)
    if (!billingDetails.address) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucune adresse de facturation disponible pour le PaymentIntent ${paymentIntent.id} - FACTURE SANS ADRESSE IMPOSSIBLE`);
      return null;
    }

    // Mettre à jour le Customer Stripe avec les billing details du PaymentIntent
    // L'Invoice utilisera automatiquement ces informations
    await stripe.customers.update(customer, {
      name: billingDetails.name || undefined,
      email: billingDetails.email || undefined,
      address: billingDetails.address || undefined,
    });
    console.log(`[Webhook] ✓ Customer ${customer} mis à jour avec billing details (nom: ${billingDetails.name || 'N/A'}, adresse: présente)`);

    // Créer un draft invoice
    // L'Invoice hérite automatiquement des billing details du Customer mis à jour ci-dessus
    const invoice = await stripe.invoices.create({
      customer: customer,
      auto_advance: false, // Ne pas envoyer automatiquement
      collection_method: 'charge_automatically',
      description: `Achat de ${creditAmount} crédits FitMyCv.ai`,
      metadata: {
        userId: userId,
        creditAmount: creditAmount.toString(),
        paymentIntentId: paymentIntent.id,
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

    console.log(`[Webhook] ✓ Facture Stripe créée: ${finalizedInvoice.id} pour PaymentIntent ${paymentIntent.id}`);
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
 * Met à jour les billing details du Customer Stripe depuis une session Checkout
 * Cette fonction DOIT être appelée AVANT que Stripe ne crée automatiquement l'Invoice pour un nouvel abonnement
 * @param {string} customerId - ID du customer Stripe
 * @param {object} session - Session Checkout Stripe complète
 */
async function updateCustomerBillingDetailsFromCheckout(customerId, session) {
  try {
    // Récupérer les billing details de base depuis la session Checkout
    const customerDetails = session.customer_details;

    if (!customerDetails) {
      console.warn(`[Webhook] ⚠️ Pas de customer_details dans la session ${session.id}`);
      return;
    }

    // Initialiser avec les billing details de la session
    let finalBillingDetails = {
      name: customerDetails.name,
      email: customerDetails.email,
      address: customerDetails.address,
    };

    console.log(`[Webhook] → Billing details Checkout Session (base):`, {
      name: customerDetails.name || 'N/A',
      email: customerDetails.email || 'N/A',
      address: customerDetails.address ? `${customerDetails.address.city}, ${customerDetails.address.country}` : 'N/A',
    });

    // Essayer de récupérer des billing details plus récents depuis le PaymentIntent
    // Important pour les Customers existants qui changent leur adresse dans le formulaire
    if (session.payment_intent) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
          expand: ['charges'],
        });

        // Si le PaymentIntent a des charges avec billing details, les utiliser en priorité
        if (paymentIntent.charges?.data?.[0]?.billing_details) {
          const piBillingDetails = paymentIntent.charges.data[0].billing_details;

          // Fusionner (priorité au PaymentIntent car plus récent)
          finalBillingDetails = {
            name: piBillingDetails.name || finalBillingDetails.name,
            email: piBillingDetails.email || finalBillingDetails.email,
            address: piBillingDetails.address || finalBillingDetails.address,
          };

          console.log(`[Webhook] → Billing details PaymentIntent (prioritaire):`, {
            name: piBillingDetails.name || 'N/A',
            email: piBillingDetails.email || 'N/A',
            address: piBillingDetails.address ? `${piBillingDetails.address.line1 || ''}, ${piBillingDetails.address.city}` : 'N/A',
          });
        } else {
          console.log(`[Webhook] → PaymentIntent sans charges, utilisation des billing details de la session`);
        }
      } catch (error) {
        console.warn(`[Webhook] ⚠️ Impossible de récupérer PaymentIntent ${session.payment_intent}:`, error.message);
        // Continuer avec session.customer_details
      }
    }

    console.log(`[Webhook] → Billing details finaux utilisés:`, {
      name: finalBillingDetails.name || 'N/A',
      email: finalBillingDetails.email || 'N/A',
      address: finalBillingDetails.address ? `${finalBillingDetails.address.line1 || ''}, ${finalBillingDetails.address.city}, ${finalBillingDetails.address.country}` : 'N/A',
    });

    // IMPORTANT : Vérifier qu'on a au moins une adresse (obligation légale)
    if (!finalBillingDetails.address) {
      console.error(`[Webhook] ⚠️ ERREUR CRITIQUE: Aucune adresse de facturation disponible pour la session ${session.id} - FACTURE SANS ADRESSE IMPOSSIBLE`);
    }

    // Mettre à jour le Customer Stripe avec les billing details finaux
    // Cela permettra à Stripe d'utiliser automatiquement ces infos lors de la création de l'Invoice
    if (finalBillingDetails.name || finalBillingDetails.email || finalBillingDetails.address) {
      await stripe.customers.update(customerId, {
        name: finalBillingDetails.name || undefined,
        email: finalBillingDetails.email || undefined,
        address: finalBillingDetails.address || undefined,
      });
      console.log(`[Webhook] ✓ Customer ${customerId} mis à jour avec billing details (nom: ${finalBillingDetails.name || 'N/A'}, adresse: ${finalBillingDetails.address ? 'présente' : 'absente'})`);
    } else {
      console.warn(`[Webhook] ⚠️ Aucun billing details à mettre à jour pour le Customer ${customerId}`);
    }
  } catch (error) {
    console.error(`[Webhook] Erreur lors de la mise à jour des billing details du Customer:`, error);
  }
}

/**
 * Gère la completion d'une session Checkout
 * CAS 1: Nouvel abonnement (mise à jour billing details Customer)
 * CAS 2: Achat de crédits (paiement one-time)
 *
 * Note: Les upgrades d'abonnement se font maintenant en backend (pas de Checkout)
 */
async function handleCheckoutCompleted(session) {
  // CAS 1: Nouvel abonnement
  if (session.mode === 'subscription') {
    const userId = session.metadata?.userId;
    const customerId = session.customer;

    if (!userId || !customerId) {
      console.error('[Webhook] userId ou customerId manquant dans checkout session (nouvel abonnement)');
      return;
    }

    console.log(`[Webhook] Nouvel abonnement détecté pour user ${userId}`);

    // IMPORTANT: Mettre à jour le Customer Stripe MAINTENANT avec les billing details
    // car Stripe va créer automatiquement une Invoice juste après, et elle doit avoir l'adresse
    await updateCustomerBillingDetailsFromCheckout(customerId, session);

    // Le reste sera géré par le webhook customer.subscription.created
    return;
  }

  // CAS 2: Achat de crédits (paiement one-time)
  if (session.mode !== 'payment' || session.metadata?.type !== 'credit_purchase') {
    return; // Autre type de session, ignoré
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
    console.log(`[Webhook] → La facture sera créée dans charge.succeeded (billing_details garantis disponibles)`);
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
  console.log(`[Webhook] → La facture sera créée dans payment_intent.succeeded (billing details garantis disponibles)`);

  // TODO: Envoyer email de confirmation via Resend
}

/**
 * Gère le succès d'un paiement
 * IMPORTANT: C'est ici que les factures de crédits sont créées (PAS dans checkout.session.completed)
 * car les charges avec billing_details sont garanties disponibles dans ce webhook
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
    console.log(`[Webhook] → La facture sera créée dans charge.succeeded (billing_details garantis disponibles)`);
    return;
  }

  // Attribuer les crédits (FALLBACK - normalement géré par checkout.session.completed)
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
  console.log(`[Webhook] → La facture sera créée dans charge.succeeded (billing_details garantis disponibles)`);

  // TODO: Envoyer email de confirmation via Resend
}

/**
 * Gère le succès d'une charge (CRÉATION FACTURES CRÉDITS)
 * IMPORTANT: C'est ici que les factures de crédits sont créées car billing_details GARANTIS disponibles
 * C'est le SEUL webhook où Stripe garantit que charge.billing_details est complet et à jour
 */
async function handleChargeSucceeded(charge) {
  const paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) {
    return; // Pas lié à un PaymentIntent (charge directe sans Intent)
  }

  // Récupérer le PaymentIntent pour avoir les métadonnées
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    console.error('[Webhook] Erreur récupération PaymentIntent:', error);
    return;
  }

  // Vérifier si c'est un achat de crédits
  if (paymentIntent.metadata?.type !== 'credit_purchase') {
    return; // Pas un achat de crédits (peut être un abonnement)
  }

  const userId = paymentIntent.metadata?.userId;
  const creditAmount = parseInt(paymentIntent.metadata?.creditAmount, 10);

  if (!userId || !creditAmount) {
    console.error('[Webhook] Métadonnées manquantes dans charge.succeeded');
    return;
  }

  // Vérifier si la transaction existe (doit déjà exister, créée par checkout.session ou payment_intent)
  const existingTransaction = await prisma.creditTransaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!existingTransaction) {
    console.error(`[Webhook] Transaction introuvable pour PaymentIntent ${paymentIntentId} dans charge.succeeded`);
    return;
  }

  // Si facture déjà créée, ne rien faire (idempotence)
  if (existingTransaction.stripeInvoiceId) {
    console.log(`[Webhook] Facture déjà créée: ${existingTransaction.stripeInvoiceId} (charge.succeeded idempotent)`);
    return;
  }

  // Créer la facture (billing_details GARANTIS disponibles dans charge.succeeded)
  console.log(`[Webhook] → Création de la facture dans charge.succeeded (billing_details GARANTIS disponibles)`);

  // Construire un objet PaymentIntent avec la charge complète
  const paymentIntentWithCharge = {
    ...paymentIntent,
    charges: {
      data: [charge], // La charge est déjà complète avec billing_details
    },
  };

  await createInvoiceForCreditPurchase({
    customer: paymentIntent.customer,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    creditAmount,
    userId,
    paymentIntent: paymentIntentWithCharge,
  }, existingTransaction.id);

  // TODO: Envoyer email de confirmation via Resend
}

/**
 * Gère le paiement réussi d'une facture (renouvellement abonnement)
 */
async function handleInvoicePaid(invoice) {
  const subscriptionId = invoice.subscription;

  if (!subscriptionId) {
    return; // Pas un paiement d'abonnement (peut être une facture de crédits)
  }

  // Récupérer l'abonnement Stripe pour avoir le userId
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans metadata subscription');
    return;
  }

  // Vérifier que c'est bien un renouvellement (pas le premier paiement)
  // Le premier paiement est géré par customer.subscription.created
  const existingSubscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!existingSubscription) {
    console.log(`[Webhook] Abonnement introuvable pour user ${userId}, probablement premier paiement (géré par subscription.created)`);
    return;
  }

  // Reset des compteurs de features pour la nouvelle période
  try {
    await resetFeatureCounters(userId);
    console.log(`[Webhook] Compteurs features reset pour user ${userId} (renouvellement)`);
  } catch (error) {
    console.error('[Webhook] Erreur reset compteurs:', error);
  }

  // Mettre à jour les dates de période
  await prisma.subscription.update({
    where: { userId },
    data: {
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: 'active',
    },
  });

  console.log(`[Webhook] Renouvellement confirmé pour user ${userId}, compteurs reset`);
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

/**
 * Gère les chargebacks (disputes)
 */
async function handleChargeDispute(charge) {
  const paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) {
    console.error('[Webhook] payment_intent manquant dans charge.dispute');
    return;
  }

  // Récupérer le PaymentIntent pour avoir les métadonnées
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const type = paymentIntent.metadata?.type;
  const userId = paymentIntent.metadata?.userId;

  if (!userId) {
    console.error('[Webhook] userId manquant dans payment_intent metadata');
    return;
  }

  // Logger le chargeback dans ErrorLog
  await prisma.errorLog.create({
    data: {
      message: `Chargeback détecté pour user ${userId}`,
      stack: JSON.stringify({
        chargeId: charge.id,
        paymentIntentId: paymentIntentId,
        amount: charge.amount / 100,
        currency: charge.currency,
        reason: charge.dispute?.reason || 'unknown',
        type: type,
      }),
      endpoint: '/api/webhooks/stripe',
      method: 'POST',
      userId: userId,
    },
  }).catch(err => console.error('[Webhook] Erreur logging chargeback:', err));

  if (type === 'credit_purchase') {
    // Chargeback sur achat de crédits : retirer le montant (balance peut devenir négative)
    const transaction = await prisma.creditTransaction.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!transaction) {
      console.error('[Webhook] Transaction introuvable pour PaymentIntent:', paymentIntentId);
      return;
    }

    const creditAmount = transaction.amount;

    // Débiter les crédits (balance peut devenir négative)
    const result = await debitCredits(userId, creditAmount, 'chargeback', {
      relatedTransactionId: transaction.id,
      chargeId: charge.id,
      disputeReason: charge.dispute?.reason || 'unknown',
    });

    if (!result.success) {
      console.error('[Webhook] Erreur débit crédits pour chargeback:', result.error);
      return;
    }

    console.log(`[Webhook] Chargeback: ${creditAmount} crédits retirés pour user ${userId}, nouvelle balance: ${result.newBalance}`);

  } else {
    // Chargeback sur abonnement : annulation immédiate
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (subscription && subscription.stripeSubscriptionId) {
      // Annuler l'abonnement Stripe
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (error) {
        console.error('[Webhook] Erreur annulation abonnement Stripe:', error);
      }

      // Downgrade vers Gratuit
      await cancelSubscription(userId, true);

      console.log(`[Webhook] Chargeback: abonnement annulé pour user ${userId}, downgrade vers Gratuit`);
    }
  }
}
