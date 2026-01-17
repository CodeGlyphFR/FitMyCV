/**
 * Skill Levels - Single Source of Truth
 *
 * Numeric values (0-5) are the canonical representation stored in DB and used by AI.
 * String keys are used for i18n lookup only.
 */

// Mapping: numeric level → i18n key
export const SKILL_LEVEL_KEYS = {
  0: 'awareness',
  1: 'beginner',
  2: 'intermediate',
  3: 'proficient',
  4: 'advanced',
  5: 'expert',
};

// Reverse mapping: i18n key → numeric level
export const SKILL_LEVEL_VALUES = {
  awareness: 0,
  beginner: 1,
  intermediate: 2,
  proficient: 3,
  advanced: 4,
  expert: 5,
};

// Valid numeric levels
export const VALID_SKILL_LEVELS = [0, 1, 2, 3, 4, 5];

// All known string variants (for migration) - maps to numeric value
export const STRING_TO_LEVEL = {
  // English keys (canonical)
  awareness: 0,
  beginner: 1,
  intermediate: 2,
  proficient: 3,
  advanced: 4,
  expert: 5,

  // French variants
  notions: 0,
  notion: 0,
  connaissance: 0,
  connaissances: 0,
  débutant: 1,
  debutant: 1,
  intermédiaire: 2,
  intermediaire: 2,
  compétent: 3,
  competent: 3,
  confirmé: 3,
  confirme: 3,
  avancé: 4,
  avance: 4,
  maître: 5,
  maitre: 5,
  maîtrise: 5,
  maitrise: 5,

  // German variants
  grundkenntnisse: 0,
  anfänger: 1,
  anfanger: 1,
  mittelstufe: 2,
  kompetent: 3,
  fortgeschritten: 4,
  experte: 5,

  // Spanish variants
  conocimiento: 0,
  principiante: 1,
  intermedio: 2,
  competente: 3,
  avanzado: 4,
  experto: 5,

  // Other common variants
  basic: 0,
  basics: 0,
  bases: 0,
  familiar: 0,
  exposure: 0,
  junior: 1,
  novice: 1,
  standard: 2,
  moyen: 2,
  experienced: 3,
  experience: 3,
  solid: 3,
  senior: 5,
};

/**
 * Normalize any proficiency value to a numeric level (0-5)
 * @param {number|string|null|undefined} value - Raw proficiency value
 * @returns {number|null} - Numeric level (0-5) or null if invalid
 */
export function normalizeToNumber(value) {
  // Already a valid number
  if (typeof value === 'number') {
    if (VALID_SKILL_LEVELS.includes(value)) {
      return value;
    }
    // Handle floating point (e.g., from older numeric scale)
    if (value >= 0 && value <= 5) {
      return Math.round(value);
    }
    return null;
  }

  // Null/undefined
  if (value == null) {
    return null;
  }

  // String - lookup in mapping
  if (typeof value === 'string') {
    const key = value.toLowerCase().trim();
    if (key in STRING_TO_LEVEL) {
      return STRING_TO_LEVEL[key];
    }
    // Try parsing as number
    const parsed = parseInt(key, 10);
    if (!isNaN(parsed) && VALID_SKILL_LEVELS.includes(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Get the i18n key for a numeric level
 * @param {number} level - Numeric level (0-5)
 * @returns {string|null} - i18n key or null if invalid
 */
export function getLevelKey(level) {
  return SKILL_LEVEL_KEYS[level] ?? null;
}

/**
 * Get localized label for a skill level (works with both number and string)
 * @param {number|string} level - Numeric level (0-5) or string key
 * @param {Function} t - Translation function
 * @returns {string} - Localized label
 */
export function getLocalizedLabel(level, t) {
  // If already a number
  if (typeof level === 'number') {
    const key = SKILL_LEVEL_KEYS[level];
    if (!key) return '';
    return t(`skillLevels.${key}`) || key;
  }

  // If string, try to normalize first
  const numericLevel = normalizeToNumber(level);
  if (numericLevel !== null) {
    const key = SKILL_LEVEL_KEYS[numericLevel];
    return t(`skillLevels.${key}`) || key;
  }

  // Fallback: try direct key lookup
  if (typeof level === 'string') {
    const result = t(`skillLevels.${level.toLowerCase()}`);
    if (result && !result.startsWith('skillLevels.')) {
      return result;
    }
  }

  return '';
}

/**
 * Check if a value is a valid skill level (number 0-5)
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isValidLevel(value) {
  return typeof value === 'number' && VALID_SKILL_LEVELS.includes(value);
}
