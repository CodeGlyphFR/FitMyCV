/**
 * Utility functions for CV diff calculations
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Générer un ID unique pour un changement
 * @returns {string} ID unique au format change_xxx
 */
export function generateChangeId() {
  return `change_${uuidv4().slice(0, 8)}`;
}

/**
 * Résoudre un chemin JSON vers sa valeur dans un objet
 * @param {Object} obj - L'objet à traverser
 * @param {string} path - Chemin JSON (ex: "summary.description", "skills.hard_skills[0].name")
 * @returns {*} La valeur au chemin spécifié, ou undefined si non trouvé
 */
export function getValueAtPath(obj, path) {
  if (!obj || !path) return undefined;

  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

/**
 * Définir une valeur à un chemin JSON dans un objet
 * @param {Object} obj - L'objet à modifier (sera muté)
 * @param {string} path - Chemin JSON
 * @param {*} value - Valeur à définir
 */
export function setValueAtPath(obj, path, value) {
  if (!obj || !path) return;

  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      // Créer un objet ou tableau intermédiaire
      current[part] = isNaN(Number(parts[i + 1])) ? {} : [];
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Comparer deux valeurs et retourner une représentation lisible
 * @param {*} before - Valeur avant
 * @param {*} after - Valeur après
 * @returns {Object} { beforeDisplay, afterDisplay }
 */
export function formatValueForDisplay(before, after) {
  const formatValue = (val) => {
    if (val === undefined || val === null) return '';
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) {
      // Pour les tableaux de skills, extraire les noms
      if (val.length > 0 && typeof val[0] === 'object' && val[0]?.name) {
        return val.map(s => s.name).join(', ');
      }
      return val.join(', ');
    }
    if (typeof val === 'object') {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  };

  return {
    beforeDisplay: formatValue(before),
    afterDisplay: formatValue(after),
  };
}

/**
 * Comparer deux valeurs de manière profonde
 * @param {*} a - Première valeur
 * @param {*} b - Deuxième valeur
 * @returns {boolean} true si les valeurs sont différentes
 */
export function valuesAreDifferent(a, b) {
  // Cas null/undefined
  if (a === null || a === undefined) {
    if (b === null || b === undefined) return false;
    if (typeof b === 'string') return b.trim() !== '';
    if (Array.isArray(b)) return b.length > 0;
    return true;
  }
  if (b === null || b === undefined) {
    if (typeof a === 'string') return a.trim() !== '';
    if (Array.isArray(a)) return a.length > 0;
    return true;
  }

  // Cas strings - normaliser les espaces pour éviter les faux positifs
  if (typeof a === 'string' && typeof b === 'string') {
    const normalizeStr = (s) => s.trim().replace(/\s+/g, ' ');
    return normalizeStr(a) !== normalizeStr(b);
  }

  // Cas arrays - comparaison plus robuste
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return true;

    try {
      const sortedA = JSON.stringify([...a].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
      const sortedB = JSON.stringify([...b].sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y))));
      return sortedA !== sortedB;
    } catch {
      return JSON.stringify(a) !== JSON.stringify(b);
    }
  }

  // Cas objects - comparer les clés significatives
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) !== JSON.stringify(b);
  }

  // Autres cas
  return a !== b;
}
