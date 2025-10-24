import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/credit-packs
 * Récupère la liste de tous les packs de crédits
 */
export async function GET(request) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Récupérer tous les packs de crédits
    const packs = await prisma.creditPack.findMany({
      orderBy: {
        id: 'asc',
      },
    });

    return NextResponse.json({ packs });

  } catch (error) {
    console.error('[Admin API] Error fetching credit packs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit packs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/credit-packs
 * Crée un nouveau pack de crédits
 * Body: {
 *   name,
 *   description,
 *   creditAmount,
 *   price,
 *   priceCurrency,
 *   isActive
 * }
 */
export async function POST(request) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      creditAmount,
      price,
      priceCurrency,
      isActive,
    } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Nom du pack requis' },
        { status: 400 }
      );
    }

    if (typeof creditAmount !== 'number' || creditAmount <= 0) {
      return NextResponse.json(
        { error: 'Le nombre de crédits doit être supérieur à 0' },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { error: 'Prix invalide' },
        { status: 400 }
      );
    }

    if (!priceCurrency || typeof priceCurrency !== 'string') {
      return NextResponse.json(
        { error: 'Devise du prix requise' },
        { status: 400 }
      );
    }

    // Vérifier que le nom n'existe pas déjà
    const existing = await prisma.creditPack.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Un pack avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    // Créer le pack
    const pack = await prisma.creditPack.create({
      data: {
        name,
        description: description || null,
        creditAmount,
        price,
        priceCurrency,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ pack }, { status: 201 });

  } catch (error) {
    console.error('[Admin API] Error creating credit pack:', error);
    return NextResponse.json(
      { error: 'Failed to create credit pack' },
      { status: 500 }
    );
  }
}
