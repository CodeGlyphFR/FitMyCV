/**
 * Gestion du rollback partiel des modifications CV
 *
 * Ce module gère la restauration des valeurs précédentes
 * lorsqu'un utilisateur rejette une modification.
 */

import { getValueAtPath, setValueAtPath } from '../modifications/diff.js';

/**
 * Appliquer un rollback partiel pour une modification rejetée
 * Restaure la valeur du champ depuis la version précédente
 *
 * @param {Object} currentCv - Contenu CV actuel (sera cloné, pas muté)
 * @param {Object} change - Le changement à rejeter (doit contenir path et beforeValue)
 * @returns {Object} Nouveau contenu CV avec la valeur restaurée
 */
export function applyPartialRollback(currentCv, change) {
  if (!currentCv || !change || !change.path) {
    throw new Error('Invalid parameters for partial rollback');
  }

  // Clone profond du CV
  const updatedCv = JSON.parse(JSON.stringify(currentCv));

  // Cas spécial: projet ajouté (changeType: added, section: projects)
  // Quand rejeté, supprimer le projet du CV
  if (change.changeType === 'added' && change.section === 'projects') {
    if (change.afterValue && updatedCv.projects) {
      const projectToRemove = typeof change.afterValue === 'string'
        ? JSON.parse(change.afterValue)
        : change.afterValue;
      const projectName = (projectToRemove.name || '').toLowerCase();

      updatedCv.projects = updatedCv.projects.filter(proj => {
        const projName = (proj.name || '').toLowerCase();
        return projName !== projectName;
      });
      console.log(`[applyPartialRollback] Removed added project: "${projectToRemove.name}"`);
    }
    return updatedCv;
  }

  // Cas spécial: expérience supprimée (changeType: experience_removed)
  if (change.changeType === 'experience_removed') {
    if (change.beforeValue) {
      if (!updatedCv.experience) {
        updatedCv.experience = [];
      }
      updatedCv.experience.push(change.beforeValue);
      console.log(`[applyPartialRollback] Restored experience: "${change.beforeValue.title}"`);
    }
    return updatedCv;
  }

  // Cas spécial: expérience déplacée vers projets (changeType: move_to_projects)
  if (change.changeType === 'move_to_projects') {
    // 1. Restaurer l'expérience depuis beforeValue
    if (change.beforeValue) {
      if (!updatedCv.experience) {
        updatedCv.experience = [];
      }
      updatedCv.experience.push(change.beforeValue);
      console.log(`[applyPartialRollback] Restored experience from project: "${change.beforeValue.title}"`);
    }

    // 2. Supprimer le projet correspondant
    if (change.projectData && updatedCv.projects) {
      const projectToRemove = change.projectData;
      updatedCv.projects = updatedCv.projects.filter(proj => {
        const nameMatch = proj.name?.toLowerCase() === projectToRemove.name?.toLowerCase();
        const roleMatch = proj.role?.toLowerCase() === projectToRemove.role?.toLowerCase();
        const summaryMatch = proj.summary?.toLowerCase() === projectToRemove.summary?.toLowerCase();
        return !(nameMatch || (roleMatch && summaryMatch));
      });
      console.log(`[applyPartialRollback] Removed project: "${projectToRemove.name}"`);
    }
    return updatedCv;
  }

  // Cas spécial: projet supprimé (changeType: removed, section: projects)
  // Restaure le projet dans le tableau projects
  if (change.changeType === 'removed' && change.section === 'projects') {
    const projectToRestore = change.beforeValue || change.itemValue;
    if (projectToRestore) {
      if (!updatedCv.projects) {
        updatedCv.projects = [];
      }
      // Vérifier que le projet n'existe pas déjà
      const projectName = (projectToRestore.name || '').toLowerCase();
      const alreadyExists = updatedCv.projects.some(
        (p) => (p.name || '').toLowerCase() === projectName
      );
      if (!alreadyExists) {
        updatedCv.projects.push(projectToRestore);
        console.log(`[applyPartialRollback] Restored project: "${projectToRestore.name}"`);
      }
    }
    return updatedCv;
  }

  // Cas spécial: extra supprimé (changeType: removed, section: extras)
  // Restaure l'extra dans le tableau extras
  if (change.changeType === 'removed' && change.section === 'extras') {
    const extraToRestore = change.beforeValue || change.itemValue;
    if (extraToRestore) {
      if (!updatedCv.extras) {
        updatedCv.extras = [];
      }
      // Vérifier que l'extra n'existe pas déjà
      const extraName = (typeof extraToRestore === 'string'
        ? extraToRestore
        : extraToRestore.name || extraToRestore.title || ''
      ).toLowerCase();
      const alreadyExists = updatedCv.extras.some((e) => {
        const eName = (typeof e === 'string' ? e : e.name || e.title || '').toLowerCase();
        return eName === extraName;
      });
      if (!alreadyExists) {
        updatedCv.extras.push(extraToRestore);
        console.log(`[applyPartialRollback] Restored extra: "${extraName}"`);
      }
    }
    return updatedCv;
  }

  // Cas spécial: extra modifié (changeType: modified, section: extras)
  // Restaure l'extra à son état précédent (nom et/ou summary)
  if (change.changeType === 'modified' && change.section === 'extras') {
    if (change.beforeValue && change.afterValue) {
      if (!updatedCv.extras) {
        updatedCv.extras = [];
      }

      const afterName = (change.afterValue?.name || '').toLowerCase();
      const idx = updatedCv.extras.findIndex((e) => {
        const eName = (e.name || e.title || '').toLowerCase();
        return eName === afterName;
      });

      if (idx !== -1) {
        updatedCv.extras[idx] = change.beforeValue;
        console.log(`[applyPartialRollback] Restored modified extra: "${change.beforeValue?.name}"`);
      }
    }
    return updatedCv;
  }

  // Cas spécial: skill_used supprimé dans une expérience
  // Restaure le skill dans le tableau skills_used de l'expérience
  if (change.changeType === 'removed' && change.section === 'experience' && change.field === 'skills_used') {
    const skillToRestore = change.itemValue || change.beforeValue;
    console.log(`[applyPartialRollback] Restoring experience skill_used:`, {
      skillToRestore,
      path: change.path,
      expIndex: change.expIndex
    });

    if (skillToRestore && change.path) {
      // S'assurer que le tableau experience existe et que l'expérience cible existe
      if (!updatedCv.experience) {
        updatedCv.experience = [];
      }

      // Extraire l'index de l'expérience depuis le path (ex: experience[0].skills_used)
      const expIndexMatch = change.path.match(/experience\[(\d+)\]/);
      const expIndex = expIndexMatch ? parseInt(expIndexMatch[1], 10) : change.expIndex;

      if (expIndex !== undefined && updatedCv.experience[expIndex]) {
        // S'assurer que skills_used existe
        if (!updatedCv.experience[expIndex].skills_used) {
          updatedCv.experience[expIndex].skills_used = [];
        }

        const currentSkills = updatedCv.experience[expIndex].skills_used;
        const skillName = (typeof skillToRestore === 'string' ? skillToRestore : skillToRestore.name || '').toLowerCase();

        const alreadyExists = currentSkills.some((s) => {
          const sName = (typeof s === 'string' ? s : s.name || '').toLowerCase();
          return sName === skillName;
        });

        if (!alreadyExists) {
          currentSkills.push(skillToRestore);
          console.log(`[applyPartialRollback] Restored experience skill: "${skillName}" to experience[${expIndex}]`);
        } else {
          console.log(`[applyPartialRollback] Experience skill "${skillName}" already exists, skipping`);
        }
      } else {
        console.warn(`[applyPartialRollback] Cannot find experience at index ${expIndex}`);
      }
    }
    return updatedCv;
  }

  // Cas spécial: skill supprimé dans une section skills (hard_skills, tools, methodologies, soft_skills)
  // Restaure le skill avec son niveau (proficiency) dans le bon tableau
  // Utilise originalPosition si disponible pour restaurer à la position d'origine
  if (change.changeType === 'removed' && change.section === 'skills' &&
      ['hard_skills', 'tools', 'methodologies', 'soft_skills'].includes(change.field)) {
    // Priorité à itemValue car il contient toujours l'objet complet avec proficiency
    const skillToRestore = change.itemValue || change.beforeValue;
    console.log(`[applyPartialRollback] Restoring skills.${change.field} skill:`, {
      skillToRestore,
      itemValue: change.itemValue,
      beforeValue: change.beforeValue,
      path: change.path,
      originalPosition: change.originalPosition,
    });

    if (skillToRestore) {
      // S'assurer que la structure skills existe
      if (!updatedCv.skills) {
        updatedCv.skills = {};
      }
      if (!updatedCv.skills[change.field]) {
        updatedCv.skills[change.field] = [];
      }

      const currentSkills = updatedCv.skills[change.field];
      const skillName = (typeof skillToRestore === 'string' ? skillToRestore : skillToRestore.name || '').toLowerCase();

      const alreadyExists = currentSkills.some((s) => {
        const sName = (typeof s === 'string' ? s : s.name || '').toLowerCase();
        return sName === skillName;
      });

      if (!alreadyExists) {
        // Utiliser originalPosition pour insérer à la position d'origine si disponible
        if (change.originalPosition !== undefined && change.originalPosition >= 0) {
          const insertIndex = Math.min(change.originalPosition, currentSkills.length);
          currentSkills.splice(insertIndex, 0, skillToRestore);
          console.log(`[applyPartialRollback] Restored skill "${skillName}" to skills.${change.field} at position ${insertIndex} with proficiency:`,
            typeof skillToRestore === 'object' ? skillToRestore.proficiency : 'N/A');
        } else {
          // Fallback: ajouter à la fin si pas de position originale
          currentSkills.push(skillToRestore);
          console.log(`[applyPartialRollback] Restored skill "${skillName}" to skills.${change.field} (at end) with proficiency:`,
            typeof skillToRestore === 'object' ? skillToRestore.proficiency : 'N/A');
        }
      } else {
        console.log(`[applyPartialRollback] Skill "${skillName}" already exists in skills.${change.field}, skipping`);
      }
    }
    return updatedCv;
  }

  // Cas spécial: changement item-level (avec changeType added/removed/modified)
  const isArrayFieldChange = Array.isArray(change.beforeValue) || Array.isArray(change.afterValue);
  const simpleFieldPaths = ['.title', '.description', '.company', '.location', '.type', '.start_date', '.end_date', '.summary', '.role'];
  const isSimpleFieldPath = simpleFieldPaths.some(suffix => change.path?.endsWith(suffix));

  const isItemLevelChange = change.changeType &&
    ['added', 'removed', 'modified', 'level_adjusted'].includes(change.changeType) &&
    (change.itemName || change.afterValue || change.beforeValue || change.itemValue) &&
    !isArrayFieldChange &&
    !isSimpleFieldPath;

  console.log(`[applyPartialRollback] Processing change:`, {
    path: change.path,
    changeType: change.changeType,
    itemName: change.itemName,
    hasAfterValue: !!change.afterValue,
    hasBeforeValue: !!change.beforeValue,
    hasItemValue: !!change.itemValue,
    isArrayFieldChange,
    isSimpleFieldPath,
    isItemLevelChange
  });

  if (isItemLevelChange) {
    const valueAtPath = getValueAtPath(updatedCv, change.path);
    const currentArray = Array.isArray(valueAtPath) ? valueAtPath : [];
    console.log(`[applyPartialRollback] Current array at ${change.path}:`, currentArray.length, 'items (was array:', Array.isArray(valueAtPath), ')');

    const getName = (item) => {
      if (typeof item === 'string') return item.toLowerCase().trim();
      return (item?.name || item?.label || item?.title || item?.value || '').toLowerCase().trim();
    };

    const matchesBullet = (item, targetName) => {
      const itemText = typeof item === 'string' ? item : (item?.name || item?.value || '');
      const targetText = targetName || '';
      return itemText.toLowerCase().trim() === targetText.toLowerCase().trim() ||
             itemText.toLowerCase().trim().startsWith(targetText.toLowerCase().trim().substring(0, 50));
    };

    if (change.changeType === 'added') {
      const valueToRemove = change.afterValue || change.itemValue || change.itemName;
      console.log(`[applyPartialRollback] Removing added item:`, valueToRemove);

      if (!valueToRemove) {
        console.error(`[applyPartialRollback] Cannot remove: no afterValue, itemValue, or itemName`);
        return updatedCv;
      }

      const filtered = currentArray.filter((item) => {
        if (typeof item === 'string') {
          const shouldRemove = matchesBullet(item, valueToRemove);
          if (shouldRemove) {
            console.log(`[applyPartialRollback] Matched and removing:`, item);
          }
          return !shouldRemove;
        }
        const itemName = getName(item);
        const targetName = (typeof valueToRemove === 'string' ? valueToRemove : valueToRemove?.name || '').toLowerCase().trim();
        const shouldRemove = itemName === targetName;
        if (shouldRemove) {
          console.log(`[applyPartialRollback] Matched object and removing:`, item);
        }
        return !shouldRemove;
      });

      console.log(`[applyPartialRollback] Array after removal: ${currentArray.length} -> ${filtered.length} items`);
      setValueAtPath(updatedCv, change.path, filtered);
    } else if (change.changeType === 'removed') {
      // Priorité à itemValue (objet complet) sur beforeValue (peut être juste le nom)
      const itemToRestore = change.itemValue || change.beforeValue;
      if (itemToRestore) {
        // Vérifier que l'item n'est pas déjà dans le tableau (évite les doublons)
        const itemName = getName(itemToRestore);
        const alreadyExists = currentArray.some(item => getName(item) === itemName);

        if (!alreadyExists) {
          currentArray.push(itemToRestore);
          setValueAtPath(updatedCv, change.path, currentArray);
          console.log(`[applyPartialRollback] Restored removed item: "${itemName}"`);
        } else {
          console.warn(`[applyPartialRollback] Item "${itemName}" already exists, skipping duplicate restoration`);
        }
      }
    } else if (change.changeType === 'modified') {
      // Cas langues
      if (change.section === 'languages' && typeof change.beforeValue === 'object' && change.beforeValue !== null) {
        const languageName = change.itemName || change.beforeValue?.name || '';
        const idx = currentArray.findIndex(item => {
          const itemName = typeof item === 'string' ? item : (item?.name || '');
          return itemName.toLowerCase().trim() === languageName.toLowerCase().trim();
        });
        if (idx !== -1) {
          currentArray[idx] = { ...change.beforeValue };
          setValueAtPath(updatedCv, change.path, currentArray);
          console.log(`[applyPartialRollback] Restored language "${languageName}":`, change.afterValue, '→', change.beforeValue);
        }
      } else if (change.section === 'skills' || change.field === 'skills_used') {
        // Cas skills modifiés (traductions) : remplacer afterValue par beforeValue
        const afterName = (typeof change.afterValue === 'string' ? change.afterValue : change.afterValue?.name || '').toLowerCase().trim();
        const beforeName = typeof change.beforeValue === 'string' ? change.beforeValue : change.beforeValue?.name || change.beforeValue;

        console.log(`[applyPartialRollback] Restoring modified skill: "${afterName}" → "${beforeName}"`);

        const idx = currentArray.findIndex(item => {
          const itemName = (typeof item === 'string' ? item : item?.name || '').toLowerCase().trim();
          return itemName === afterName;
        });

        if (idx !== -1) {
          // Restaurer avec le nom original, en conservant le proficiency si c'est un objet
          if (typeof currentArray[idx] === 'object' && currentArray[idx] !== null) {
            currentArray[idx] = { ...currentArray[idx], name: beforeName };
          } else {
            currentArray[idx] = beforeName;
          }
          setValueAtPath(updatedCv, change.path, currentArray);
          console.log(`[applyPartialRollback] Restored skill at index ${idx}: "${afterName}" → "${beforeName}"`);
        } else {
          console.warn(`[applyPartialRollback] Could not find skill "${afterName}" to restore`);
        }
      } else {
        // Cas bullets
        const afterText = typeof change.afterValue === 'string' ? change.afterValue : '';
        const beforeText = typeof change.beforeValue === 'string' ? change.beforeValue : '';
        const idx = currentArray.findIndex(item => {
          const text = typeof item === 'string' ? item : (item?.value || '');
          return text.toLowerCase().trim() === afterText.toLowerCase().trim();
        });
        if (idx !== -1 && beforeText) {
          currentArray[idx] = beforeText;
          setValueAtPath(updatedCv, change.path, currentArray);
        }
      }
    } else if (change.changeType === 'level_adjusted') {
      const idx = currentArray.findIndex(item => {
        return getName(item) === change.itemName.toLowerCase().trim();
      });
      if (idx !== -1 && change.beforeValue) {
        if (typeof currentArray[idx] === 'object') {
          currentArray[idx] = {
            ...currentArray[idx],
            proficiency: change.beforeValue,
          };
        }
        setValueAtPath(updatedCv, change.path, currentArray);
        console.log(`[applyPartialRollback] Restored level for "${change.itemName}": ${change.afterValue} → ${change.beforeValue}`);
      }
    }

    return updatedCv;
  }

  // Cas standard: restaurer la valeur précédente (field-level change)
  console.log(`[applyPartialRollback] Standard field-level rollback for ${change.path}`);
  console.log(`[applyPartialRollback] Restoring beforeValue:`, Array.isArray(change.beforeValue)
    ? `Array with ${change.beforeValue.length} items`
    : typeof change.beforeValue);

  if (change.beforeValue === undefined || change.beforeValue === null) {
    console.warn(`[applyPartialRollback] Cannot restore ${change.path}: beforeValue is ${change.beforeValue}`);
    console.warn(`[applyPartialRollback] Change details:`, {
      changeType: change.changeType,
      itemName: change.itemName,
      hasBeforeDisplay: !!change.beforeDisplay
    });
    if (change.changeType === 'modified' && change.beforeDisplay) {
      const bullets = change.beforeDisplay
        .split('\n')
        .map(line => line.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
      if (bullets.length > 0) {
        console.log(`[applyPartialRollback] Reconstructed from beforeDisplay:`, bullets.length, 'items');
        setValueAtPath(updatedCv, change.path, bullets);
      }
    }
    return updatedCv;
  }

  const valueToRestore = Array.isArray(change.beforeValue)
    ? [...change.beforeValue]
    : change.beforeValue;
  setValueAtPath(updatedCv, change.path, valueToRestore);

  return updatedCv;
}
