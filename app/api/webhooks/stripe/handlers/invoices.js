/**
 * Stripe webhook handlers for invoice events
 */

import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { cancelSubscription } from '@/lib/subscription/subscriptions';
import { resetFeatureCounters } from '@/lib/subscription/featureUsage';

/**
 * Gère le paiement réussi d'une facture (renouvellement abonnement)
 */
export async function handleInvoicePaid(invoice) {
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
export async function handleInvoicePaymentFailed(invoice) {
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
