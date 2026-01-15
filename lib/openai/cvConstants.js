/**
 * Constantes CV pour reconstruction et affichage
 *
 * Ces constantes remplacent les champs statiques qui étaient
 * précédemment générés par l'IA (order_hint, section_titles).
 */

import prisma from '@/lib/prisma';

// ============================================================================
// ORDRE DES SECTIONS
// ============================================================================

/**
 * Ordre par défaut des sections CV (utilisé si Setting absent)
 */
export const DEFAULT_SECTION_ORDER = [
  'header',
  'summary',
  'skills',
  'experience',
  'education',
  'languages',
  'extras',
  'projects'
];

// Cache pour l'ordre des sections (évite requêtes DB répétées)
let cachedSectionOrder = null;
let sectionOrderCacheTime = 0;
const SECTION_ORDER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Récupère l'ordre des sections depuis Settings (avec cache)
 * @returns {Promise<string[]>} - Tableau des noms de sections dans l'ordre
 */
export async function getSectionOrder() {
  // Utiliser le cache si valide
  if (cachedSectionOrder && Date.now() - sectionOrderCacheTime < SECTION_ORDER_CACHE_TTL) {
    return cachedSectionOrder;
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { settingName: 'cv_section_order' }
    });

    cachedSectionOrder = setting?.value
      ? JSON.parse(setting.value)
      : DEFAULT_SECTION_ORDER;
  } catch (error) {
    console.error('[cvConstants] Erreur lecture cv_section_order:', error.message);
    cachedSectionOrder = DEFAULT_SECTION_ORDER;
  }

  sectionOrderCacheTime = Date.now();
  return cachedSectionOrder;
}

/**
 * Invalide le cache de l'ordre des sections
 * Appeler après modification dans l'admin
 */
export function invalidateSectionOrderCache() {
  cachedSectionOrder = null;
  sectionOrderCacheTime = 0;
}

// ============================================================================
// TITRES DES SECTIONS PAR LANGUE
// ============================================================================

/**
 * Titres des sections traduits par langue
 * Utilisés pour reconstruire section_titles depuis la langue du CV
 */
export const SECTION_TITLES_BY_LANGUAGE = {
  fr: {
    summary: 'Résumé',
    skills: 'Compétences',
    experience: 'Expérience',
    education: 'Formation',
    languages: 'Langues',
    extras: 'Informations complémentaires',
    projects: 'Projets personnels'
  },
  en: {
    summary: 'Summary',
    skills: 'Skills',
    experience: 'Experience',
    education: 'Education',
    languages: 'Languages',
    extras: 'Additional Information',
    projects: 'Projects'
  },
  es: {
    summary: 'Resumen',
    skills: 'Habilidades',
    experience: 'Experiencia',
    education: 'Formación',
    languages: 'Idiomas',
    extras: 'Información adicional',
    projects: 'Proyectos'
  },
  de: {
    summary: 'Zusammenfassung',
    skills: 'Fähigkeiten',
    experience: 'Berufserfahrung',
    education: 'Ausbildung',
    languages: 'Sprachen',
    extras: 'Zusätzliche Informationen',
    projects: 'Projekte'
  }
};

/**
 * Récupère les titres de sections pour une langue donnée
 * @param {string} language - Code langue (fr, en, es, de)
 * @returns {Object} - Titres des sections
 */
export function getSectionTitles(language) {
  return SECTION_TITLES_BY_LANGUAGE[language] || SECTION_TITLES_BY_LANGUAGE.en;
}

// ============================================================================
// DÉTECTION DE LANGUE
// ============================================================================

/**
 * Indicateurs de langue pour la détection automatique
 */
const LANGUAGE_INDICATORS = {
  fr: ['expérience', 'compétences', 'formation', 'langues', 'résumé', 'actuellement', 'entreprise'],
  en: ['experience', 'skills', 'education', 'languages', 'summary', 'currently', 'company'],
  es: ['experiencia', 'habilidades', 'formación', 'idiomas', 'resumen', 'actualmente', 'empresa'],
  de: ['erfahrung', 'fähigkeiten', 'ausbildung', 'sprachen', 'zusammenfassung', 'aktuell', 'unternehmen']
};

/**
 * Détecte la langue du CV depuis son contenu extrait
 * @param {Object} extracted - Contenu CV extrait
 * @returns {string} - Code langue détecté (fr, en, es, de)
 */
export function detectLanguage(extracted) {
  // Concaténer tout le texte du CV
  const textParts = [];

  if (extracted.header?.current_title) {
    textParts.push(extracted.header.current_title);
  }
  if (extracted.summary?.description) {
    textParts.push(extracted.summary.description);
  }
  if (extracted.summary?.headline) {
    textParts.push(extracted.summary.headline);
  }
  if (extracted.experience?.length) {
    extracted.experience.forEach(exp => {
      if (exp.title) textParts.push(exp.title);
      if (exp.description) textParts.push(exp.description);
      if (exp.responsibilities) textParts.push(...exp.responsibilities);
    });
  }

  const fullText = textParts.join(' ').toLowerCase();

  // Compter les indicateurs par langue
  const scores = {};
  for (const [lang, indicators] of Object.entries(LANGUAGE_INDICATORS)) {
    scores[lang] = indicators.filter(word => fullText.includes(word)).length;
  }

  // Retourner la langue avec le score le plus élevé
  const detectedLang = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  // Si aucun indicateur trouvé, défaut à français
  if (detectedLang[1] === 0) {
    return 'fr';
  }

  return detectedLang[0];
}

// ============================================================================
// STRUCTURES PAR DÉFAUT
// ============================================================================

/**
 * Structure skills vide par défaut
 */
export function getEmptySkills() {
  return {
    hard_skills: [],
    soft_skills: [],
    tools: [],
    methodologies: []
  };
}

/**
 * Structure header vide par défaut
 */
export function getEmptyHeader() {
  return {
    full_name: '',
    current_title: '',
    contact: {
      email: '',
      phone: '',
      location: {
        city: '',
        region: '',
        country_code: ''
      },
      links: []
    }
  };
}

/**
 * Structure summary vide par défaut
 */
export function getEmptySummary() {
  return {
    headline: '',
    description: '',
    years_experience: 0,
    domains: [],
    key_strengths: []
  };
}
