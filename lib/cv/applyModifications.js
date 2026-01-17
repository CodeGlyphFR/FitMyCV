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
 * Check if an experience is the current/active job
 * Current experiences should NEVER be removed
 * @param {Object} experience - Experience object
 * @returns {boolean} - True if this is a current experience
 */
function isCurrentExperience(experience) {
  if (!experience) return false;

  // Check end_date is null or undefined
  if (experience.end_date === null || experience.end_date === undefined) {
    return true;
  }

  // Check if end_date contains "Présent", "Present", "Current", "Aujourd'hui", etc.
  if (typeof experience.end_date === 'string') {
    const currentIndicators = ['présent', 'present', 'current', 'aujourd', 'actuel', 'now', 'ongoing'];
    const lowerEndDate = experience.end_date.toLowerCase();
    if (currentIndicators.some(indicator => lowerEndDate.includes(indicator))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an experience is a personal project (not a real job)
 * @param {Object} experience - Experience object
 * @returns {boolean} - True if this is a personal project
 */
function isPersonalProject(experience) {
  if (!experience) return false;

  const personalIndicators = ['projet', 'personnel', 'fondateur', 'freelance perso', 'personal'];

  const title = (experience.title || '').toLowerCase();
  const company = (experience.company || '').toLowerCase();

  // Check if company contains personal project indicators
  if (personalIndicators.some(indicator => company.includes(indicator))) {
    return true;
  }

  // Check if title is "Fondateur" without established company
  if (title.includes('fondateur') && !company) {
    return true;
  }

  return false;
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
 * Sanitize a skill name to comply with naming constraints:
 * - Max 3 words
 * - No special characters: /, &, ()
 * - One concept only
 * @param {string} name - Original skill name
 * @returns {string} - Sanitized skill name
 */
function sanitizeSkillName(name) {
  if (!name || typeof name !== 'string') return name;

  let sanitized = name;

  // Remove content in parentheses (including the parentheses)
  sanitized = sanitized.replace(/\s*\([^)]*\)/g, '');

  // Replace / and & with nothing (keep first part only)
  // "Customer Success / Account Management" → "Customer Success"
  // "Diagnostic organisation & SI" → "Diagnostic organisation"
  if (sanitized.includes('/')) {
    sanitized = sanitized.split('/')[0];
  }
  if (sanitized.includes('&')) {
    sanitized = sanitized.split('&')[0];
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  // Limit to 3 words
  const words = sanitized.split(/\s+/);
  if (words.length > 3) {
    sanitized = words.slice(0, 3).join(' ');
  }

  // Final trim
  sanitized = sanitized.trim();

  // Capitalize first letter
  if (sanitized.length > 0) {
    sanitized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);
  }

  return sanitized || name; // Return original if sanitized is empty
}

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
  if (mods.experience) applyExperienceMods(cv, mods.experience, sourceCv);
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
    cv.skills.methodologies = applyArrayMods(cv.skills.methodologies || [], mods.methodologies)
      .map(m => sanitizeSkillName(m));
  }
}

/**
 * Apply experience modifications
 * @param {Object} cv - CV to modify
 * @param {Object} mods - Experience modifications
 * @param {Object} sourceCv - Original source CV (for checking current experience status)
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
    // Initialize projects array if needed
    if (!cv.projects) {
      cv.projects = [];
    }

    const toMove = new Set(mods.move_to_projects);

    for (let idx = 0; idx < cv.experience.length; idx++) {
      if (toMove.has(idx)) {
        const exp = cv.experience[idx];

        // Convert experience to project format
        // For personal projects, use title as name (not company which might be "Projets personnels")
        const isPersonalProject = !exp.company ||
          exp.company.toLowerCase().includes('projet') ||
          exp.company.toLowerCase().includes('personnel') ||
          exp.company.toLowerCase().includes('fondateur');

        const project = {
          name: isPersonalProject ? (exp.title || exp.company || 'Projet') : (exp.company || exp.title || 'Projet'),
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
  // Note: if move_to_projects was used, these indexes may be invalid - use with caution
  // CRITICAL: NEVER remove current experiences (real jobs, not personal projects)
  if (mods.remove && Array.isArray(mods.remove)) {
    const toRemove = new Set(mods.remove);

    // Get the original experiences before any filtering to check current status
    const originalExperiences = deepClone(sourceCv.experience || []);

    cv.experience = cv.experience.filter((exp, idx) => {
      // If not in remove list, keep it
      if (!toRemove.has(idx)) return true;

      // Check if this is a current experience (real job, not personal project)
      const originalExp = originalExperiences[idx];
      if (originalExp && isCurrentExperience(originalExp) && !isPersonalProject(originalExp)) {
        console.warn(`[applyModifications] ⚠️ BLOCKED: Attempted to remove current experience "${originalExp.title}" at "${originalExp.company}". Current experiences cannot be removed.`);
        return true; // Keep it - don't allow removal of current experience
      }

      // Otherwise, allow removal
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
  // If less than 2, restore removed experiences (most recent first)
  const MIN_EXPERIENCES = 2;
  if (cv.experience.length < MIN_EXPERIENCES && sourceCv && sourceCv.experience) {
    const originalExperiences = sourceCv.experience || [];

    // Find professional experiences that were removed (not personal projects)
    const removedProfessionalExps = originalExperiences.filter((exp, idx) => {
      const stillExists = cv.experience.some(e =>
        e.title === exp.title && e.company === exp.company && e.start_date === exp.start_date
      );
      return !stillExists && !isPersonalProject(exp);
    });

    // Sort by start_date descending (most recent first)
    removedProfessionalExps.sort((a, b) => {
      const dateA = a.start_date || '';
      const dateB = b.start_date || '';
      return dateB.localeCompare(dateA);
    });

    // Add back enough experiences to reach minimum
    const needed = MIN_EXPERIENCES - cv.experience.length;
    const toRestore = removedProfessionalExps.slice(0, needed);

    if (toRestore.length > 0) {
      console.warn(`[applyModifications] ⚠️ RESTORED ${toRestore.length} experience(s) to maintain minimum of ${MIN_EXPERIENCES}:`,
        toRestore.map(e => `"${e.title}" at "${e.company}"`).join(', ')
      );
      cv.experience.push(...toRestore);

      // Re-sort by start_date descending
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
 * @param {Object} mods - Modifications {replace, add, remove, reorder}
 * @returns {Array} - Modified array
 */
function applyArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Full replacement (takes precedence over other operations)
  if (mods.replace && Array.isArray(mods.replace)) {
    return mods.replace.map(item => extractName(item) || item);
  }

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
 * @param {Object} mods - Modifications {replace, add, remove, update, reorder}
 * @returns {Array} - Modified skill array
 */
function applySkillArrayMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Full replacement (takes precedence over other operations)
  if (mods.replace && Array.isArray(mods.replace)) {
    return mods.replace.map(skill => {
      // Normalize: ensure it's an object with name
      if (typeof skill === 'string') {
        return { name: sanitizeSkillName(skill) };
      }
      // Sanitize name if object
      return {
        ...skill,
        name: sanitizeSkillName(skill.name)
      };
    });
  }

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
    const newSkills = mods.add
      .filter(skill => !existingLower.has(safeToLowerCase(skill.name)))
      .map(skill => ({
        ...skill,
        name: sanitizeSkillName(skill.name)
      }));
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
 * @param {Object} mods - Modifications {add, remove, update, replace}
 * @returns {Array} - Modified array
 */
function applyArrayWithIndexMods(arr, mods) {
  if (!arr) arr = [];
  let result = [...arr];

  // Full replacement (takes precedence over other operations)
  if (mods.replace && Array.isArray(mods.replace)) {
    return mods.replace.map(item => extractName(item) || item);
  }

  // Update - supports two formats:
  // 1. Array of objects with {index, value} → update specific indices
  // 2. Array of strings → full replacement (like replace)
  if (mods.update && Array.isArray(mods.update)) {
    // Check if it's an array of strings (full replacement)
    if (mods.update.length > 0 && typeof mods.update[0] === 'string') {
      return mods.update.map(item => extractName(item) || item);
    }
    // Otherwise, update by index
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
