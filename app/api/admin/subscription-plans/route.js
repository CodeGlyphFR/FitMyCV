import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

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
      name,
      description,
      priceMonthly,
      priceYearly,
      yearlyDiscountPercent,
      priceCurrency,
      tokenCount,
      featureLimits,
    } = body;

    // Validation
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Nom du plan requis' },
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

    if (typeof yearlyDiscountPercent !== 'number' || yearlyDiscountPercent < 0 || yearlyDiscountPercent > 100) {
      return NextResponse.json(
        { error: 'Pourcentage de réduction annuelle invalide' },
        { status: 400 }
      );
    }

    if (!priceCurrency || typeof priceCurrency !== 'string') {
      return NextResponse.json(
        { error: 'Devise du prix requise' },
        { status: 400 }
      );
    }

    if (typeof tokenCount !== 'number' || tokenCount < 0) {
      return NextResponse.json(
        { error: 'Nombre de tokens invalide' },
        { status: 400 }
      );
    }

    // Vérifier que le nom n'existe pas déjà
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Un plan avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    // Créer le plan avec ses features
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        description: description || null,
        priceMonthly,
        priceYearly,
        yearlyDiscountPercent,
        priceCurrency,
        tokenCount,
        featureLimits: {
          create: featureLimits?.map((fl) => ({
            featureName: fl.featureName,
            isEnabled: fl.isEnabled ?? true,
            usageLimit: fl.usageLimit ?? -1,
            allowedAnalysisLevels: fl.allowedAnalysisLevels ? JSON.stringify(fl.allowedAnalysisLevels) : null,
          })) || [],
        },
      },
      include: {
        featureLimits: true,
      },
    });

    return NextResponse.json({ plan }, { status: 201 });

  } catch (error) {
    console.error('[Admin API] Error creating subscription plan:', error);
    return NextResponse.json(
      { error: 'Failed to create subscription plan' },
      { status: 500 }
    );
  }
}
