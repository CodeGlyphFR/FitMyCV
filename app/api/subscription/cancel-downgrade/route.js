/**
 * POST /api/subscription/cancel-downgrade
 * Annule un downgrade programmé en libérant le schedule Stripe
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
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

    // Récupérer l'abonnement actuel
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'Aucun abonnement trouvé' },
        { status: 404 }
      );
    }

    if (!subscription.stripeSubscriptionId || subscription.stripeSubscriptionId.startsWith('local_')) {
      return NextResponse.json(
        { error: 'Aucun abonnement Stripe actif' },
        { status: 400 }
      );
    }

    // Récupérer l'abonnement Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);

    if (!stripeSubscription.schedule) {
      return NextResponse.json(
        { error: 'Aucun downgrade programmé' },
        { status: 400 }
      );
    }

    // Libérer le schedule (retour à un abonnement sans schedule)
    const releasedSubscription = await stripe.subscriptionSchedules.release(stripeSubscription.schedule);

    console.log(`[Cancel Downgrade] Schedule ${stripeSubscription.schedule} libéré pour user ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Downgrade annulé avec succès',
      subscription: {
        id: releasedSubscription.id,
        status: releasedSubscription.status,
      },
    });

  } catch (error) {
    console.error('[Cancel Downgrade] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'annulation du downgrade' },
      { status: 500 }
    );
  }
}
