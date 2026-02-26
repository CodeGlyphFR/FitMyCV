/**
 * GET /api/credits/transactions
 * Récupère l'historique des transactions de crédits
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getCreditTransactions } from '@/lib/subscription/credits';

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
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type') || null;

    const transactions = await getCreditTransactions(userId, {
      limit,
      offset,
      type,
    });

    return NextResponse.json({ transactions });

  } catch (error) {
    console.error('[Credits Transactions] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    );
  }
}
