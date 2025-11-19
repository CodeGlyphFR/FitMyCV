/**
 * Définition centralisée des types de tâches en arrière-plan
 *
 * IMPORTANT : Ces constantes doivent correspondre exactement aux types
 * définis dans les routes API (app/api/background-tasks/*)
 */

export const TASK_TYPES = {
  // Génération de CV avec IA
  GENERATION: 'generation',

  // Création de CV depuis un template
  TEMPLATE_CREATION: 'template-creation',

  // Import de CV depuis PDF
  IMPORT_PDF: 'import-pdf',

  // Traduction de CV
  TRANSLATE: 'translate-cv',

  // Calcul du score de match
  MATCH_SCORE: 'calculate-match-score',
};

/**
 * Types de tâches considérées comme des générations IA
 * Utilisé pour la validation de l'étape 2 d'onboarding
 */
export const AI_GENERATION_TYPES = [
  TASK_TYPES.GENERATION,
  TASK_TYPES.TEMPLATE_CREATION,
];

/**
 * Vérifie si une tâche est une génération IA
 * @param {Object} task - Tâche à vérifier
 * @returns {boolean}
 */
export function isAiGenerationTask(task) {
  return task && AI_GENERATION_TYPES.includes(task.type);
}

/**
 * Émet un événement task:added pour notifier l'ajout d'une tâche
 * @param {Object} task - Tâche ajoutée
 */
export function emitTaskAddedEvent(task) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('task:added', {
    detail: { task }
  }));
}
