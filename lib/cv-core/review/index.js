/**
 * Review module - Gestion de la review des modifications CV
 *
 * Ce module expose toutes les fonctions pour gérer l'état de review,
 * les actions d'acceptation/rejet, et le rollback partiel.
 */

// State management
export {
  updateChangeStatus,
  allChangesReviewed,
  getReviewProgress,
  clearReviewState,
  initializeReviewState,
  getReviewState
} from './state.js';

// Review actions
export {
  processReviewAction,
  processBatchReviewAction
} from './actions.js';

// Rollback
export {
  applyPartialRollback
} from './rollback.js';
