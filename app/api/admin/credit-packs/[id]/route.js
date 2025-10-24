import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/admin/credit-packs/[id]
 * Modifie un pack de crédits
 * Body: {
 *   name?,
 *   description?,
 *   creditAmount?,
 *   price?,
 *   priceCurrency?,
 *   isActive?
 * }
 */
export async function PATCH(request, { params }) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const packId = parseInt(params.id, 10);
    if (isNaN(packId)) {
      return NextResponse.json(
        { error: 'ID de pack invalide' },
        { status: 400 }
      );
    }

    // Vérifier que le pack existe
    const existingPack = await prisma.creditPack.findUnique({
      where: { id: packId },
    });

    if (!existingPack) {
      return NextResponse.json(
        { error: 'Pack de crédits non trouvé' },
        { status: 404 }
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

    // Validation optionnelle des champs fournis
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Nom du pack invalide' },
          { status: 400 }
        );
      }

      // Vérifier l'unicité du nom (sauf pour le pack actuel)
      const nameExists = await prisma.creditPack.findFirst({
        where: {
          name,
          NOT: { id: packId },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'Un pack avec ce nom existe déjà' },
          { status: 409 }
        );
      }
    }

    if (creditAmount !== undefined && (typeof creditAmount !== 'number' || creditAmount <= 0)) {
      return NextResponse.json(
        { error: 'Le nombre de crédits doit être supérieur à 0' },
        { status: 400 }
      );
    }

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json(
        { error: 'Prix invalide' },
        { status: 400 }
      );
    }

    // Construire les données de mise à jour
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (creditAmount !== undefined) updateData.creditAmount = creditAmount;
    if (price !== undefined) updateData.price = price;
    if (priceCurrency !== undefined) updateData.priceCurrency = priceCurrency;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Mettre à jour le pack
    const updatedPack = await prisma.creditPack.update({
      where: { id: packId },
      data: updateData,
    });

    return NextResponse.json({ pack: updatedPack });

  } catch (error) {
    console.error('[Admin API] Error updating credit pack:', error);
    return NextResponse.json(
      { error: 'Failed to update credit pack' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/credit-packs/[id]
 * Supprime un pack de crédits
 */
export async function DELETE(request, { params }) {
  try {
    const session = await auth();

    // Vérifier que l'utilisateur est admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const packId = parseInt(params.id, 10);
    if (isNaN(packId)) {
      return NextResponse.json(
        { error: 'ID de pack invalide' },
        { status: 400 }
      );
    }

    // Vérifier que le pack existe
    const existingPack = await prisma.creditPack.findUnique({
      where: { id: packId },
    });

    if (!existingPack) {
      return NextResponse.json(
        { error: 'Pack de crédits non trouvé' },
        { status: 404 }
      );
    }

    // Supprimer le pack
    await prisma.creditPack.delete({
      where: { id: packId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Admin API] Error deleting credit pack:', error);
    return NextResponse.json(
      { error: 'Failed to delete credit pack' },
      { status: 500 }
    );
  }
}
