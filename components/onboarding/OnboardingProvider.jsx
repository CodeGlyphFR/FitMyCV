'use client';

import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { getTotalSteps } from '@/lib/onboarding/onboardingSteps';
import { useOnboardingSteps } from '@/lib/onboarding/useOnboardingSteps';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';
import {
  useOnboardingFetch,
  useStepNavigation,
  useOnboardingAutoStart,
  useOnboardingStateUpdater,
  useConditionChecker
} from './hooks';
import ChecklistPanel from './ChecklistPanel';
import OnboardingOrchestrator from './OnboardingOrchestrator';
import WelcomeModal from './WelcomeModal';

/**
 * Context pour l'onboarding
 */
export const OnboardingContext = createContext(null);

/**
 * Provider pour le système d'onboarding
 */
export default function OnboardingProvider({ children }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const onboardingSteps = useOnboardingSteps();

  // Cacher l'onboarding UI sur les routes admin
  const isAdminRoute = pathname?.startsWith('/admin');

  // Timer refs pour cleanup
  const welcomeTimerRef = useRef(null);
  const loadingToOnboardingTimerRef = useRef(null);
  const timerRefs = { welcomeTimerRef, loadingToOnboardingTimerRef };

  // Ref pour capturer l'état actuel (utilisé dans les handlers auto-start)
  const stateRef = useRef({
    currentStep: 0,
    hasCompleted: false,
    hasSkipped: false,
    isActive: false,
    showWelcomeModal: false,
    isLoading: true,
    cvCount: 0,
  });

  // UI state
  const [checklistExpanded, setChecklistExpanded] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Timestamps pour tracking
  const [onboardingStartTime, setOnboardingStartTime] = useState(null);
  const [stepStartTime, setStepStartTime] = useState(null);

  // Check si authentifié
  const isAuthenticated = status !== 'loading' && session;

  // Hook pour charger/synchroniser l'état
  const {
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
    isLoading
  } = useOnboardingFetch(isAuthenticated, session?.user?.id, stateRef);

  // Hook pour vérifier les conditions
  const { checkStepConditions } = useConditionChecker(onboardingSteps);

  // Hook pour les mises à jour d'état
  const {
    updateOnboardingState,
    markModalCompleted,
    markTooltipClosed
  } = useOnboardingStateUpdater({
    onboardingState,
    setOnboardingState
  });

  // Hook pour la navigation
  const {
    goToNextStep,
    goToPrevStep,
    goToStep,
    markStepComplete,
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,
    stepTimerRef
  } = useStepNavigation({
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
  });

  // Hook pour l'auto-start
  useOnboardingAutoStart({
    isAuthenticated,
    isLoading,
    stateRef,
    setShowWelcomeModal,
    loadingToOnboardingTimerRef
  });

  /**
   * Cleanup effect pour tous les timers
   */
  useEffect(() => {
    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }
    };
  }, [stepTimerRef]);

  // Maintenir stateRef à jour
  useEffect(() => {
    stateRef.current = {
      ...stateRef.current,
      currentStep,
      hasCompleted,
      hasSkipped,
      isActive,
      showWelcomeModal,
      isLoading,
    };
  }, [currentStep, hasCompleted, hasSkipped, isActive, showWelcomeModal, isLoading]);

  /**
   * Toggle checklist
   */
  const toggleChecklist = useCallback(() => {
    setChecklistExpanded(prev => {
      const newValue = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding-checklist-expanded', JSON.stringify(newValue));
      }
      return newValue;
    });
  }, []);

  /**
   * Charger état checklist depuis localStorage
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('onboarding-checklist-expanded');
      if (saved !== null) {
        try {
          setChecklistExpanded(JSON.parse(saved));
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  }, [isAuthenticated]);

  /**
   * Tracker un event (pour télémétrie)
   */
  const trackEvent = useCallback(async (eventType, metadata = {}) => {
    const duration = stepStartTime ? Date.now() - stepStartTime : null;

    try {
      await fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: `ONBOARDING_${eventType.toUpperCase()}`,
          category: 'onboarding',
          metadata: {
            step: currentStep,
            duration,
            ...metadata,
          },
        }),
      });
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Track error:', error);
    }
  }, [currentStep, stepStartTime]);

  /**
   * Helper: Transition from welcome modal to step 1
   */
  const transitionToStep1 = useCallback(async () => {
    const previousStep = currentStep;
    const previousIsActive = isActive;

    try {
      setIsActive(true);
      setCurrentStep(1);
      setOnboardingStartTime(Date.now());
      setStepStartTime(Date.now());

      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      });

      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      onboardingLogger.log('[OnboardingProvider] Successfully transitioned to step 1');
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Failed to transition to step 1:', error);

      setCurrentStep(previousStep);
      setIsActive(previousIsActive);
      setOnboardingStartTime(null);
      setStepStartTime(null);

      throw error;
    }
  }, [currentStep, isActive, setCurrentStep, setIsActive]);

  /**
   * Handlers pour le WelcomeModal
   */
  const handleWelcomeComplete = useCallback(async () => {
    setShowWelcomeModal(false);

    try {
      await markModalCompleted('welcome');
      await transitionToStep1();
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Welcome complete failed:', error);
    }
  }, [markModalCompleted, transitionToStep1]);

  const handleWelcomeSkip = useCallback(() => {
    setShowWelcomeModal(false);
    skipOnboarding();
  }, [skipOnboarding]);

  const handleWelcomeClose = useCallback(async () => {
    setShowWelcomeModal(false);

    try {
      await transitionToStep1();
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Welcome close failed:', error);
    }
  }, [transitionToStep1]);

  // Valeurs par défaut si non authentifié
  const defaultValue = {
    currentStep: 0,
    completedSteps: [],
    isActive: false,
    hasCompleted: false,
    hasSkipped: false,
    isLoading: false,
    checklistExpanded: false,
    onboardingStartTime: null,
    stepStartTime: null,
    goToNextStep: () => {},
    goToPrevStep: () => {},
    goToStep: () => {},
    markStepComplete: () => {},
    skipOnboarding: () => {},
    completeOnboarding: () => {},
    resetOnboarding: () => {},
    toggleChecklist: () => {},
    checkStepConditions: () => false,
    trackEvent: () => {},
    steps: onboardingSteps,
  };

  /**
   * Context value
   */
  const value = {
    // State
    currentStep,
    completedSteps,
    onboardingState,
    isActive,
    hasCompleted,
    hasSkipped,
    isLoading,
    checklistExpanded,

    // Timestamps
    onboardingStartTime,
    stepStartTime,

    // Navigation
    goToNextStep,
    goToPrevStep,
    goToStep,
    markStepComplete,

    // Actions
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,

    // UI
    toggleChecklist,

    // Helpers
    checkStepConditions,
    trackEvent,
    updateOnboardingState,
    markModalCompleted,
    markTooltipClosed,

    // Steps config
    steps: onboardingSteps,
  };

  return (
    <OnboardingContext.Provider value={isAuthenticated ? value : defaultValue}>
      {children}
      {/* Modal de bienvenue */}
      {isAuthenticated && (
        <WelcomeModal
          open={showWelcomeModal}
          onComplete={handleWelcomeComplete}
          onSkip={handleWelcomeSkip}
          onClose={handleWelcomeClose}
        />
      )}
      {/* Checklist flottante */}
      {isAuthenticated && !isAdminRoute && <ChecklistPanel />}
      {/* Orchestrateur */}
      {isAuthenticated && !isAdminRoute && !isLoading && <OnboardingOrchestrator />}
    </OnboardingContext.Provider>
  );
}
