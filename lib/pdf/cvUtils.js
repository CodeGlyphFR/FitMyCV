import { getTranslation } from './cvTranslations';

/**
 * Format a date string for display
 * Converts YYYY-MM to MM/YYYY or keeps YYYY only
 */
export function formatDate(dateStr, language = 'fr') {
  if (!dateStr) return "";
  if (dateStr.toLowerCase() === "present") {
    return getTranslation(language, "cvSections.present");
  }

  const parts = String(dateStr).split("-");
  const year = parts[0];
  if (!parts[1]) return year;
  const month = parts[1];
  const mm = String(Number(month)).padStart(2, "0");
  return `${mm}/${year}`;
}

/**
 * Format location object to string
 */
export function formatLocation(location) {
  if (!location) return "";
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country_code) parts.push(`(${location.country_code})`);
  return parts.join(", ");
}

/**
 * Check if a section is enabled based on selections
 */
export function isSectionEnabled(selections, sectionKey) {
  if (!selections || !selections.sections) return true;
  return selections.sections[sectionKey]?.enabled !== false;
}

/**
 * Check if a subsection is enabled based on selections
 */
export function isSubsectionEnabled(selections, sectionKey, subsectionKey) {
  if (!selections || !selections.sections) return true;
  const section = selections.sections[sectionKey];
  if (!section || !section.subsections) return true;
  return section.subsections[subsectionKey] !== false;
}

/**
 * Filter items based on selections
 */
export function filterItems(items, selections, sectionKey) {
  if (!selections || !selections.sections) return items;
  const section = selections.sections[sectionKey];
  if (!section || !section.items) return items;

  return items
    .map((item, index) => ({
      ...item,
      _originalIndex: item._originalIndex !== undefined ? item._originalIndex : index
    }))
    .filter((item) => section.items.includes(item._originalIndex));
}

/**
 * Sort experiences by date (most recent first)
 * Adds _originalIndex BEFORE sorting to preserve UI selection mapping
 */
export function sortExperiences(experiences) {
  return experiences
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .sort((a, b) => {
      const dateA = a.end_date === "present" ? "9999-99" : (a.end_date || a.start_date || "");
      const dateB = b.end_date === "present" ? "9999-99" : (b.end_date || b.start_date || "");
      return dateB.localeCompare(dateA);
    });
}

/**
 * Sort education by date (most recent first)
 * Adds _originalIndex BEFORE sorting to preserve UI selection mapping
 */
export function sortEducation(education) {
  return education
    .map((item, index) => ({ ...item, _originalIndex: index }))
    .sort((a, b) => {
      const dateA = a.end_date || a.start_date || "";
      const dateB = b.end_date || b.start_date || "";
      return dateB.localeCompare(dateA);
    });
}

/**
 * Sanitize filename for HTTP Content-Disposition header
 * Returns both ASCII-safe and RFC 5987 encoded versions
 */
export function sanitizeFilenameForHeader(filename) {
  // ASCII-safe version: replace non-ASCII chars with underscore
  const asciiSafe = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x20-\x7E]/g, '_')   // Replace non-printable ASCII with _
    .replace(/["\\]/g, '_');          // Replace quotes and backslashes

  // RFC 5987 encoded version for full Unicode support
  const encoded = encodeURIComponent(filename)
    .replace(/'/g, '%27');

  return { asciiSafe, encoded };
}

/**
 * Prepare CV data for rendering
 * Sorts and filters experiences, education, and other lists
 */
export function prepareCvData(cvData, selections) {
  const {
    header = {},
    summary = {},
    skills = {},
    experience: rawExperience = [],
    education: rawEducation = [],
    languages: rawLanguages = [],
    projects: rawProjects = [],
    extras: rawExtras = [],
    section_titles = {}
  } = cvData;

  // Sort and filter experiences
  const sortedExperience = sortExperiences(rawExperience);
  const experience = filterItems(sortedExperience, selections, 'experience');

  // Sort and filter education
  const sortedEducation = sortEducation(rawEducation);
  const education = filterItems(sortedEducation, selections, 'education');

  // Filter other lists
  const languages = filterItems(rawLanguages, selections, 'languages');
  const projects = filterItems(rawProjects, selections, 'projects');
  const extras = filterItems(rawExtras, selections, 'extras');

  return {
    header,
    summary,
    skills,
    experience,
    education,
    languages,
    projects,
    extras,
    section_titles,
    contact: header.contact || {}
  };
}

/**
 * Default section order
 */
export const DEFAULT_SECTION_ORDER = ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];
