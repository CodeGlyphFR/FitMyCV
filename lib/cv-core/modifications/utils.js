/**
 * Utilitaires pour les modifications de CV
 *
 * Fonctions communes utilisées par apply.js et applyV2.js
 */

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Extract string name from either a string or an object with name property
 * Handles cases where AI returns either "skill" or {name: "skill"}
 * @param {string|Object} item - String or object with name property
 * @returns {string|null} - Extracted string name or null if invalid
 */
export function extractName(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item.name && typeof item.name === 'string') {
    return item.name;
  }
  return null;
}

/**
 * Safe lowercase conversion - handles both strings and objects
 * @param {string|Object} item - String or object with name property
 * @returns {string|null} - Lowercase string or null
 */
export function safeToLowerCase(item) {
  const name = extractName(item);
  return name ? name.toLowerCase() : null;
}

/**
 * Sanitize a skill name to comply with naming constraints:
 * - Max 3 words
 * - No special characters: /, &, ()
 * - One concept only
 * @param {string} name - Original skill name
 * @returns {string} - Sanitized skill name
 */
export function sanitizeSkillName(name) {
  if (!name || typeof name !== 'string') return name;

  let sanitized = name;

  // Remove content in parentheses (including the parentheses)
  sanitized = sanitized.replace(/\s*\([^)]*\)/g, '');

  // Replace / and & with nothing (keep first part only)
  // "Customer Success / Account Management" → "Customer Success"
  // "Diagnostic organisation & SI" → "Diagnostic organisation"
  if (sanitized.includes('/')) {
    sanitized = sanitized.split('/')[0];
  }
  if (sanitized.includes('&')) {
    sanitized = sanitized.split('&')[0];
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit to 3 words
  const words = sanitized.split(/\s+/);
  if (words.length > 3) {
    sanitized = words.slice(0, 3).join(' ');
  }

  // Final trim
  sanitized = sanitized.trim();

  // Capitalize first letter
  if (sanitized.length > 0) {
    sanitized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  }

  return sanitized || name; // Return original if sanitized is empty
}

/**
 * Check if an experience is the current/active job
 * Current experiences should NEVER be removed
 * @param {Object} experience - Experience object
 * @returns {boolean} - True if this is a current experience
 */
export function isCurrentExperience(experience) {
  if (!experience) return false;

  // Check end_date is null or undefined
  if (experience.end_date === null || experience.end_date === undefined) {
    return true;
  }

  // Check if end_date contains "Présent", "Present", "Current", "Aujourd'hui", etc.
  if (typeof experience.end_date === 'string') {
    const currentIndicators = ['présent', 'present', 'current', 'aujourd', 'actuel', 'now', 'ongoing'];
    const lowerEndDate = experience.end_date.toLowerCase();
    if (currentIndicators.some(indicator => lowerEndDate.includes(indicator))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an experience is a personal project (not a real job)
 * @param {Object} experience - Experience object
 * @returns {boolean} - True if this is a personal project
 */
export function isPersonalProject(experience) {
  if (!experience) return false;

  const personalIndicators = ['projet', 'personnel', 'fondateur', 'freelance perso', 'personal'];

  const title = (experience.title || '').toLowerCase();
  const company = (experience.company || '').toLowerCase();

  // Check if company contains personal project indicators
  if (personalIndicators.some(indicator => company.includes(indicator))) {
    return true;
  }

  // Check if title is "Fondateur" without established company
  if (title.includes('fondateur') && !company) {
    return true;
  }

  return false;
}
