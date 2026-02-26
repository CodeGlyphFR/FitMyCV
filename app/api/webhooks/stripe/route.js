/**
 * POST /api/webhooks/stripe
 * Handler unifié pour tous les webhooks Stripe
 *
 * Events gérés :
 * - customer.subscription.created/updated/deleted (abonnements)
 * - checkout.session.completed (achat crédits - attribution crédits)
 * - payment_intent.succeeded (achat crédits - fallback attribution)
 * - invoice.paid (renouvellement abonnement + facture crédits auto-créée)
 * - invoice.payment_failed (échec paiement abonnement)
 * - charge.dispute.created (chargebacks)
 *
 * Workflow achats de crédits :
 * 1. checkout.session.completed : Attribution des crédits
 * 2. payment_intent.succeeded : Fallback attribution si checkout raté
 * 3. invoice.paid : Stripe crée la facture automatiquement (via invoice_creation),
 *    on stocke l'ID facture et on envoie l'email de confirmation
 *
 * Factures :
 * - Abonnements : factures générées automatiquement par Stripe
 * - Crédits : factures générées automatiquement par Stripe (invoice_creation sur checkout)
 *
 * Chargebacks :
 * - Crédits : retrait du montant (balance peut devenir négative)
 * - Abonnements : annulation immédiate de l'abonnement
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import stripe from '@/lib/stripe';
import prisma from '@/lib/prisma';

import {
  handleSubscriptionUpdate,
  handleSubscriptionDeleted,
  handleCheckoutCompleted,
  handlePaymentSuccess,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleChargeDispute,
} from './handlers/index.js';

// Désactiver le parsing du body par Next.js (requis pour webhooks Stripe)
export const runtime = 'nodejs';

export async function POST(request) {
  const body = await request.text();
  // Next.js 16: headers() est maintenant async
  const headerStore = await headers();
  const signature = headerStore.get('stripe-signature');

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
      { error: 'Webhook signature invalide' },
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
      { error: 'Internal webhook processing error' },
      { status: 500 }
    );
  }
}
