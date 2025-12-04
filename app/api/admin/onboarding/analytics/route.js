import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
import {
  ONBOARDING_STEPS,
  ONBOARDING_MODALS,
  ONBOARDING_ANALYTICS_CONFIG,
  determineUserStatus,
  formatDuration,
} from '@/lib/admin/onboardingSteps';

/**
 * GET /api/admin/onboarding/analytics
 * Récupère les KPIs et statistiques de l'onboarding
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (défaut: '30d')
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
    const period = searchParams.get('period') || '30d';

    // Calculer la date de début selon la période
    let startDate = null;
    const now = new Date();
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        startDate = null;
        break;
    }

    // Récupérer TOUS les utilisateurs avec leur onboardingState
    // Le filtrage par période se fait en JavaScript sur les timestamps d'activité onboarding
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        createdAt: true,
        onboardingState: true,
      },
    });

    // Filtrer par activité onboarding dans la période (pas par date de création du compte)
    const users = startDate
      ? allUsers.filter(user => {
          const state = user.onboardingState;
          if (!state || typeof state !== 'object') return false;

          const timestamps = state.timestamps;
          if (!timestamps) return false;

          // Vérifier si une activité onboarding a eu lieu dans la période
          const startedAt = timestamps.startedAt ? new Date(timestamps.startedAt) : null;
          const completedAt = timestamps.completedAt ? new Date(timestamps.completedAt) : null;
          const skippedAt = timestamps.skippedAt ? new Date(timestamps.skippedAt) : null;
          const lastActivity = timestamps.lastStepChangeAt ? new Date(timestamps.lastStepChangeAt) : null;

          return (
            (startedAt && startedAt >= startDate) ||
            (completedAt && completedAt >= startDate) ||
            (skippedAt && skippedAt >= startDate) ||
            (lastActivity && lastActivity >= startDate)
          );
        })
      : allUsers;

    // Initialiser les compteurs
    const stats = {
      totalUsers: users.length,
      started: 0,
      completed: 0,
      skipped: 0,
      inProgress: 0,
      notStarted: 0,
      stuck: 0,
      completionTimes: [],
    };

    // Compteurs pour le funnel
    const stepReached = {};
    const stepCompleted = {};
    ONBOARDING_STEPS.forEach(step => {
      stepReached[step.id] = 0;
      stepCompleted[step.id] = 0;
    });

    // Compteurs pour les modales
    const modalStats = {};
    ONBOARDING_MODALS.forEach(modal => {
      modalStats[modal.key] = { completed: 0, total: 0 };
    });

    // Timeline des N derniers jours (configurable)
    const timelineDays = ONBOARDING_ANALYTICS_CONFIG.TIMELINE_DAYS;
    const timelineData = {};
    for (let i = 0; i < timelineDays; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      timelineData[dateKey] = { started: 0, completed: 0, skipped: 0 };
    }

    // Analyser chaque utilisateur
    users.forEach(user => {
      const state = user.onboardingState;

      if (!state || typeof state !== 'object' || Object.keys(state).length === 0) {
        stats.notStarted++;
        return;
      }

      // Déterminer le statut
      const status = determineUserStatus(state);

      switch (status) {
        case 'completed':
          stats.completed++;
          stats.started++;
          break;
        case 'skipped':
          stats.skipped++;
          stats.started++;
          break;
        case 'stuck':
          stats.stuck++;
          stats.started++;
          stats.inProgress++;
          break;
        case 'in_progress':
          stats.inProgress++;
          stats.started++;
          break;
        case 'not_started':
          stats.notStarted++;
          break;
      }

      // Calculer le temps de complétion
      if (state.hasCompleted && state.timestamps?.startedAt && state.timestamps?.completedAt) {
        const duration = new Date(state.timestamps.completedAt).getTime() - new Date(state.timestamps.startedAt).getTime();
        if (duration > 0) {
          stats.completionTimes.push(duration);
        }
      }

      // Compter les étapes atteintes/complétées
      if (state.currentStep !== undefined) {
        // Toutes les étapes jusqu'à currentStep ont été atteintes
        for (let i = 0; i <= state.currentStep && i <= 8; i++) {
          stepReached[i] = (stepReached[i] || 0) + 1;
        }
      }

      // Étapes complétées
      if (Array.isArray(state.completedSteps)) {
        state.completedSteps.forEach(stepNum => {
          if (stepNum >= 0 && stepNum <= 8) {
            stepCompleted[stepNum] = (stepCompleted[stepNum] || 0) + 1;
          }
        });
      }

      // Compter les modales
      if (state.modals && typeof state.modals === 'object') {
        ONBOARDING_MODALS.forEach(modal => {
          // Incrémenter le total si l'utilisateur a démarré
          if (state.timestamps?.startedAt || state.currentStep > 0) {
            modalStats[modal.key].total++;
          }

          // Incrémenter les complétés
          if (state.modals[modal.key]?.completed) {
            modalStats[modal.key].completed++;
          }
        });
      }

      // Timeline - Date de début
      if (state.timestamps?.startedAt) {
        const startDateStr = new Date(state.timestamps.startedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        if (timelineData[startDateStr]) {
          timelineData[startDateStr].started++;
        }
      }

      // Timeline - Date de complétion
      if (state.timestamps?.completedAt) {
        const completedDateStr = new Date(state.timestamps.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        if (timelineData[completedDateStr]) {
          timelineData[completedDateStr].completed++;
        }
      }

      // Timeline - Date de skip
      if (state.timestamps?.skippedAt) {
        const skippedDateStr = new Date(state.timestamps.skippedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        if (timelineData[skippedDateStr]) {
          timelineData[skippedDateStr].skipped++;
        }
      }
    });

    // Calculer les KPIs
    const completionRate = stats.started > 0
      ? Math.round((stats.completed / stats.started) * 100 * 10) / 10
      : 0;

    const skipRate = stats.started > 0
      ? Math.round((stats.skipped / stats.started) * 100 * 10) / 10
      : 0;

    // Moyenne du temps de complétion
    const avgCompletionTimeMs = stats.completionTimes.length > 0
      ? Math.round(stats.completionTimes.reduce((a, b) => a + b, 0) / stats.completionTimes.length)
      : 0;

    // Score de santé: (completionRate * 0.6) + ((100 - skipRate) * 0.4)
    const healthScore = Math.round((completionRate * 0.6) + ((100 - skipRate) * 0.4));

    // Construire le funnel
    const funnel = ONBOARDING_STEPS.map(step => ({
      step: step.id,
      name: step.nameFr,
      icon: step.icon,
      reached: stepReached[step.id] || 0,
      completed: stepCompleted[step.id] || 0,
    }));

    // Ajouter "Completed" comme dernière entrée du funnel
    funnel.push({
      step: 9,
      name: 'Complété',
      icon: '🎉',
      reached: stats.completed,
      completed: stats.completed,
    });

    // Calculer les drop-offs entre étapes
    const stepDropoff = [];
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i++) {
      const fromStep = ONBOARDING_STEPS[i];
      const toStep = ONBOARDING_STEPS[i + 1];
      const fromCount = stepReached[fromStep.id] || 0;
      const toCount = stepReached[toStep.id] || 0;

      const dropoffCount = fromCount - toCount;
      const dropoffRate = fromCount > 0
        ? Math.round((dropoffCount / fromCount) * 100 * 10) / 10
        : 0;

      stepDropoff.push({
        from: fromStep.id,
        to: toStep.id,
        fromName: fromStep.nameFr,
        toName: toStep.nameFr,
        dropoffCount,
        dropoffRate,
      });
    }

    // Calculer le taux de complétion des modales
    const modals = {};
    ONBOARDING_MODALS.forEach(modal => {
      const stat = modalStats[modal.key];
      modals[modal.key] = {
        name: modal.nameFr,
        completed: stat.completed,
        total: stat.total,
        rate: stat.total > 0
          ? Math.round((stat.completed / stat.total) * 100 * 10) / 10
          : 0,
      };
    });

    // Construire la timeline (inverser pour avoir les dates les plus anciennes en premier)
    const timeline = Object.entries(timelineData)
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .reverse();

    return NextResponse.json({
      period,
      kpis: {
        totalUsers: stats.totalUsers,
        started: stats.started,
        completed: stats.completed,
        skipped: stats.skipped,
        inProgress: stats.inProgress,
        notStarted: stats.notStarted,
        stuckCount: stats.stuck,
        completionRate,
        skipRate,
        avgCompletionTimeMs,
        avgCompletionTime: formatDuration(avgCompletionTimeMs),
        healthScore,
      },
      funnel,
      stepDropoff,
      modals,
      timeline,
    });

  } catch (error) {
    console.error('[Admin API] Error fetching onboarding analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding analytics' },
      { status: 500 }
    );
  }
}
