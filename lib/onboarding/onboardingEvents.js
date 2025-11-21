/**
 * Constantes pour les événements d'onboarding
 * Utilise le pattern namespace:action en kebab-case pour la cohérence
 */

export const ONBOARDING_EVENTS = {
  // Step 3 validations
  TASK_MANAGER_OPENED: 'onboarding:task-manager-opened',

  // Step 4 precondition and validation
  CV_GENERATED: 'onboarding:cv-generated',
  GENERATED_CV_OPENED: 'onboarding:generated-cv-opened',

  // Step 5 validation
  MATCH_SCORE_CALCULATED: 'onboarding:match-score-calculated',

  // Génération IA (step 2)
  OPEN_GENERATOR: 'onboarding:open-generator',

  // Optimisation (step 6)
  OPEN_OPTIMIZER: 'onboarding:open-optimizer',
};

/**
 * Émet un événement d'onboarding de manière sûre
 * @param {string} eventName - Nom de l'événement (utilisez ONBOARDING_EVENTS.*)
 * @param {object} detail - Détails à passer avec l'événement
 */
export function emitOnboardingEvent(eventName, detail = {}) {
  if (typeof window === 'undefined') return;

  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  } catch (error) {
    console.error(`[OnboardingEvents] Error emitting ${eventName}:`, error);
  }
}
