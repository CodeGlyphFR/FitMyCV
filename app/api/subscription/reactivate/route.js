/**
 * POST /api/subscription/reactivate
 * Réactive un abonnement annulé (cancel_at_period_end)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { reactivateSubscription } from '@/lib/subscription/subscriptions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // Réactiver l'abonnement dans la base de données
    const result = await reactivateSubscription(userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Si l'abonnement a un stripeSubscriptionId, réactiver aussi sur Stripe
    if (result.subscription.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.update(
          result.subscription.stripeSubscriptionId,
          { cancel_at_period_end: false }
        );
        console.log(`[Subscription Reactivate] Réactivé sur Stripe: ${result.subscription.stripeSubscriptionId}`);
      } catch (stripeError) {
        console.error('[Subscription Reactivate] Erreur Stripe:', stripeError);
        // Ne pas bloquer si Stripe échoue, la DB est déjà mise à jour
      }
    }

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
    });

  } catch (error) {
    console.error('[Subscription Reactivate] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la réactivation' },
      { status: 500 }
    );
  }
}
