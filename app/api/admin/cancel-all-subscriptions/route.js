import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';

/**
 * GET /api/admin/cancel-all-subscriptions
 * Prévisualise les abonnements payants actifs qui seront annulés
 */
export async function GET(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Récupérer tous les abonnements payants actifs
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: {
          isFree: false,
        },
        stripeSubscriptionId: {
          not: null,
          startsWith: 'sub_', // Vrais abonnements Stripe (pas local_)
        },
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Calculer le prorata pour chaque abonnement
    const previewData = await Promise.all(
      subscriptions.map(async (sub) => {
        let prorataAmount = 0;
        let currency = 'eur';

        try {
          // Récupérer l'abonnement Stripe pour calculer le prorata
          const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

          if (stripeSubscription.status === 'active') {
            const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
            const now = new Date();
            const daysRemaining = Math.ceil((currentPeriodEnd - now) / (1000 * 60 * 60 * 24));
            const totalDays = sub.billingPeriod === 'yearly' ? 365 : 30;

            // Calculer le montant prorata
            const planPrice = sub.billingPeriod === 'yearly'
              ? sub.plan.priceYearly
              : sub.plan.priceMonthly;
            prorataAmount = Math.round((planPrice * daysRemaining / totalDays) * 100) / 100;
            currency = stripeSubscription.currency || 'eur';
          }
        } catch (error) {
          console.error(`[Cancel All] Erreur Stripe pour ${sub.stripeSubscriptionId}:`, error.message);
        }

        return {
          subscriptionId: sub.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          userId: sub.userId,
          userEmail: sub.user?.email,
          userName: sub.user?.name,
          planName: sub.plan.name,
          billingPeriod: sub.billingPeriod,
          currentPeriodEnd: sub.currentPeriodEnd,
          prorataAmount,
          currency,
        };
      })
    );

    // Calculer le total des remboursements
    const totalRefund = previewData.reduce((sum, item) => sum + item.prorataAmount, 0);

    return NextResponse.json({
      subscriptionsCount: subscriptions.length,
      totalRefund: Math.round(totalRefund * 100) / 100,
      currency: 'eur',
      subscriptions: previewData,
    });

  } catch (error) {
    console.error('[Cancel All Subscriptions API] Error in preview:', error);
    return NextResponse.json(
      { error: 'Failed to preview subscriptions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cancel-all-subscriptions
 * Annule tous les abonnements payants avec remboursement prorata
 */
export async function POST(request) {
  try {
    const session = await auth();

    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { confirmationCode } = body;

    // Vérifier le code de confirmation
    if (confirmationCode !== 'CANCEL_ALL_SUBSCRIPTIONS') {
      return NextResponse.json(
        { error: 'Invalid confirmation code. Send { confirmationCode: "CANCEL_ALL_SUBSCRIPTIONS" }' },
        { status: 400 }
      );
    }

    // Récupérer tous les abonnements payants actifs
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: {
          isFree: false,
        },
        stripeSubscriptionId: {
          not: null,
          startsWith: 'sub_',
        },
      },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    const results = {
      total: subscriptions.length,
      success: 0,
      failed: 0,
      refunded: 0,
      totalRefundAmount: 0,
      errors: [],
    };

    for (const sub of subscriptions) {
      try {
        // 1. Annuler l'abonnement Stripe avec remboursement prorata
        const canceledSubscription = await stripe.subscriptions.cancel(sub.stripeSubscriptionId, {
          prorate: true,
          invoice_now: true, // Génère une facture finale avec le crédit prorata
        });

        // 2. Si un crédit a été généré, créer un remboursement
        if (canceledSubscription.latest_invoice) {
          try {
            const invoice = await stripe.invoices.retrieve(canceledSubscription.latest_invoice);

            // Si la facture a un montant négatif (crédit), rembourser
            if (invoice.amount_due < 0 && invoice.charge) {
              const refundAmount = Math.abs(invoice.amount_due);
              await stripe.refunds.create({
                charge: invoice.charge,
                amount: refundAmount,
                reason: 'requested_by_customer',
                metadata: {
                  reason: 'subscription_mode_disabled',
                  admin_email: session.user.email,
                },
              });
              results.refunded++;
              results.totalRefundAmount += refundAmount / 100;
            }
          } catch (refundError) {
            console.error(`[Cancel All] Refund failed for ${sub.stripeSubscriptionId}:`, refundError.message);
          }
        }

        // 3. Mettre à jour la DB locale
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'canceled',
            canceledAt: new Date(),
            stripeSubscriptionId: null, // Nettoyer la référence Stripe
          },
        });

        results.success++;
        console.log(`[Cancel All] Subscription ${sub.stripeSubscriptionId} canceled for user ${sub.user?.email}`);

      } catch (error) {
        results.failed++;
        results.errors.push({
          subscriptionId: sub.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          userEmail: sub.user?.email,
          error: 'Erreur lors de l\'annulation',
        });
        console.error(`[Cancel All] Failed to cancel ${sub.stripeSubscriptionId}:`, error.message);
      }
    }

    console.log(`[Cancel All] Opération terminée: ${results.success}/${results.total} abonnements annulés, ${results.refunded} remboursements effectués`);

    return NextResponse.json({
      success: true,
      message: `${results.success} abonnements annulés sur ${results.total}`,
      results,
    });

  } catch (error) {
    console.error('[Cancel All Subscriptions API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscriptions' },
      { status: 500 }
    );
  }
}
