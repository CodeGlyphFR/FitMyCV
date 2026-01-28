"use client";
import { useHighlight } from "@/components/providers/HighlightProvider";

/**
 * Hook pour vérifier si une formation a des changements pending (pour le highlighting)
 */
export function useEducationHasChanges(institution) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion || !institution) return { hasChanges: false, isModified: false, change: null };

  // Chercher un changement pour cette formation (par institution ou par itemName)
  const educationChange = pendingChanges.find((c) => {
    if (c.section !== "education" || c.status !== "pending") return false;
    if (c.itemName && institution) {
      return c.itemName.toLowerCase() === institution.toLowerCase();
    }
    return false;
  });

  return {
    hasChanges: !!educationChange,
    isModified: educationChange?.changeType === "modified",
    isRemoved: educationChange?.changeType === "removed",
    change: educationChange,
  };
}

/**
 * Hook pour récupérer tous les changements d'une formation (degree, field_of_study)
 */
export function useEducationAllChanges(institution) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion || !institution) return { changes: [], hasChanges: false };

  // Chercher tous les changements pour cette formation
  const educationChanges = pendingChanges.filter((c) => {
    if (c.section !== "education" || c.status !== "pending") return false;
    if (c.itemName && institution) {
      return c.itemName.toLowerCase() === institution.toLowerCase();
    }
    return false;
  });

  return {
    changes: educationChanges,
    hasChanges: educationChanges.length > 0,
  };
}
