"use client";
/**
 * Hook de review pour la section Education
 *
 * Gère l'état et les actions de review pour :
 * - Les entrées d'éducation (degree, institution, etc.)
 */

import { useSectionReview } from "./useSectionReview";

/**
 * Hook pour la review de la section education
 *
 * @returns {Object} State et actions de review
 */
export function useEducationReview() {
  const review = useSectionReview({ section: "education" });

  // Helper pour trouver un changement par index d'éducation
  const findEducationChange = (eduIndex) => {
    return review.changes.find(
      (c) => c.eduIndex === eduIndex || c.itemIndex === eduIndex
    );
  };

  // Helper pour trouver un changement par field et index
  const findFieldChange = (field, eduIndex) => {
    return review.changes.find(
      (c) =>
        c.field === field &&
        (c.eduIndex === eduIndex || c.itemIndex === eduIndex)
    );
  };

  // Helper pour vérifier si une entrée d'éducation a des changements
  const hasEducationChange = (eduIndex) => {
    return review.changes.some(
      (c) =>
        c.eduIndex === eduIndex ||
        c.itemIndex === eduIndex ||
        c.path?.includes(`education[${eduIndex}]`)
    );
  };

  // Filtrer les changements par type
  const addedEducation = review.addedItems;
  const modifiedEducation = review.modifiedItems;
  const removedEducation = review.removedItems;

  // Accepter le changement d'une entrée d'éducation par son index
  const acceptEducation = async (eduIndex) => {
    const change = findEducationChange(eduIndex);
    if (change) {
      return review.accept(change.id);
    }
    return { success: false };
  };

  // Rejeter le changement d'une entrée d'éducation par son index
  const rejectEducation = async (eduIndex) => {
    const change = findEducationChange(eduIndex);
    if (change) {
      return review.reject(change.id);
    }
    return { success: false };
  };

  return {
    ...review,
    // Helpers spécifiques à education
    findEducationChange,
    findFieldChange,
    hasEducationChange,
    // Changements par type
    addedEducation,
    modifiedEducation,
    removedEducation,
    // Actions par index
    acceptEducation,
    rejectEducation,
  };
}

/**
 * Hook pour vérifier si une entrée d'éducation spécifique a des changements
 *
 * @param {string} educationIdentifier - Nom de l'institution ou degree
 * @returns {Object} { hasChanges, isAdded, isModified, isRemoved, change }
 */
export function useEducationHasChanges(educationIdentifier) {
  const { changes, isLatestVersion } = useEducationReview();

  if (!isLatestVersion || !educationIdentifier) {
    return {
      hasChanges: false,
      isAdded: false,
      isModified: false,
      isRemoved: false,
      change: null,
    };
  }

  const change = changes.find((c) => {
    // Matcher par itemName (nom de l'élément)
    if (c.itemName && educationIdentifier) {
      return c.itemName.toLowerCase() === educationIdentifier.toLowerCase();
    }
    return false;
  });

  const changeType = change?.changeType;

  return {
    hasChanges: !!change,
    isAdded: changeType === "added",
    isModified: changeType === "modified",
    isRemoved: changeType === "removed",
    change,
  };
}
