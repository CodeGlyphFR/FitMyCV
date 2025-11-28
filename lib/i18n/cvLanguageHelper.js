/**
 * Helper to get CV section titles based on CV language (not site language)
 * This ensures CV section names follow the CV's language independently of the user's site language preference
 */

import frTranslations from '@/locales/fr.json';
import enTranslations from '@/locales/en.json';

const translations = {
  fr: frTranslations,
  en: enTranslations,
};

/**
 * Get translation function for a specific CV language
 * @param {string} cvLanguage - 'fr' or 'en'
 * @returns {Function} Translation function t(path)
 */
export function getTranslatorForCvLanguage(cvLanguage) {
  const lang = cvLanguage === 'en' ? 'en' : 'fr'; // Default to 'fr'

  return (path) => {
    const keys = path.split('.');
    let value = translations[lang];

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return path;
      }
    }

    return value || path;
  };
}

/**
 * Get CV section title in CV's language
 * Uses getSectionTitle logic but with CV language instead of site language
 * @param {string} sectionKey - Section key (summary, experience, education, etc.)
 * @param {string} customTitle - Custom title from CV JSON (may be null/undefined)
 * @param {string} cvLanguage - CV language ('fr' or 'en')
 * @returns {string} The translated or custom section title
 */
export function getCvSectionTitleInCvLanguage(sectionKey, customTitle, cvLanguage) {
  const t = getTranslatorForCvLanguage(cvLanguage);

  // If no custom title, use default translation
  if (!customTitle || !customTitle.trim()) {
    return t(`cvSections.${sectionKey}`);
  }

  // Default titles in French
  const defaultTitlesFr = {
    header: ["En-tête"],
    summary: ["Résumé"],
    experience: ["Expérience"],
    education: ["Éducation", "Formation"],
    skills: ["Compétences"],
    projects: ["Projets personnels", "Projets"],
    languages: ["Langues"],
    extras: ["Informations complémentaires", "Extras"]
  };

  // Default titles in English
  const defaultTitlesEn = {
    header: ["Header"],
    summary: ["Summary"],
    experience: ["Experience"],
    education: ["Education"],
    skills: ["Skills"],
    projects: ["Personal Projects", "Projects"],
    languages: ["Languages"],
    extras: ["Additional Information", "Extras"]
  };

  // Check if title matches a default title (FR or EN)
  const trimmedTitle = customTitle.trim();
  const isFrenchDefault = defaultTitlesFr[sectionKey] && defaultTitlesFr[sectionKey].includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey] && defaultTitlesEn[sectionKey].includes(trimmedTitle);

  // If it's a default title, use the CV language translation
  if (isFrenchDefault || isEnglishDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  // Otherwise, it's a custom title, keep it as-is
  return customTitle;
}
