/**
 * Stripe webhook handlers for payment events
 * Fallback pour l'attribution de crédits si checkout.session.completed n'arrive pas
 */

import prisma from '@/lib/prisma';
import { grantCredits } from '@/lib/subscription/credits';

/**
 * Gère le succès d'un paiement (FALLBACK)
 * L'attribution principale des crédits se fait dans checkout.session.completed.
 * Ce handler assure que les crédits sont attribués même si checkout.session.completed est raté.
 */
export async function handlePaymentSuccess(paymentIntent) {
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
    console.log(`[Webhook] ✓ Anti-duplication: crédits déjà attribués pour PaymentIntent ${paymentIntent.id}`);
    return;
  }

  // Attribuer les crédits (FALLBACK)
  const pricePaid = (paymentIntent.amount || 0) / 100;
  try {
    const result = await grantCredits(userId, creditAmount, 'purchase', {
      stripePaymentIntentId: paymentIntent.id,
      source: 'credit_pack_purchase',
      pricePaid,
    });

    if (!result.success) {
      console.error('[Webhook] Erreur attribution crédits:', result.error);
      return;
    }
  } catch (error) {
    // Gérer l'erreur de contrainte unique (race condition)
    if (error.code === 'P2002' && error.meta?.target?.includes('stripePaymentIntentId')) {
      console.log(`[Webhook] Contrainte unique violation pour PaymentIntent ${paymentIntent.id} (race condition détectée)`);
      return;
    }
    throw error;
  }

  console.log(`[Webhook] ${creditAmount} crédits attribués à user ${userId} (payment_intent.succeeded fallback)`);
}
