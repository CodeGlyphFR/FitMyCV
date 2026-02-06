/**
 * Text formatting utilities for CV data
 * @module lib/utils/textFormatting
 */

/**
 * Format a date string (YYYY-MM or YYYY) to MM/YYYY format for display
 * Handles "present" values (returns "présent")
 *
 * @param {string|null|undefined} d - The date string to format
 * @returns {string} The formatted date, or empty string if invalid
 *
 * @example
 * ym("2024-03")   // "03/2024"
 * ym("2024")      // "2024"
 * ym("present")   // "présent"
 * ym(null)        // ""
 */
export function ym(d) {
  if (!d) return "";
  const s = String(d).toLowerCase();
  if (s === "present") return "présent";
  const parts = String(d).split("-");
  const y = parts[0];
  if (!parts[1]) return y;
  const m = parts[1];
  const mm = String(Number(m)).padStart(2, "0");
  return mm + "/" + y;
}

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

/**
 * Converts a string to Title Case (first letter of each word capitalized)
 * Preserves special cases (acronyms like "IT", "HR", "CEO", etc.)
 *
 * @param {string|null|undefined} str - The string to convert
 * @returns {string|null|undefined} The title-cased string, or original value if invalid
 *
 * @example
 * toTitleCase("SENIOR CONSULTANT")  // "Senior Consultant"
 * toTitleCase("senior consultant")  // "Senior Consultant"
 * toTitleCase("IT Manager")         // "IT Manager" (preserved)
 * toTitleCase("CEO")                // "CEO" (preserved - acronym)
 *
 * Rules:
 * - All uppercase words matching known acronyms → preserved as-is
 * - Other words → capitalize first letter, lowercase rest
 * - Null/undefined/non-string → returned unchanged
 */
export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return str;

  // Common acronyms to preserve in uppercase
  const acronyms = [
    'IT', 'HR', 'CEO', 'CTO', 'CFO', 'COO', 'VP', 'SVP', 'EVP',
    'AI', 'ML', 'UX', 'UI', 'QA', 'PM', 'BA', 'BI',
    'ERP', 'CRM', 'SAP', 'AWS', 'GCP', 'API', 'SaaS', 'B2B', 'B2C',
    'RH', 'PDG', 'DG', 'DAF', 'DSI', 'DRH' // French acronyms
  ];

  return str
    .split(' ')
    .map(word => {
      const upper = word.toUpperCase();
      // If the word is a known acronym, keep it uppercase
      if (acronyms.includes(upper)) return upper;
      // Otherwise, capitalize first letter and lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
