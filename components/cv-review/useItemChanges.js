"use client";
import { useHighlight } from "@/components/providers/HighlightProvider";

/**
 * Hook pour récupérer les changements d'items pour une section donnée
 *
 * @param {string} section - La section (projects, languages, education, extras, experience)
 * @returns {Object} - { addedItems, modifiedItems, removedItems, allPendingChanges }
 *
 * Usage:
 * const { addedItems, removedItems } = useItemChanges("projects");
 * const { addedItems, removedItems } = useItemChanges("languages");
 */
export function useItemChanges(section) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion) {
    return {
      addedItems: [],
      modifiedItems: [],
      removedItems: [],
      allPendingChanges: [],
    };
  }

  // Filtrer les changements pending pour cette section
  const sectionChanges = pendingChanges.filter(
    (c) => c.section === section && c.status === "pending"
  );

  // Séparer par type de changement
  const addedItems = sectionChanges.filter((c) =>
    c.changeType === "added" || c.changeType === "move_to_projects"
  );

  const modifiedItems = sectionChanges.filter((c) =>
    c.changeType === "modified" || c.changeType === "level_adjusted"
  );

  const removedItems = sectionChanges.filter((c) =>
    c.changeType === "removed" || c.changeType === "experience_removed"
  );

  return {
    addedItems,
    modifiedItems,
    removedItems,
    allPendingChanges: sectionChanges,
  };
}

/**
 * Hook pour vérifier si un item spécifique a des changements
 *
 * @param {string} section - La section
 * @param {string} itemIdentifier - Identifiant de l'item (nom, index, etc.)
 * @returns {Object} - { hasChanges, isAdded, isModified, isRemoved, change }
 */
export function useItemHasChanges(section, itemIdentifier) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion || !itemIdentifier) {
    return {
      hasChanges: false,
      isAdded: false,
      isModified: false,
      isRemoved: false,
      change: null
    };
  }

  const change = pendingChanges.find((c) => {
    if (c.section !== section || c.status !== "pending") return false;

    // Matcher par itemName (nom de l'élément)
    if (c.itemName && itemIdentifier) {
      return c.itemName.toLowerCase() === itemIdentifier.toLowerCase();
    }

    // Matcher par index si itemIdentifier est un nombre
    if (typeof itemIdentifier === "number" && c.itemIndex !== undefined) {
      return c.itemIndex === itemIdentifier;
    }

    return false;
  });

  const changeType = change?.changeType;

  return {
    hasChanges: !!change,
    isAdded: changeType === "added" || changeType === "move_to_projects",
    isModified: changeType === "modified" || changeType === "level_adjusted",
    isRemoved: changeType === "removed" || changeType === "experience_removed",
    change,
  };
}
