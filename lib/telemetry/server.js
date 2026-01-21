/**
 * Server-side telemetry module
 *
 * This file re-exports all telemetry functions for backward compatibility.
 * The actual implementation is organized by domain in:
 * - constants.js: Event types and categories
 * - core.js: Base tracking functions
 * - events/: Domain-specific tracking functions
 */

// Re-export constants
export {
  EventTypes,
  EventCategories,
  getCategoryFromType,
  isFeatureEvent,
  getFeatureNameFromEventType,
} from './constants.js';

// Re-export core functions
export {
  trackEvent,
  incrementFeatureUsage,
  getLastUsedFeature,
} from './core.js';

// Re-export all domain-specific events
export {
  // CV events
  trackCvGenerationFromUrl,
  trackCvGenerationFromPdf,
  trackCvGenerationFromJobTitle,
  trackCvTemplateCreationFromUrl,
  trackCvTemplateCreationFromPdf,
  trackCvImport,
  trackCvExport,
  trackCvCreation,
  trackCvEdit,
  trackMatchScore,
  trackCvOptimization,
  trackCvChangesReviewed,
  // CV Generation pipeline events
  trackCvGenerationStarted,
  trackCvGenerationCompleted,
  trackCvGenerationFailed,
  // Auth events
  trackUserRegistration,
  trackUserLogin,
  trackUserLogout,
} from './events/index.js';
