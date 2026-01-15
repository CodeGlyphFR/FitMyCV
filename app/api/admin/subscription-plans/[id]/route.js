import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { syncStripeProductsInternal } from '@/lib/subscription/stripeSync';

/**
 * Génère le nom d'un plan à partir de son tier
 * @param {number} tier - Niveau du plan (0=Gratuit, 1=Pro, 2=Premium, etc.)
 * @returns {string} Nom du plan
 */
function generatePlanName(tier) {
  const TIER_NAMES = {
    0: 'Gratuit',
    1: 'Pro',
    2: 'Premium',
    3: 'Business',
    4: 'Enterprise'
  };
  return TIER_NAMES[tier] || `Niveau ${tier}`;
}

/**
 * PATCH /api/admin/subscription-plans/[id]
 * Modifie un plan d'abonnement et ses limitations de features
 * Body: {
 *   tier?,
 *   priceMonthly?,
 *   priceYearly?,
 *   priceCurrency?,
 *   isFree?,
 *   isPopular?,
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

    // Next.js 16: params est maintenant async
    const { id } = await params;
    const planId = parseInt(id, 10);
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
      priceMonthly,
      priceYearly,
      priceCurrency,
      featureLimits,
      // Nouveaux champs robustes
      isFree,
      tier,
      isPopular,
    } = body;

    // Validation optionnelle des champs fournis
    if (tier !== undefined) {
      if (typeof tier !== 'number' || tier < 0) {
        return NextResponse.json(
          { error: 'Niveau (tier) invalide' },
          { status: 400 }
        );
      }

      // Vérifier l'unicité du tier (sauf pour le plan actuel)
      const tierExists = await prisma.subscriptionPlan.findFirst({
        where: {
          tier,
          NOT: { id: planId },
        },
      });

      if (tierExists) {
        return NextResponse.json(
          { error: `Un plan avec le niveau ${tier} existe déjà : "${tierExists.name}"` },
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

    // IMPORTANT: Vérifier qu'il n'y a pas déjà un autre plan gratuit si on modifie ce plan vers 0€
    // Un seul plan gratuit est autorisé dans le système
    const updatedPriceMonthly = priceMonthly !== undefined ? priceMonthly : existingPlan.priceMonthly;
    const updatedPriceYearly = priceYearly !== undefined ? priceYearly : existingPlan.priceYearly;
    const wouldBecomeFree = updatedPriceMonthly === 0 && updatedPriceYearly === 0;

    if (wouldBecomeFree) {
      const existingFreePlan = await prisma.subscriptionPlan.findFirst({
        where: {
          priceMonthly: 0,
          priceYearly: 0,
          NOT: { id: planId }, // Exclure le plan actuel
        },
      });

      if (existingFreePlan) {
        return NextResponse.json(
          { error: `Un autre plan gratuit existe déjà : "${existingFreePlan.name}". Vous ne pouvez avoir qu'un seul plan gratuit dans le système.` },
          { status: 409 }
        );
      }
    }

    // Construire les données de mise à jour
    const updateData = {};

    // Générer automatiquement le nom si le tier change
    if (tier !== undefined) {
      updateData.tier = tier;
      updateData.name = generatePlanName(tier);
    }

    if (priceMonthly !== undefined) updateData.priceMonthly = priceMonthly;
    if (priceYearly !== undefined) updateData.priceYearly = priceYearly;
    if (priceCurrency !== undefined) updateData.priceCurrency = priceCurrency;
    if (isFree !== undefined) updateData.isFree = isFree;
    if (isPopular !== undefined) updateData.isPopular = isPopular;

    // Calculer automatiquement la réduction annuelle si les prix changent
    const finalPriceMonthly = priceMonthly !== undefined ? priceMonthly : existingPlan.priceMonthly;
    const finalPriceYearly = priceYearly !== undefined ? priceYearly : existingPlan.priceYearly;

    if (priceMonthly !== undefined || priceYearly !== undefined) {
      updateData.yearlyDiscountPercent = finalPriceMonthly > 0 && finalPriceYearly > 0
        ? ((finalPriceMonthly * 12 - finalPriceYearly) / (finalPriceMonthly * 12)) * 100
        : 0;
    }

    // Description toujours null (supprimée)
    updateData.description = null;

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

    // Synchroniser avec Stripe (non-bloquant)
    syncStripeProductsInternal().catch(err => console.warn('[Admin] Stripe sync failed:', err));

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

    // Next.js 16: params est maintenant async
    const { id } = await params;
    const planId = parseInt(id, 10);
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

    // Synchroniser avec Stripe (non-bloquant)
    syncStripeProductsInternal().catch(err => console.warn('[Admin] Stripe sync failed:', err));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Admin API] Error deleting subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription plan' },
      { status: 500 }
    );
  }
}
