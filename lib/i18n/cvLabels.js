/**
 * Helper functions to get translated labels for CV-related content
 */

export function getAnalysisLevelLabel(level, t) {
  if (!level) return null;
  const key = `topbar.analysisLevels.${level}`;
  return t(key);
}

export function getSkillLevelLabel(level, t) {
  if (!level) return null;
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

export function getLanguageLevelLabel(level, t) {
  if (!level) return null;
  const key = `languageLevels.${level}`;
  const result = t(key);

  // Si la traduction n'est pas trouvée (retourne la clé), essayer avec la première lettre en minuscule
  if (result === key && level.length > 0) {
    const lowerKey = `languageLevels.${level.charAt(0).toLowerCase() + level.slice(1)}`;
    const lowerResult = t(lowerKey);
    if (lowerResult !== lowerKey) return lowerResult;
  }

  return result === key ? level : result;
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

export const ANALYSIS_OPTIONS = (t) => Object.freeze([
  {
    id: "rapid",
    label: t("topbar.analysisLevels.rapid"),
    model: "gpt-5-nano-2025-08-07",
    hint: t("cvGenerator.analysisHints.rapid"),
  },
  {
    id: "medium",
    label: t("topbar.analysisLevels.medium"),
    model: "gpt-5-mini-2025-08-07",
    hint: t("cvGenerator.analysisHints.medium"),
  },
  {
    id: "deep",
    label: t("topbar.analysisLevels.deep"),
    model: "gpt-5-2025-08-07",
    hint: t("cvGenerator.analysisHints.deep"),
  },
]);
