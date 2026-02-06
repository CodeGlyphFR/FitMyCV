"use client";
/**
 * Contexte minimal pour le système de review par section
 *
 * Ce module fournit le contexte partagé entre tous les hooks de section.
 * Il contient uniquement les informations communes nécessaires :
 * - filename : nom du fichier CV
 * - contentVersion : version du contenu pour invalidation
 * - broadcastUpdate : fonction pour notifier les autres sections d'un changement
 */

import { createContext, useContext } from "react";

/**
 * Contexte de review partagé
 * Valeurs par défaut pour éviter les erreurs si utilisé hors Provider
 */
export const ReviewContext = createContext({
  filename: null,
  contentVersion: 1,
  broadcastUpdate: () => {},
  isLatestVersion: true,
});

/**
 * Hook pour accéder au contexte de review
 * @returns {Object} { filename, contentVersion, broadcastUpdate, isLatestVersion }
 */
export function useReviewContext() {
  const context = useContext(ReviewContext);
  if (!context) {
    console.warn("[useReviewContext] Used outside of ReviewProvider");
  }
  return context;
}

/**
 * Types d'événements de synchronisation inter-sections
 */
export const REVIEW_EVENTS = {
  SECTION_UPDATED: "review:section-updated",
  CHANGES_REFRESHED: "review:changes-refreshed",
};

/**
 * Sections qui peuvent déclencher une mise à jour d'autres sections
 * Exemple: move_to_projects affecte experience ET projects
 */
export const CROSS_SECTION_DEPENDENCIES = {
  // Quand experience est modifiée, projects pourrait être affecté (move_to_projects)
  experience: ["projects"],
  // Quand projects est modifiée, experience pourrait être affecté (restauration)
  projects: ["experience"],
};

/**
 * Helper pour déterminer si une section doit se rafraîchir
 * suite à un changement dans une autre section
 *
 * @param {string} mySection - Ma section
 * @param {string} changedSection - La section qui a changé
 * @returns {boolean} true si je dois me rafraîchir
 */
export function shouldRefreshForSection(mySection, changedSection) {
  if (mySection === changedSection) return false;

  const dependencies = CROSS_SECTION_DEPENDENCIES[changedSection];
  return dependencies?.includes(mySection) || false;
}
