/**
 * Telemetry events - organized by domain
 */

// CV events
export {
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
} from './cv-events.js';

// CV Generation pipeline events
export {
  trackCvGenerationStarted,
  trackCvGenerationCompleted,
  trackCvGenerationFailed,
} from './generation-events.js';

// Auth events
export {
  trackUserRegistration,
  trackUserLogin,
  trackUserLogout,
} from './auth-events.js';
