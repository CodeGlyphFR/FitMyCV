/**
 * GET /api/subscription/current
 * Récupère l'abonnement actuel de l'utilisateur avec toutes les infos
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getSubscriptionSummary } from '@/lib/subscription/subscriptions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

    // Récupérer le résumé complet
    const summary = await getSubscriptionSummary(userId);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('[Subscription Current] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération de l\'abonnement' },
      { status: 500 }
    );
  }
}
