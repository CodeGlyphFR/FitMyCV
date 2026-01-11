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
 */
function extractJobOfferKeyInfo(jobOffer) {
  const content = jobOffer?.content || jobOffer;
  const skills = content.skills || {};
  const required = skills.required || [];
  const niceToHave = skills.nice_to_have || [];
  const softSkills = skills.soft_skills || [];
  const methodologies = skills.methodologies || [];

  return {
    title: content.title || 'Non specifie',
    requiredSkills: required.length > 0 ? required.join(', ') : 'Non specifie',
    niceToHaveSkills: niceToHave.length > 0 ? niceToHave.join(', ') : 'Non specifie',
    softSkills: softSkills.length > 0 ? softSkills.join(', ') : 'Non specifie',
    methodologies: methodologies.length > 0 ? methodologies.join(', ') : 'Non specifie',
  };
}

/**
 * Genere le Cache A : Job Offer pour system prompt
 * Utilise par: batch-experiences, batch-projects, batch-extras
 *
 * @param {Object} jobOffer - Offre d'emploi
 * @returns {string} - Prefixe cache pour system prompt
 */
export function generateCacheA(jobOffer) {
  const jobOfferContent = jobOffer?.content || jobOffer;
  const keyInfo = extractJobOfferKeyInfo(jobOffer);

  return `# OFFRE D'EMPLOI CIBLE

## Informations Cles (pour adaptation)

**Titre du poste:** ${keyInfo.title}

**Competences techniques REQUISES:** ${keyInfo.requiredSkills}

**Competences techniques APPRECIEES:** ${keyInfo.niceToHaveSkills}

**Soft skills demandes:** ${keyInfo.softSkills}

**Methodologies:** ${keyInfo.methodologies}

## Offre Complete (JSON)

\`\`\`json
${JSON.stringify(jobOfferContent, null, 2)}
\`\`\`

---

`;
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

  return `# OFFRE D'EMPLOI CIBLE

## Informations Cles (pour adaptation)

**Titre du poste:** ${keyInfo.title}

**Competences techniques REQUISES:** ${keyInfo.requiredSkills}

**Competences techniques APPRECIEES:** ${keyInfo.niceToHaveSkills}

**Soft skills demandes:** ${keyInfo.softSkills}

**Methodologies:** ${keyInfo.methodologies}

## Offre Complete (JSON)

\`\`\`json
${JSON.stringify(jobOfferContent, null, 2)}
\`\`\`

# EXPERIENCES ADAPTEES

\`\`\`json
${JSON.stringify(adaptedExperiences, null, 2)}
\`\`\`

# PROJETS ADAPTES

\`\`\`json
${JSON.stringify(adaptedProjects, null, 2)}
\`\`\`

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
