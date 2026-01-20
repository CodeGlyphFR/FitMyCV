/**
 * CV Core - Domain pure pour les opérations CV
 *
 * Contient les fonctionnalités de base pour la gestion des CV :
 * - Storage : lecture/écriture des fichiers CV
 * - Validation : validation du schéma CV
 * - Versioning : gestion des versions
 * - Change tracking : suivi des modifications
 * - Reconstruction : reconstruction du CV depuis les modifications
 * - Language : détection et gestion des langues
 */

// Storage
export {
  readUserCvFile,
  readUserCvFileWithMeta,
  writeUserCvFile,
  deleteUserCvFile,
  listUserCvFiles,
  ensureUserCvDir,
  detectNewFiles,
  cvFileExists
} from './storage.js';

// Validation
export { validateCv } from './validation.js';

// Versioning
export {
  createCvVersion,
  createCvVersionWithTracking,
  getCvVersions,
  getCvVersionsWithDetails,
  getCvVersionContent,
  getCvVersionCount,
  restoreCvVersion,
  restoreCvVersionDestructive
} from './versioning.js';

// Change tracking (re-exports from modifications and review)
export * from './changeTracking.js';

// Reconstruction
export { reconstructCv, reconstructCvSync } from './reconstruction.js';

// Source
export { getCvSource, setCvSource } from './source.js';

// Constants
export * from './constants.js';

// Language
export * from './language/index.js';

// Modifications
export * from './modifications/index.js';

// Review
export * from './review/index.js';
