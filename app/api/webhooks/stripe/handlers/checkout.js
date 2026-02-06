/**
 * Stripe webhook handlers for checkout events
 */

import prisma from '@/lib/prisma';
import { grantCredits } from '@/lib/subscription/credits';
import { updateCustomerBillingDetailsFromCheckout } from './utils.js';

/**
 * Gère la completion d'une session Checkout
 * CAS 1: Nouvel abonnement (mise à jour billing details Customer)
 * CAS 2: Achat de crédits (paiement one-time)
 *
 * Note: Les upgrades d'abonnement se font maintenant en backend (pas de Checkout)
 */
export async function handleCheckoutCompleted(session) {
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
  console.log(`[Webhook] → La facture sera créée dans charge.succeeded (billing details garantis disponibles)`);
  // Note: L'email de confirmation est envoyé dans handleChargeSucceeded après création de la facture
}
