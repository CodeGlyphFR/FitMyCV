/**
 * GET /api/subscription/invoices
 * Récupère les factures Stripe de l'utilisateur
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';
import { secureLog, secureError } from '@/lib/security/secureLogger';

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
      secureLog('[Invoices] Customer ID local ou manquant, tentative de récupération depuis PaymentIntents');

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
            secureLog('[Invoices] Customer Stripe trouvé:', stripeCustomerId);

            // Mettre à jour la subscription si elle existe
            if (subscription) {
              await prisma.subscription.update({
                where: { userId },
                data: { stripeCustomerId },
              });
            }

            // Aussi mettre à jour User pour le mode full crédit
            await prisma.user.update({
              where: { id: userId },
              data: { stripeCustomerId },
            });
          }
        } catch (error) {
          secureError('[Invoices] Erreur lors de la récupération du PaymentIntent:', error);
        }
      }
    }

    // Note: Pas de fallback par email pour éviter de récupérer les factures
    // d'un ancien compte supprimé avec le même email (problème de confidentialité)

    // Fallback 3 : Chercher dans la table User (pour les utilisateurs qui ont acheté des crédits mais n'ont jamais eu d'abonnement)
    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      secureLog('[Invoices] Tentative de récupération depuis table User');

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (user?.stripeCustomerId && !user.stripeCustomerId.startsWith('local_')) {
        stripeCustomerId = user.stripeCustomerId;
        secureLog('[Invoices] Customer Stripe trouvé dans User:', stripeCustomerId);

        // Mettre à jour la subscription pour la prochaine fois (s'il y a une subscription)
        const existingSub = await prisma.subscription.findUnique({
          where: { userId },
          select: { id: true },
        });

        if (existingSub) {
          await prisma.subscription.update({
            where: { userId },
            data: { stripeCustomerId },
          });
          secureLog('[Invoices] Subscription mise à jour avec customer Stripe');
        }
      }
    }

    // Si toujours pas de customer Stripe valide, retourner tableau vide
    if (!stripeCustomerId || stripeCustomerId.startsWith('local_')) {
      secureLog('[Invoices] Aucun customer Stripe valide trouvé');
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
      secureError('[Invoices] Erreur lors de la récupération des invoices:', error.message);
    }

    // Récupérer les PaymentIntents (paiements one-time pour packs de crédits)
    try {
      paymentIntents = await stripe.paymentIntents.list({
        customer: stripeCustomerId,
        limit: 50,
      });
    } catch (error) {
      secureError('[Invoices] Erreur lors de la récupération des PaymentIntents:', error.message);
    }

    // Formater les factures (abonnements ET crédits)
    const formattedInvoices = invoices.data.map(invoice => {
      // Différencier les factures de crédits des abonnements via metadata
      const isCreditPurchase = invoice.metadata?.source === 'credit_pack_purchase';

      return {
        id: invoice.id,
        date: new Date(invoice.created * 1000).toISOString(),
        // Utiliser total au lieu de amount_paid pour les invoices paid_out_of_band
        amount: invoice.total / 100, // Convertir centimes en euros
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        description: invoice.lines.data[0]?.description || (isCreditPurchase ? 'Pack de crédits' : 'Abonnement'),
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        type: isCreditPurchase ? 'credit_pack' : 'subscription',
      };
    });

    // Créer un Set des PaymentIntent IDs qui ont déjà une Invoice associée
    const paymentIntentsWithInvoice = new Set(
      invoices.data
        .filter(inv => inv.metadata?.paymentIntentId)
        .map(inv => inv.metadata.paymentIntentId)
    );

    // Formater les PaymentIntents (packs de crédits)
    // Filtrer pour ne garder QUE les achats de crédits et exclure ceux qui ont déjà une Invoice
    const formattedPayments = paymentIntents.data
      .filter(pi =>
        pi.status === 'succeeded' && // Ne garder que les paiements réussis
        pi.metadata?.type === 'credit_purchase' && // Ne garder que les achats de crédits
        !paymentIntentsWithInvoice.has(pi.id) // Exclure ceux qui ont déjà une Invoice
      )
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

    // Récupérer le customer balance (crédit de facturation)
    let creditBalance = 0;
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      // Le balance est en centimes et négatif = crédit (ex: -4599 = 45,99€ de crédit)
      // On inverse le signe pour avoir un montant positif
      creditBalance = customer.balance < 0 ? Math.abs(customer.balance) / 100 : 0;
    } catch (error) {
      secureError('[Invoices] Erreur lors de la récupération du customer balance:', error);
      // On continue sans balance si erreur
    }

    // Fusionner et trier par date (plus récent en premier)
    const allTransactions = [...formattedInvoices, ...formattedPayments]
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({
      invoices: allTransactions,
      creditBalance,
    });

  } catch (error) {
    secureError('[Invoices] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des factures' },
      { status: 500 }
    );
  }
}
