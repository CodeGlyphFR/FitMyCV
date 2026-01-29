/**
 * Construction du résultat final des skills
 *
 * Ce module:
 * 1. Détermine l'action (renamed/kept/deleted) selon les scores de correspondance
 * 2. Fusionne les skills séparés vers leur parent original
 * 3. Reconstruit le format final compatible avec batchSkillsSchema.json
 *
 * SÉPARATION DES RESPONSABILITÉS:
 * - L'IA calcule: score, reason, adapted_name (seulement pour skills score > 60%)
 * - Le CODE détermine: action (renamed/kept/deleted)
 *
 * LOGIQUE D'INVERSION (v2):
 * - L'IA ne retourne QUE les skills avec score > 60%
 * - Tout skill absent de la réponse IA est considéré comme "deleted"
 * - Le code initialise TOUS les skills comme "deleted" par défaut
 * - Puis met à jour avec les matches retournés par l'IA
 */

import { buildNameToIndexMap } from './prepareSkillItems.js';

/**
 * Dictionnaire des raisons de suppression par langue
 * Utilisé quand un skill n'est pas retourné par l'IA (score <= 60%)
 */
const NO_MATCH_REASONS = {
  fr: "Aucune correspondance avec l'offre",
  en: 'No match with the job offer',
  de: 'Keine Übereinstimmung mit dem Stellenangebot',
  es: 'Sin correspondencia con la oferta',
};

/**
 * Retourne la raison de suppression traduite
 * @param {string} lang - Code langue (fr, en, de, es)
 * @returns {string} Raison traduite
 */
function getNoMatchReason(lang) {
  return NO_MATCH_REASONS[lang] || NO_MATCH_REASONS.fr;
}

/**
 * Compare deux noms de skills (case-insensitive, trim)
 * @param {string} a - Premier nom
 * @param {string} b - Deuxième nom
 * @returns {boolean} true si identiques
 */
function isSameName(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

/**
 * Détermine l'action pour un skill selon son score de correspondance
 *
 * Logique:
 * - score < 60% ou offer_skill null → "deleted"
 * - score >= 80% → utilise le nom de l'offre
 *   - Si nom offre = nom CV → "kept"
 *   - Sinon → "renamed"
 * - score 60-79% → utilise le nom adapté (traduit si langues différentes)
 *   - Si nom adapté = nom CV → "kept"
 *   - Sinon → "renamed"
 *
 * @param {Object} match - Résultat de correspondance de l'IA
 * @param {string} match.cv_skill - Nom du skill dans le CV
 * @param {string|null} match.offer_skill - Nom du skill de l'offre qui matche
 * @param {number} match.score - Score de correspondance (0-100)
 * @param {string|null} match.reason - Raison de la correspondance
 * @param {string} match.adapted_name - Nom adapté/traduit
 * @returns {Object} Skill avec action déterminée
 */
export function determineAction(match) {
  const { cv_skill, offer_skill, score, reason, adapted_name } = match;

  let action;
  let skill_final;

  if (score < 60 || !offer_skill) {
    // Score < 60% ou pas de correspondance : supprimé
    action = 'deleted';
    skill_final = adapted_name; // Nom traduit si nécessaire
  } else if (score >= 70) {
    // Score >= 80% : on utilise le nom de l'offre
    skill_final = offer_skill;

    // Si le nom de l'offre est identique au CV → "kept", sinon → "renamed"
    action = isSameName(offer_skill, cv_skill) ? 'kept' : 'renamed';
  } else {
    // Score 60-79% : on utilise le nom adapté (traduit si langues différentes)
    skill_final = adapted_name;

    // Si le nom adapté est identique au CV → "kept", sinon → "renamed" (traduit)
    action = isSameName(adapted_name, cv_skill) ? 'kept' : 'renamed';
  }

  return {
    action,
    skill_final,
    probability: score,
    reason,
    original_value: cv_skill,
  };
}

/**
 * Construit le résultat final pour une catégorie
 *
 * LOGIQUE D'INVERSION:
 * 1. Initialise TOUS les preparedItems comme "deleted" par défaut
 * 2. Met à jour avec les matches retournés par l'IA (skills conservés)
 * 3. Fusionne les skills séparés vers leur parent
 *
 * @param {Array} matches - Résultats de correspondance de l'IA (seulement score > 60%)
 * @param {Array} preparedItems - Items préparés par prepareSkillItems
 * @param {Map} linkMap - Map index → {parentIndex, parentName}
 * @param {boolean} hasProficiency - true si la catégorie a des proficiency
 * @param {Array} sourceItems - Items originaux du CV source
 * @param {string} noMatchReason - Raison traduite pour les skills supprimés
 * @returns {Array} Skills avec action, format batchSkillsSchema.json
 */
export function buildCategoryResult(matches, preparedItems, linkMap, hasProficiency, sourceItems, noMatchReason) {
  // Si pas de preparedItems, rien à faire
  if (!preparedItems || preparedItems.length === 0) {
    return [];
  }

  // 1. Créer une map nom → index pour lookup rapide
  const nameToIndex = buildNameToIndexMap(preparedItems);

  // 2. Initialiser TOUS les items comme "deleted" par défaut
  const byParent = new Map();

  preparedItems.forEach((item, idx) => {
    const link = linkMap.get(idx);
    if (!link) return;

    if (!byParent.has(link.parentIndex)) {
      // Récupérer le proficiency depuis le sourceItem original
      const sourceItem = sourceItems[link.parentIndex];
      const proficiency = typeof sourceItem === 'object' ? sourceItem.proficiency : null;

      byParent.set(link.parentIndex, {
        parentName: link.parentName,
        items: [],
        proficiency,
        isSeparated: item.is_separated,
      });
    }

    // Ajouter comme "deleted" par défaut (sera mis à jour si retourné par l'IA)
    byParent.get(link.parentIndex).items.push({
      action: 'deleted',
      skill_final: item.name, // Nom original
      probability: 0,
      reason: noMatchReason,
      original_value: item.name,
      isSeparated: item.is_separated,
      separatedFrom: item.separated_from,
    });
  });

  // 3. Traiter les matches retournés par l'IA (skills à conserver)
  if (matches && matches.length > 0) {
    matches.forEach(match => {
      const idx = nameToIndex.get(match.cv_skill.toLowerCase().trim());
      if (idx === undefined) {
        console.warn(`[buildSkillsResult] Skill non trouvé: "${match.cv_skill}"`);
        return;
      }

      const link = linkMap.get(idx);
      if (!link) {
        console.warn(`[buildSkillsResult] Pas de link pour index ${idx}`);
        return;
      }

      const itemWithAction = determineAction(match);
      const preparedItem = preparedItems[idx];
      const parentData = byParent.get(link.parentIndex);

      // Trouver et remplacer l'item "deleted" par défaut
      const existingIdx = parentData.items.findIndex(
        i => i.original_value.toLowerCase().trim() === match.cv_skill.toLowerCase().trim()
      );

      if (existingIdx !== -1) {
        parentData.items[existingIdx] = {
          ...itemWithAction,
          isSeparated: preparedItem.is_separated,
          separatedFrom: preparedItem.separated_from,
        };
      } else {
        // Si pas trouvé (ne devrait pas arriver), ajouter quand même
        parentData.items.push({
          ...itemWithAction,
          isSeparated: preparedItem.is_separated,
          separatedFrom: preparedItem.separated_from,
        });
      }
    });
  }

  // 4. Pour chaque parent, fusionner et prendre la meilleure action
  const merged = [];

  byParent.forEach(({ parentName, items, proficiency, isSeparated }, parentIndex) => {
    if (items.length === 0) return;

    // Priorité pour déterminer le meilleur item:
    // 1. renamed (3) > kept (2) > deleted (1)
    // 2. À priorité égale, prendre le score le plus élevé
    const priorityMap = { renamed: 3, kept: 2, deleted: 1 };

    const bestItem = items.reduce((best, curr) => {
      const bestPriority = priorityMap[best.action] || 0;
      const currPriority = priorityMap[curr.action] || 0;

      // Comparer: priorité action * 1000 + score
      const bestScore = bestPriority * 1000 + (best.probability || 0);
      const currScore = currPriority * 1000 + (curr.probability || 0);

      return currScore > bestScore ? curr : best;
    });

    // Construire l'objet final
    const result = {
      action: bestItem.action,
      skill_final: bestItem.skill_final,
      probability: bestItem.probability,
      reason: bestItem.reason,
      original_value: parentName, // Nom du parent original (avant séparation)
      original_position: parentIndex,
    };

    // Ajouter proficiency si applicable
    if (hasProficiency && proficiency !== null && proficiency !== undefined) {
      result.proficiency = proficiency;
    }

    // Ajouter separated_from si le skill était séparé
    if (isSeparated && items.length > 1) {
      result.separated_from = parentName;
    }

    merged.push(result);
  });

  // 5. Trier par position originale
  return merged.sort((a, b) => a.original_position - b.original_position);
}

/**
 * Consolide les skills qui ont été renommés vers le même skill_final
 *
 * Quand plusieurs skills du CV (ex: "Claude Code", "OpenAI API") matchent le même
 * skill de l'offre (ex: "LLM") avec score >= 80%, ils sont regroupés en un seul
 * skill avec les informations de tous les originaux pour permettre un rollback complet.
 *
 * @param {Array} categoryResult - Résultat d'une catégorie après buildCategoryResult
 * @param {boolean} hasProficiency - true si la catégorie a des proficiency
 * @returns {Array} Skills consolidés
 */
function consolidateDuplicateSkillFinals(categoryResult, hasProficiency) {
  if (!categoryResult || categoryResult.length === 0) {
    return categoryResult;
  }

  // Regrouper les skills "renamed" par skill_final (case-insensitive)
  const bySkillFinal = new Map();

  categoryResult.forEach((skill, idx) => {
    // Seulement les skills "renamed" sont candidats à la consolidation
    if (skill.action === 'renamed' && skill.skill_final) {
      const key = skill.skill_final.toLowerCase().trim();
      if (!bySkillFinal.has(key)) {
        bySkillFinal.set(key, []);
      }
      bySkillFinal.get(key).push({ ...skill, _originalIdx: idx });
    }
  });

  // Identifier les skills à consolider (2+ skills vers le même skill_final)
  const toConsolidate = new Set();
  const consolidatedMap = new Map(); // skill_final key → consolidated skill

  bySkillFinal.forEach((skills, key) => {
    if (skills.length >= 2) {
      // Marquer tous ces skills pour consolidation
      skills.forEach(s => toConsolidate.add(s._originalIdx));

      // Calculer le proficiency moyen si applicable
      let avgProficiency = null;
      if (hasProficiency) {
        const proficiencies = skills
          .map(s => s.proficiency)
          .filter(p => p !== null && p !== undefined);
        if (proficiencies.length > 0) {
          avgProficiency = Math.round(
            proficiencies.reduce((sum, p) => sum + p, 0) / proficiencies.length
          );
        }
      }

      // Prendre le skill avec le score le plus élevé comme base
      const bestSkill = skills.reduce((best, curr) =>
        (curr.probability || 0) > (best.probability || 0) ? curr : best
      );

      // Créer le skill consolidé
      const consolidated = {
        action: 'renamed',
        skill_final: bestSkill.skill_final,
        probability: bestSkill.probability,
        reason: bestSkill.reason,
        // Utiliser le premier original_value comme référence principale
        original_value: skills[0].original_value,
        original_position: Math.min(...skills.map(s => s.original_position)),
        // Stocker les informations de tous les skills consolidés
        consolidated_from: skills.map(s => ({
          original_value: s.original_value,
          proficiency: s.proficiency,
          reason: s.reason,
          score: s.probability,
          original_position: s.original_position,
        })),
      };

      if (hasProficiency && avgProficiency !== null) {
        consolidated.proficiency = avgProficiency;
      }

      consolidatedMap.set(key, consolidated);
    }
  });

  // Si aucune consolidation nécessaire, retourner tel quel
  if (toConsolidate.size === 0) {
    return categoryResult;
  }

  // Reconstruire le tableau : garder les non-consolidés + ajouter les consolidés
  const result = [];
  const addedConsolidated = new Set();

  categoryResult.forEach((skill, idx) => {
    if (toConsolidate.has(idx)) {
      // Ce skill fait partie d'une consolidation
      const key = skill.skill_final.toLowerCase().trim();
      if (!addedConsolidated.has(key)) {
        // Ajouter le skill consolidé une seule fois
        result.push(consolidatedMap.get(key));
        addedConsolidated.add(key);
      }
      // Les autres occurrences sont ignorées (déjà consolidées)
    } else {
      // Skill normal, garder tel quel
      result.push(skill);
    }
  });

  // Trier par position originale
  return result.sort((a, b) => a.original_position - b.original_position);
}

/**
 * Construit le résultat final compatible avec batchSkillsSchema.json
 *
 * @param {Object} params
 * @param {Array} params.hardMatches - Matches pour hard_skills
 * @param {Array} params.softMatches - Matches pour soft_skills
 * @param {Array} params.toolsMatches - Matches pour tools
 * @param {Array} params.methodsMatches - Matches pour methodologies
 * @param {Object} params.preparedCategories - Catégories préparées par prepareAllCategories
 * @param {Object} params.sourceSkills - Skills originaux du CV source
 * @param {string} params.interfaceLanguage - Langue de l'interface (pour les raisons traduites)
 * @returns {Object} Résultat formaté {hard_skills, soft_skills, tools, methodologies}
 */
export function buildSkillsResult({
  hardMatches,
  softMatches,
  toolsMatches,
  methodsMatches,
  preparedCategories,
  sourceSkills,
  interfaceLanguage = 'fr',
}) {
  // Obtenir la raison traduite pour les skills supprimés
  const noMatchReason = getNoMatchReason(interfaceLanguage);

  // Construire les résultats par catégorie
  const hardResult = buildCategoryResult(
    hardMatches,
    preparedCategories.hard_skills.preparedItems,
    preparedCategories.hard_skills.linkMap,
    true, // hasProficiency
    sourceSkills.hard_skills || [],
    noMatchReason
  );

  const softResult = buildCategoryResult(
    softMatches,
    preparedCategories.soft_skills.preparedItems,
    preparedCategories.soft_skills.linkMap,
    false, // hasProficiency
    sourceSkills.soft_skills || [],
    noMatchReason
  );

  const toolsResult = buildCategoryResult(
    toolsMatches,
    preparedCategories.tools.preparedItems,
    preparedCategories.tools.linkMap,
    true, // hasProficiency
    sourceSkills.tools || [],
    noMatchReason
  );

  const methodsResult = buildCategoryResult(
    methodsMatches,
    preparedCategories.methodologies.preparedItems,
    preparedCategories.methodologies.linkMap,
    false, // hasProficiency
    sourceSkills.methodologies || [],
    noMatchReason
  );

  // Consolider les skills dupliqués (plusieurs CV skills → même offre skill)
  return {
    hard_skills: consolidateDuplicateSkillFinals(hardResult, true),
    soft_skills: consolidateDuplicateSkillFinals(softResult, false),
    tools: consolidateDuplicateSkillFinals(toolsResult, true),
    methodologies: consolidateDuplicateSkillFinals(methodsResult, false),
  };
}
