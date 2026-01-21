/**
 * Fonctions de calcul de diff entre versions de CV
 *
 * This file re-exports from the modularized diff directory.
 * See ./diff/index.js for the main implementation.
 */

export {
  // Main functions
  computeCvDiff,
  computeDetailedChanges,
  // Utilities
  generateChangeId,
  getValueAtPath,
  setValueAtPath,
  formatValueForDisplay,
  valuesAreDifferent,
  computeArrayItemDiff,
  computeBulletDiff
} from './diff/index.js';
