import { useRef, useCallback, useEffect } from 'react';
import { ONBOARDING_API } from '@/lib/onboarding/onboardingConfig';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook pour gérer la persistence debouncée de l'état d'onboarding
 * Batch les updates pour éviter les race conditions
 */
export function useDebouncedPersist(updateOnboardingState) {
  const pendingUpdatesRef = useRef({});
  const persistTimeoutRef = useRef(null);
  const persistInProgressRef = useRef(false);
  const updateOnboardingStateRef = useRef(updateOnboardingState);

  // Garder la ref à jour
  useEffect(() => {
    updateOnboardingStateRef.current = updateOnboardingState;
  }, [updateOnboardingState]);

  /**
   * Fonction debouncée pour batch toutes les updates ensemble
   */
  const debouncedPersist = useCallback(() => {
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }

    persistTimeoutRef.current = setTimeout(async () => {
      persistTimeoutRef.current = null;

      if (!updateOnboardingStateRef.current ||
          Object.keys(pendingUpdatesRef.current).length === 0 ||
          persistInProgressRef.current) {
        return;
      }

      const updates = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};

      persistInProgressRef.current = true;

      try {
        await updateOnboardingStateRef.current(updates);
      } catch (error) {
        onboardingLogger.error('[Onboarding] Error persisting state:', error);
      } finally {
        persistInProgressRef.current = false;
      }
    }, ONBOARDING_API.CACHE_TTL);
  }, []);

  /**
   * Ajouter des updates au batch
   */
  const queueUpdate = useCallback((updates) => {
    pendingUpdatesRef.current = {
      ...pendingUpdatesRef.current,
      ...updates
    };
    debouncedPersist();
  }, [debouncedPersist]);

  /**
   * Cleanup au unmount avec flush des pending updates
   */
  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;

        if (updateOnboardingStateRef.current &&
            Object.keys(pendingUpdatesRef.current).length > 0 &&
            !persistInProgressRef.current) {
          const updates = { ...pendingUpdatesRef.current };
          pendingUpdatesRef.current = {};

          onboardingLogger.log('[Onboarding] Flush pending updates au unmount:', updates);

          updateOnboardingStateRef.current(updates).catch(err => {
            onboardingLogger.error('[Onboarding] Failed to flush on unmount:', err);
          });
        }
      }
    };
  }, []);

  return { queueUpdate };
}
