"use client";
/**
 * Hook de review pour la section Summary
 *
 * Gère l'état et les actions de review pour :
 * - summary.title
 * - summary.description
 */

import { useSectionReview } from "./useSectionReview";

/**
 * Hook pour la review de la section summary
 *
 * @returns {Object} State et actions de review
 */
export function useSummaryReview() {
  const review = useSectionReview({ section: "summary" });

  // Helpers spécifiques au summary
  const getTitleChange = () => {
    return review.changes.find(
      (c) => c.field === "title" || c.path === "summary.title"
    );
  };

  const getDescriptionChange = () => {
    return review.changes.find(
      (c) => c.field === "description" || c.path === "summary.description"
    );
  };

  return {
    ...review,
    // Helpers spécifiques
    titleChange: getTitleChange(),
    descriptionChange: getDescriptionChange(),
    hasTitleChange: !!getTitleChange(),
    hasDescriptionChange: !!getDescriptionChange(),
  };
}
