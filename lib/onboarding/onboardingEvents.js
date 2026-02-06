/**
 * Constantes pour les événements d'onboarding
 * Utilise le pattern namespace:action en kebab-case pour la cohérence
 */

export const ONBOARDING_EVENTS = {
  // Auto-start onboarding
  LOADING_SCREEN_CLOSED: 'onboarding:loading-screen-closed',

  // Step 3 validations
  TASK_MANAGER_OPENED: 'onboarding:task-manager-opened',

  // Step 4 precondition and validation
  CV_GENERATED: 'onboarding:cv-generated',
  GENERATED_CV_OPENED: 'onboarding:generated-cv-opened',

  // Step 5: AI Review
  ALL_REVIEWS_COMPLETED: 'onboarding:all-reviews-completed',

  // Step 6 validation
  MATCH_SCORE_CALCULATED: 'onboarding:match-score-calculated',

  // Génération IA (step 2)
  OPEN_GENERATOR: 'onboarding:open-generator',

  // Optimisation (step 7)
  OPEN_OPTIMIZER: 'onboarding:open-optimizer',

  // Step 8: Historique
  HISTORY_CLOSED: 'onboarding:history-closed',

  // Step 9: Export
  OPEN_EXPORT: 'onboarding:open-export',
  EXPORT_CLICKED: 'onboarding:export-clicked',
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
