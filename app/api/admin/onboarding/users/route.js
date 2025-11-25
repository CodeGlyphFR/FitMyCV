import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import {
  determineUserStatus,
  calculateProgress,
  getStepNameFr,
} from '@/lib/admin/onboardingSteps';

/**
 * GET /api/admin/onboarding/users
 * Récupère la liste des utilisateurs avec leur statut d'onboarding
 *
 * Query params:
 * - page: numéro de page (défaut: 1)
 * - limit: nombre d'items par page (défaut: 10, max: 50)
 * - status: filtre par statut (completed, in_progress, skipped, not_started, stuck, all)
 * - step: filtre par étape actuelle (0-8)
 * - search: recherche par nom/email
 * - sortBy: tri (newest, oldest, progress)
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);
    const statusFilter = searchParams.get('status') || 'all';
    const stepFilter = searchParams.get('step');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'newest';

    // Ordre de tri
    let orderBy;
    switch (sortBy) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Récupérer tous les utilisateurs avec onboardingState
    const allUsers = await prisma.user.findMany({
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        onboardingState: true,
      },
    });

    // Transformer les utilisateurs avec leur statut calculé
    const searchTerm = search.trim().toLowerCase();

    let processedUsers = allUsers.map(user => {
      const state = user.onboardingState;
      const status = determineUserStatus(state);
      const progress = calculateProgress(state);

      // Déterminer si bloqué (>7 jours sans activité)
      let isStuck = false;
      let stuckDays = 0;
      if (state?.timestamps?.lastStepChangeAt && !state.hasCompleted && !state.isSkipped) {
        stuckDays = Math.floor((Date.now() - new Date(state.timestamps.lastStepChangeAt).getTime()) / (1000 * 60 * 60 * 24));
        isStuck = stuckDays > 7;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        status,
        currentStep: state?.currentStep ?? 0,
        currentStepName: getStepNameFr(state?.currentStep ?? 0),
        completedSteps: state?.completedSteps || [],
        modalsCompleted: state?.modals
          ? Object.values(state.modals).filter(m => m.completed).length
          : 0,
        totalModals: 6,
        progressPercent: progress,
        startedAt: state?.timestamps?.startedAt || null,
        completedAt: state?.timestamps?.completedAt || null,
        lastActivity: state?.timestamps?.lastStepChangeAt || user.createdAt,
        isStuck,
        stuckDays,
      };
    });

    // Filtrer par recherche
    if (searchTerm) {
      processedUsers = processedUsers.filter(user => {
        const nameMatch = user.name?.toLowerCase().includes(searchTerm);
        const emailMatch = user.email?.toLowerCase().includes(searchTerm);
        return nameMatch || emailMatch;
      });
    }

    // Filtrer par statut
    if (statusFilter !== 'all') {
      processedUsers = processedUsers.filter(user => user.status === statusFilter);
    }

    // Filtrer par étape
    if (stepFilter !== null && stepFilter !== undefined && stepFilter !== '') {
      const stepNum = parseInt(stepFilter, 10);
      if (!isNaN(stepNum) && stepNum >= 0 && stepNum <= 8) {
        processedUsers = processedUsers.filter(user => user.currentStep === stepNum);
      }
    }

    // Tri par progression si demandé
    if (sortBy === 'progress') {
      processedUsers.sort((a, b) => b.progressPercent - a.progressPercent);
    }

    // Calculer la pagination
    const totalCount = processedUsers.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Appliquer la pagination
    const paginatedUsers = processedUsers.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
    });

  } catch (error) {
    console.error('[Admin API] Error fetching onboarding users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding users' },
      { status: 500 }
    );
  }
}
