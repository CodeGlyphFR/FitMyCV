import { useCallback, useRef } from 'react';
import { ONBOARDING_API } from '@/lib/onboarding/onboardingConfig';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook pour gérer les mises à jour de l'état d'onboarding
 */
export function useOnboardingStateUpdater({
  onboardingState,
  setOnboardingState
}) {
  const updateInProgressRef = useRef(false);
  const pendingUpdateRef = useRef(null);
  const retryAttemptsRef = useRef(0);
  const MAX_RETRY_ATTEMPTS = ONBOARDING_API.MAX_RETRY_ATTEMPTS;

  /**
   * Deep merge helper pour éviter perte de données dans objets imbriqués
   */
  const deepMerge = useCallback((target, source) => {
    const output = { ...target };
    if (typeof target === 'object' && typeof source === 'object') {
      Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }, []);

  /**
   * Mettre à jour l'état d'onboarding (update partiel avec queue anti-race)
   */
  const updateOnboardingState = useCallback(async (updates) => {
    if (updateInProgressRef.current) {
      onboardingLogger.log('[OnboardingProvider] Update déjà en cours, merge avec pending');
      pendingUpdateRef.current = pendingUpdateRef.current
        ? deepMerge(pendingUpdateRef.current, updates)
        : updates;
      return;
    }

    updateInProgressRef.current = true;
    const previousState = onboardingState;

    try {
      const newState = deepMerge(onboardingState, updates);
      setOnboardingState(newState);

      const res = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingState: newState }),
      });

      if (!res.ok) {
        onboardingLogger.error('[OnboardingProvider] Failed to persist onboardingState:', res.status);
        setOnboardingState(previousState);
        throw new Error(`API returned ${res.status}`);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error persisting onboardingState:', error);
      setOnboardingState(previousState);
    } finally {
      updateInProgressRef.current = false;

      if (pendingUpdateRef.current) {
        const pending = pendingUpdateRef.current;
        pendingUpdateRef.current = null;

        retryAttemptsRef.current++;
        if (retryAttemptsRef.current <= MAX_RETRY_ATTEMPTS) {
          onboardingLogger.log(`[OnboardingProvider] Exécution pending update (attempt ${retryAttemptsRef.current}/${MAX_RETRY_ATTEMPTS}):`, pending);
          await updateOnboardingState(pending);
        } else {
          onboardingLogger.error('[OnboardingProvider] Max retry attempts reached, dropping update:', pending);
          retryAttemptsRef.current = 0;
        }
      } else {
        retryAttemptsRef.current = 0;
      }
    }
  }, [onboardingState, setOnboardingState, deepMerge]);

  /**
   * Marquer un modal comme complété
   */
  const markModalCompleted = useCallback(async (stepKey) => {
    onboardingLogger.log(`[OnboardingProvider] markModalCompleted called for modal: ${stepKey}`);

    const updates = {
      modals: {
        ...onboardingState.modals,
        [stepKey]: {
          completed: true,
          completedAt: new Date().toISOString()
        }
      },
      timestamps: {
        ...onboardingState.timestamps,
        lastStepChangeAt: new Date().toISOString()
      }
    };

    onboardingLogger.log(`[OnboardingProvider] Modal completion updates for ${stepKey}:`, JSON.stringify(updates.modals[stepKey]));

    try {
      await updateOnboardingState(updates);
      onboardingLogger.log(`[OnboardingProvider] Modal ${stepKey} marked as completed in DB`);
    } catch (error) {
      onboardingLogger.error(`[OnboardingProvider] Failed to mark modal ${stepKey} as completed:`, error);
      throw error;
    }
  }, [onboardingState, updateOnboardingState]);

  /**
   * Marquer un tooltip comme fermé/ouvert manuellement
   */
  const markTooltipClosed = useCallback(async (stepNumber, closed = true) => {
    const updates = {
      tooltips: {
        ...onboardingState.tooltips,
        [String(stepNumber)]: { closedManually: closed }
      },
      timestamps: {
        ...onboardingState.timestamps,
        lastStepChangeAt: new Date().toISOString()
      }
    };
    await updateOnboardingState(updates);
  }, [onboardingState, updateOnboardingState]);

  return {
    updateOnboardingState,
    markModalCompleted,
    markTooltipClosed,
    deepMerge
  };
}
