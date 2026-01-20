/**
 * Source de vérité unique pour les étapes d'onboarding
 *
 * Ce fichier centralise les définitions des étapes utilisées par :
 * - lib/admin/onboardingSteps.js (dashboard admin)
 * - lib/onboarding/onboardingSteps.js (client)
 */

/**
 * Nombre total d'étapes (1-8, sans le welcome)
 */
export const ONBOARDING_STEPS_COUNT = 8;

/**
 * Définitions minimales des étapes principales (1-8)
 * Utilisées comme base pour les configurations admin et client
 */
export const STEP_DEFINITIONS = [
  { id: 1, key: 'edit_mode', emoji: '✏️' },
  { id: 2, key: 'ai_generation', emoji: '✨' },
  { id: 3, key: 'task_manager', emoji: '📋' },
  { id: 4, key: 'open_generated_cv', emoji: '📄' },
  { id: 5, key: 'match_score', emoji: '🎯' },
  { id: 6, key: 'optimization', emoji: '🚀' },
  { id: 7, key: 'history', emoji: '📝' },
  { id: 8, key: 'export', emoji: '📥' },
];

/**
 * Définition de l'étape Welcome (étape 0, admin uniquement)
 */
export const WELCOME_STEP = { id: 0, key: 'welcome', emoji: '👋' };

/**
 * Définitions incluant l'étape Welcome (pour admin)
 */
export const ADMIN_STEP_DEFINITIONS = [
  WELCOME_STEP,
  ...STEP_DEFINITIONS,
];

/**
 * Mapping clé → noms (FR/EN) pour l'admin
 */
export const STEP_NAMES = {
  welcome: { name: 'Welcome', nameFr: 'Bienvenue' },
  edit_mode: { name: 'Edit Mode', nameFr: 'Mode édition' },
  ai_generation: { name: 'AI Generation', nameFr: 'Génération IA' },
  task_manager: { name: 'Task Manager', nameFr: 'Gestionnaire tâches' },
  open_generated_cv: { name: 'CV View', nameFr: 'Vue CV généré' },
  match_score: { name: 'Match Score', nameFr: 'Score de match' },
  optimization: { name: 'Optimization', nameFr: 'Optimisation' },
  history: { name: 'History', nameFr: 'Historique' },
  export: { name: 'Export PDF', nameFr: 'Export PDF' },
};

/**
 * Mapping clé → descriptions (admin)
 */
export const STEP_DESCRIPTIONS = {
  welcome: 'Écrans d\'accueil (3 slides)',
  edit_mode: 'Explication du mode édition',
  ai_generation: 'Génération de CV avec l\'IA',
  task_manager: 'Ouverture du gestionnaire de tâches',
  open_generated_cv: 'Visualisation du CV généré',
  match_score: 'Calcul du score de correspondance',
  optimization: 'Optimisation ATS du CV',
  history: 'Consultation de l\'historique',
  export: 'Export du CV en PDF',
};

/**
 * Mapping clé → hasModal (admin)
 */
export const STEP_HAS_MODAL = {
  welcome: true,
  edit_mode: true,
  ai_generation: true,
  task_manager: false,
  open_generated_cv: false,
  match_score: false,
  optimization: true,
  history: false,
  export: true,
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Obtient une définition d'étape par ID
 * @param {number} stepId - ID de l'étape (0-8)
 * @param {boolean} includeWelcome - true pour inclure l'étape 0
 * @returns {Object|null}
 */
export function getStepDefinition(stepId, includeWelcome = false) {
  const steps = includeWelcome ? ADMIN_STEP_DEFINITIONS : STEP_DEFINITIONS;
  return steps.find(s => s.id === stepId) || null;
}

/**
 * Obtient l'emoji d'une étape par ID
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {string}
 */
export function getStepEmoji(stepId) {
  const step = getStepDefinition(stepId, true);
  return step?.emoji || '❓';
}

/**
 * Obtient la clé d'une étape par ID
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {string|null}
 */
export function getStepKey(stepId) {
  const step = getStepDefinition(stepId, true);
  return step?.key || null;
}

/**
 * Obtient le nom français d'une étape par ID
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {string}
 */
export function getStepNameFr(stepId) {
  const step = getStepDefinition(stepId, true);
  if (!step) return 'Inconnu';
  return STEP_NAMES[step.key]?.nameFr || 'Inconnu';
}

/**
 * Obtient le nom anglais d'une étape par ID
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {string}
 */
export function getStepName(stepId) {
  const step = getStepDefinition(stepId, true);
  if (!step) return 'Unknown';
  return STEP_NAMES[step.key]?.name || 'Unknown';
}
