/**
 * Préparation des items de skills pour le traitement IA parallélisé
 *
 * Ce module:
 * 1. Sépare les skills composés ("React/Vue" → "React", "Vue")
 * 2. Maintient un linkMap pour retrouver le parent original
 * 3. Prépare les items pour envoi à l'IA (format simplifié)
 */

/**
 * Expression régulière pour les séparateurs de skills composés
 * Supports: /, &, ,, +, "et", "and"
 */
const SEPARATORS = /[\/&,+]|\s+(?:et|and)\s+/gi;

/**
 * Exceptions: skills composés à ne PAS séparer
 * Ces skills doivent rester intacts malgré la présence de séparateurs
 */
const COMPOUND_EXCEPTIONS = new Set([
  'ci/cd',
  'ux/ui',
  'ui/ux',
  'r&d',
  'tcp/ip',
  'b2b',
  'b2c',
  'i/o',
  'os/2',
  'os/400',
  'node.js',
  'vue.js',
  'react.js',
  'next.js',
  'nuxt.js',
  'nest.js',
  'express.js',
  'c++',
  'c#',
  '.net',
  'asp.net',
  'vb.net',
  'f#',
  'q#',
  'j#',
]);

/**
 * Sépare les skills composés en skills individuels tout en maintenant
 * la traçabilité vers le skill parent original.
 *
 * @param {Array} categoryItems - Tableau de skills de la catégorie
 *   - Pour hard_skills/tools: [{name: string, proficiency: number}]
 *   - Pour soft_skills/methodologies: [string]
 * @param {string} category - Nom de la catégorie (hard_skills, soft_skills, tools, methodologies)
 * @returns {Object} { preparedItems, linkMap }
 *   - preparedItems: Tableau des skills préparés avec métadonnées internes
 *   - linkMap: Map<index, {parentIndex, parentName}> pour retrouver le parent
 */
export function separateCompoundSkills(categoryItems, category) {
  const preparedItems = [];
  const linkMap = new Map();

  if (!categoryItems || !Array.isArray(categoryItems)) {
    return { preparedItems, linkMap };
  }

  categoryItems.forEach((item, parentIndex) => {
    // Extraire le nom et proficiency selon le format
    const skillName = typeof item === 'string' ? item : item.name;
    const proficiency = typeof item === 'object' ? item.proficiency : null;

    if (!skillName) {
      console.warn(`[prepareSkillItems] Skill vide ignoré à l'index ${parentIndex} dans ${category}`);
      return;
    }

    // Vérifier si c'est une exception (ne pas séparer)
    const normalizedName = skillName.toLowerCase().trim();
    if (COMPOUND_EXCEPTIONS.has(normalizedName)) {
      preparedItems.push({
        name: skillName,
        proficiency,
        original_position: parentIndex,
        is_separated: false,
      });
      linkMap.set(preparedItems.length - 1, { parentIndex, parentName: skillName });
      return;
    }

    // Tenter la séparation
    const parts = skillName
      .split(SEPARATORS)
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      // Skill composé: créer un item pour chaque partie
      parts.forEach(part => {
        // Vérifier que la partie n'est pas vide ou trop courte
        if (part.length < 2) {
          console.warn(`[prepareSkillItems] Partie trop courte ignorée: "${part}" de "${skillName}"`);
          return;
        }

        preparedItems.push({
          name: part,
          proficiency,
          original_position: parentIndex,
          is_separated: true,
          separated_from: skillName,
        });
        linkMap.set(preparedItems.length - 1, { parentIndex, parentName: skillName });
      });
    } else {
      // Skill simple: garder tel quel
      preparedItems.push({
        name: skillName,
        proficiency,
        original_position: parentIndex,
        is_separated: false,
      });
      linkMap.set(preparedItems.length - 1, { parentIndex, parentName: skillName });
    }
  });

  return { preparedItems, linkMap };
}

/**
 * Prépare les items pour envoi à l'IA (filtre les champs internes)
 * L'IA ne reçoit que les informations nécessaires pour le matching.
 *
 * @param {Array} preparedItems - Tableau des items préparés par separateCompoundSkills
 * @param {boolean} hasProficiency - true si la catégorie a des proficiency (hard_skills, tools)
 * @returns {Array} Items formatés pour l'IA
 *   - Si hasProficiency: [{name: string, proficiency: number}]
 *   - Sinon: [string]
 */
export function prepareItemsForAI(preparedItems, hasProficiency) {
  return preparedItems.map(item => {
    if (hasProficiency) {
      return { name: item.name, proficiency: item.proficiency };
    }
    // soft_skills et methodologies: juste le string
    return item.name;
  });
}

/**
 * Construit une map nom → index pour lookup rapide lors du merge
 *
 * @param {Array} preparedItems - Tableau des items préparés
 * @returns {Map<string, number>} Map nom (lowercase) → index dans preparedItems
 */
export function buildNameToIndexMap(preparedItems) {
  const nameToIndex = new Map();
  preparedItems.forEach((item, idx) => {
    const key = item.name.toLowerCase().trim();
    // En cas de doublons, garder le premier
    if (!nameToIndex.has(key)) {
      nameToIndex.set(key, idx);
    }
  });
  return nameToIndex;
}

/**
 * Prépare toutes les catégories de skills pour le traitement parallélisé
 *
 * @param {Object} skills - Skills du CV source {hard_skills, soft_skills, tools, methodologies}
 * @returns {Object} Catégories préparées avec leurs items et linkMaps
 */
export function prepareAllCategories(skills) {
  return {
    hard_skills: separateCompoundSkills(skills.hard_skills || [], 'hard_skills'),
    soft_skills: separateCompoundSkills(skills.soft_skills || [], 'soft_skills'),
    tools: separateCompoundSkills(skills.tools || [], 'tools'),
    methodologies: separateCompoundSkills(skills.methodologies || [], 'methodologies'),
  };
}
