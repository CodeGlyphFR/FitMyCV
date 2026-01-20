/**
 * Background Jobs - Gestion des tâches asynchrones
 *
 * Contient l'infrastructure pour les jobs en arrière-plan :
 * - jobQueue : file d'attente et exécution des jobs
 * - processRegistry : registre des processus actifs
 * - taskTypes : constantes des types de tâches
 * - sortTasks : tri des tâches pour affichage
 * - cleanupOrphanedTasks : nettoyage au redémarrage
 * - taskFeatureMapping : mapping tâches → features télémétrie
 */

// Job Queue
export {
  enqueueJob,
  getQueueSnapshot,
  canStartTaskType,
  registerTaskTypeStart,
  registerTaskTypeEnd,
  getActiveTaskTypes
} from './jobQueue.js';

// Process Registry
export {
  registerAbortController,
  getRegisteredProcess,
  clearRegisteredProcess,
  killRegisteredProcess
} from './processRegistry.js';

// Task Types
export * from './taskTypes.js';

// Sort Tasks
export { sortTasksForDisplay } from './sortTasks.js';

// Cleanup
export { cleanupOrphanedTasks } from './cleanupOrphanedTasks.js';

// Task Feature Mapping
export {
  TASK_TYPE_TO_FEATURES,
  TASK_PHASES,
  DEFAULT_DURATIONS,
  MIN_CALLS_FOR_AVERAGE,
  getFeaturesForTaskType,
  getDefaultDuration
} from './taskFeatureMapping.js';

// Job Runner Framework
export { createJobRunner } from './jobRunner.js';
