"use client";
import { useHighlight } from "@/components/providers/HighlightProvider";

/**
 * Hook pour vérifier si une langue a des changements pending (pour le highlighting)
 */
export function useLanguageHasChanges(languageName) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  if (!isLatestVersion || !languageName) return { hasChanges: false, isAdded: false, isModified: false, change: null };

  const languageChange = pendingChanges.find((c) => {
    if (c.section !== "languages" || c.status !== "pending") return false;
    if (c.itemName && languageName) {
      return c.itemName.toLowerCase() === languageName.toLowerCase();
    }
    return false;
  });

  return {
    hasChanges: !!languageChange,
    isAdded: languageChange?.changeType === "added",
    isRemoved: languageChange?.changeType === "removed",
    isModified: languageChange?.changeType === "modified",
    change: languageChange,
  };
}
