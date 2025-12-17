/**
 * Apply CV modifications from AI-generated diff
 *
 * Applies structured modifications to a source CV without mutating original.
 */

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Extract string name from either a string or an object with name property
 * Handles cases where AI returns either "skill" or {name: "skill"}
 * @param {string|Object} item - String or object with name property
 * @returns {string|null} - Extracted string name or null if invalid
 */
function extractName(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item.name && typeof item.name === 'string') {
    return item.name;
  }
  return null;
}

/**
 * Safe lowercase conversion - handles both strings and objects
 * @param {string|Object} item - String or object with name property
 * @returns {string|null} - Lowercase string or null
 */
function safeToLowerCase(item) {
  const name = extractName(item);
  return name ? name.toLowerCase() : null;
}

/**
 * Apply all modifications to a CV
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
  if (mods.experience) applyExperienceMods(cv, mods.experience);
  if (mods.education) applyEducationMods(cv, mods.education);
  if (mods.languages) applyLanguagesMods(cv, mods.languages);

  return cv;
}

/**
 * Apply header modifications
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Header modifications
 */
function applyHeaderMods(cv, mods) {
  if (!cv.header) return;

  if (mods.current_title !== undefined && mods.current_title !== null) {
    cv.header.current_title = mods.current_title;
  }
}

/**
 * Apply summary modifications
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Summary modifications
 */
function applySummaryMods(cv, mods) {
  if (!cv.summary) {
    cv.summary = {};
  }

  if (mods.headline !== undefined && mods.headline !== null) {
    cv.summary.headline = mods.headline;
  }

  if (mods.description !== undefined && mods.description !== null) {
    cv.summary.description = mods.description;
  }

  if (mods.domains) {
    cv.summary.domains = applyArrayMods(cv.summary.domains || [], mods.domains);
  }

  if (mods.key_strengths) {
    cv.summary.key_strengths = applyArrayMods(cv.summary.key_strengths || [], mods.key_strengths);
  }
}

/**
 * Apply skills modifications
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Skills modifications
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
    cv.skills.methodologies = applyArrayMods(cv.skills.methodologies || [], mods.methodologies);
  }
}

/**
 * Apply experience modifications
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Experience modifications
 */
function applyExperienceMods(cv, mods) {
  if (!cv.experience || !Array.isArray(cv.experience)) return;

  // Reorder experiences if specified
  if (mods.reorder && Array.isArray(mods.reorder)) {
    const original = [...cv.experience];
    cv.experience = mods.reorder
      .filter(idx => idx >= 0 && idx < original.length)
      .map(idx => original[idx]);
  }

  // Apply individual updates
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
}

/**
 * Apply education modifications (reorder only)
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Education modifications
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
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Languages modifications
 */
function applyLanguagesMods(cv, mods) {
  if (!cv.languages || !Array.isArray(cv.languages)) return;

  if (mods.reorder && Array.isArray(mods.reorder)) {
    const langMap = new Map(cv.languages.map(l => [safeToLowerCase(l.name), l]));
    const reordered = mods.reorder
      .map(name => langMap.get(safeToLowerCase(name)))
      .filter(Boolean);

    // Add any languages that weren't in the reorder list
    const reorderedNames = new Set(mods.reorder.map(n => safeToLowerCase(n)));
    const remaining = cv.languages.filter(l => !reorderedNames.has(safeToLowerCase(l.name)));

    cv.languages = [...reordered, ...remaining];
  }
}

/**
 * Apply modifications to a simple string array
 * @param {Array} arr - Original array
 * @param {Object} mods - Modifications {add, remove, reorder}
 * @returns {Array} - Modified array
 */
function applyArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Remove items
  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(item => !toRemove.has(safeToLowerCase(item)));
  }

  // Add items
  if (mods.add && Array.isArray(mods.add)) {
    // Only add items that don't already exist
    const existingLower = new Set(result.map(s => safeToLowerCase(s)));
    const newItems = mods.add.filter(item => !existingLower.has(safeToLowerCase(item)));
    // Extract string value if object was passed
    result.push(...newItems.map(item => extractName(item) || item));
  }

  // Reorder (full replacement if specified)
  if (mods.reorder && Array.isArray(mods.reorder)) {
    const itemMap = new Map(result.map(item => [safeToLowerCase(item), item]));
    const reordered = mods.reorder
      .map(name => itemMap.get(safeToLowerCase(name)))
      .filter(Boolean);

    // Add any items that weren't in the reorder list
    const reorderedLower = new Set(mods.reorder.map(n => safeToLowerCase(n)));
    const remaining = result.filter(item => !reorderedLower.has(safeToLowerCase(item)));

    result = [...reordered, ...remaining];
  }

  return result;
}

/**
 * Apply modifications to a skill array (objects with name/proficiency)
 * @param {Array} arr - Original skill array
 * @param {Object} mods - Modifications {add, remove, update, reorder}
 * @returns {Array} - Modified skill array
 */
function applySkillArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Remove by name
  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(skill => !toRemove.has(safeToLowerCase(skill.name)));
  }

  // Update proficiency
  if (mods.update && Array.isArray(mods.update)) {
    for (const update of mods.update) {
      const updateName = safeToLowerCase(update.name);
      const skill = result.find(s => safeToLowerCase(s.name) === updateName);
      if (skill && update.proficiency) {
        skill.proficiency = update.proficiency;
      }
    }
  }

  // Add new skills
  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => safeToLowerCase(s.name)));
    const newSkills = mods.add.filter(skill => !existingLower.has(safeToLowerCase(skill.name)));
    result.push(...newSkills);
  }

  // Reorder by name
  if (mods.reorder && Array.isArray(mods.reorder)) {
    const skillMap = new Map(result.map(s => [safeToLowerCase(s.name), s]));
    const reordered = mods.reorder
      .map(name => skillMap.get(safeToLowerCase(name)))
      .filter(Boolean);

    // Add any skills that weren't in the reorder list
    const reorderedLower = new Set(mods.reorder.map(n => safeToLowerCase(n)));
    const remaining = result.filter(s => !reorderedLower.has(safeToLowerCase(s.name)));

    result = [...reordered, ...remaining];
  }

  return result;
}

/**
 * Apply modifications with index-based updates
 * @param {Array} arr - Original array
 * @param {Object} mods - Modifications {add, remove, update}
 * @returns {Array} - Modified array
 */
function applyArrayWithIndexMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Update by index
  if (mods.update && Array.isArray(mods.update)) {
    for (const update of mods.update) {
      if (update.index >= 0 && update.index < result.length && update.value) {
        result[update.index] = update.value;
      }
    }
  }

  // Remove items
  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(item => !toRemove.has(safeToLowerCase(item)));
  }

  // Add items
  if (mods.add && Array.isArray(mods.add)) {
    result.push(...mods.add.map(item => extractName(item) || item));
  }

  return result;
}

/**
 * Apply simple add/remove modifications
 * @param {Array} arr - Original array
 * @param {Object} mods - Modifications {add, remove}
 * @returns {Array} - Modified array
 */
function applySimpleArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Remove items
  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove.map(s => safeToLowerCase(s)));
    result = result.filter(item => !toRemove.has(safeToLowerCase(item)));
  }

  // Add items
  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => safeToLowerCase(s)));
    const newItems = mods.add.filter(item => !existingLower.has(safeToLowerCase(item)));
    result.push(...newItems.map(item => extractName(item) || item));
  }

  return result;
}
