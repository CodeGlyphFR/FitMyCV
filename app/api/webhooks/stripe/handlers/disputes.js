/**
 * Stripe webhook handlers for dispute events (chargebacks)
 */

import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { debitCredits } from '@/lib/subscription/credits';
import { cancelSubscription } from '@/lib/subscription/subscriptions';

/**
 * Gère les chargebacks (disputes)
 */
export async function handleChargeDispute(charge) {
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
