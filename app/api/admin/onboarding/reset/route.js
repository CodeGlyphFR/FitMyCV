import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { DEFAULT_ONBOARDING_STATE } from '@/lib/onboarding/onboardingState';

/**
 * POST /api/admin/onboarding/reset
 * Réinitialise l'onboarding d'un utilisateur spécifique
 *
 * Body: { userId: string }
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
    const { userId } = body;

    // Validation
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId requis' },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        onboardingState: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Réinitialiser l'onboardingState
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingState: DEFAULT_ONBOARDING_STATE,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    console.log(`[Admin API] Onboarding reset for user ${userId} by admin ${session.user.id}`);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `Onboarding réinitialisé pour ${updatedUser.email}`,
    });

  } catch (error) {
    console.error('[Admin API] Error resetting onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to reset onboarding' },
      { status: 500 }
    );
  }
}
