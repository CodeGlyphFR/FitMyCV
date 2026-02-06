import { useEffect, useRef } from 'react';
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
import { ONBOARDING_EVENTS } from '@/lib/onboarding/onboardingEvents';
import { LOADING_EVENTS } from '@/lib/loading/loadingEvents';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook pour gérer le démarrage automatique de l'onboarding
 */
export function useOnboardingAutoStart({
  isAuthenticated,
  isLoading,
  stateRef,
  setShowWelcomeModal,
  loadingToOnboardingTimerRef
}) {
  const listenerAttachedRef = useRef(false);
  const loadingClosedWhileBusyRef = useRef(false);

  /**
   * Écouter l'événement TOPBAR_READY pour mettre à jour cvCount
   * et démarrer l'onboarding si les conditions sont remplies
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleTopBarReady = (event) => {
      const itemsCount = event?.detail?.itemsCount || 0;
      onboardingLogger.log(`[OnboardingProvider] TOPBAR_READY received, cvCount=${itemsCount}`);

      const previousCvCount = stateRef.current.cvCount;
      stateRef.current.cvCount = itemsCount;

      if (itemsCount >= 1 && previousCvCount === 0) {
        const state = stateRef.current;
        const shouldAutoStart =
          state.currentStep === 0 &&
          !state.hasCompleted &&
          !state.hasSkipped &&
          !state.isActive &&
          !state.showWelcomeModal &&
          !state.isLoading;

        if (shouldAutoStart) {
          onboardingLogger.log(
            `[OnboardingProvider] TOPBAR_READY: cvCount changed 0 → ${itemsCount}, ` +
            `conditions met, starting onboarding after ${ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY}ms`
          );

          if (loadingToOnboardingTimerRef.current) {
            clearTimeout(loadingToOnboardingTimerRef.current);
          }

          loadingToOnboardingTimerRef.current = setTimeout(() => {
            setShowWelcomeModal(true);
            stateRef.current.showWelcomeModal = true;
          }, ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY);
        }
      }
    };

    window.addEventListener(LOADING_EVENTS.TOPBAR_READY, handleTopBarReady);

    return () => {
      window.removeEventListener(LOADING_EVENTS.TOPBAR_READY, handleTopBarReady);
    };
  }, [isAuthenticated, stateRef, setShowWelcomeModal, loadingToOnboardingTimerRef]);

  /**
   * Auto-start onboarding pour nouveaux utilisateurs
   * Écoute l'événement de fermeture du loading screen
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (listenerAttachedRef.current) return;

    const handleLoadingClosed = (event) => {
      const state = stateRef.current;

      const shouldAutoStart =
        state.currentStep === 0 &&
        !state.hasCompleted &&
        !state.hasSkipped &&
        !state.isActive &&
        !state.showWelcomeModal &&
        !state.isLoading &&
        state.cvCount >= 1;

      if (!shouldAutoStart) {
        if (state.isLoading) {
          loadingClosedWhileBusyRef.current = true;
          onboardingLogger.log(
            `[OnboardingProvider] Loading closed while busy (isLoading=true), ` +
            `will check again when loading completes`
          );
        } else {
          onboardingLogger.log(
            `[OnboardingProvider] Loading closed but conditions not met: ` +
            `step=${state.currentStep}, completed=${state.hasCompleted}, ` +
            `skipped=${state.hasSkipped}, active=${state.isActive}, ` +
            `modal=${state.showWelcomeModal}, loading=${state.isLoading}, ` +
            `cvCount=${state.cvCount}`
          );
        }
        return;
      }

      loadingClosedWhileBusyRef.current = false;

      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      const trigger = event?.detail?.trigger || 'unknown';
      onboardingLogger.log(
        `[OnboardingProvider] Loading screen closed via ${trigger}, ` +
        `conditions met (cvCount=${state.cvCount}), ` +
        `waiting ${ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY}ms before welcome modal`
      );

      loadingToOnboardingTimerRef.current = setTimeout(() => {
        loadingToOnboardingTimerRef.current = null;
        onboardingLogger.log('[OnboardingProvider] Showing welcome modal after delay');
        setShowWelcomeModal(true);
      }, ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY);
    };

    window.addEventListener(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, handleLoadingClosed);
    listenerAttachedRef.current = true;

    onboardingLogger.log('[OnboardingProvider] Listener attached for LOADING_SCREEN_CLOSED (immediate)');

    return () => {
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      if (listenerAttachedRef.current) {
        window.removeEventListener(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, handleLoadingClosed);
        listenerAttachedRef.current = false;
        onboardingLogger.log('[OnboardingProvider] Listener removed for LOADING_SCREEN_CLOSED');
      }
    };
  }, [isAuthenticated, stateRef, setShowWelcomeModal, loadingToOnboardingTimerRef]);

  /**
   * Fallback effect : Si LOADING_SCREEN_CLOSED est arrivé pendant isLoading=true
   */
  useEffect(() => {
    if (!loadingClosedWhileBusyRef.current) return;
    if (isLoading) return;

    onboardingLogger.log('[OnboardingProvider] Fallback: isLoading became false, checking conditions');

    const state = stateRef.current;
    const shouldAutoStart =
      state.currentStep === 0 &&
      !state.hasCompleted &&
      !state.hasSkipped &&
      !state.isActive &&
      !state.showWelcomeModal &&
      state.cvCount >= 1;

    if (shouldAutoStart) {
      onboardingLogger.log(
        `[OnboardingProvider] Fallback: Conditions met, starting onboarding ` +
        `(cvCount=${state.cvCount})`
      );

      loadingClosedWhileBusyRef.current = false;

      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      loadingToOnboardingTimerRef.current = setTimeout(() => {
        loadingToOnboardingTimerRef.current = null;
        onboardingLogger.log('[OnboardingProvider] Fallback: Showing welcome modal after delay');
        setShowWelcomeModal(true);
      }, ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY);
    } else {
      loadingClosedWhileBusyRef.current = false;
      onboardingLogger.log(
        `[OnboardingProvider] Fallback: Conditions still not met after loading: ` +
        `step=${state.currentStep}, cvCount=${state.cvCount}, ` +
        `completed=${state.hasCompleted}, skipped=${state.hasSkipped}`
      );
    }
  }, [isLoading, stateRef, setShowWelcomeModal, loadingToOnboardingTimerRef]);

  return { loadingClosedWhileBusyRef };
}
