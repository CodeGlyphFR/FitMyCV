/**
 * Hook personnalisé pour les étapes d'onboarding traduites
 *
 * Utilise le système i18n existant pour fournir des étapes
 * d'onboarding dans la langue courante de l'utilisateur.
 *
 * @example
 * import { useOnboardingSteps } from '@/lib/onboarding/useOnboardingSteps';
 *
 * function MyComponent() {
 *   const steps = useOnboardingSteps();
 *   // steps est maintenant un tableau d'étapes traduites
 * }
 */

import { useMemo } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { createOnboardingSteps, getStepById, getTotalSteps, hasPhases, getPhase } from './onboardingSteps';

/**
 * Hook pour obtenir les étapes d'onboarding traduites
 * @returns {Array} Liste des étapes d'onboarding dans la langue courante
 */
export function useOnboardingSteps() {
  const { t } = useLanguage();

  // Mémorise les étapes pour éviter les recréations inutiles
  // Se recalcule uniquement quand la fonction t change (changement de langue)
  const steps = useMemo(() => createOnboardingSteps(t), [t]);

  return steps;
}

/**
 * Hook pour obtenir une étape spécifique par ID
 * @param {number} stepId - ID de l'étape
 * @returns {Object|undefined} L'étape correspondante ou undefined
 */
export function useOnboardingStep(stepId) {
  const steps = useOnboardingSteps();

  return useMemo(() => getStepById(steps, stepId), [steps, stepId]);
}

/**
 * Hook pour obtenir les helpers d'onboarding avec les étapes traduites
 * @returns {Object} Objet contenant les étapes et les fonctions helpers
 */
export function useOnboardingHelpers() {
  const steps = useOnboardingSteps();

  return useMemo(
    () => ({
      steps,
      getStepById: (stepId) => getStepById(steps, stepId),
      getTotalSteps,
      hasPhases: (stepId) => hasPhases(steps, stepId),
      getPhase: (stepId, phaseNumber) => getPhase(steps, stepId, phaseNumber),
    }),
    [steps]
  );
}

export default useOnboardingSteps;
