/**
 * Modifications module - Centralise toutes les fonctions d'application de modifications CV
 *
 * Ce module expose deux APIs:
 * - V1: applyModifications() - legacy, conservé pour compatibilité
 * - V2: applyExperienceModifications(), applyProjectModifications() pour improveCvJob.js
 * - Diff: computeCvDiff(), computeDetailedChanges() pour changeTracking
 */

// Re-export utility functions
export {
  deepClone,
  extractName,
  safeToLowerCase,
  sanitizeSkillName,
  isCurrentExperience,
  isPersonalProject
} from './utils.js';

// Re-export V1 API (legacy, conservé pour compatibilité)
export {
  applyModifications,
  sanitizeCvSkills
} from './apply.js';

// Re-export V2 API (for improveCvJob.js)
export {
  applyFieldDiff,
  applyDiffModifications,
  applySummaryDiff,
  applyArrayDiff,
  applyExperienceModifications,
  applyProjectModifications
} from './apply.js';

// Re-export diff functions (for changeTracking)
export {
  generateChangeId,
  getValueAtPath,
  setValueAtPath,
  computeCvDiff,
  computeDetailedChanges
} from './diff.js';
