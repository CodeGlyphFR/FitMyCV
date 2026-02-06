/**
 * Cache Context Utility - Pipeline CV v2
 *
 * Optimise le cache OpenAI en structurant les prompts pour que les prefixes
 * identiques soient caches.
 *
 * Architecture des caches:
 * - Cache A: Job Offer uniquement (pour experiences, projects, extras)
 * - Cache B: Job Offer + Sections adaptees (pour skills, summary)
 */

/**
 * Extrait les infos cles d'un job offer pour le contexte
 *
 * Format skills v2 (4 catégories):
 * - hard_skills: { required: [], nice_to_have: [] }
 * - tools: { required: [], nice_to_have: [] }
 * - methodologies: { required: [], nice_to_have: [] }
 * - soft_skills: []
 */
function extractJobOfferKeyInfo(jobOffer) {
  const content = jobOffer?.content || jobOffer;
  const skills = content.skills || {};

  // Combiner toutes les compétences requises des 3 catégories
  const allRequired = [
    ...(skills.hard_skills?.required || []),
    ...(skills.tools?.required || []),
    ...(skills.methodologies?.required || [])
  ];

  const allNiceToHave = [
    ...(skills.hard_skills?.nice_to_have || []),
    ...(skills.tools?.nice_to_have || []),
    ...(skills.methodologies?.nice_to_have || [])
  ];

  const softSkills = skills.soft_skills || [];

  // Méthodologies séparées pour contexte spécifique
  const methodologies = [
    ...(skills.methodologies?.required || []),
    ...(skills.methodologies?.nice_to_have || [])
  ];

  return {
    title: content.title || 'Non specifie',
    requiredSkills: allRequired.length > 0 ? allRequired.join(', ') : 'Non specifie',
    niceToHaveSkills: allNiceToHave.length > 0 ? allNiceToHave.join(', ') : 'Non specifie',
    softSkills: softSkills.length > 0 ? softSkills.join(', ') : 'Non specifie',
    methodologies: methodologies.length > 0 ? methodologies.join(', ') : 'Non specifie',
  };
}

/**
 * Genere le Cache A : Job Offer pour system prompt (version simplifiee)
 * Utilise par: batch-experiences, batch-projects, batch-extras
 *
 * @param {Object} jobOffer - Offre d'emploi
 * @returns {string} - Prefixe cache pour system prompt
 */
export function generateCacheA(jobOffer) {
  const jobOfferContent = jobOffer?.content || jobOffer;

  // Extraire uniquement les responsabilites de l'offre (max 5)
  const responsibilities = jobOfferContent.responsibilities || [];
  const responsibilitiesText = responsibilities.length > 0
    ? responsibilities.slice(0, 5).map(r => `- ${r}`).join('\n')
    : '(non specifie)';

  return `# OFFRE D'EMPLOI - Responsabilites cibles

${responsibilitiesText}

---

`;
}

/**
 * Extrait les responsabilites formatees de l'offre pour le user prompt
 * @param {Object} jobOffer - Offre d'emploi
 * @returns {string} - Responsabilites formatees en bullets
 */
export function extractJobResponsibilities(jobOffer) {
  const jobOfferContent = jobOffer?.content || jobOffer;
  const responsibilities = jobOfferContent.responsibilities || [];

  if (responsibilities.length === 0) {
    return '(non specifie)';
  }

  return responsibilities.slice(0, 5).map(r => `- ${r}`).join('\n');
}

/**
 * Genere le Cache B : Job Offer + Sections adaptees pour system prompt
 * Utilise par: batch-skills, batch-summary
 *
 * @param {Object} jobOffer - Offre d'emploi
 * @param {Array} adaptedExperiences - Experiences deja adaptees
 * @param {Array} adaptedProjects - Projets deja adaptes
 * @returns {string} - Prefixe cache pour system prompt
 */
export function generateCacheB(jobOffer, adaptedExperiences, adaptedProjects) {
  const jobOfferContent = jobOffer?.content || jobOffer;
  const keyInfo = extractJobOfferKeyInfo(jobOffer);

  // Extraire les responsabilites de l'offre
  const responsibilities = jobOfferContent.responsibilities || [];
  const responsibilitiesText = responsibilities.length > 0
    ? responsibilities.slice(0, 5).join('\n- ')
    : 'Non specifie';

  // Resume compact des experiences (titre + company + skills)
  const experiencesSummary = (adaptedExperiences || []).map(exp =>
    `- ${exp.title} @ ${exp.company} | Skills: ${(exp.skills_used || []).slice(0, 5).join(', ')}`
  ).join('\n');

  // Resume compact des projets (nom + tech)
  const projectsSummary = (adaptedProjects || []).map(proj =>
    `- ${proj.name} | Tech: ${(proj.tech_stack || []).slice(0, 5).join(', ')}`
  ).join('\n');

  return `# OFFRE D'EMPLOI CIBLE (pour reference uniquement)

⚠️ NE PAS ajouter de mots-cles de cette offre si l'experience ne les contient pas.

**Titre du poste vise:** ${keyInfo.title}

**Competences demandees:**
${keyInfo.requiredSkills}

**Competences appreciees:**
${keyInfo.niceToHaveSkills}

**Soft skills:**
${keyInfo.softSkills}

**Methodologies:**
${keyInfo.methodologies}

**Missions du poste:**
- ${responsibilitiesText}

# EXPERIENCES ADAPTEES
${experiencesSummary || 'Aucune'}

# PROJETS ADAPTES
${projectsSummary || 'Aucun'}

---

`;
}

/**
 * Construit le system prompt avec cache prefix
 *
 * @param {string} cachePrefix - Prefixe genere par generateCacheA ou generateCacheB
 * @param {string} phaseInstructions - Instructions specifiques a la phase
 * @returns {string} - System prompt complet
 */
export function buildCachedSystemPrompt(cachePrefix, phaseInstructions) {
  return cachePrefix + phaseInstructions;
}
