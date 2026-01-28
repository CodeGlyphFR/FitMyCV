"use client";
/**
 * Hook de review pour la section Projects
 *
 * Gère l'état et les actions de review pour :
 * - Les projets (name, role, summary, technologies, etc.)
 * - Les projets ajoutés via move_to_projects (depuis experience)
 */

import { useSectionReview } from "./useSectionReview";

/**
 * Hook pour la review de la section projects
 *
 * @returns {Object} State et actions de review
 */
export function useProjectsReview() {
  const review = useSectionReview({ section: "projects" });

  // Helper pour trouver un changement par nom de projet
  const findProjectChange = (projectName) => {
    if (!projectName) return null;
    return review.changes.find(
      (c) => c.itemName?.toLowerCase() === projectName.toLowerCase()
    );
  };

  // Helper pour vérifier si un projet a des changements
  const hasProjectChange = (projectName) => {
    const change = findProjectChange(projectName);
    return change?.status === "pending";
  };

  // Helper pour obtenir le type de changement d'un projet
  const getProjectChangeType = (projectName) => {
    const change = findProjectChange(projectName);
    return change?.changeType || null;
  };

  // Projets déplacés depuis experience (move_to_projects)
  const movedProjects = review.changes.filter(
    (c) => c.changeType === "move_to_projects"
  );

  // Accepter le changement d'un projet par son nom
  const acceptProject = async (projectName) => {
    const change = findProjectChange(projectName);
    if (change) {
      return review.accept(change.id);
    }
    return { success: false };
  };

  // Rejeter le changement d'un projet par son nom
  const rejectProject = async (projectName) => {
    const change = findProjectChange(projectName);
    if (change) {
      return review.reject(change.id);
    }
    return { success: false };
  };

  return {
    ...review,
    // Helpers spécifiques aux projects
    findProjectChange,
    hasProjectChange,
    getProjectChangeType,
    acceptProject,
    rejectProject,
    // Projets déplacés
    movedProjects,
  };
}

/**
 * Hook pour vérifier si un projet spécifique a des changements
 *
 * @param {string} projectName - Nom du projet
 * @returns {Object} { hasChanges, isAdded, isModified, isRemoved, isMoved, change }
 */
export function useProjectHasChanges(projectName) {
  const { changes } = useProjectsReview();

  if (!projectName) {
    return {
      hasChanges: false,
      isAdded: false,
      isModified: false,
      isRemoved: false,
      isMoved: false,
      change: null,
    };
  }

  const change = changes.find(
    (c) =>
      c.itemName?.toLowerCase() === projectName.toLowerCase() &&
      c.status === "pending"
  );

  const changeType = change?.changeType;

  return {
    hasChanges: !!change,
    isAdded: changeType === "added",
    isModified: changeType === "modified",
    isRemoved: changeType === "removed",
    isMoved: changeType === "move_to_projects",
    change,
  };
}
