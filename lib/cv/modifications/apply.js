/**
 * Apply CV modifications from AI-generated diff
 *
 * Ce module centralise toutes les fonctions d'application de modifications :
 * - V1: applyModifications() - utilisé par generateCv.js
 * - V2: applyExperienceModificationsV2(), applyProjectModificationsV2() - utilisé par improveCvJob.js
 *
 * IMPORTANT: Toutes les fonctions appliquent les modifications sans muter l'original.
 */

import {
  deepClone,
  extractName,
  safeToLowerCase,
  sanitizeSkillName,
  isCurrentExperience,
  isPersonalProject
} from './utils.js';

// ============================================================================
// V1 API - Compatible avec generateCv.js
// ============================================================================

/**
 * Sanitize all skill names in a CV object
 * Applies sanitizeSkillName to hard_skills, tools, and methodologies
 * @param {Object} cv - CV object to sanitize (will be mutated)
 * @returns {Object} - The sanitized CV object
 */
export function sanitizeCvSkills(cv) {
  if (!cv || !cv.skills) return cv;

  // Sanitize hard_skills
  if (Array.isArray(cv.skills.hard_skills)) {
    cv.skills.hard_skills = cv.skills.hard_skills.map(skill => {
      if (typeof skill === 'string') {
        return { name: sanitizeSkillName(skill) };
      }
      return { ...skill, name: sanitizeSkillName(skill.name) };
    });
  }

  // Sanitize tools
  if (Array.isArray(cv.skills.tools)) {
    cv.skills.tools = cv.skills.tools.map(skill => {
      if (typeof skill === 'string') {
        return { name: sanitizeSkillName(skill) };
      }
      return { ...skill, name: sanitizeSkillName(skill.name) };
    });
  }

  // Sanitize methodologies
  if (Array.isArray(cv.skills.methodologies)) {
    cv.skills.methodologies = cv.skills.methodologies.map(m => {
      if (typeof m === 'string') {
        return sanitizeSkillName(m);
      }
      return m;
    });
  }

  return cv;
}

/**
 * Apply all modifications to a CV (V1 API)
 * @param {Object} sourceCv - Original CV JSON
 * @param {Object} aiResponse - AI response with modifications and reasoning
 * @returns {Object} - Modified CV
 */
export function applyModifications(sourceCv, aiResponse) {
  if (!aiResponse || !aiResponse.modifications) {
    return sourceCv;
  }

  const cv = deepClone(sourceCv);
  const mods = aiResponse.modifications;

  // Apply each section's modifications
  if (mods.header) applyHeaderMods(cv, mods.header);
  if (mods.summary) applySummaryMods(cv, mods.summary);
  if (mods.skills) applySkillsMods(cv, mods.skills);
  if (mods.experience) applyExperienceMods(cv, mods.experience, sourceCv);
  if (mods.education) applyEducationMods(cv, mods.education);
  if (mods.languages) applyLanguagesMods(cv, mods.languages);

  return cv;
}

/**
 * Apply header modifications
 */
function applyHeaderMods(cv, mods) {
  if (!cv.header) return;

  if (mods.current_title !== undefined && mods.current_title !== null) {
    cv.header.current_title = mods.current_title;
  }
}

/**
 * Apply summary modifications (description uniquement)
 */
function applySummaryMods(cv, mods) {
  if (!cv.summary) {
    cv.summary = {};
  }

  if (mods.description !== undefined && mods.description !== null) {
    cv.summary.description = mods.description;
  }
}

/**
 * Apply skills modifications
 */
function applySkillsMods(cv, mods) {
  if (!cv.skills) {
    cv.skills = {
      hard_skills: [],
      soft_skills: [],
      tools: [],
      methodologies: []
    };
  }

  if (mods.hard_skills) {
    cv.skills.hard_skills = applySkillArrayMods(cv.skills.hard_skills || [], mods.hard_skills);
  }

  if (mods.soft_skills) {
    cv.skills.soft_skills = applyArrayMods(cv.skills.soft_skills || [], mods.soft_skills);
  }

  if (mods.tools) {
    cv.skills.tools = applySkillArrayMods(cv.skills.tools || [], mods.tools);
  }

  if (mods.methodologies) {
    cv.skills.methodologies = applyArrayMods(cv.skills.methodologies || [], mods.methodologies)
      .map(m => sanitizeSkillName(m));
  }
}

/**
 * Apply experience modifications
 */
function applyExperienceMods(cv, mods, sourceCv) {
  if (!cv.experience || !Array.isArray(cv.experience)) return;

  // Apply individual updates FIRST (indexes refer to ORIGINAL positions)
  if (mods.updates && Array.isArray(mods.updates)) {
    for (const update of mods.updates) {
      const idx = update.index;
      if (idx >= 0 && idx < cv.experience.length && update.changes) {
        const exp = cv.experience[idx];
        const changes = update.changes;

        // Update description
        if (changes.description !== undefined && changes.description !== null) {
          exp.description = changes.description;
        }

        // Update responsibilities
        if (changes.responsibilities) {
          exp.responsibilities = applyArrayWithIndexMods(
            exp.responsibilities || [],
            changes.responsibilities
          );
        }

        // Update deliverables
        if (changes.deliverables) {
          exp.deliverables = applyArrayWithIndexMods(
            exp.deliverables || [],
            changes.deliverables
          );
        }

        // Update skills_used
        if (changes.skills_used) {
          exp.skills_used = applySimpleArrayMods(
            exp.skills_used || [],
            changes.skills_used
          );
        }
      }
    }
  }

  // Move experiences to projects section (indexes refer to ORIGINAL positions)
  if (mods.move_to_projects && Array.isArray(mods.move_to_projects)) {
    if (!cv.projects) {
      cv.projects = [];
    }

    const toMove = new Set(mods.move_to_projects);

    for (let idx = 0; idx < cv.experience.length; idx++) {
      if (toMove.has(idx)) {
        const exp = cv.experience[idx];

        // Convert experience to project format
        const isPersonal = !exp.company ||
          exp.company.toLowerCase().includes('projet') ||
          exp.company.toLowerCase().includes('personnel') ||
          exp.company.toLowerCase().includes('fondateur');

        const project = {
          name: isPersonal ? (exp.title || exp.company || 'Projet') : (exp.company || exp.title || 'Projet'),
          role: exp.title || '',
          start_date: exp.start_date || '',
          end_date: exp.end_date || '',
          summary: exp.description || (exp.responsibilities ? exp.responsibilities.join('. ') : ''),
          tech_stack: exp.skills_used || []
        };

        cv.projects.push(project);
      }
    }

    // Remove moved experiences from experience array
    cv.experience = cv.experience.filter((_, idx) => !toMove.has(idx));
  }

  // Remove experiences by index AFTER updates (indexes refer to ORIGINAL positions)
  // CRITICAL: NEVER remove current experiences (real jobs, not personal projects)
  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove);
    const originalExperiences = deepClone(sourceCv.experience || []);

    cv.experience = cv.experience.filter((exp, idx) => {
      if (!toRemove.has(idx)) return true;

      const originalExp = originalExperiences[idx];
      if (originalExp && isCurrentExperience(originalExp) && !isPersonalProject(originalExp)) {
        console.warn(`[applyModifications] BLOCKED: Attempted to remove current experience "${originalExp.title}" at "${originalExp.company}". Current experiences cannot be removed.`);
        return true;
      }

      return false;
    });
  }

  // Reorder experiences if specified (indexes refer to post-remove array)
  if (mods.reorder && Array.isArray(mods.reorder)) {
    const original = [...cv.experience];
    cv.experience = mods.reorder
      .filter(idx => idx >= 0 && idx < original.length)
      .map(idx => original[idx]);
  }

  // MINIMUM EXPERIENCES RULE: Ensure at least 2 professional experiences remain
  const MIN_EXPERIENCES = 2;
  if (cv.experience.length < MIN_EXPERIENCES && sourceCv && sourceCv.experience) {
    const originalExperiences = sourceCv.experience || [];

    const removedProfessionalExps = originalExperiences.filter((exp, idx) => {
      const stillExists = cv.experience.some(e =>
        e.title === exp.title && e.company === exp.company && e.start_date === exp.start_date
      );
      return !stillExists && !isPersonalProject(exp);
    });

    removedProfessionalExps.sort((a, b) => {
      const dateA = a.start_date || '';
      const dateB = b.start_date || '';
      return dateB.localeCompare(dateA);
    });

    const needed = MIN_EXPERIENCES - cv.experience.length;
    const toRestore = removedProfessionalExps.slice(0, needed);

    if (toRestore.length > 0) {
      console.warn(`[applyModifications] RESTORED ${toRestore.length} experience(s) to maintain minimum of ${MIN_EXPERIENCES}:`,
        toRestore.map(e => `"${e.title}" at "${e.company}"`).join(', ')
      );
      cv.experience.push(...toRestore);

      cv.experience.sort((a, b) => {
        const dateA = a.start_date || '';
        const dateB = b.start_date || '';
        return dateB.localeCompare(dateA);
      });
    }
  }
}

/**
 * Apply education modifications (reorder only)
 */
function applyEducationMods(cv, mods) {
  if (!cv.education || !Array.isArray(cv.education)) return;

  if (mods.reorder && Array.isArray(mods.reorder)) {
    const original = [...cv.education];
    cv.education = mods.reorder
      .filter(idx => idx >= 0 && idx < original.length)
      .map(idx => original[idx]);
  }
}

/**
 * Apply languages modifications (reorder by name)
 */
function applyLanguagesMods(cv, mods) {
  if (!cv.languages || !Array.isArray(cv.languages)) return;

  if (mods.reorder && Array.isArray(mods.reorder)) {
    const langMap = new Map(cv.languages.map(l => [safeToLowerCase(l.name), l]));
    const reordered = mods.reorder
      .map(name => langMap.get(safeToLowerCase(name)))
      .filter(Boolean);

    const reorderedNames = new Set(mods.reorder.map(n => safeToLowerCase(n)));
    const remaining = cv.languages.filter(l => !reorderedNames.has(safeToLowerCase(l.name)));

    cv.languages = [...reordered, ...remaining];
  }
}

/**
 * Apply modifications to a simple string array
 */
function applyArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  if (mods.replace && Array.isArray(mods.replace)) {
    return mods.replace.map(item => extractName(item) || item);
  }

  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(item => !toRemove.has(safeToLowerCase(item)));
  }

  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => safeToLowerCase(s)));
    const newItems = mods.add.filter(item => !existingLower.has(safeToLowerCase(item)));
    result.push(...newItems.map(item => extractName(item) || item));
  }

  if (mods.reorder && Array.isArray(mods.reorder)) {
    const itemMap = new Map(result.map(item => [safeToLowerCase(item), item]));
    const reordered = mods.reorder
      .map(name => itemMap.get(safeToLowerCase(name)))
      .filter(Boolean);

    const reorderedLower = new Set(mods.reorder.map(n => safeToLowerCase(n)));
    const remaining = result.filter(item => !reorderedLower.has(safeToLowerCase(item)));

    result = [...reordered, ...remaining];
  }

  return result;
}

/**
 * Apply modifications to a skill array (objects with name/proficiency)
 */
function applySkillArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  if (mods.replace && Array.isArray(mods.replace)) {
    return mods.replace.map(skill => {
      if (typeof skill === 'string') {
        return { name: sanitizeSkillName(skill) };
      }
      return {
        ...skill,
        name: sanitizeSkillName(skill.name)
      };
    });
  }

  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(skill => !toRemove.has(safeToLowerCase(skill.name)));
  }

  if (mods.update && Array.isArray(mods.update)) {
    for (const update of mods.update) {
      const updateName = safeToLowerCase(update.name);
      const skill = result.find(s => safeToLowerCase(s.name) === updateName);
      if (skill && update.proficiency) {
        skill.proficiency = update.proficiency;
      }
    }
  }

  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => safeToLowerCase(s.name)));
    const newSkills = mods.add
      .filter(skill => !existingLower.has(safeToLowerCase(skill.name)))
      .map(skill => ({
        ...skill,
        name: sanitizeSkillName(skill.name)
      }));
    result.push(...newSkills);
  }

  if (mods.reorder && Array.isArray(mods.reorder)) {
    const skillMap = new Map(result.map(s => [safeToLowerCase(s.name), s]));
    const reordered = mods.reorder
      .map(name => skillMap.get(safeToLowerCase(name)))
      .filter(Boolean);

    const reorderedLower = new Set(mods.reorder.map(n => safeToLowerCase(n)));
    const remaining = result.filter(s => !reorderedLower.has(safeToLowerCase(s.name)));

    result = [...reordered, ...remaining];
  }

  return result;
}

/**
 * Apply modifications with index-based updates
 */
function applyArrayWithIndexMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  if (mods.replace && Array.isArray(mods.replace)) {
    return mods.replace.map(item => extractName(item) || item);
  }

  if (mods.update && Array.isArray(mods.update)) {
    if (mods.update.length > 0 && typeof mods.update[0] === 'string') {
      return mods.update.map(item => extractName(item) || item);
    }
    for (const update of mods.update) {
      if (update.index >= 0 && update.index < result.length && update.value) {
        result[update.index] = update.value;
      }
    }
  }

  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(item => !toRemove.has(safeToLowerCase(item)));
  }

  if (mods.add && Array.isArray(mods.add)) {
    result.push(...mods.add.map(item => extractName(item) || item));
  }

  return result;
}

/**
 * Apply simple add/remove modifications
 */
function applySimpleArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(item => !toRemove.has(safeToLowerCase(item)));
  }

  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => safeToLowerCase(s)));
    const newItems = mods.add.filter(item => !existingLower.has(safeToLowerCase(item)));
    result.push(...newItems.map(item => extractName(item) || item));
  }

  return result;
}

// ============================================================================
// V2 API - Compatible avec improveCvJob.js (Pipeline V2)
// ============================================================================

/**
 * Applique un diff (add/remove/update) à un champ spécifique
 * @param {Object} item - L'élément (experience ou project)
 * @param {string} field - Le nom du champ (responsibilities, deliverables, skills_used, tech_stack)
 * @param {Object} diff - Objet {add: [], remove: [], update: []}
 */
export function applyFieldDiff(item, field, diff) {
  // S'assurer que le champ existe comme array
  if (!Array.isArray(item[field])) {
    item[field] = [];
  }

  // Appliquer les suppressions d'abord
  if (Array.isArray(diff.remove)) {
    for (const toRemove of diff.remove) {
      const idx = item[field].findIndex(v =>
        typeof v === 'string'
          ? v.toLowerCase() === toRemove.toLowerCase()
          : (v.name || v).toLowerCase() === toRemove.toLowerCase()
      );
      if (idx !== -1) {
        item[field].splice(idx, 1);
      }
    }
  }

  // Appliquer les mises à jour (par index)
  if (Array.isArray(diff.update)) {
    for (const upd of diff.update) {
      if (typeof upd.index === 'number' && upd.index >= 0 && upd.index < item[field].length) {
        item[field][upd.index] = upd.value;
      }
    }
  }

  // Appliquer les ajouts
  if (Array.isArray(diff.add)) {
    for (const toAdd of diff.add) {
      // Éviter les doublons
      const exists = item[field].some(v =>
        typeof v === 'string'
          ? v.toLowerCase() === toAdd.toLowerCase()
          : (v.name || v).toLowerCase() === toAdd.toLowerCase()
      );
      if (!exists) {
        item[field].push(toAdd);
      }
    }
  }
}

/**
 * Applique les modifications DIFF à une section du CV (experience ou projects)
 * @param {Array} originalSection - Section originale du CV
 * @param {Object} modifications - Objet {updates: [...]} avec les modifications DIFF
 * @returns {Array} - Section modifiée
 */
export function applyDiffModifications(originalSection, modifications) {
  if (!modifications?.updates || !Array.isArray(modifications.updates)) {
    return originalSection;
  }

  // Créer une copie profonde de la section originale
  const modifiedSection = deepClone(originalSection);

  for (const update of modifications.updates) {
    const { index, changes } = update;

    // Vérifier que l'index est valide
    if (index < 0 || index >= modifiedSection.length) {
      console.warn(`[applyDiffModifications] Index ${index} hors limites (0-${modifiedSection.length - 1})`);
      continue;
    }

    const item = modifiedSection[index];

    // Appliquer les changements pour chaque champ
    for (const [field, value] of Object.entries(changes)) {
      if (typeof value === 'string') {
        // Remplacement direct (title, description, role, summary, name)
        item[field] = value;
      } else if (typeof value === 'object' && value !== null) {
        // Format DIFF avec add/remove/update
        applyFieldDiff(item, field, value);
      }
    }
  }

  return modifiedSection;
}

/**
 * Applique les modifications DIFF au summary du CV
 * @param {Object} originalSummary - Summary original du CV
 * @param {Object} modifications - Objet avec les modifications DIFF pour le summary
 * @returns {Object} - Summary modifié
 */
export function applySummaryDiff(originalSummary, modifications) {
  if (!modifications) {
    return originalSummary;
  }

  // Créer une copie profonde du summary original
  const modifiedSummary = deepClone(originalSummary || {});

  // Appliquer le changement de description si présent
  if (modifications.description && typeof modifications.description === 'string') {
    modifiedSummary.description = modifications.description;
  }

  return modifiedSummary;
}

/**
 * Applique un diff (add/remove/reorder) à un array de strings
 * @param {Array} originalArray - Array original
 * @param {Object} diff - Objet {add: [], remove: [], reorder: []}
 * @returns {Array} - Array modifié
 */
export function applyArrayDiff(originalArray, diff) {
  let result = [...originalArray];

  // Si reorder est fourni, utiliser cet ordre comme base
  if (Array.isArray(diff.reorder) && diff.reorder.length > 0) {
    result = diff.reorder;
  } else {
    // Appliquer les suppressions d'abord
    if (Array.isArray(diff.remove)) {
      for (const toRemove of diff.remove) {
        const idx = result.findIndex(v =>
          v.toLowerCase() === toRemove.toLowerCase()
        );
        if (idx !== -1) {
          result.splice(idx, 1);
        }
      }
    }

    // Appliquer les ajouts
    if (Array.isArray(diff.add)) {
      for (const toAdd of diff.add) {
        // Éviter les doublons
        const exists = result.some(v =>
          v.toLowerCase() === toAdd.toLowerCase()
        );
        if (!exists) {
          result.push(toAdd);
        }
      }
    }
  }

  return result;
}

/**
 * Applique les modifications V2 à une expérience
 * @param {Object} experience - L'expérience originale
 * @param {Object} modifications - Les modifications à appliquer
 * @returns {Object} - L'expérience modifiée
 */
export function applyExperienceModificationsV2(experience, modifications) {
  const modified = deepClone(experience);

  if (modifications.description) {
    modified.description = modifications.description;
  }

  if (modifications.responsibilities) {
    applyFieldDiff(modified, 'responsibilities', modifications.responsibilities);
  }

  if (modifications.deliverables) {
    applyFieldDiff(modified, 'deliverables', modifications.deliverables);
  }

  if (modifications.skills_used) {
    applyFieldDiff(modified, 'skills_used', modifications.skills_used);
  }

  return modified;
}

/**
 * Applique les modifications V2 à un projet
 * @param {Object} project - Le projet original (ou null si création)
 * @param {Object} modifications - Les modifications à appliquer
 * @param {boolean} isNew - Si c'est un nouveau projet
 * @returns {Object} - Le projet modifié ou créé
 */
export function applyProjectModificationsV2(project, modifications, isNew) {
  if (isNew) {
    // Création d'un nouveau projet
    return {
      name: modifications.name || 'Nouveau projet',
      summary: modifications.summary || '',
      tech_stack: modifications.tech_stack || [],
      role: modifications.role || '',
      start_date: modifications.start_date || null,
      end_date: modifications.end_date || null,
      link: modifications.link || null,
    };
  }

  // Modification d'un projet existant
  const modified = deepClone(project);

  if (modifications.summary) {
    modified.summary = modifications.summary;
  }

  if (modifications.role) {
    modified.role = modifications.role;
  }

  if (modifications.tech_stack) {
    if (Array.isArray(modifications.tech_stack)) {
      modified.tech_stack = modifications.tech_stack;
    } else {
      applyFieldDiff(modified, 'tech_stack', modifications.tech_stack);
    }
  }

  return modified;
}
