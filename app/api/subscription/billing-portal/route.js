/**
 * POST /api/subscription/billing-portal
 * Créer une session Stripe Billing Portal pour gérer les moyens de paiement
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

    // Récupérer le customer Stripe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId || user.stripeCustomerId.startsWith('local_')) {
      return NextResponse.json(
        { error: 'Aucun compte Stripe trouvé. Veuillez d\'abord effectuer un achat ou souscrire à un abonnement.' },
        { status: 400 }
      );
    }

    // Créer la session Billing Portal
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions`,
    });

    return NextResponse.json({
      url: portalSession.url,
    });

  } catch (error) {
    console.error('[Billing Portal] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création de la session' },
      { status: 500 }
    );
  }
}
