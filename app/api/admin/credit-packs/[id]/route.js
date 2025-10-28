import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { syncStripeProductsInternal } from '@/lib/subscription/stripeSync';

/**
 * PATCH /api/admin/credit-packs/[id]
 * Modifie un pack de crédits
 * Le nom est automatiquement régénéré si creditAmount est modifié
 * Body: {
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
      creditAmount,
      price,
      priceCurrency,
      isActive,
    } = body;

    // Validation optionnelle des champs fournis
    if (creditAmount !== undefined) {
      if (typeof creditAmount !== 'number' || creditAmount <= 0) {
        return NextResponse.json(
          { error: 'Le nombre de crédits doit être supérieur à 0' },
          { status: 400 }
        );
      }

      // Vérifier l'unicité du creditAmount (sauf pour le pack actuel)
      const creditAmountExists = await prisma.creditPack.findFirst({
        where: {
          creditAmount,
          NOT: { id: packId },
        },
      });

      if (creditAmountExists) {
        return NextResponse.json(
          { error: `Un pack avec ${creditAmount} crédits existe déjà` },
          { status: 409 }
        );
      }
    }

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return NextResponse.json(
        { error: 'Prix invalide' },
        { status: 400 }
      );
    }

    // Construire les données de mise à jour
    const updateData = {};
    if (creditAmount !== undefined) {
      updateData.creditAmount = creditAmount;
      // Régénérer automatiquement le nom
      updateData.name = `${creditAmount} Crédits`;
    }
    if (price !== undefined) updateData.price = price;
    if (priceCurrency !== undefined) updateData.priceCurrency = priceCurrency;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Mettre à jour le pack
    const updatedPack = await prisma.creditPack.update({
      where: { id: packId },
      data: updateData,
    });

    // Synchroniser avec Stripe (non-bloquant)
    syncStripeProductsInternal().catch(err => console.warn('[Admin] Stripe sync failed:', err));

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

    // Synchroniser avec Stripe (non-bloquant)
    syncStripeProductsInternal().catch(err => console.warn('[Admin] Stripe sync failed:', err));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Admin API] Error deleting credit pack:', error);
    return NextResponse.json(
      { error: 'Failed to delete credit pack' },
      { status: 500 }
    );
  }
}
