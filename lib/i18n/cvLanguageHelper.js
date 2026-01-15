/**
 * Helper to get CV section titles based on CV language (not site language)
 * This ensures CV section names follow the CV's language independently of the user's site language preference
 */

// French translations (split by category)
import frUi from '@/locales/fr/ui.json';
import frErrors from '@/locales/fr/errors.json';
import frAuth from '@/locales/fr/auth.json';
import frCv from '@/locales/fr/cv.json';
import frEnums from '@/locales/fr/enums.json';
import frSubscription from '@/locales/fr/subscription.json';
import frTasks from '@/locales/fr/tasks.json';
import frOnboarding from '@/locales/fr/onboarding.json';
import frAccount from '@/locales/fr/account.json';

// English translations (split by category)
import enUi from '@/locales/en/ui.json';
import enErrors from '@/locales/en/errors.json';
import enAuth from '@/locales/en/auth.json';
import enCv from '@/locales/en/cv.json';
import enEnums from '@/locales/en/enums.json';
import enSubscription from '@/locales/en/subscription.json';
import enTasks from '@/locales/en/tasks.json';
import enOnboarding from '@/locales/en/onboarding.json';
import enAccount from '@/locales/en/account.json';

// Spanish translations (split by category)
import esUi from '@/locales/es/ui.json';
import esErrors from '@/locales/es/errors.json';
import esAuth from '@/locales/es/auth.json';
import esCv from '@/locales/es/cv.json';
import esEnums from '@/locales/es/enums.json';
import esSubscription from '@/locales/es/subscription.json';
import esTasks from '@/locales/es/tasks.json';
import esOnboarding from '@/locales/es/onboarding.json';
import esAccount from '@/locales/es/account.json';

// German translations (split by category)
import deUi from '@/locales/de/ui.json';
import deErrors from '@/locales/de/errors.json';
import deAuth from '@/locales/de/auth.json';
import deCv from '@/locales/de/cv.json';
import deEnums from '@/locales/de/enums.json';
import deSubscription from '@/locales/de/subscription.json';
import deTasks from '@/locales/de/tasks.json';
import deOnboarding from '@/locales/de/onboarding.json';
import deAccount from '@/locales/de/account.json';

const translations = {
  fr: { ...frUi, ...frErrors, ...frAuth, ...frCv, ...frEnums, ...frSubscription, ...frTasks, ...frOnboarding, ...frAccount },
  en: { ...enUi, ...enErrors, ...enAuth, ...enCv, ...enEnums, ...enSubscription, ...enTasks, ...enOnboarding, ...enAccount },
  es: { ...esUi, ...esErrors, ...esAuth, ...esCv, ...esEnums, ...esSubscription, ...esTasks, ...esOnboarding, ...esAccount },
  de: { ...deUi, ...deErrors, ...deAuth, ...deCv, ...deEnums, ...deSubscription, ...deTasks, ...deOnboarding, ...deAccount },
};

/**
 * Get translation function for a specific CV language
 * @param {string} cvLanguage - 'fr' or 'en'
 * @returns {Function} Translation function t(path)
 */
export function getTranslatorForCvLanguage(cvLanguage) {
  const lang = cvLanguage === 'en' ? 'en' : cvLanguage === 'es' ? 'es' : cvLanguage === 'de' ? 'de' : 'fr'; // Default to 'fr'

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

  // Default titles in Spanish
  const defaultTitlesEs = {
    header: ["Encabezado"],
    summary: ["Resumen"],
    experience: ["Experiencia"],
    education: ["Educación", "Formación"],
    skills: ["Habilidades", "Competencias"],
    projects: ["Proyectos personales", "Proyectos"],
    languages: ["Idiomas"],
    extras: ["Información adicional", "Extras"]
  };

  // Default titles in German
  const defaultTitlesDe = {
    header: ["Kopfzeile"],
    summary: ["Zusammenfassung"],
    experience: ["Berufserfahrung", "Erfahrung"],
    education: ["Ausbildung"],
    skills: ["Fähigkeiten", "Kompetenzen"],
    projects: ["Persönliche Projekte", "Projekte"],
    languages: ["Sprachen"],
    extras: ["Zusätzliche Informationen", "Extras"]
  };

  // Check if title matches a default title (FR, EN, ES or DE)
  const trimmedTitle = customTitle.trim();
  const isFrenchDefault = defaultTitlesFr[sectionKey] && defaultTitlesFr[sectionKey].includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey] && defaultTitlesEn[sectionKey].includes(trimmedTitle);
  const isSpanishDefault = defaultTitlesEs[sectionKey] && defaultTitlesEs[sectionKey].includes(trimmedTitle);
  const isGermanDefault = defaultTitlesDe[sectionKey] && defaultTitlesDe[sectionKey].includes(trimmedTitle);

  // If it's a default title, use the CV language translation
  if (isFrenchDefault || isEnglishDefault || isSpanishDefault || isGermanDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  // Otherwise, it's a custom title, keep it as-is
  return customTitle;
}
