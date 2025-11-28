/**
 * Language detection constants and utilities
 */

/**
 * Supported language codes for CV content
 */
export const SUPPORTED_LANGUAGES = {
  FR: 'fr',
  EN: 'en',
};

/**
 * Maximum characters to send to OpenAI for language detection.
 *
 * Rationale: 50 characters provides enough linguistic markers (articles,
 * prepositions, verb conjugations) to distinguish French from English,
 * while minimizing token usage.
 *
 * Note: This is NOT a minimum requirement. Detection is attempted for any
 * non-empty text, but only the first N characters are sent to OpenAI.
 */
export const MAX_CHARS_FOR_DETECTION = 50;

/**
 * Default language when detection fails or summary is too short
 */
export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES.FR;

/**
 * Language name mappings for display
 */
export const LANGUAGE_NAMES = {
  [SUPPORTED_LANGUAGES.FR]: 'français',
  [SUPPORTED_LANGUAGES.EN]: 'anglais',
};

/**
 * Flag icon paths for each supported language
 */
export const LANGUAGE_FLAGS = {
  [SUPPORTED_LANGUAGES.FR]: '/icons/fr.svg',
  [SUPPORTED_LANGUAGES.EN]: '/icons/gb.svg',
};

/**
 * Display labels for language selection UI
 */
export const LANGUAGE_LABELS = {
  [SUPPORTED_LANGUAGES.FR]: 'Français',
  [SUPPORTED_LANGUAGES.EN]: 'English',
};

/**
 * Keywords used to normalize language input strings
 */
export const LANGUAGE_KEYWORDS = {
  [SUPPORTED_LANGUAGES.FR]: ['français', 'french', 'france', 'fr'],
  [SUPPORTED_LANGUAGES.EN]: ['anglais', 'english', 'anglaise', 'en', 'eng'],
};

/**
 * Normalizes various language input formats to a supported language code.
 *
 * @param {string} input - Language input (e.g., 'français', 'English', 'en')
 * @returns {string} - Normalized language code ('fr' or 'en')
 *
 * @example
 * normalizeLanguageInput('français')  // 'fr'
 * normalizeLanguageInput('English')   // 'en'
 * normalizeLanguageInput('anglais')   // 'en'
 * normalizeLanguageInput('unknown')   // 'fr' (default)
 */
export function normalizeLanguageInput(input) {
  const normalized = (input || '').toLowerCase().trim();

  // Check if already a valid code
  if (Object.values(SUPPORTED_LANGUAGES).includes(normalized)) {
    return normalized;
  }

  // Match against keywords
  for (const [langCode, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return langCode;
    }
  }

  // Default to French
  return DEFAULT_LANGUAGE;
}
