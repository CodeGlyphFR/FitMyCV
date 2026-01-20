/**
 * Language module - Language detection and utilities
 */

export {
  detectCvLanguage,
  detectJobOfferLanguage,
  getLanguageName
} from './detectLanguage.js';

export {
  SUPPORTED_LANGUAGES,
  MAX_CHARS_FOR_DETECTION,
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  LANGUAGE_KEYWORDS,
  normalizeLanguageInput
} from './languageConstants.js';

export {
  detectAndPersistCvLanguage,
  detectLanguageInBackground,
  getCvLanguage
} from './languageUtils.js';
