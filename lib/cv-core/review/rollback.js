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
      if (change.itemValue || change.beforeValue) {
        currentArray.push(change.beforeValue || change.itemValue);
        setValueAtPath(updatedCv, change.path, currentArray);
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
