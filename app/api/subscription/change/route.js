/**
 * POST /api/subscription/change
 * Change le plan d'abonnement (upgrade/downgrade)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { changeSubscription } from '@/lib/subscription/subscriptions';
import { blockCvsForDowngrade } from '@/lib/subscription/cvLimits';

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
    const { planId, cvsToBlock = [] } = body;

    // Validation
    if (!planId || typeof planId !== 'number') {
      return NextResponse.json(
        { error: 'planId requis' },
        { status: 400 }
      );
    }

    // Si des CV doivent être bloqués (downgrade confirmé)
    if (cvsToBlock.length > 0) {
      const blockResult = await blockCvsForDowngrade(
        userId,
        cvsToBlock,
        'Downgrade abonnement'
      );

      if (!blockResult.success) {
        return NextResponse.json(
          { error: blockResult.error },
          { status: 500 }
        );
      }
    }

    // Changer l'abonnement
    const result = await changeSubscription(userId, planId);

    if (!result.success) {
      // Si needsCvBlocking=true, retourner les CV suggérés pour blocage
      if (result.needsCvBlocking) {
        return NextResponse.json({
          needsCvBlocking: true,
          suggestedCvs: result.suggestedCvs,
          error: result.error,
        }, { status: 400 });
      }

      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: result.subscription,
    });

  } catch (error) {
    console.error('[Subscription Change] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du changement d\'abonnement' },
      { status: 500 }
    );
  }
}
