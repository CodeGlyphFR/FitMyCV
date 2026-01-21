import { useCallback, useRef } from 'react';
import { getTotalSteps } from '@/lib/onboarding/onboardingSteps';
import { markStepCompleted as markStepCompletedHelper } from '@/lib/onboarding/onboardingState';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook pour la navigation entre étapes d'onboarding
 */
export function useStepNavigation({
  currentStep,
  setCurrentStep,
  completedSteps,
  setCompletedSteps,
  onboardingState,
  setOnboardingState,
  setIsActive,
  setHasCompleted,
  setHasSkipped,
  setStepStartTime,
  setOnboardingStartTime,
  setShowWelcomeModal,
  timerRefs
}) {
  const stepTimerRef = useRef(null);

  /**
   * Clear tous les timers
   */
  const clearAllTimers = useCallback(() => {
    if (timerRefs.welcomeTimerRef?.current) {
      clearTimeout(timerRefs.welcomeTimerRef.current);
      timerRefs.welcomeTimerRef.current = null;
    }
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (timerRefs.loadingToOnboardingTimerRef?.current) {
      clearTimeout(timerRefs.loadingToOnboardingTimerRef.current);
      timerRefs.loadingToOnboardingTimerRef.current = null;
    }
  }, [timerRefs]);

  /**
   * Compléter l'onboarding
   */
  const completeOnboarding = useCallback(async () => {
    try {
      clearAllTimers();

      const res = await fetch('/api/user/onboarding?action=complete', {
        method: 'POST',
      });

      if (res.ok) {
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(getTotalSteps());
        setCompletedSteps([1, 2, 3, 4, 5, 6, 7, 8]);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error completing onboarding:', error);
    }
  }, [clearAllTimers, setHasCompleted, setIsActive, setCurrentStep, setCompletedSteps, setShowWelcomeModal]);

  /**
   * Aller à l'étape suivante
   */
  const goToNextStep = useCallback(async () => {
    if (currentStep > getTotalSteps()) {
      await completeOnboarding();
      return;
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setStepStartTime(Date.now());

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep }),
      });

      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [currentStep, completeOnboarding, setCurrentStep, setStepStartTime]);

  /**
   * Aller à l'étape précédente
   */
  const goToPrevStep = useCallback(async () => {
    if (currentStep <= 1) return;

    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setStepStartTime(Date.now());

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: prevStep }),
      });

      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [currentStep, setCurrentStep, setStepStartTime]);

  /**
   * Aller directement à une étape
   */
  const goToStep = useCallback(async (step) => {
    if (step < 0 || step > getTotalSteps()) {
      onboardingLogger.error('[OnboardingProvider] Invalid step:', step);
      return;
    }

    setCurrentStep(step);
    setStepStartTime(Date.now());

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });

      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [setCurrentStep, setStepStartTime]);

  /**
   * Marquer une étape comme complétée
   */
  const markStepComplete = useCallback(async (step) => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    const previousOnboardingState = onboardingState;
    const previousCompletedSteps = completedSteps;
    const previousCurrentStep = currentStep;

    if (onboardingState?.completedSteps?.includes(step)) {
      onboardingLogger.log(`[OnboardingProvider] Step ${step} déjà complété, skip`);
      return;
    }

    const newOnboardingState = markStepCompletedHelper(onboardingState, step);

    setOnboardingState(newOnboardingState);
    setCompletedSteps(newOnboardingState.completedSteps);
    setCurrentStep(newOnboardingState.currentStep);

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingState: newOnboardingState }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      onboardingLogger.log(`[OnboardingProvider] Step ${step} persisté avec succès`);
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Persistence failed, rolling back:', error);

      setOnboardingState(previousOnboardingState);
      setCompletedSteps(previousCompletedSteps);
      setCurrentStep(previousCurrentStep);
      return;
    }

    const totalSteps = getTotalSteps();
    if (step >= totalSteps) {
      onboardingLogger.log('[OnboardingProvider] Step final complété, en attente fermeture modal');
      return;
    }

    onboardingLogger.log(`[OnboardingProvider] Step ${step} complété, transition vers step ${newOnboardingState.currentStep}`);
  }, [onboardingState, completedSteps, currentStep, setOnboardingState, setCompletedSteps, setCurrentStep]);

  /**
   * Skip l'onboarding
   */
  const skipOnboarding = useCallback(async () => {
    try {
      clearAllTimers();

      const res = await fetch('/api/user/onboarding?action=skip', {
        method: 'POST',
      });

      if (res.ok) {
        setHasSkipped(true);
        setHasCompleted(false);
        setIsActive(false);
        setCurrentStep(0);
        setCompletedSteps([]);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error skipping onboarding:', error);
    }
  }, [clearAllTimers, setHasSkipped, setHasCompleted, setIsActive, setCurrentStep, setCompletedSteps, setShowWelcomeModal]);

  /**
   * Reset l'onboarding
   */
  const resetOnboarding = useCallback(async () => {
    try {
      clearAllTimers();

      const res = await fetch('/api/user/onboarding?action=reset', {
        method: 'POST',
      });

      if (res.ok) {
        setHasCompleted(false);
        setHasSkipped(false);
        setIsActive(false);
        setCurrentStep(0);
        setCompletedSteps([]);
        setOnboardingState({});
        setOnboardingStartTime(null);
        setStepStartTime(null);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error resetting onboarding:', error);
    }
  }, [clearAllTimers, setHasCompleted, setHasSkipped, setIsActive, setCurrentStep, setCompletedSteps, setOnboardingState, setOnboardingStartTime, setStepStartTime, setShowWelcomeModal]);

  return {
    goToNextStep,
    goToPrevStep,
    goToStep,
    markStepComplete,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
    stepTimerRef
  };
}
