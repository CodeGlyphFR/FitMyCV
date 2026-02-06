/**
 * Helper functions to get translated labels for CV-related content
 */

import { SKILL_LEVEL_KEYS, normalizeToNumber } from '@/lib/constants/skillLevels';

/**
 * Get localized skill level label
 * Handles both numeric (0-5) and string key inputs
 * @param {number|string} level - Numeric level (0-5) or string key
 * @param {Function} t - Translation function
 * @returns {string|null} - Localized label or null if invalid
 */
export function getSkillLevelLabel(level, t) {
  if (level === null || level === undefined) return null;

  // If numeric, convert to string key first
  if (typeof level === 'number') {
    const key = SKILL_LEVEL_KEYS[level];
    if (!key) return null;
    return t(`skillLevels.${key}`) || key;
  }

  // If string, could be a key or a legacy string value
  if (typeof level === 'string') {
    // Try normalizing to number first (handles legacy string values)
    const numericLevel = normalizeToNumber(level);
    if (numericLevel !== null) {
      const key = SKILL_LEVEL_KEYS[numericLevel];
      return t(`skillLevels.${key}`) || key;
    }

    // Fallback: try direct key lookup
    const key = `skillLevels.${level}`;
    const result = t(key);

    // Si la traduction n'est pas trouvée (retourne la clé), essayer avec la première lettre en minuscule
    if (result === key && level.length > 0) {
      const lowerKey = `skillLevels.${level.charAt(0).toLowerCase() + level.slice(1)}`;
      const lowerResult = t(lowerKey);
      if (lowerResult !== lowerKey) return lowerResult;
    }

    return result === key ? level : result;
  }

  return null;
}

/**
 * Get language level label
 * Since language level is now a free-form text field,
 * this function simply returns the value as-is without translation.
 * @param {string} level - The language level as stored in the CV
 * @param {Function} t - Translation function (unused, kept for backward compatibility)
 * @returns {string|null} - The level as-is, or null if empty
 */
export function getLanguageLevelLabel(level, t) {
  if (!level) return null;
  return level;
}

export function getCvSectionLabel(section, t) {
  if (!section) return null;
  const key = `cvSections.${section}`;
  return t(key);
}

/**
 * Obtient le titre d'une section de CV en détectant si c'est un titre par défaut ou personnalisé
 * @param {string} sectionKey - Clé de la section (summary, experience, education, etc.)
 * @param {string} customTitle - Titre stocké dans le CV JSON
 * @param {Function} t - Fonction de traduction
 * @returns {string} Le titre traduit ou personnalisé
 */
export function getSectionTitle(sectionKey, customTitle, t) {
  // Si pas de titre personnalisé, utiliser la traduction par défaut
  if (!customTitle || !customTitle.trim()) {
    return t(`cvSections.${sectionKey}`);
  }

  // Titres par défaut en français (avec variantes)
  const defaultTitlesFr = {
    header: ["En-tête"],
    summary: ["Résumé"],
    experience: ["Expérience"],
    education: ["Éducation"],
    skills: ["Compétences"],
    projects: ["Projets personnels"],
    languages: ["Langues"],
    extras: ["Informations complémentaires"]
  };

  // Titres par défaut en anglais
  const defaultTitlesEn = {
    header: ["Header"],
    summary: ["Summary"],
    experience: ["Experience"],
    education: ["Education"],
    skills: ["Skills"],
    projects: ["Personal Projects"],
    languages: ["Languages"],
    extras: ["Additional Information"]
  };

  // Vérifier si le titre correspond à un titre par défaut (FR ou EN)
  const trimmedTitle = customTitle.trim();
  const isFrenchDefault = defaultTitlesFr[sectionKey] && defaultTitlesFr[sectionKey].includes(trimmedTitle);
  const isEnglishDefault = defaultTitlesEn[sectionKey] && defaultTitlesEn[sectionKey].includes(trimmedTitle);

  // Si c'est un titre par défaut, utiliser la traduction
  if (isFrenchDefault || isEnglishDefault) {
    return t(`cvSections.${sectionKey}`);
  }

  // Sinon, c'est un titre personnalisé, on le garde tel quel
  return customTitle;
}

/**
 * Obtient le nom d'un plan d'abonnement en fonction de son niveau (tier)
 * @param {number} tier - Niveau du plan (0=Gratuit, 1=Pro, 2=Premium, etc.)
 * @param {Function} t - Fonction de traduction
 * @returns {string} Le nom du plan traduit ou "Niveau X" si non trouvé
 */
export function getPlanNameByTier(tier, t) {
  const key = `admin.subscriptionPlans.tiers.${tier}`;
  const name = t(key);
  // Si la traduction n'existe pas (retourne la clé), retourner "Niveau X"
  return name === key ? `Niveau ${tier}` : name;
}
