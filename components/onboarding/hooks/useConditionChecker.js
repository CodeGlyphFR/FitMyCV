import { useCallback } from 'react';
import { getStepById } from '@/lib/onboarding/onboardingSteps';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

/**
 * Hook pour vérifier les conditions des étapes d'onboarding
 */
export function useConditionChecker(onboardingSteps) {
  /**
   * Helper pour vérifier une condition simple
   */
  const checkSingleCondition = useCallback((condition) => {
    if (!condition || !condition.type) return true;

    switch (condition.type) {
      case 'element_visible':
        if (!condition.selector) return false;
        const element = document.querySelector(condition.selector);
        return element && element.offsetParent !== null;

      case 'state_check':
        if (condition.key === 'editModeActive') {
          return !!document.querySelector('[data-onboarding="edit-button"]');
        }
        if (condition.key === 'generationInProgress') {
          const taskButton = document.querySelector('[data-onboarding="task-manager"]');
          return taskButton && taskButton.querySelector('.animate-pulse');
        }
        if (condition.key === 'matchScoreCalculated') {
          const matchScoreElement = document.querySelector('[data-onboarding="match-score"]');
          return matchScoreElement && matchScoreElement.textContent?.includes('%');
        }
        return true;

      case 'data_check':
        if (condition.check === 'currentCvHasJobSummary') {
          return !!document.querySelector('[data-onboarding="match-score"]');
        }
        return true;

      case 'timeout':
        return true;

      default:
        onboardingLogger.warn('[OnboardingProvider] Unknown condition type:', condition.type);
        return true;
    }
  }, []);

  /**
   * Vérifier conditions d'une étape
   */
  const checkStepConditions = useCallback((stepId) => {
    const step = getStepById(onboardingSteps, stepId);
    if (!step) return false;

    if (!step.precondition) return true;

    const { precondition } = step;

    if (precondition.type === 'multi') {
      return precondition.conditions.every((cond) => {
        return checkSingleCondition(cond);
      });
    }

    return checkSingleCondition(precondition);
  }, [onboardingSteps, checkSingleCondition]);

  return { checkStepConditions };
}
