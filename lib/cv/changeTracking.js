/**
 * Change Tracking module - Re-exports for backward compatibility
 *
 * @deprecated Import directly from:
 * - '@/lib/cv/modifications' for diff functions
 * - '@/lib/cv/review' for review state and actions
 */

// Re-export from modifications/diff.js
export {
  generateChangeId,
  getValueAtPath,
  setValueAtPath,
  computeCvDiff,
  computeDetailedChanges
} from './modifications/diff.js';

// Re-export from review/state.js
export {
  updateChangeStatus,
  allChangesReviewed,
  getReviewProgress,
  clearReviewState,
  initializeReviewState,
  getReviewState
} from './review/state.js';

// Re-export from review/actions.js
export {
  processReviewAction,
  processBatchReviewAction
} from './review/actions.js';

// Re-export from review/rollback.js
export {
  applyPartialRollback
} from './review/rollback.js';
