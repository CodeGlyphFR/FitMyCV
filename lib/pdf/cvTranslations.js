import { SKILL_LEVEL_KEYS, normalizeToNumber } from '@/lib/constants/skillLevels';

// French translations (split by category)
import frUi from "@/locales/fr/ui.json";
import frErrors from "@/locales/fr/errors.json";
import frAuth from "@/locales/fr/auth.json";
import frCv from "@/locales/fr/cv.json";
import frEnums from "@/locales/fr/enums.json";
import frSubscription from "@/locales/fr/subscription.json";
import frTasks from "@/locales/fr/tasks.json";
import frOnboarding from "@/locales/fr/onboarding.json";
import frAccount from "@/locales/fr/account.json";

// English translations (split by category)
import enUi from "@/locales/en/ui.json";
import enErrors from "@/locales/en/errors.json";
import enAuth from "@/locales/en/auth.json";
import enCv from "@/locales/en/cv.json";
import enEnums from "@/locales/en/enums.json";
import enSubscription from "@/locales/en/subscription.json";
import enTasks from "@/locales/en/tasks.json";
import enOnboarding from "@/locales/en/onboarding.json";
import enAccount from "@/locales/en/account.json";

// Spanish translations (split by category)
import esUi from "@/locales/es/ui.json";
import esErrors from "@/locales/es/errors.json";
import esAuth from "@/locales/es/auth.json";
import esCv from "@/locales/es/cv.json";
import esEnums from "@/locales/es/enums.json";
import esSubscription from "@/locales/es/subscription.json";
import esTasks from "@/locales/es/tasks.json";
import esOnboarding from "@/locales/es/onboarding.json";
import esAccount from "@/locales/es/account.json";

// German translations (split by category)
import deUi from "@/locales/de/ui.json";
import deErrors from "@/locales/de/errors.json";
import deAuth from "@/locales/de/auth.json";
import deCv from "@/locales/de/cv.json";
import deEnums from "@/locales/de/enums.json";
import deSubscription from "@/locales/de/subscription.json";
import deTasks from "@/locales/de/tasks.json";
import deOnboarding from "@/locales/de/onboarding.json";
import deAccount from "@/locales/de/account.json";

export const translations = {
  fr: { ...frUi, ...frErrors, ...frAuth, ...frCv, ...frEnums, ...frSubscription, ...frTasks, ...frOnboarding, ...frAccount },
  en: { ...enUi, ...enErrors, ...enAuth, ...enCv, ...enEnums, ...enSubscription, ...enTasks, ...enOnboarding, ...enAccount },
  es: { ...esUi, ...esErrors, ...esAuth, ...esCv, ...esEnums, ...esSubscription, ...esTasks, ...esOnboarding, ...esAccount },
  de: { ...deUi, ...deErrors, ...deAuth, ...deCv, ...deEnums, ...deSubscription, ...deTasks, ...deOnboarding, ...deAccount },
};

/**
 * Helper function to get translation by path
 */
export function getTranslation(language, path) {
  const keys = path.split(".");
  let value = translations[language] || translations.fr;

  for (const key of keys) {
    if (value && typeof value === "object") {
      value = value[key];
    } else {
      return path;
    }
  }

  return value || path;
}

/**
 * Translate skill/language levels according to CV language
 */
export function translateLevel(language, level, type = 'skill') {
  if (level === null || level === undefined || level === '') return '';

  let lookupKey = level;

  if (type === 'skill') {
    const numeric = normalizeToNumber(level);
    if (numeric !== null) {
      lookupKey = SKILL_LEVEL_KEYS[numeric] || level;
    }
  }

  const path = type === 'skill' ? `skillLevels.${lookupKey}` : `languageLevels.${lookupKey}`;
  const translated = getTranslation(language, path);

  return translated === path ? String(level) : translated;
}

// Default section titles by language
const defaultTitlesFr = {
  header: ["En-tête"],
  summary: ["Résumé"],
  experience: ["Expérience"],
  education: ["Formation", "Éducation"],
  skills: ["Compétences"],
  projects: ["Projets personnels", "Projets"],
  languages: ["Langues"],
  extras: ["Informations complémentaires", "Extras"]
};

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

/**
 * Get section title with smart detection of default vs custom titles
 */
export function getSectionTitle(sectionKey, customTitle, language) {
  const t = (path) => getTranslation(language, path);

  if (!customTitle || !customTitle.trim()) {
    return t(`cvSections.${sectionKey}`);
  }

  const trimmedTitle = customTitle.trim();
  const isFrenchDefault = defaultTitlesFr[sectionKey] && defaultTitlesFr[sectionKey].includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey] && defaultTitlesEn[sectionKey].includes(trimmedTitle);

  if (isFrenchDefault || isEnglishDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  return customTitle;
}

/**
 * Create a translator function for a specific language
 */
export function createTranslator(language) {
  return (path) => getTranslation(language, path);
}
