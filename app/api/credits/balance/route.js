/**
 * GET /api/credits/balance
 * Récupère la balance de crédits de l'utilisateur
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getCreditBalance } from '@/lib/subscription/credits';

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
    const balance = await getCreditBalance(userId);

    return NextResponse.json(balance);

  } catch (error) {
    console.error('[Credits Balance] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de la balance' },
      { status: 500 }
    );
  }
}
