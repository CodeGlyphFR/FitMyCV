/**
 * Array comparison functions for CV diff calculations
 * Handles skills arrays, responsibilities, deliverables, etc.
 */

import { normalizeToNumber, getLevelKey } from '@/lib/constants/skillLevels';

/**
 * Calculer les différences item par item dans un tableau de skills
 * Détecte les ajouts, suppressions et changements de niveau
 */
export function computeArrayItemDiff(currentArr, previousArr, section, field, basePath) {
  const changes = [];

  const getName = (item) => {
    if (typeof item === 'string') return item.toLowerCase().trim();
    return (item?.name || item?.label || item?.title || item?.value || '').toLowerCase().trim();
  };

  const getDisplayName = (item) => {
    if (typeof item === 'string') return item;
    return item?.name || item?.label || item?.title || item?.value || '';
  };

  const getProficiency = (item) => {
    if (typeof item === 'string') return null;
    const raw = item?.proficiency ?? item?.level ?? null;
    return normalizeToNumber(raw);
  };

  const previousMap = new Map();
  previousArr.forEach(item => {
    const name = getName(item);
    if (name) previousMap.set(name, item);
  });

  const currentMap = new Map();
  currentArr.forEach(item => {
    const name = getName(item);
    if (name) currentMap.set(name, item);
  });

  // Items ajoutés
  currentArr.forEach((item) => {
    const name = getName(item);
    if (name && !previousMap.has(name)) {
      changes.push({
        section,
        field,
        path: basePath,
        itemName: getDisplayName(item),
        changeType: 'added',
        itemValue: item,
        afterValue: typeof item === 'string' ? item : getDisplayName(item),
        change: `${getDisplayName(item)} ajouté`,
        reason: 'Compétence pertinente pour le poste',
      });
    }
  });

  // Items supprimés
  previousArr.forEach((item) => {
    const name = getName(item);
    if (name && !currentMap.has(name)) {
      changes.push({
        section,
        field,
        path: basePath,
        itemName: getDisplayName(item),
        changeType: 'removed',
        itemValue: item,
        beforeValue: typeof item === 'string' ? item : getDisplayName(item),
        change: `« ${getDisplayName(item)} » supprimé`,
        reason: 'Non pertinent pour le poste ciblé',
      });
    }
  });

  // Items avec niveau modifié
  currentArr.forEach((currentItem) => {
    const name = getName(currentItem);
    if (name && previousMap.has(name)) {
      const previousItem = previousMap.get(name);
      const currentProficiency = getProficiency(currentItem);
      const previousProficiency = getProficiency(previousItem);

      if (currentProficiency !== null && previousProficiency !== null && currentProficiency !== previousProficiency) {
        const beforeKey = getLevelKey(previousProficiency) || String(previousProficiency);
        const afterKey = getLevelKey(currentProficiency) || String(currentProficiency);
        changes.push({
          section,
          field,
          path: basePath,
          itemName: getDisplayName(currentItem),
          changeType: 'level_adjusted',
          beforeValue: previousProficiency,
          afterValue: currentProficiency,
          itemValue: currentItem,
          change: `${getDisplayName(currentItem)}: ${beforeKey} → ${afterKey}`,
          reason: 'Niveau ajusté selon l\'expérience',
        });
      }
    }
  });

  return changes;
}

/**
 * Calculer les différences bullet par bullet dans un tableau de strings
 * Utilisé pour responsibilities et deliverables des expériences
 */
export function computeBulletDiff(currentArr, previousArr, section, field, basePath, expIndex, expTitle) {
  const changes = [];

  const normalizeBullet = (bullet) => {
    if (!bullet || typeof bullet !== 'string') return '';
    return bullet.toLowerCase().trim().replace(/[.,:;!?]+$/, '').trim();
  };

  const getSignificantStart = (bullet) => {
    if (!bullet || typeof bullet !== 'string') return '';
    const words = bullet.toLowerCase().trim().split(/\s+/).slice(0, 5);
    return words.join(' ');
  };

  const currentNormalized = currentArr.map(normalizeBullet);
  const previousNormalized = previousArr.map(normalizeBullet);
  const previousStarts = previousArr.map(getSignificantStart);
  const currentStarts = currentArr.map(getSignificantStart);

  const matchedPrevious = new Set();
  const matchedCurrent = new Set();

  // Correspondances exactes
  currentArr.forEach((bullet, idx) => {
    const normalized = currentNormalized[idx];
    const prevIdx = previousNormalized.findIndex((p, i) => p === normalized && !matchedPrevious.has(i));
    if (prevIdx !== -1) {
      matchedPrevious.add(prevIdx);
      matchedCurrent.add(idx);
    }
  });

  // Correspondances partielles
  currentArr.forEach((bullet, idx) => {
    if (matchedCurrent.has(idx)) return;
    const start = currentStarts[idx];
    if (!start) return;

    const prevIdx = previousStarts.findIndex((p, i) => p === start && !matchedPrevious.has(i));
    if (prevIdx !== -1) {
      changes.push({
        section,
        field,
        path: basePath,
        expIndex,
        bulletIndex: idx,
        itemName: bullet.substring(0, 50) + (bullet.length > 50 ? '...' : ''),
        changeType: 'modified',
        beforeValue: previousArr[prevIdx],
        afterValue: bullet,
        change: `Responsabilité modifiée dans "${expTitle}"`,
        reason: 'Reformulation pour le poste ciblé',
      });
      matchedPrevious.add(prevIdx);
      matchedCurrent.add(idx);
    }
  });

  // Bullets ajoutés
  currentArr.forEach((bullet, idx) => {
    if (matchedCurrent.has(idx)) return;
    changes.push({
      section,
      field,
      path: basePath,
      expIndex,
      bulletIndex: idx,
      itemName: bullet.substring(0, 50) + (bullet.length > 50 ? '...' : ''),
      changeType: 'added',
      itemValue: bullet,
      afterValue: bullet,
      change: `Nouvelle responsabilité dans "${expTitle}"`,
      reason: 'Ajout pertinent pour le poste ciblé',
    });
  });

  // Bullets supprimés
  previousArr.forEach((bullet, idx) => {
    if (matchedPrevious.has(idx)) return;
    changes.push({
      section,
      field,
      path: basePath,
      expIndex,
      bulletIndex: idx,
      itemName: bullet.substring(0, 50) + (bullet.length > 50 ? '...' : ''),
      changeType: 'removed',
      itemValue: bullet,
      beforeValue: bullet,
      change: `Responsabilité retirée de "${expTitle}"`,
      reason: 'Non pertinente pour le poste ciblé',
    });
  });

  return changes;
}
