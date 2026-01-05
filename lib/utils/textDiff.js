/**
 * Utilitaires pour le diff de texte au niveau des mots
 * Permet d'identifier précisément les portions de texte modifiées
 */

/**
 * Découpe un texte en tokens (mots + espaces/ponctuation)
 * Préserve les espaces et la ponctuation pour un rendu fidèle
 * @param {string} text - Texte à tokenizer
 * @returns {string[]} Array de tokens
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];

  // Split en gardant les séparateurs (espaces, ponctuation)
  // Regex: capture les mots et les non-mots séparément
  const tokens = text.match(/\S+|\s+/g) || [];
  return tokens;
}

/**
 * Calcule la plus longue sous-séquence commune (LCS)
 * Algorithme de base pour le diff
 * @param {string[]} a - Premier array de tokens
 * @param {string[]} b - Deuxième array de tokens
 * @returns {string[]} LCS
 */
function lcs(a, b) {
  const m = a.length;
  const n = b.length;

  // Table de programmation dynamique
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // Remplir la table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack pour récupérer la LCS
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Types de changement dans le diff
 */
export const DiffType = {
  UNCHANGED: 'unchanged',
  ADDED: 'added',
  REMOVED: 'removed',
};

/**
 * Calcule le diff entre deux textes au niveau des mots
 * @param {string} oldText - Texte original (before)
 * @param {string} newText - Nouveau texte (after)
 * @returns {Array<{type: string, value: string}>} Array de segments avec type
 */
export function computeTextDiff(oldText, newText) {
  // Cas limites
  if (!oldText && !newText) return [];
  if (!oldText) {
    return [{ type: DiffType.ADDED, value: newText }];
  }
  if (!newText) {
    return [{ type: DiffType.REMOVED, value: oldText }];
  }

  // Si textes identiques
  if (oldText === newText) {
    return [{ type: DiffType.UNCHANGED, value: newText }];
  }

  // Tokenizer
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  // Calculer la LCS
  const common = lcs(oldTokens, newTokens);

  // Construire le diff
  const result = [];
  let oldIdx = 0;
  let newIdx = 0;
  let commonIdx = 0;

  while (oldIdx < oldTokens.length || newIdx < newTokens.length) {
    // Tokens supprimés (dans old mais pas dans LCS)
    const removedTokens = [];
    while (oldIdx < oldTokens.length &&
           (commonIdx >= common.length || oldTokens[oldIdx] !== common[commonIdx])) {
      removedTokens.push(oldTokens[oldIdx]);
      oldIdx++;
    }
    if (removedTokens.length > 0) {
      result.push({ type: DiffType.REMOVED, value: removedTokens.join('') });
    }

    // Tokens ajoutés (dans new mais pas dans LCS)
    const addedTokens = [];
    while (newIdx < newTokens.length &&
           (commonIdx >= common.length || newTokens[newIdx] !== common[commonIdx])) {
      addedTokens.push(newTokens[newIdx]);
      newIdx++;
    }
    if (addedTokens.length > 0) {
      result.push({ type: DiffType.ADDED, value: addedTokens.join('') });
    }

    // Token commun
    if (commonIdx < common.length) {
      // Collecter les tokens communs consécutifs
      const unchangedTokens = [];
      while (commonIdx < common.length &&
             oldIdx < oldTokens.length &&
             newIdx < newTokens.length &&
             oldTokens[oldIdx] === common[commonIdx] &&
             newTokens[newIdx] === common[commonIdx]) {
        unchangedTokens.push(common[commonIdx]);
        oldIdx++;
        newIdx++;
        commonIdx++;
      }
      if (unchangedTokens.length > 0) {
        result.push({ type: DiffType.UNCHANGED, value: unchangedTokens.join('') });
      }
    }
  }

  // Fusionner les segments consécutifs du même type
  return mergeConsecutiveSegments(result);
}

/**
 * Fusionne les segments consécutifs du même type
 * @param {Array} segments - Array de segments
 * @returns {Array} Array fusionné
 */
function mergeConsecutiveSegments(segments) {
  if (segments.length === 0) return [];

  const merged = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    const current = segments[i];

    if (last.type === current.type) {
      last.value += current.value;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Vérifie si le diff contient des changements significatifs
 * @param {Array} diff - Résultat de computeTextDiff
 * @returns {boolean} true si des changements existent
 */
export function hasChanges(diff) {
  return diff.some(segment =>
    segment.type === DiffType.ADDED || segment.type === DiffType.REMOVED
  );
}

/**
 * Calcule des statistiques sur le diff
 * @param {Array} diff - Résultat de computeTextDiff
 * @returns {Object} { added, removed, unchanged }
 */
export function getDiffStats(diff) {
  return diff.reduce((stats, segment) => {
    const count = segment.value.trim().split(/\s+/).filter(Boolean).length;
    if (segment.type === DiffType.ADDED) stats.added += count;
    else if (segment.type === DiffType.REMOVED) stats.removed += count;
    else stats.unchanged += count;
    return stats;
  }, { added: 0, removed: 0, unchanged: 0 });
}
