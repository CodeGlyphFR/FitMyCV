/**
 * API Routes: /api/user/onboarding
 *
 * Gère l'état d'onboarding des utilisateurs avec:
 * - Type Json pour onboardingState (Prisma parse automatiquement)
 * - Synchronisation SSE temps réel multi-device
 * - Source unique de vérité (onboardingState uniquement)
 *
 * Routes:
 * - GET: Récupérer l'état complet
 * - PUT: Mettre à jour l'étape en cours
 * - PATCH: Mettre à jour onboardingState
 * - POST: Actions (complete, skip, reset)
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { getTotalSteps } from '@/lib/onboarding/onboardingSteps';
import { DEFAULT_ONBOARDING_STATE, normalizeOnboardingState } from '@/lib/onboarding/onboardingState';
import { ONBOARDING_API } from '@/lib/onboarding/onboardingConfig';
import dbEmitter from '@/lib/events/dbEmitter';
import { CommonErrors, OtherErrors } from '@/lib/api/apiErrors';

// Constante : nombre d'étapes total
const MAX_STEP = getTotalSteps();

// Cache in-memory avec TTL pour éviter DB writes multiples
const updateCache = new Map();
const CACHE_TTL = ONBOARDING_API.CACHE_TTL; // 1000ms TTL (synchronisé avec debounce persistence)
const CACHE_CLEANUP_INTERVAL = 60000; // Cleanup toutes les 60 secondes

// Cleanup périodique du cache
const cacheCleanupTimer = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of updateCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      updateCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0 && process.env.NODE_ENV === 'development') {
    console.log(`[Cache Cleanup] Supprimé ${cleaned} entrées expirées`);
  }
}, CACHE_CLEANUP_INTERVAL);

/**
 * Vérifier si l'update peut être skippé (cache hit)
 */
function shouldSkipUpdate(userId, updates) {
  const cacheKey = String(userId);
  const cached = updateCache.get(cacheKey);

  if (!cached) return false;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    updateCache.delete(cacheKey);
    return false;
  }

  // Vérifier si la persistence DB précédente a réussi
  if (!cached.dbSuccess) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[PATCH /api/user/onboarding] Cache hit but previous DB write failed, retrying');
    }
    return false;
  }

  // Vérifier si les updates sont identiques
  const sameUpdates = JSON.stringify(cached.updates) === JSON.stringify(updates);
  if (sameUpdates && process.env.NODE_ENV === 'development') {
    console.log('[PATCH /api/user/onboarding] Skip duplicate update (cache hit)');
  }

  return sameUpdates;
}

/**
 * GET /api/user/onboarding
 * Récupérer l'état d'onboarding complet
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        onboardingState: true,
      },
    });

    if (!user) {
      return CommonErrors.notFound('user');
    }

    // Prisma parse automatiquement Json → Object
    const onboardingState = user.onboardingState || DEFAULT_ONBOARDING_STATE;

    // Normaliser pour garantir structure complète
    const normalizedState = normalizeOnboardingState(onboardingState);

    return NextResponse.json({
      currentStep: normalizedState.currentStep || 0,
      hasCompleted: normalizedState.hasCompleted || false,
      isSkipped: normalizedState.isSkipped || false,
      completedAt: normalizedState.timestamps?.completedAt || null,
      skippedAt: normalizedState.timestamps?.skippedAt || null,
      startedAt: normalizedState.timestamps?.startedAt || null,
      onboardingState: normalizedState,
    });
  } catch (error) {
    console.error('[GET /api/user/onboarding] Error:', error);
    return CommonErrors.serverError();
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
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const body = await request.json();
    const { step } = body;

    // Validation
    if (typeof step !== 'number' || step < 0 || step > MAX_STEP) {
      return OtherErrors.onboardingInvalidStep();
    }

    // Récupérer état actuel
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingState: true },
    });

    const currentState = user?.onboardingState || DEFAULT_ONBOARDING_STATE;

    // Protection anti-régression multi-device
    // Si le client tente de passer à un step inférieur à celui en base,
    // c'est une désynchronisation → rejeter et forcer reload côté client
    const currentStepInDB = currentState.currentStep || 0;
    if (step < currentStepInDB) {
      return NextResponse.json(
        {
          error: 'DESYNC',
          message: 'Client désynchronisé - step inférieur à celui en base',
          serverStep: currentStepInDB
        },
        { status: 409 }
      );
    }

    // Mettre à jour currentStep
    const isStartingOnboarding = step === 1 && currentState.currentStep === 0;

    const newState = {
      ...currentState,
      currentStep: step,
      // Reset flags et timestamps SEULEMENT au démarrage (0 → 1)
      ...(isStartingOnboarding && {
        hasCompleted: false,
        isSkipped: false,
        timestamps: {
          ...currentState.timestamps,
          startedAt: new Date().toISOString(),
          completedAt: null,
          skippedAt: null,
          lastStepChangeAt: new Date().toISOString()
        }
      }),
      // Pour autres transitions, juste update lastStepChangeAt
      ...(!isStartingOnboarding && {
        timestamps: {
          ...currentState.timestamps,
          lastStepChangeAt: new Date().toISOString()
        }
      })
    };

    // Sauvegarder
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingState: newState },
      select: { onboardingState: true },
    });

    // Broadcast SSE
    dbEmitter.emitOnboardingUpdate(session.user.id, {
      currentStep: step,
      onboardingState: updatedUser.onboardingState,
    });

    return NextResponse.json({
      success: true,
      currentStep: step,
      hasCompleted: newState.hasCompleted,
    });
  } catch (error) {
    console.error('[PUT /api/user/onboarding] Error:', error);
    return CommonErrors.serverError();
  }
}

/**
 * PATCH /api/user/onboarding
 * Mettre à jour l'état d'onboarding (onboardingState uniquement)
 *
 * Body: { onboardingState: object }
 */
export async function PATCH(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    // Parse body
    let body;
    try {
      const text = await request.text();
      if (!text || text.trim() === '') {
        return OtherErrors.onboardingInvalidBody();
      }
      body = JSON.parse(text);
    } catch (error) {
      return OtherErrors.onboardingInvalidBody();
    }

    const { onboardingState } = body;

    // Validation
    if (!onboardingState || typeof onboardingState !== 'object' || onboardingState === null) {
      return OtherErrors.onboardingInvalidBody();
    }

    // Normaliser avant de sauvegarder
    const normalizedState = normalizeOnboardingState(onboardingState);

    // Protection anti-régression multi-device
    // Récupérer l'état actuel en base pour comparer le currentStep
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { onboardingState: true },
    });
    const currentState = user?.onboardingState || DEFAULT_ONBOARDING_STATE;
    const currentStepInDB = currentState.currentStep || 0;
    const newStep = normalizedState.currentStep || 0;

    // Si le client tente de régresser le currentStep, garder le max
    if (newStep < currentStepInDB) {
      normalizedState.currentStep = currentStepInDB;
    }

    // Vérifier cache
    if (shouldSkipUpdate(session.user.id, { onboardingState: normalizedState })) {
      const cached = updateCache.get(String(session.user.id));
      return NextResponse.json({
        success: true,
        onboardingState: cached.data.onboardingState,
      });
    }

    // Update DB - Prisma sérialise automatiquement Json
    let updatedUser;
    let dbWriteSuccess = false;
    try {
      updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          onboardingState: normalizedState,
        },
        select: {
          onboardingState: true,
        },
      });
      dbWriteSuccess = true;
    } catch (dbError) {
      updateCache.delete(String(session.user.id));
      console.error('[PATCH /api/user/onboarding] DB error:', dbError);
      throw dbError;
    }

    // Stocker en cache UNIQUEMENT si l'écriture DB a réussi
    if (dbWriteSuccess) {
      updateCache.set(String(session.user.id), {
        timestamp: Date.now(),
        updates: { onboardingState: normalizedState },
        data: { onboardingState: updatedUser.onboardingState },
        dbSuccess: true, // Flag pour éviter de skip si DB write a échoué
      });
    }

    // Broadcast SSE pour synchroniser les autres devices
    dbEmitter.emitOnboardingUpdate(session.user.id, {
      onboardingState: updatedUser.onboardingState,
      currentStep: updatedUser.onboardingState.currentStep,
    });

    return NextResponse.json({
      success: true,
      onboardingState: updatedUser.onboardingState,
    });
  } catch (error) {
    console.error('[PATCH /api/user/onboarding] Error:', error);
    return CommonErrors.serverError();
  }
}

/**
 * POST /api/user/onboarding?action=complete|skip|reset
 * Actions sur l'onboarding
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    const validActions = ['skip', 'complete', 'reset'];
    if (!action || !validActions.includes(action)) {
      return OtherErrors.onboardingInvalidAction();
    }

    if (action === 'complete') {
      // Récupérer état actuel
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { onboardingState: true },
      });

      const currentState = user?.onboardingState || DEFAULT_ONBOARDING_STATE;
      const completedAt = new Date().toISOString();

      // Marquer comme complété
      const newState = {
        ...currentState,
        currentStep: MAX_STEP,
        hasCompleted: true,
        isSkipped: false,
        timestamps: {
          ...currentState.timestamps,
          completedAt,
          lastStepChangeAt: completedAt
        }
      };

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingState: newState },
        select: { onboardingState: true },
      });

      // Broadcast SSE
      dbEmitter.emitOnboardingUpdate(session.user.id, {
        hasCompleted: true,
        completedAt,
        onboardingState: updatedUser.onboardingState,
      });

      return NextResponse.json({
        success: true,
        completedAt,
      });
    }

    if (action === 'skip') {
      // Récupérer état actuel
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { onboardingState: true },
      });

      const currentState = user?.onboardingState || DEFAULT_ONBOARDING_STATE;
      const skippedAt = new Date().toISOString();

      // Marquer comme skipped (skip ≠ completed)
      // Sémantique : Skip = abandon de l'onboarding, pas une complétion rapide
      // Analytics : hasCompleted=true pour complétion normale, isSkipped=true pour abandon
      const newState = {
        ...currentState,
        hasCompleted: false, // Skip n'est PAS considéré comme une complétion normale
        isSkipped: true,
        timestamps: {
          ...currentState.timestamps,
          skippedAt,
          lastStepChangeAt: skippedAt
        }
      };

      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingState: newState },
        select: { onboardingState: true },
      });

      // Broadcast SSE
      dbEmitter.emitOnboardingUpdate(session.user.id, {
        hasCompleted: false, // Cohérent avec newState
        isSkipped: true,
        skippedAt,
        onboardingState: updatedUser.onboardingState,
      });

      return NextResponse.json({
        success: true,
        skippedAt,
      });
    }

    if (action === 'reset') {
      // Reset complet avec DEFAULT_ONBOARDING_STATE
      const updatedUser = await prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingState: DEFAULT_ONBOARDING_STATE },
        select: { onboardingState: true },
      });

      // Invalider cache
      updateCache.delete(String(session.user.id));

      // Broadcast SSE RESET
      dbEmitter.emitOnboardingReset(session.user.id, {
        onboardingState: DEFAULT_ONBOARDING_STATE,
      });

      return NextResponse.json({
        success: true,
        message: 'Onboarding réinitialisé',
        onboardingState: updatedUser.onboardingState,
      });
    }

    return OtherErrors.onboardingInvalidAction();
  } catch (error) {
    console.error('[POST /api/user/onboarding] Error:', error);
    return CommonErrors.serverError();
  }
}
