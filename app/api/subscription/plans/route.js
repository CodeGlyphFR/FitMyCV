/**
 * GET /api/subscription/plans
 * Liste les plans d'abonnement disponibles
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { CommonErrors } from '@/lib/api/apiErrors';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        featureLimits: true,
      },
      orderBy: {
        priceMonthly: 'asc',
      },
    });

    return NextResponse.json({ plans });
  } catch (error) {
    console.error('[Subscription Plans] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des plans' },
      { status: 500 }
    );
  }
}
