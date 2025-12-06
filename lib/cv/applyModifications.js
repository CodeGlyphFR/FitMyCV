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
    const langMap = new Map(cv.languages.map(l => [l.name?.toLowerCase(), l]));
    const reordered = mods.reorder
      .map(name => langMap.get(name?.toLowerCase()))
      .filter(Boolean);

    // Add any languages that weren't in the reorder list
    const reorderedNames = new Set(mods.reorder.map(n => n?.toLowerCase()));
    const remaining = cv.languages.filter(l => !reorderedNames.has(l.name?.toLowerCase()));

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
    const toRemove = new Set(mods.remove.map(s => s?.toLowerCase()));
    result = result.filter(item => !toRemove.has(item?.toLowerCase()));
  }

  // Add items
  if (mods.add && Array.isArray(mods.add)) {
    // Only add items that don't already exist
    const existingLower = new Set(result.map(s => s?.toLowerCase()));
    const newItems = mods.add.filter(item => !existingLower.has(item?.toLowerCase()));
    result.push(...newItems);
  }

  // Reorder (full replacement if specified)
  if (mods.reorder && Array.isArray(mods.reorder)) {
    const itemMap = new Map(result.map(item => [item?.toLowerCase(), item]));
    const reordered = mods.reorder
      .map(name => itemMap.get(name?.toLowerCase()))
      .filter(Boolean);

    // Add any items that weren't in the reorder list
    const reorderedLower = new Set(mods.reorder.map(n => n?.toLowerCase()));
    const remaining = result.filter(item => !reorderedLower.has(item?.toLowerCase()));

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
    const toRemove = new Set(mods.remove.map(s => s?.toLowerCase()));
    result = result.filter(skill => !toRemove.has(skill.name?.toLowerCase()));
  }

  // Update proficiency
  if (mods.update && Array.isArray(mods.update)) {
    for (const update of mods.update) {
      const skill = result.find(s => s.name?.toLowerCase() === update.name?.toLowerCase());
      if (skill && update.proficiency) {
        skill.proficiency = update.proficiency;
      }
    }
  }

  // Add new skills
  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => s.name?.toLowerCase()));
    const newSkills = mods.add.filter(skill => !existingLower.has(skill.name?.toLowerCase()));
    result.push(...newSkills);
  }

  // Reorder by name
  if (mods.reorder && Array.isArray(mods.reorder)) {
    const skillMap = new Map(result.map(s => [s.name?.toLowerCase(), s]));
    const reordered = mods.reorder
      .map(name => skillMap.get(name?.toLowerCase()))
      .filter(Boolean);

    // Add any skills that weren't in the reorder list
    const reorderedLower = new Set(mods.reorder.map(n => n?.toLowerCase()));
    const remaining = result.filter(s => !reorderedLower.has(s.name?.toLowerCase()));

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
    const toRemove = new Set(mods.remove.map(s => s?.toLowerCase()));
    result = result.filter(item => !toRemove.has(item?.toLowerCase()));
  }

  // Add items
  if (mods.add && Array.isArray(mods.add)) {
    result.push(...mods.add);
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
    const toRemove = new Set(mods.remove.map(s => s?.toLowerCase()));
    result = result.filter(item => !toRemove.has(item?.toLowerCase()));
  }

  // Add items
  if (mods.add && Array.isArray(mods.add)) {
    const existingLower = new Set(result.map(s => s?.toLowerCase()));
    const newItems = mods.add.filter(item => !existingLower.has(item?.toLowerCase()));
    result.push(...newItems);
  }

  return result;
}
