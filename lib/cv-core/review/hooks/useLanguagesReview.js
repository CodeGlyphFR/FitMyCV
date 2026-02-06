"use client";
/**
 * Hook de review pour la section Languages
 *
 * Gère l'état et les actions de review pour :
 * - Les langues (name, level)
 */

import { useSectionReview } from "./useSectionReview";

/**
 * Hook pour la review de la section languages
 *
 * @returns {Object} State et actions de review
 */
export function useLanguagesReview() {
  const review = useSectionReview({ section: "languages" });

  // Helper pour trouver un changement par nom de langue
  const findLanguageChange = (languageName) => {
    if (!languageName) return null;
    return review.changes.find(
      (c) => c.itemName?.toLowerCase() === languageName.toLowerCase()
    );
  };

  // Helper pour vérifier si une langue a des changements
  const hasLanguageChange = (languageName) => {
    const change = findLanguageChange(languageName);
    return change?.status === "pending";
  };

  // Helper pour obtenir le type de changement d'une langue
  const getLanguageChangeType = (languageName) => {
    const change = findLanguageChange(languageName);
    return change?.changeType || null;
  };

  // Accepter le changement d'une langue par son nom
  const acceptLanguage = async (languageName) => {
    const change = findLanguageChange(languageName);
    if (change) {
      return review.accept(change.id);
    }
    return { success: false };
  };

  // Rejeter le changement d'une langue par son nom
  const rejectLanguage = async (languageName) => {
    const change = findLanguageChange(languageName);
    if (change) {
      return review.reject(change.id);
    }
    return { success: false };
  };

  return {
    ...review,
    // Helpers spécifiques aux languages
    findLanguageChange,
    hasLanguageChange,
    getLanguageChangeType,
    acceptLanguage,
    rejectLanguage,
  };
}

/**
 * Hook pour vérifier si une langue spécifique a des changements
 * (Équivalent de useLanguageHasChanges dans LanguageReviewActions.jsx)
 *
 * @param {string} languageName - Nom de la langue
 * @returns {Object} { hasChanges, change }
 */
export function useLanguageHasChanges(languageName) {
  const { changes } = useLanguagesReview();

  if (!languageName) {
    return { hasChanges: false, change: null };
  }

  const change = changes.find(
    (c) =>
      c.itemName?.toLowerCase() === languageName.toLowerCase() &&
      c.status === "pending"
  );

  return {
    hasChanges: !!change,
    change,
  };
}
