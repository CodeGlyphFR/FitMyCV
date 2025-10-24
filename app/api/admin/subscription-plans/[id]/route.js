import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/admin/subscription-plans/[id]
 * Modifie un plan d'abonnement et ses limitations de features
 * Body: {
 *   name?,
 *   description?,
 *   priceAmount?,
 *   priceCurrency?,
 *   pricePeriod?,
 *   maxCvCount?,
 *   tokenCount?,
 *   featureLimits?: [{ featureName, isEnabled, usageLimit }]
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

    const planId = parseInt(params.id, 10);
    if (isNaN(planId)) {
      return NextResponse.json(
        { error: 'ID de plan invalide' },
        { status: 400 }
      );
    }

    // Vérifier que le plan existe
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan d\'abonnement non trouvé' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      yearlyDiscountPercent,
      priceCurrency,
      maxCvCount,
      tokenCount,
      featureLimits,
    } = body;

    // Validation optionnelle des champs fournis
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Nom du plan invalide' },
          { status: 400 }
        );
      }

      // Vérifier l'unicité du nom (sauf pour le plan actuel)
      const nameExists = await prisma.subscriptionPlan.findFirst({
        where: {
          name,
          NOT: { id: planId },
        },
      });

      if (nameExists) {
        return NextResponse.json(
          { error: 'Un plan avec ce nom existe déjà' },
          { status: 409 }
        );
      }
    }

    if (priceMonthly !== undefined && (typeof priceMonthly !== 'number' || priceMonthly < 0)) {
      return NextResponse.json(
        { error: 'Prix mensuel invalide' },
        { status: 400 }
      );
    }

    if (priceYearly !== undefined && (typeof priceYearly !== 'number' || priceYearly < 0)) {
      return NextResponse.json(
        { error: 'Prix annuel invalide' },
        { status: 400 }
      );
    }

    if (yearlyDiscountPercent !== undefined && (typeof yearlyDiscountPercent !== 'number' || yearlyDiscountPercent < 0 || yearlyDiscountPercent > 100)) {
      return NextResponse.json(
        { error: 'Pourcentage de réduction annuelle invalide' },
        { status: 400 }
      );
    }

    if (maxCvCount !== undefined && typeof maxCvCount !== 'number') {
      return NextResponse.json(
        { error: 'Nombre max de CV invalide' },
        { status: 400 }
      );
    }

    if (tokenCount !== undefined && (typeof tokenCount !== 'number' || tokenCount < 0)) {
      return NextResponse.json(
        { error: 'Nombre de tokens invalide' },
        { status: 400 }
      );
    }

    // Construire les données de mise à jour
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (priceMonthly !== undefined) updateData.priceMonthly = priceMonthly;
    if (priceYearly !== undefined) updateData.priceYearly = priceYearly;
    if (yearlyDiscountPercent !== undefined) updateData.yearlyDiscountPercent = yearlyDiscountPercent;
    if (priceCurrency !== undefined) updateData.priceCurrency = priceCurrency;
    if (maxCvCount !== undefined) updateData.maxCvCount = maxCvCount;
    if (tokenCount !== undefined) updateData.tokenCount = tokenCount;

    // Si des featureLimits sont fournis, les mettre à jour en cascade
    if (featureLimits && Array.isArray(featureLimits)) {
      // Supprimer toutes les anciennes limites
      await prisma.subscriptionPlanFeatureLimit.deleteMany({
        where: { planId },
      });

      // Créer les nouvelles limites
      updateData.featureLimits = {
        create: featureLimits.map((fl) => ({
          featureName: fl.featureName,
          isEnabled: fl.isEnabled ?? true,
          usageLimit: fl.usageLimit ?? -1,
          allowedAnalysisLevels: fl.allowedAnalysisLevels ? JSON.stringify(fl.allowedAnalysisLevels) : null,
        })),
      };
    }

    // Mettre à jour le plan
    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: updateData,
      include: {
        featureLimits: {
          orderBy: {
            featureName: 'asc',
          },
        },
      },
    });

    return NextResponse.json({ plan: updatedPlan });

  } catch (error) {
    console.error('[Admin API] Error updating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription plan' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/subscription-plans/[id]
 * Supprime un plan d'abonnement
 * Les featureLimits seront automatiquement supprimés grâce à onDelete: Cascade
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

    const planId = parseInt(params.id, 10);
    if (isNaN(planId)) {
      return NextResponse.json(
        { error: 'ID de plan invalide' },
        { status: 400 }
      );
    }

    // Vérifier que le plan existe
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Plan d\'abonnement non trouvé' },
        { status: 404 }
      );
    }

    // Supprimer le plan (cascade sur featureLimits)
    await prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Admin API] Error deleting subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription plan' },
      { status: 500 }
    );
  }
}
