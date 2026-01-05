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
 * GET /api/admin/subscription-plans
 * Récupère la liste de tous les plans d'abonnement avec leurs limitations
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

    // Récupérer tous les plans avec leurs features incluses
    const plans = await prisma.subscriptionPlan.findMany({
      include: {
        featureLimits: {
          orderBy: {
            featureName: 'asc',
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return NextResponse.json({ plans });

  } catch (error) {
    console.error('[Admin API] Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription plans' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/subscription-plans
 * Crée un nouveau plan d'abonnement avec ses limitations de features
 * Body: {
 *   name,
 *   description,
 *   priceAmount,
 *   priceCurrency,
 *   pricePeriod,
 *   maxCvCount,
 *   tokenCount,
 *   featureLimits: [{ featureName, isEnabled, usageLimit }]
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
      priceMonthly,
      priceYearly,
      priceCurrency,
      featureLimits,
      // Nouveaux champs robustes
      isFree = false,
      tier = 0,
      isPopular = false,
    } = body;

    // Validation
    if (typeof tier !== 'number' || tier < 0) {
      return NextResponse.json(
        { error: 'Niveau (tier) invalide' },
        { status: 400 }
      );
    }

    if (typeof priceMonthly !== 'number' || priceMonthly < 0) {
      return NextResponse.json(
        { error: 'Prix mensuel invalide' },
        { status: 400 }
      );
    }

    if (typeof priceYearly !== 'number' || priceYearly < 0) {
      return NextResponse.json(
        { error: 'Prix annuel invalide' },
        { status: 400 }
      );
    }

    if (!priceCurrency || typeof priceCurrency !== 'string') {
      return NextResponse.json(
        { error: 'Devise du prix requise' },
        { status: 400 }
      );
    }

    // Générer automatiquement le nom à partir du tier
    const name = generatePlanName(tier);

    // Vérifier qu'il n'existe pas déjà un plan avec ce tier
    const existingTier = await prisma.subscriptionPlan.findFirst({
      where: { tier },
    });

    if (existingTier) {
      return NextResponse.json(
        { error: `Un plan avec le niveau ${tier} existe déjà : "${existingTier.name}"` },
        { status: 409 }
      );
    }

    // IMPORTANT: Vérifier qu'il n'y a pas déjà un plan gratuit (priceMonthly === 0)
    // Un seul plan gratuit est autorisé dans le système
    const isFreeplan = priceMonthly === 0 && priceYearly === 0;
    if (isFreeplan) {
      const existingFreePlan = await prisma.subscriptionPlan.findFirst({
        where: {
          priceMonthly: 0,
          priceYearly: 0,
        },
      });

      if (existingFreePlan) {
        return NextResponse.json(
          { error: `Un plan gratuit existe déjà : "${existingFreePlan.name}". Vous ne pouvez avoir qu'un seul plan gratuit dans le système.` },
          { status: 409 }
        );
      }
    }

    // Calculer la réduction annuelle automatiquement
    const yearlyDiscountPercent = priceMonthly > 0 && priceYearly > 0
      ? ((priceMonthly * 12 - priceYearly) / (priceMonthly * 12)) * 100
      : 0;

    // Créer le plan avec ses features
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        description: null, // Description supprimée
        priceMonthly,
        priceYearly,
        yearlyDiscountPercent,
        priceCurrency,
        // Nouveaux champs
        isFree,
        tier,
        isPopular,
        featureLimits: {
          create: featureLimits?.map((fl) => ({
            featureName: fl.featureName,
            isEnabled: fl.isEnabled ?? true,
            usageLimit: fl.usageLimit ?? -1,
          })) || [],
        },
      },
      include: {
        featureLimits: true,
      },
    });

    // Synchroniser avec Stripe (non-bloquant)
    syncStripeProductsInternal().catch(err => console.warn('[Admin] Stripe sync failed:', err));

    return NextResponse.json({ plan }, { status: 201 });

  } catch (error) {
    console.error('[Admin API] Error creating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription plan' },
      { status: 500 }
    );
  }
}
