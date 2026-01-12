/**
 * CV Pipeline v2 - Main exports
 *
 * Pipeline en 3 phases:
 * 1. Classification (KEEP/REMOVE/MOVE_TO_PROJECTS)
 * 2. Batches (adaptation par section)
 * 3. Recomposition (assemblage final)
 */

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

// Orchestrateur
export {
  startCvGenerationV2,
  startSingleOfferGeneration,
  withRetry,
  refundCreditForOffer,
} from './orchestrator.js';

// Utilitaires
export {
  detectJobOfferLanguage,
  getTargetLanguageName,
  getLanguageCode,
  getLanguageInstruction,
  needsTranslation,
} from './utils/language.js';
