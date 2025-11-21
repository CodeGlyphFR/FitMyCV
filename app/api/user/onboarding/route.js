import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { ONBOARDING_STEPS } from '@/lib/onboarding/onboardingSteps';

// Constante : nombre d'étapes total (dynamique depuis config)
const MAX_STEP = ONBOARDING_STEPS.length; // 7 étapes

/**
 * GET /api/user/onboarding
 * Récupérer l'état d'onboarding de l'utilisateur
 */
export async function GET(request) {
  try {
    // Authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Récupérer user avec champs onboarding
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        onboardingStep: true,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Déterminer si skipped
    const isSkipped = !!user.onboardingSkippedAt;

    // Réponse
    return NextResponse.json({
      currentStep: user.onboardingStep || 0,
      hasCompleted: user.hasCompletedOnboarding,
      isSkipped,
      completedAt: user.onboardingCompletedAt?.toISOString() || null,
      skippedAt: user.onboardingSkippedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('[API /api/user/onboarding GET] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/onboarding
 * Mettre à jour l'étape en cours
 *
 * Body: { step: number }
 */
export async function PUT(request) {
  try {
    // Authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Parse body
    const body = await request.json();
    const { step } = body;

    // Validation
    if (typeof step !== 'number' || step < 0 || step > MAX_STEP) {
      return NextResponse.json(
        { error: `Étape invalide (doit être entre 0 et ${MAX_STEP})` },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingStep: step,
        // Si on passe de 0 à 1+, c'est qu'on démarre l'onboarding
        // Donc on reset hasCompletedOnboarding à false
        ...(step > 0 && {
          hasCompletedOnboarding: false,
          onboardingCompletedAt: null,
          onboardingSkippedAt: null,
        }),
      },
      select: {
        onboardingStep: true,
        hasCompletedOnboarding: true,
      },
    });

    return NextResponse.json({
      success: true,
      currentStep: updatedUser.onboardingStep,
      hasCompleted: updatedUser.hasCompletedOnboarding,
    });
  } catch (error) {
    console.error('[API /api/user/onboarding PUT] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/onboarding/complete
 * Marquer l'onboarding comme complété
 */
export async function POST(request) {
  try {
    // Authentification
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Vérifier l'action via query parameter (complete, skip, reset)
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Validation du paramètre action
    if (!action) {
      return NextResponse.json(
        { error: 'Le paramètre "action" est requis (skip, complete, reset)' },
        { status: 400 }
      );
    }

    const validActions = ['skip', 'complete', 'reset'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Action invalide. Valeurs acceptées: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (action === 'complete') {
      // Marquer comme complété
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date(),
          onboardingStep: MAX_STEP, // Toutes les étapes complétées (7)
        },
        select: {
          hasCompletedOnboarding: true,
          onboardingCompletedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        completedAt: updatedUser.onboardingCompletedAt.toISOString(),
      });
    } else if (action === 'skip') {
      // Marquer comme skipped
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          hasCompletedOnboarding: true, // Considéré comme complété (skipped)
          onboardingSkippedAt: new Date(),
        },
        select: {
          hasCompletedOnboarding: true,
          onboardingSkippedAt: true,
        },
      });

      return NextResponse.json({
        success: true,
        skippedAt: updatedUser.onboardingSkippedAt.toISOString(),
      });
    } else if (action === 'reset') {
      // Reset onboarding (pour relancer depuis settings)
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          hasCompletedOnboarding: false,
          onboardingStep: 0,
          onboardingCompletedAt: null,
          onboardingSkippedAt: null,
        },
        select: {
          hasCompletedOnboarding: true,
          onboardingStep: true,
        },
      });

      return NextResponse.json({
        success: true,
        currentStep: updatedUser.onboardingStep,
      });
    } else {
      return NextResponse.json(
        { error: 'Action invalide' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API /api/user/onboarding POST] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
