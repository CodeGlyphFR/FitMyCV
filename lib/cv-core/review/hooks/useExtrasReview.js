"use client";
/**
 * Hook de review pour la section Extras
 *
 * Gère l'état et les actions de review pour :
 * - Les extras (certifications, awards, publications, etc.)
 */

import { useSectionReview } from "./useSectionReview";

/**
 * Hook pour la review de la section extras
 *
 * @returns {Object} State et actions de review
 */
export function useExtrasReview() {
  const review = useSectionReview({ section: "extras" });

  // Helper pour trouver un changement par nom d'extra
  const findExtraChange = (extraName) => {
    if (!extraName) return null;
    return review.changes.find(
      (c) => c.itemName?.toLowerCase() === extraName.toLowerCase()
    );
  };

  // Helper pour vérifier si un extra a des changements
  const hasExtraChange = (extraName) => {
    const change = findExtraChange(extraName);
    return change?.status === "pending";
  };

  // Helper pour obtenir le type de changement d'un extra
  const getExtraChangeType = (extraName) => {
    const change = findExtraChange(extraName);
    return change?.changeType || null;
  };

  // Accepter le changement d'un extra par son nom
  const acceptExtra = async (extraName) => {
    const change = findExtraChange(extraName);
    if (change) {
      return review.accept(change.id);
    }
    return { success: false };
  };

  // Rejeter le changement d'un extra par son nom
  const rejectExtra = async (extraName) => {
    const change = findExtraChange(extraName);
    if (change) {
      return review.reject(change.id);
    }
    return { success: false };
  };

  return {
    ...review,
    // Helpers spécifiques aux extras
    findExtraChange,
    hasExtraChange,
    getExtraChangeType,
    acceptExtra,
    rejectExtra,
  };
}

/**
 * Hook pour vérifier si un extra spécifique a des changements
 *
 * @param {string} extraName - Nom de l'extra
 * @returns {Object} { hasChanges, isAdded, isModified, isRemoved, change }
 */
export function useExtraHasChanges(extraName) {
  const { changes } = useExtrasReview();

  if (!extraName) {
    return {
      hasChanges: false,
      isAdded: false,
      isModified: false,
      isRemoved: false,
      change: null,
    };
  }

  const change = changes.find(
    (c) =>
      c.itemName?.toLowerCase() === extraName.toLowerCase() &&
      c.status === "pending"
  );

  const changeType = change?.changeType;

  return {
    hasChanges: !!change,
    isAdded: changeType === "added",
    isModified: changeType === "modified",
    isRemoved: changeType === "removed",
    change,
  };
}
