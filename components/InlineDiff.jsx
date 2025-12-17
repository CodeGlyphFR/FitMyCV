"use client";
import React, { useMemo } from "react";
import { DiffType } from "@/lib/utils/textDiff";

/**
 * Calcule un diff simple basé sur préfixe/suffixe communs
 * Plus intuitif que LCS pour l'affichage des modifications de texte
 *
 * Exemple:
 * - Old: "Ingénieur mécanique avec plus de 6 ans"
 * - New: "Plus de 6 ans"
 * Résultat: REMOVED "Ingénieur mécanique avec plus" | ADDED "Plus" | UNCHANGED " de 6 ans"
 */
function computeSimpleDiff(oldText, newText) {
  if (!oldText && !newText) return [];
  if (!oldText) return [{ type: DiffType.ADDED, value: newText }];
  if (!newText) return [{ type: DiffType.REMOVED, value: oldText }];
  if (oldText === newText) return [{ type: DiffType.UNCHANGED, value: newText }];

  // Trouver le plus long suffixe commun (fin identique)
  let suffixLen = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (
    suffixLen < minLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  // Ajuster au début d'un mot (ne pas couper au milieu d'un mot)
  while (
    suffixLen > 0 &&
    suffixLen < oldText.length &&
    suffixLen < newText.length &&
    oldText[oldText.length - suffixLen] !== " " &&
    oldText[oldText.length - suffixLen - 1] !== " "
  ) {
    suffixLen--;
  }

  const result = [];

  // Partie modifiée (début)
  const oldChanged = oldText.substring(0, oldText.length - suffixLen);
  const newChanged = newText.substring(0, newText.length - suffixLen);

  if (oldChanged) {
    result.push({ type: DiffType.REMOVED, value: oldChanged });
  }
  if (newChanged) {
    result.push({ type: DiffType.ADDED, value: newChanged });
  }

  // Suffixe commun (fin inchangée)
  if (suffixLen > 0) {
    result.push({
      type: DiffType.UNCHANGED,
      value: oldText.substring(oldText.length - suffixLen),
    });
  }

  return result;
}

/**
 * Vérifie si le diff contient des changements
 */
function hasChanges(diff) {
  return diff.some(
    (segment) => segment.type === DiffType.ADDED || segment.type === DiffType.REMOVED
  );
}

/**
 * Composant pour afficher un diff de texte inline
 * Utilise un algorithme simple basé sur suffixe commun
 * Affiche: supprimé (rouge barré) puis ajouté (vert) puis inchangé
 *
 * @param {string} beforeText - Texte original
 * @param {string} afterText - Nouveau texte
 * @param {boolean} showRemoved - Afficher le texte supprimé (défaut: true)
 * @param {function} onClick - Callback au clic sur le diff
 */
export default function InlineDiff({
  beforeText,
  afterText,
  showRemoved = true,
  onClick,
  className = "",
}) {
  // Calculer le diff simple
  const diff = useMemo(
    () => computeSimpleDiff(beforeText || "", afterText || ""),
    [beforeText, afterText]
  );

  // Si les textes sont identiques ou pas de changements, afficher tel quel
  if (!hasChanges(diff)) {
    return <span className={className}>{afterText}</span>;
  }

  return (
    <span
      onClick={onClick}
      className={`${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {diff.map((segment, index) => {
        if (segment.type === DiffType.UNCHANGED) {
          // Partie inchangée - affichage normal
          return <span key={index}>{segment.value}</span>;
        }

        if (segment.type === DiffType.REMOVED && showRemoved) {
          // Partie supprimée - rouge barré
          return (
            <span
              key={index}
              className="line-through text-red-400/70 bg-red-500/10 px-0.5 rounded"
              title="Supprimé"
            >
              {segment.value}
            </span>
          );
        }

        if (segment.type === DiffType.ADDED) {
          // Partie ajoutée - vert surligné
          return (
            <span
              key={index}
              className="text-emerald-300 bg-emerald-500/20 px-0.5 rounded border-b border-emerald-400/50"
              title="Ajouté"
            >
              {segment.value}
            </span>
          );
        }

        return null;
      })}
    </span>
  );
}

/**
 * Composant pour afficher un diff compact (résumé)
 * Utile pour les aperçus ou les listes
 */
export function CompactDiff({ beforeText, afterText, maxLength = 50 }) {
  const diff = useMemo(
    () => computeSimpleDiff(beforeText || "", afterText || ""),
    [beforeText, afterText]
  );

  if (!hasChanges(diff)) {
    const truncated = (afterText || "").slice(0, maxLength);
    return (
      <span className="text-white/60">
        {truncated}
        {(afterText || "").length > maxLength ? "..." : ""}
      </span>
    );
  }

  // Trouver le premier changement significatif
  const firstChange = diff.find(
    (s) => s.type === DiffType.ADDED || s.type === DiffType.REMOVED
  );

  if (!firstChange) {
    return <span className="text-white/60">{afterText?.slice(0, maxLength)}</span>;
  }

  const truncatedValue = firstChange.value.slice(0, maxLength);

  return (
    <span className="text-xs">
      {firstChange.type === DiffType.REMOVED ? (
        <span className="line-through text-red-400/70">
          {truncatedValue}
          {firstChange.value.length > maxLength ? "..." : ""}
        </span>
      ) : (
        <span className="text-emerald-400">
          {truncatedValue}
          {firstChange.value.length > maxLength ? "..." : ""}
        </span>
      )}
    </span>
  );
}

/**
 * Composant pour afficher un diff side-by-side
 * Avant à gauche (rouge), Après à droite (vert)
 */
export function SideBySideDiff({ beforeText, afterText }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Avant */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-red-400 uppercase tracking-wider">
          Avant
        </div>
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-white/80 whitespace-pre-wrap">
          {beforeText || <span className="text-white/30 italic">(vide)</span>}
        </div>
      </div>

      {/* Après */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
          Après
        </div>
        <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-sm text-white/80 whitespace-pre-wrap">
          {afterText || <span className="text-white/30 italic">(vide)</span>}
        </div>
      </div>
    </div>
  );
}
