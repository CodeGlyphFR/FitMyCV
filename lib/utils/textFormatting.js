/**
 * Text formatting utilities for CV data
 * @module lib/utils/textFormatting
 */

/**
 * Capitalizes the first character of a skill name with smart formatting preservation
 *
 * @param {string|null|undefined} name - The skill name to capitalize
 * @returns {string|null|undefined} The capitalized name, or original value if invalid
 *
 * @example
 * capitalizeSkillName("python")      // "Python"
 * capitalizeSkillName("SQL")         // "SQL" (preserved - all uppercase)
 * capitalizeSkillName("JavaScript")  // "JavaScript" (preserved - mixed case)
 * capitalizeSkillName("iOS")         // "iOS" (preserved - mixed case)
 *
 * Rules:
 * - Mixed case (e.g., "JavaScript", "iOS") → preserved as-is
 * - All uppercase (e.g., "SQL", "API", "MATLAB") → preserved as-is (likely acronym)
 * - All lowercase (e.g., "python") → capitalize first character
 * - Null/undefined/non-string → returned unchanged
 */
export function capitalizeSkillName(name) {
  if (!name || typeof name !== 'string') return name;

  // Preserve mixed case (intentional formatting like "JavaScript", "iOS", "AutoCAD")
  const hasLowerCase = /[a-z]/.test(name);
  const hasUpperCase = /[A-Z]/.test(name);
  if (hasLowerCase && hasUpperCase) return name;

  // Preserve all-uppercase (likely acronyms like "SQL", "API", "MATLAB")
  if (name === name.toUpperCase()) return name;

  // Capitalize first character for all-lowercase
  return name.charAt(0).toUpperCase() + name.slice(1);
}
