import { useState, useEffect, useCallback, useRef } from 'react';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';
import { DEFAULT_ONBOARDING_STATE } from '@/lib/onboarding/onboardingState';

/**
 * Hook pour charger et synchroniser l'état d'onboarding depuis l'API/SSE
 */
export function useOnboardingFetch(isAuthenticated, userId, stateRef) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [onboardingState, setOnboardingState] = useState(DEFAULT_ONBOARDING_STATE);
  const [isActive, setIsActive] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Charger l'état d'onboarding depuis l'API
   */
  const fetchOnboardingState = useCallback(async () => {
    try {
      const res = await fetch('/api/user/onboarding');

      if (!res.ok) {
        onboardingLogger.error('[OnboardingProvider] Failed to fetch state:', res.status);
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      setCurrentStep(data.currentStep);
      setHasCompleted(data.hasCompleted);
      setHasSkipped(data.isSkipped);
      setCompletedSteps(data.completedSteps || []);
      setOnboardingState(data.onboardingState || DEFAULT_ONBOARDING_STATE);

      // Si on est sur une étape > 0 et pas complété, c'est qu'on est en cours
      const isActiveNow = data.currentStep > 0 && !data.hasCompleted && !data.isSkipped;
      if (isActiveNow) {
        setIsActive(true);
      }

      // CRITICAL: Synchroniser stateRef IMMÉDIATEMENT pour éviter race condition
      // avec les effects de useOnboardingAutoStart qui s'exécutent AVANT
      // l'effet de sync du Provider
      if (stateRef) {
        stateRef.current = {
          ...stateRef.current,
          currentStep: data.currentStep,
          hasCompleted: data.hasCompleted,
          hasSkipped: data.isSkipped,
          isActive: isActiveNow,
          isLoading: false,
        };
      }

      setIsLoading(false);
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error fetching state:', error);
      setIsLoading(false);
    }
  }, [stateRef]);

  /**
   * Charger l'état au montage
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (userId) {
      fetchOnboardingState();
    }
  }, [isAuthenticated, userId, fetchOnboardingState]);

  /**
   * Synchronisation temps réel multi-device via SSE principal
   */
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const handleOnboardingUpdate = (event) => {
      const data = event.detail;
      onboardingLogger.log('[SSE] onboarding:updated reçu:', data);

      // Protection anti-régression multi-device
      const localStep = stateRef.current.currentStep || 0;
      const serverStep = data.currentStep ?? localStep;

      if (serverStep < localStep) {
        onboardingLogger.log(
          `[SSE] Ignoring update with inferior step: server=${serverStep}, local=${localStep}`
        );
        return;
      }

      if (data.onboardingState) {
        setOnboardingState(data.onboardingState);
        setCompletedSteps(data.onboardingState.completedSteps || []);
      }
      if (data.currentStep !== undefined) {
        setCurrentStep(data.currentStep);
      }
      if (data.hasCompleted !== undefined) {
        setHasCompleted(data.hasCompleted);
      }
    };

    const handleOnboardingReset = (event) => {
      const data = event.detail;
      onboardingLogger.log('[SSE] onboarding:reset reçu, reset complet UI');

      if (data.onboardingState) {
        setOnboardingState(data.onboardingState);
        setCompletedSteps(data.onboardingState.completedSteps || []);
      }
      setCurrentStep(0);
      setHasCompleted(false);
      setHasSkipped(false);
      setIsActive(false);
    };

    window.addEventListener('onboarding:updated', handleOnboardingUpdate);
    window.addEventListener('onboarding:reset', handleOnboardingReset);

    return () => {
      window.removeEventListener('onboarding:updated', handleOnboardingUpdate);
      window.removeEventListener('onboarding:reset', handleOnboardingReset);
    };
  }, [isAuthenticated, userId, stateRef]);

  return {
    currentStep,
    setCurrentStep,
    completedSteps,
    setCompletedSteps,
    onboardingState,
    setOnboardingState,
    isActive,
    setIsActive,
    hasCompleted,
    setHasCompleted,
    hasSkipped,
    setHasSkipped,
    isLoading,
    setIsLoading,
    fetchOnboardingState
  };
}
