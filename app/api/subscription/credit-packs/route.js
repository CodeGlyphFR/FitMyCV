/**
 * GET /api/subscription/credit-packs
 * Liste les packs de crédits disponibles (pour tous les utilisateurs)
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const packs = await prisma.creditPack.findMany({
      orderBy: {
        creditAmount: 'asc',
      },
    });

    return NextResponse.json({ packs });
  } catch (error) {
    console.error('[Credit Packs] Erreur:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la récupération des packs' },
      { status: 500 }
    );
  }
}
