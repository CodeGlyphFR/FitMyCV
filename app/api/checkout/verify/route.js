/**
 * GET /api/checkout/verify?session_id=xxx
 * Vérifie le statut d'une session de checkout Stripe
 * Utilisé pour le polling côté client après redirection
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import stripe from '@/lib/stripe';

// Forcer le rendu dynamique (route utilise auth() qui lit les headers)
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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id requis' },
        { status: 400 }
      );
    }

    // Récupérer la session Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Vérifier que la session appartient bien à l'utilisateur
    if (checkoutSession.metadata?.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Session non autorisée' },
        { status: 403 }
      );
    }

    // Retourner le statut
    return NextResponse.json({
      status: checkoutSession.payment_status, // 'paid', 'unpaid', 'no_payment_required'
      mode: checkoutSession.mode, // 'payment' ou 'subscription'
      metadata: checkoutSession.metadata,
      customer: checkoutSession.customer,
    });

  } catch (error) {
    console.error('[Checkout Verify] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la vérification' },
      { status: 500 }
    );
  }
}
