import { useContext } from 'react';
import { OnboardingContext } from '@/components/onboarding/OnboardingProvider';

/**
 * Hook personnalisé pour consommer le OnboardingContext
 *
 * Usage :
 * ```jsx
 * const {
 *   currentStep,
 *   isActive,
 *   markStepComplete,
 *   skipOnboarding
 * } = useOnboarding();
 * ```
 *
 * @returns {Object} Context d'onboarding
 */
export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (!context) {
    throw new Error(
      'useOnboarding must be used within OnboardingProvider. ' +
      'Make sure your component is wrapped with <OnboardingProvider>.'
    );
  }

  return context;
}

/**
 * Helper : Vérifier si une étape spécifique est complétée
 *
 * @param {number} stepId - ID de l'étape (1-9)
 * @returns {boolean}
 */
export function useIsStepCompleted(stepId) {
  const { completedSteps } = useOnboarding();
  return completedSteps.includes(stepId);
}

/**
 * Helper : Vérifier si on est actuellement sur une étape spécifique
 *
 * @param {number} stepId - ID de l'étape (1-9)
 * @returns {boolean}
 */
export function useIsCurrentStep(stepId) {
  const { currentStep } = useOnboarding();
  return currentStep === stepId;
}

/**
 * Helper : Obtenir la progression en pourcentage
 *
 * @returns {number} Pourcentage de progression (0-100)
 */
export function useOnboardingProgress() {
  const { completedSteps } = useOnboarding();
  return Math.round((completedSteps.length / 9) * 100);
}

export default useOnboarding;
