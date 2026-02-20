/**
 * Stripe webhook handlers for invoice events
 */

import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { cancelSubscription } from '@/lib/subscription/subscriptions';
import { resetFeatureCounters } from '@/lib/subscription/featureUsage';
import { sendPurchaseCreditsEmail } from '@/lib/email/emailService';

/**
 * Gère le paiement réussi d'une facture
 * - Abonnements : reset des compteurs de features pour la nouvelle période
 * - Crédits : stockage de l'ID facture + envoi email de confirmation
 */
export async function handleInvoicePaid(invoice) {
  // CAS 1 : Facture d'abonnement (renouvellement)
  if (invoice.subscription) {
    return handleSubscriptionInvoicePaid(invoice);
  }

  // CAS 2 : Facture de crédits (créée automatiquement par invoice_creation)
  if (invoice.metadata?.type === 'credit_purchase') {
    return handleCreditInvoicePaid(invoice);
  }

  // Autre type de facture, ignoré
}

/**
 * Gère la facture d'un renouvellement d'abonnement
 */
async function handleSubscriptionInvoicePaid(invoice) {
  const subscriptionId = invoice.subscription;

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
 * Gère la facture d'un achat de crédits (créée automatiquement par Stripe via invoice_creation)
 * - Stocke l'ID de la facture dans CreditTransaction
 * - Envoie l'email de confirmation avec le lien de la facture
 */
async function handleCreditInvoicePaid(invoice) {
  const userId = invoice.metadata?.userId;
  const creditAmount = parseInt(invoice.metadata?.creditAmount, 10);
  const paymentIntentId = invoice.payment_intent;

  if (!userId || !creditAmount) {
    console.error('[Webhook] Métadonnées manquantes dans invoice.paid (credit_purchase)');
    return;
  }

  console.log(`[Webhook] Facture crédits auto-créée par Stripe: ${invoice.id} pour user ${userId}`);

  // Trouver la CreditTransaction associée via le PaymentIntent
  if (paymentIntentId) {
    try {
      const transaction = await prisma.creditTransaction.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (transaction && !transaction.stripeInvoiceId) {
        await prisma.creditTransaction.update({
          where: { id: transaction.id },
          data: { stripeInvoiceId: invoice.id },
        });
        console.log(`[Webhook] ✓ Facture ${invoice.id} associée à la transaction ${transaction.id}`);
      } else if (transaction?.stripeInvoiceId) {
        console.log(`[Webhook] Facture déjà associée: ${transaction.stripeInvoiceId} (idempotent)`);
      } else {
        console.warn(`[Webhook] ⚠️ Transaction introuvable pour PaymentIntent ${paymentIntentId}`);
      }
    } catch (error) {
      console.error('[Webhook] Erreur association facture-transaction:', error);
    }
  }

  // Envoyer l'email de confirmation avec lien facture
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const invoiceUrl = invoice.hosted_invoice_url || invoice.invoice_pdf;

      // Formater le prix TTC depuis la facture Stripe
      const totalPrice = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: (invoice.currency || 'eur').toUpperCase(),
      }).format((invoice.amount_paid || 0) / 100);

      await sendPurchaseCreditsEmail({
        email: user.email,
        name: user.name,
        userId,
        creditsAmount: creditAmount,
        totalPrice,
        invoiceUrl,
      });

      console.log(`[Webhook] ✅ Email purchase_credits envoyé à ${user.email} (facture: ${invoice.id})`);
    }
  } catch (emailError) {
    // Ne pas bloquer le webhook si l'email échoue
    console.error('[Webhook] Erreur envoi email purchase_credits (non-bloquant):', emailError);
  }
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
