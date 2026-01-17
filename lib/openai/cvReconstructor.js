/**
 * Module de reconstruction CV
 *
 * Reconstruit un CV JSON depuis le contenu extrait par l'IA (8 sections).
 *
 * IMPORTANT: Les métadonnées suivantes sont stockées en DB (CvFile), PAS dans le JSON :
 * - language        → CvFile.language (détecté à l'import/création)
 * - generated_at    → CvFile.createdAt
 * - order_hint      → Setting 'cv_section_order' (global)
 * - section_titles  → Calculé via getSectionTitles(CvFile.language)
 * - meta.*          → CvFile.createdBy, CvFile.sourceType, etc.
 *
 * Le JSON CV ne contient que le contenu pur (8 sections).
 */

import {
  detectLanguage,
  getEmptySkills,
  getEmptySummary
} from './cvConstants.js';

/**
 * Reconstruit un CV JSON depuis une extraction sparse
 *
 * Retourne uniquement le contenu pur (8 sections).
 * Les métadonnées sont gérées par CvFile en DB.
 *
 * @param {Object} extracted - Contenu extrait (8 sections)
 * @returns {Promise<Object>} - CV JSON avec contenu uniquement
 */
export async function reconstructCv(extracted) {
  return {
    // Contenu extrait (avec reconstruction des structures)
    header: reconstructHeader(extracted.header),
    summary: reconstructSummary(extracted.summary),
    skills: extracted.skills || getEmptySkills(),
    experience: reconstructExperiences(extracted.experience || []),
    education: reconstructEducation(extracted.education || []),
    languages: extracted.languages || [],
    extras: extracted.extras || [],
    projects: reconstructProjects(extracted.projects || []),
  };
}

/**
 * Détecte la langue d'un CV extrait (wrapper pour compatibilité)
 * @param {Object} extracted - Contenu extrait
 * @returns {string} - Code langue détecté (fr, en, es, de)
 */
export { detectLanguage };

/**
 * Reconstruit la structure header avec contact.location imbriqué
 * @param {Object} sparseHeader - Header extrait (champs plats)
 * @returns {Object} - Header au format standard
 */
function reconstructHeader(sparseHeader) {
  if (!sparseHeader) {
    return {
      full_name: '',
      current_title: '',
      contact: {
        email: '',
        phone: '',
        location: { city: '', region: '', country_code: '' },
        links: []
      }
    };
  }

  return {
    full_name: sparseHeader.full_name || '',
    current_title: sparseHeader.current_title || '',
    contact: {
      email: sparseHeader.email || '',
      phone: sparseHeader.phone || '',
      location: {
        city: sparseHeader.city || '',
        region: sparseHeader.region || '',
        country_code: sparseHeader.country_code || ''
      },
      links: (sparseHeader.links || []).map(link => ({
        type: link.type || 'other',
        label: link.label || getLinkLabel(link.type),
        url: link.url || ''
      }))
    }
  };
}

/**
 * Génère un label par défaut pour un type de lien
 * @param {string} type - Type de lien
 * @returns {string} - Label
 */
function getLinkLabel(type) {
  const labels = {
    linkedin: 'LinkedIn',
    github: 'GitHub',
    portfolio: 'Portfolio',
    website: 'Website',
    other: 'Link'
  };
  return labels[type] || labels.other;
}

/**
 * Reconstruit la structure summary
 * @param {Object} sparseSummary - Summary extrait
 * @returns {Object} - Summary au format standard
 */
function reconstructSummary(sparseSummary) {
  if (!sparseSummary) {
    return getEmptySummary();
  }

  return {
    headline: sparseSummary.headline || '',
    description: sparseSummary.description || '',
    years_experience: sparseSummary.years_experience || 0
  };
}

/**
 * Reconstruit les expériences avec location imbriquée
 * @param {Array} sparseExperiences - Expériences extraites
 * @returns {Array} - Expériences au format standard
 */
function reconstructExperiences(sparseExperiences) {
  return sparseExperiences.map(exp => ({
    title: exp.title || '',
    company: exp.company || '',
    department_or_client: exp.department_or_client || '',
    start_date: exp.start_date || '',
    end_date: exp.end_date || '',
    location: {
      city: exp.city || '',
      region: exp.region || '',
      country_code: exp.country_code || ''
    },
    description: exp.description || '',
    responsibilities: exp.responsibilities || [],
    deliverables: exp.deliverables || [],
    skills_used: exp.skills_used || []
  }));
}

/**
 * Reconstruit les formations avec location imbriquée
 * @param {Array} sparseEducation - Formations extraites
 * @returns {Array} - Formations au format standard
 */
function reconstructEducation(sparseEducation) {
  return sparseEducation.map(edu => ({
    institution: edu.institution || '',
    degree: edu.degree || '',
    field_of_study: edu.field_of_study || '',
    location: {
      city: edu.city || '',
      region: edu.region || '',
      country_code: edu.country_code || ''
    },
    start_date: edu.start_date || '',
    end_date: edu.end_date || ''
  }));
}

/**
 * Reconstruit les projets avec keywords vide (non extrait)
 * @param {Array} sparseProjects - Projets extraits
 * @returns {Array} - Projets au format standard
 */
function reconstructProjects(sparseProjects) {
  return sparseProjects.map(proj => ({
    name: proj.name || '',
    role: proj.role || '',
    summary: proj.summary || '',
    tech_stack: proj.tech_stack || [],
    keywords: [], // Non extrait, ajouté vide
    start_date: proj.start_date || '',
    end_date: proj.end_date || ''
  }));
}

/**
 * Version synchrone de reconstructCv
 *
 * Retourne uniquement le contenu pur (8 sections).
 * Les métadonnées sont gérées par CvFile en DB.
 *
 * @param {Object} extracted - Contenu extrait
 * @returns {Object} - CV JSON avec contenu uniquement
 */
export function reconstructCvSync(extracted) {
  return {
    header: reconstructHeader(extracted.header),
    summary: reconstructSummary(extracted.summary),
    skills: extracted.skills || getEmptySkills(),
    experience: reconstructExperiences(extracted.experience || []),
    education: reconstructEducation(extracted.education || []),
    languages: extracted.languages || [],
    extras: extracted.extras || [],
    projects: reconstructProjects(extracted.projects || []),
  };
}
