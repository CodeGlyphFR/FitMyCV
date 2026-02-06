"use client";
import { useReview } from "@/components/providers/ReviewProvider";

/**
 * Hook pour vérifier si une langue a des changements pending (pour le highlighting)
 */
export function useLanguageHasChanges(languageName) {
  const { pendingChanges, isLatestVersion } = useReview();

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

/**
 * Hook alternatif utilisant le nouveau système de review par section
 * @deprecated Utilisez useLanguageHasChanges ou directement useLanguagesReview
 */
export { useLanguageHasChanges as useLanguageHasChangesV2 } from "@/lib/cv-core/review/hooks";
