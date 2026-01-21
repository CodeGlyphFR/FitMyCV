/**
 * CV Adaptation Orchestrator - Main Entry Point
 *
 * Re-exports the public API for the CV adaptation pipeline orchestrator.
 * This module coordinates all phases of CV generation and provides
 * the main entry points for starting generation tasks.
 */

// Task lifecycle management
export {
  startSingleOfferGeneration,
  startMultiOfferGeneration,
} from './taskRunner.js';

// Retry utilities (for external use and testing)
export {
  withRetry,
  MAX_RETRIES,
  BACKOFF_BASE_MS,
  sleep,
  getBackoffDelay,
} from './retryHandler.js';

// Credit management (for external use and testing)
export { refundCreditForOffer } from './creditManager.js';

// Progress events (for external use)
export { emitProgress } from './progressEmitter.js';

// Phase processors (for advanced use cases)
export {
  runExtractionPhase,
  runClassificationPhase,
  runBatchesPhase,
  runRecompositionPhase,
  processOffer,
} from './offerProcessor.js';
