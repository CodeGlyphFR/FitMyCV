/**
 * GET /api/subscription/invoices
 * Récupère les factures Stripe de l'utilisateur
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Récupérer le stripeCustomerId
    let subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    });

    let stripeCustomerId = subscription?.stripeCustomerId;

    // Si pas de customer Stripe ou customer local, tenter de récupérer depuis les PaymentIntents
    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      console.log('[Invoices] Customer ID local ou manquant, tentative de récupération depuis PaymentIntents');

      // Récupérer un PaymentIntent de l'utilisateur pour extraire le customer
      const creditTransaction = await prisma.creditTransaction.findFirst({
        where: {
          userId,
          stripePaymentIntentId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        select: { stripePaymentIntentId: true },
      });

      if (creditTransaction?.stripePaymentIntentId) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            creditTransaction.stripePaymentIntentId
          );

          if (paymentIntent.customer) {
            stripeCustomerId = paymentIntent.customer;
            console.log('[Invoices] Customer Stripe trouvé:', stripeCustomerId);

            // Mettre à jour la subscription avec le vrai customer ID
            await prisma.subscription.update({
              where: { userId },
              data: { stripeCustomerId },
            });
          }
        } catch (error) {
          console.error('[Invoices] Erreur lors de la récupération du PaymentIntent:', error);
        }
      }
    }

    // Si toujours pas de customer Stripe valide, retourner tableau vide
    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      console.log('[Invoices] Aucun customer Stripe valide trouvé');
      return NextResponse.json({
        invoices: [],
      });
    }

    let invoices = { data: [] };
    let paymentIntents = { data: [] };

    // Récupérer les factures Stripe (abonnements)
    try {
      invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 50, // Les 50 dernières factures
      });
    } catch (error) {
      console.error('[Invoices] Erreur lors de la récupération des invoices:', error.message);
    }

    // Récupérer les PaymentIntents (paiements one-time pour packs de crédits)
    try {
      paymentIntents = await stripe.paymentIntents.list({
        customer: stripeCustomerId,
        limit: 50,
      });
    } catch (error) {
      console.error('[Invoices] Erreur lors de la récupération des PaymentIntents:', error.message);
    }

    // Formater les factures (abonnements)
    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000).toISOString(),
      amount: invoice.amount_paid / 100, // Convertir centimes en euros
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      description: invoice.lines.data[0]?.description || 'Abonnement',
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      type: 'subscription',
    }));

    // Formater les PaymentIntents (packs de crédits)
    const formattedPayments = paymentIntents.data
      .filter(pi => pi.status === 'succeeded') // Ne garder que les paiements réussis
      .map(pi => ({
        id: pi.id,
        date: new Date(pi.created * 1000).toISOString(),
        amount: pi.amount / 100, // Convertir centimes en euros
        currency: pi.currency.toUpperCase(),
        status: 'paid', // Les PaymentIntents succeeded sont considérés comme payés
        description: pi.description || 'Pack de crédits',
        pdfUrl: null, // Les PaymentIntents n'ont pas de PDF
        hostedUrl: null, // Pas de hosted URL non plus
        type: 'credit_pack',
      }));

    // Fusionner et trier par date (plus récent en premier)
    const allTransactions = [...formattedInvoices, ...formattedPayments]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({
      invoices: allTransactions,
    });

  } catch (error) {
    console.error('[Invoices] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des factures' },
      { status: 500 }
    );
  }
}
