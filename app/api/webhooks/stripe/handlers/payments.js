/**
 * Stripe webhook handlers for payment events
 */

import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';
import { grantCredits } from '@/lib/subscription/credits';
import { sendPurchaseCreditsEmail } from '@/lib/email/emailService';
import { createInvoiceForCreditPurchase } from './utils.js';

/**
 * Gère le succès d'un paiement
 * IMPORTANT: C'est ici que les factures de crédits sont créées (PAS dans checkout.session.completed)
 * car les charges avec billing_details sont garanties disponibles dans ce webhook
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
    console.log(`[Webhook] ✓ Anti-duplication: crédits déjà attribués par checkout.session.completed pour PaymentIntent ${paymentIntent.id}`);
    console.log(`[Webhook] → La facture sera créée dans charge.succeeded (billing_details garantis disponibles)`);
    return;
  }

  // Attribuer les crédits (FALLBACK - normalement géré par checkout.session.completed)
  const pricePaid = (paymentIntent.amount || 0) / 100; // Stripe amount en centimes → euros
  let result;
  try {
    result = await grantCredits(userId, creditAmount, 'purchase', {
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
      console.log(`[Webhook] Contrainte unique violation pour PaymentIntent ${paymentIntent.id} (race condition détectée - checkout.session.completed a déjà traité)`);
      return;
    }
    throw error;
  }

  console.log(`[Webhook] ${creditAmount} crédits attribués à user ${userId} (payment_intent.succeeded fallback)`);
  console.log(`[Webhook] → La facture sera créée dans charge.succeeded (billing_details garantis disponibles)`);
  // Note: L'email de confirmation est envoyé dans handleChargeSucceeded après création de la facture
}

/**
 * Gère le succès d'une charge (CRÉATION FACTURES CRÉDITS)
 * IMPORTANT: C'est ici que les factures de crédits sont créées car billing_details GARANTIS disponibles
 * C'est le SEUL webhook où Stripe garantit que charge.billing_details est complet et à jour
 */
export async function handleChargeSucceeded(charge) {
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
  const packId = paymentIntent.metadata?.packId ? parseInt(paymentIntent.metadata.packId, 10) : null;

  if (!userId || !creditAmount) {
    console.error('[Webhook] Métadonnées manquantes dans charge.succeeded');
    return;
  }

  // Récupérer le stripePriceId du pack pour la facture (tax_behavior inclus)
  let stripePriceId = null;
  if (packId) {
    const pack = await prisma.creditPack.findUnique({
      where: { id: packId },
      select: { stripePriceId: true },
    });
    stripePriceId = pack?.stripePriceId;
  }

  // Vérifier si la transaction existe (peut ne pas exister si charge.succeeded arrive avant checkout.session)
  let existingTransaction = await prisma.creditTransaction.findFirst({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  // Si la transaction n'existe pas, la créer (cas où charge.succeeded arrive avant checkout.session)
  if (!existingTransaction) {
    console.log(`[Webhook] Transaction inexistante pour PaymentIntent ${paymentIntentId}, création dans charge.succeeded`);

    try {
      const chargePricePaid = (paymentIntent.amount || 0) / 100; // Stripe amount en centimes → euros
      const result = await grantCredits(userId, creditAmount, 'purchase', {
        stripePaymentIntentId: paymentIntentId,
        source: 'credit_pack_purchase',
        pricePaid: chargePricePaid,
      });

      if (!result.success) {
        console.error('[Webhook] Erreur attribution crédits dans charge.succeeded:', result.error);
        return;
      }

      // Récupérer la transaction créée
      existingTransaction = await prisma.creditTransaction.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      console.log(`[Webhook] ${creditAmount} crédits attribués à user ${userId} (charge.succeeded - ordre inversé)`);
    } catch (error) {
      // Gérer l'erreur de contrainte unique (race condition avec checkout.session)
      if (error.code === 'P2002' && error.meta?.target?.includes('stripePaymentIntentId')) {
        console.log(`[Webhook] Race condition détectée, transaction créée par un autre webhook, récupération...`);
        existingTransaction = await prisma.creditTransaction.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
        });
      } else {
        throw error;
      }
    }
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

  const invoiceId = await createInvoiceForCreditPurchase({
    customer: paymentIntent.customer,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    creditAmount,
    userId,
    paymentIntent: paymentIntentWithCharge,
    stripePriceId,
  }, existingTransaction.id);

  // Vérifier que la facture a bien été créée
  if (!invoiceId) {
    throw new Error(`Échec création facture pour PaymentIntent ${paymentIntentId} - voir logs ci-dessus pour détails`);
  }

  console.log(`[Webhook] ✅ Facture ${invoiceId} créée et associée à la transaction ${existingTransaction.id}`);

  // Envoyer email de confirmation avec lien facture
  try {
    // Récupérer l'utilisateur pour l'email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      // Récupérer l'URL de la facture depuis Stripe
      const invoice = await stripe.invoices.retrieve(invoiceId);
      const invoiceUrl = invoice.hosted_invoice_url || invoice.invoice_pdf;

      // Formater le prix (amount est en centimes)
      const totalPrice = new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: paymentIntent.currency.toUpperCase(),
      }).format(paymentIntent.amount / 100);

      await sendPurchaseCreditsEmail({
        email: user.email,
        name: user.name,
        userId,
        creditsAmount: creditAmount,
        totalPrice,
        invoiceUrl,
      });

      console.log(`[Webhook] ✅ Email purchase_credits envoyé à user ${userId}`);
    }
  } catch (emailError) {
    // Ne pas bloquer le webhook si l'email échoue
    console.error('[Webhook] Erreur envoi email purchase_credits (non-bloquant):', emailError);
  }
}
