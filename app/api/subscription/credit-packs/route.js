/**
 * GET /api/subscription/credit-packs
 * Liste les packs de crédits disponibles
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

    const packs = await prisma.creditPack.findMany({
      orderBy: {
        creditAmount: 'asc',
      },
    });

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('[Credit Packs] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des packs' },
      { status: 500 }
    );
  }
}
