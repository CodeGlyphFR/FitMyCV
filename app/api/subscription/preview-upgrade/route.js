/**
 * POST /api/subscription/preview-upgrade
 * Calcule le montant du prorata pour un upgrade d'abonnement SANS effectuer la modification
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { planId, billingPeriod } = await request.json();

    if (!planId || !billingPeriod) {
      return NextResponse.json(
        { error: 'planId et billingPeriod requis' },
        { status: 400 }
      );
    }

    // Récupérer le plan cible
    const targetPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!targetPlan) {
      return NextResponse.json(
        { error: 'Plan non trouvé' },
        { status: 404 }
      );
    }

    // Récupérer l'abonnement actuel de l'utilisateur
    const currentSubscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!currentSubscription || !currentSubscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Cette API est uniquement pour les upgrades d\'abonnements existants. Pour créer un nouvel abonnement, utilisez le checkout normal.' },
        { status: 400 }
      );
    }

    // Récupérer l'abonnement Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSubscription.stripeSubscriptionId
    );

    if (!stripeSubscription || stripeSubscription.items.data.length === 0) {
      return NextResponse.json(
        { error: 'Abonnement Stripe invalide' },
        { status: 400 }
      );
    }

    // Récupérer le vrai customer ID depuis l'abonnement Stripe (pas depuis la DB qui peut être "local_...")
    const stripeCustomerId = stripeSubscription.customer;

    console.log('[Preview Upgrade] Customer ID:', stripeCustomerId, '(depuis Stripe subscription)');

    // Récupérer le customer pour avoir son solde créditeur
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    const customerBalance = customer.balance / 100; // Convertir centimes en euros (négatif = crédit)

    console.log('[Preview Upgrade] Customer balance:', customerBalance, '€');

    // Déterminer le price ID du nouveau plan
    const stripePriceId = billingPeriod === 'yearly'
      ? targetPlan.stripePriceIdYearly
      : targetPlan.stripePriceIdMonthly;

    if (!stripePriceId) {
      return NextResponse.json(
        { error: `Price ID manquant pour le plan ${targetPlan.name} (${billingPeriod})` },
        { status: 400 }
      );
    }

    // Calculer le prorata avec upcoming invoice
    let upcomingInvoice;
    try {
      upcomingInvoice = await stripe.invoices.createPreview({
        customer: stripeCustomerId,
        subscription: currentSubscription.stripeSubscriptionId,
        subscription_details: {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: stripePriceId,
            },
          ],
          proration_behavior: 'create_prorations',
          billing_cycle_anchor: 'now',
        },
      });
    } catch (error) {
      console.error('[Preview Upgrade] Erreur récupération upcoming invoice:', error);
      return NextResponse.json(
        { error: 'Impossible de calculer le prorata' },
        { status: 500 }
      );
    }

    // Calculer le montant du prorata SANS le customer balance
    const prorataAmountBeforeBalance = upcomingInvoice.amount_due / 100; // Convertir centimes en euros
    const currency = upcomingInvoice.currency.toUpperCase();

    // Appliquer le solde créditeur du customer (balance négatif = crédit)
    // Le montant final à payer = prorata + balance (si balance = -69.99, alors on déduit 69.99)
    const finalAmount = Math.max(0, prorataAmountBeforeBalance + customerBalance);

    console.log('[Preview Upgrade] Prorata avant balance:', prorataAmountBeforeBalance, '€');
    console.log('[Preview Upgrade] Montant final après balance:', finalAmount, '€');

    // Déterminer le prix du nouveau plan
    const newPlanPrice = billingPeriod === 'yearly'
      ? targetPlan.priceYearly
      : targetPlan.priceMonthly;

    // Calculer le crédit total (lignes négatives de l'invoice)
    let creditAmount = 0;
    if (upcomingInvoice.lines?.data) {
      upcomingInvoice.lines.data.forEach(line => {
        if (line.amount < 0) {
          creditAmount += Math.abs(line.amount);
        }
      });
    }
    creditAmount = creditAmount / 100; // Convertir centimes en euros

    // Calculer les mois offerts (uniquement si passage vers mensuel)
    let monthsOffered = 0;
    if (billingPeriod === 'monthly' && creditAmount > 0 && targetPlan.priceMonthly > 0) {
      monthsOffered = Math.floor(creditAmount / targetPlan.priceMonthly);
    }

    return NextResponse.json({
      success: true,
      prorataAmount: finalAmount, // Montant FINAL incluant le solde créditeur
      prorataAmountBeforeBalance, // Montant avant application du balance (pour debug/affichage)
      customerBalance, // Solde créditeur du customer
      currency,
      newPlanName: targetPlan.name,
      newPlanPrice,
      billingPeriod,
      currentPlanName: currentSubscription.plan.name,
      creditAmount,
      monthsOffered,
    });

  } catch (error) {
    console.error('[Preview Upgrade] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du calcul du prorata' },
      { status: 500 }
    );
  }
}
