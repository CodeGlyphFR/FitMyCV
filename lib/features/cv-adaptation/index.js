/**
 * CV Adaptation Feature - Main exports
 *
 * Feature for adapting CVs to job offers using AI-powered pipeline.
 *
 * Pipeline phases:
 * 1. Extraction (fetch job offer from URL)
 * 2. Classification (KEEP/REMOVE/MOVE_TO_PROJECTS)
 * 3. Batches (experiences, projects, extras, skills, summary adaptation)
 * 4. Recomposition (final assembly + languages)
 */

// ============================================================================
// ORCHESTRATOR - Main entry points for CV generation
// ============================================================================

export {
  // Primary entry points
  startSingleOfferGeneration,
  startMultiOfferGeneration,
  // Retry utilities
  withRetry,
  refundCreditForOffer,
} from './orchestrator/index.js';

// ============================================================================
// PHASES - Individual pipeline phases
// ============================================================================

// Phase 1: Classification
export {
  executeClassification,
  applyClassification,
} from './phases/classify.js';

// Phase 2: Batches
export { executeBatchExperiences } from './phases/batch-experiences.js';
export { executeBatchProjects, convertExperienceToProject } from './phases/batch-projects.js';
export { executeBatchExtras } from './phases/batch-extras.js';
export { executeBatchSkills } from './phases/batch-skills.js';
export { executeBatchSummary } from './phases/batch-summary.js';

// Phase 3: Recomposition
export { executeRecomposition } from './phases/recompose.js';

// ============================================================================
// UTILITIES
// ============================================================================

export {
  detectJobOfferLanguage,
  getTargetLanguageName,
  getLanguageCode,
  getLanguageInstruction,
  needsTranslation,
} from './utils/language.js';

// ============================================================================
// REVIEW - Apply selective changes after user review
// ============================================================================

export { applySelectiveChanges } from './applySelectiveChanges.js';
