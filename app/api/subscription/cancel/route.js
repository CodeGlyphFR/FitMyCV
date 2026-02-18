/**
 * POST /api/subscription/cancel
 * Annule l'abonnement utilisateur
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { cancelSubscription } from '@/lib/subscription/subscriptions';
import prisma from '@/lib/prisma';
import stripe from '@/lib/stripe';

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
    const body = await request.json();
    const { immediate = false } = body;

    // Récupérer l'abonnement actuel
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Aucun abonnement à annuler' },
        { status: 404 }
      );
    }

    // Si abonnement Stripe, annuler dans Stripe également
    if (subscription.stripeSubscriptionId && !subscription.stripeSubscriptionId.startsWith('local_')) {
      try {
        // Récupérer l'abonnement Stripe pour vérifier si un schedule existe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

        // Si un schedule existe, le libérer avant d'annuler
        if (stripeSubscription.schedule) {
          try {
            await stripe.subscriptionSchedules.release(stripeSubscription.schedule);
            console.log(`[Subscription Cancel] Schedule ${stripeSubscription.schedule} libéré avant annulation`);
          } catch (scheduleError) {
            // Log l'erreur mais continue (le schedule expirera de toute façon à la fin de période)
            console.error('[Subscription Cancel] Erreur libération schedule:', scheduleError);
          }
        }

        // Procéder à l'annulation
        if (immediate) {
          // Annulation immédiate
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } else {
          // Annulation à la fin de la période
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        }
      } catch (stripeError) {
        console.error('[Subscription Cancel] Erreur Stripe:', stripeError);
        // Continuer quand même l'annulation en local
      }
    }

    // Annuler l'abonnement en local
    const result = await cancelSubscription(userId, immediate);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
      message: immediate
        ? 'Abonnement annulé immédiatement'
        : 'Abonnement annulé à la fin de la période',
    });

  } catch (error) {
    console.error('[Subscription Cancel] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'annulation' },
      { status: 500 }
    );
  }
}
