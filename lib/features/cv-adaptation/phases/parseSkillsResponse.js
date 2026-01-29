/**
 * Post-traitement de la réponse IA pour les skills
 *
 * Ce module gère:
 * 1. Validation que les original_value correspondent aux skills du CV source
 * 2. Construction des objets review pour l'UI
 * 3. Transformation vers le format attendu par recompose.js
 */

/**
 * Collecte tous les noms de skills du CV source par catégorie
 * @param {Object} skills - Skills du CV source
 * @returns {Object} Map des skills source par catégorie (Set normalisés)
 */
function collectSourceSkillNames(skills) {
  const normalize = (name) => name?.toLowerCase().trim() || '';

  return {
    hard_skills: new Set((skills.hard_skills || []).map(s => normalize(s.name || s))),
    soft_skills: new Set((skills.soft_skills || []).map(s => normalize(s.name || s))),
    tools: new Set((skills.tools || []).map(s => normalize(s.name || s))),
    methodologies: new Set((skills.methodologies || []).map(s => normalize(s.name || s))),
  };
}

/**
 * Valide que les skills retournés par l'IA correspondent aux skills source
 * Supprime les skills inventés (qui n'existent pas dans le CV source)
 * @param {Object} aiResult - Résultat de l'IA avec les 4 catégories de skills
 * @param {Object} sourceSkillNames - Map des skills source (Set par catégorie)
 * @returns {Object} Résultat filtré sans les skills inventés
 */
function validateSkillsAgainstSource(aiResult, sourceSkillNames) {
  const normalize = (name) => name?.toLowerCase().trim() || '';

  const validateCategory = (items, sourceSet, category) => {
    if (!items || !Array.isArray(items)) return [];

    return items.filter(item => {
      const originalValue = normalize(item.original_value);
      const isFromSource = sourceSet.has(originalValue);

      if (!isFromSource) {
        console.warn(
          `[parseSkillsResponse] Skill inventé supprimé: "${item.original_value}" ` +
          `(skill_final: "${item.skill_final}") dans ${category} - ` +
          `n'existe pas dans le CV source`
        );
      }

      return isFromSource;
    });
  };

  return {
    hard_skills: validateCategory(aiResult.hard_skills, sourceSkillNames.hard_skills, 'hard_skills'),
    soft_skills: validateCategory(aiResult.soft_skills, sourceSkillNames.soft_skills, 'soft_skills'),
    tools: validateCategory(aiResult.tools, sourceSkillNames.tools, 'tools'),
    methodologies: validateCategory(aiResult.methodologies, sourceSkillNames.methodologies, 'methodologies'),
  };
}

/**
 * Log un warning si l'IA n'a pas retourné tous les skills source
 * @param {Object} aiResult - Résultat de l'IA
 * @param {Object} sourceSkills - Skills du CV source
 */
function logCompletenessWarning(aiResult, sourceSkills) {
  const categories = ['hard_skills', 'soft_skills', 'tools', 'methodologies'];
  for (const cat of categories) {
    const sourceItems = sourceSkills[cat] || [];
    const sourceCount = Array.isArray(sourceItems) ? sourceItems.length : 0;
    const returnedCount = (aiResult[cat] || []).length;
    if (returnedCount < sourceCount) {
      console.warn(
        `[parseSkillsResponse] Complétude: ${cat} - ${returnedCount}/${sourceCount} skills retournés`
      );
    }
  }
}

/**
 * Reconstruit l'objet review pour chaque skill
 * L'IA génère un format minimal (sans review), cette fonction reconstitue
 * les données review nécessaires pour le système de review UI
 *
 * @param {Object} result - Résultat validé de l'IA (sans review)
 * @param {boolean} languagesDifferent - true si CV et offre ont des langues différentes
 * @returns {Object} Résultat enrichi avec review pour chaque skill
 */
function reconstructReviewData(result, languagesDifferent) {
  const processCategory = (items) => {
    if (!items || !Array.isArray(items)) return [];

    return items.map(item => {
      // Déterminer si review requis et quelle couleur
      let reviewRequired = false;
      let reviewColor = null;

      if (item.action === 'deleted') {
        // Skill supprimé → review rouge obligatoire
        reviewRequired = true;
        reviewColor = 'red';
      } else if (item.action === 'renamed') {
        // Skill renommé → review ambre obligatoire
        reviewRequired = true;
        reviewColor = 'amber';
      } else if (item.action === 'kept') {
        // Skill conservé → review si traduit (langues différentes)
        if (languagesDifferent) {
          reviewRequired = true;
          reviewColor = 'amber';
        }
      }

      // Reconstruire popover_content si review requis
      const popoverContent = reviewRequired ? {
        reason: item.reason,
        original_value: item.original_value,
      } : null;

      return {
        ...item,
        review: {
          required: reviewRequired,
          color: reviewColor,
          popover_content: popoverContent,
        },
      };
    });
  };

  return {
    hard_skills: processCategory(result.hard_skills),
    soft_skills: processCategory(result.soft_skills),
    tools: processCategory(result.tools),
    methodologies: processCategory(result.methodologies),
  };
}

/**
 * Transforme les skills pour le format attendu par recompose.js
 * Filtre les skills deleted et construit le format CV final
 *
 * @param {Array} skillItems - Tableau de skills avec action
 * @param {string} category - Nom de la catégorie (hard_skills, soft_skills, tools, methodologies)
 * @returns {Array} Skills transformés (sans les deleted)
 */
function transformCategoryForCv(skillItems, category) {
  // Ne garder que les skills non-deleted pour le CV final
  const keptSkills = (skillItems || [])
    .filter(item => item.action !== 'deleted')
    .map(item => {
      // Pour hard_skills et tools: retourner objet avec name et proficiency
      if (category === 'hard_skills' || category === 'tools') {
        return {
          name: item.skill_final,
          proficiency: item.proficiency,
        };
      }
      // Pour soft_skills et methodologies: retourner juste le string
      return item.skill_final;
    });
  return keptSkills;
}

/**
 * Parse et enrichit la réponse de l'IA pour les skills
 *
 * @param {Object} aiResult - Réponse brute de l'IA
 * @param {Object} sourceSkills - Skills du CV source
 * @param {boolean} languagesDifferent - true si CV et offre ont des langues différentes
 * @returns {Object} Skills enrichis avec review data
 */
export function parseSkillsResponse(aiResult, sourceSkills, languagesDifferent = false) {
  // 1. Collecter les noms source (pour validation)
  const sourceSkillNames = collectSourceSkillNames(sourceSkills);

  // 2. Log warning si skills manquants (avant validation pour détecter les omissions IA)
  logCompletenessWarning(aiResult, sourceSkills);

  // 3. Valider chaque skill contre source
  const validatedResult = validateSkillsAgainstSource(aiResult, sourceSkillNames);

  // 4. Construire review data
  const enrichedResult = reconstructReviewData(validatedResult, languagesDifferent);

  return enrichedResult;
}

/**
 * Transforme les skills pour le CV final (sans les deleted)
 * @param {Object} parsedSkills - Skills parsés avec review data
 * @returns {Object} Skills format CV (sans deleted, format name/proficiency ou string)
 */
export function transformSkillsForCv(parsedSkills) {
  return {
    hard_skills: transformCategoryForCv(parsedSkills.hard_skills, 'hard_skills'),
    soft_skills: transformCategoryForCv(parsedSkills.soft_skills, 'soft_skills'),
    tools: transformCategoryForCv(parsedSkills.tools, 'tools'),
    methodologies: transformCategoryForCv(parsedSkills.methodologies, 'methodologies'),
  };
}

/**
 * Fonction combinée pour usage simplifié dans offerProcessor
 * Parse, valide et transforme la réponse IA en un seul appel
 *
 * @param {Object} aiResult - Réponse brute de l'IA
 * @param {Object} sourceSkills - Skills du CV source
 * @param {boolean} languagesDifferent - true si CV et offre ont des langues différentes
 * @returns {Object} { adaptedSkills, modifications }
 */
export function processSkillsResponse(aiResult, sourceSkills, languagesDifferent = false) {
  // Parse et enrichit avec review data
  const parsedSkills = parseSkillsResponse(aiResult, sourceSkills, languagesDifferent);

  // Transforme pour le CV final
  const adaptedSkills = transformSkillsForCv(parsedSkills);

  return {
    // Skills transformés pour le CV final (sans les deleted)
    ...adaptedSkills,
    // Données brutes enrichies pour le système de review (inclut deleted)
    _raw: parsedSkills,
  };
}
