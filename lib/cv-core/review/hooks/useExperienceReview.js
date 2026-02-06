"use client";
/**
 * Hook de review pour la section Experience
 *
 * Gère l'état et les actions de review pour :
 * - Chaque expérience individuellement (par expIndex)
 * - Les champs de chaque expérience (title, company, responsibilities, etc.)
 * - Les skills_used de chaque expérience
 */

import { useSectionReview } from "./useSectionReview";
import { useReviewContext } from "./useReviewContext";
import { useCallback, useMemo } from "react";

/**
 * Hook pour la review d'une expérience spécifique (par index)
 *
 * @param {number} expIndex - L'index de l'expérience dans le tableau
 * @returns {Object} State et actions de review pour cette expérience
 */
export function useExperienceReview(expIndex) {
  const review = useSectionReview({ section: "experience", expIndex });

  // Helper pour trouver un changement par field
  const findFieldChange = (field) => {
    return review.changes.find(
      (c) => c.field === field && (c.expIndex === expIndex || c.expIndex === undefined)
    );
  };

  // Helpers pour champs spécifiques
  const titleChange = findFieldChange("title");
  const companyChange = findFieldChange("company");
  const locationChange = findFieldChange("location");
  const responsibilitiesChange = findFieldChange("responsibilities");
  const deliverablesChange = findFieldChange("deliverables");
  const descriptionChange = findFieldChange("description");

  // Skills used - filtrer les changements qui concernent skills_used
  const skillsUsedChanges = review.changes.filter(
    (c) => c.field === "skills_used"
  );

  // Helper pour trouver un changement de skill_used par nom
  const findSkillUsedChange = (skillName) => {
    if (!skillName) return null;
    return skillsUsedChanges.find(
      (c) => c.itemName?.toLowerCase() === skillName.toLowerCase()
    );
  };

  // Accepter un changement de skill_used par son nom
  const acceptSkillUsed = async (skillName) => {
    const change = findSkillUsedChange(skillName);
    if (change) {
      return review.accept(change.id);
    }
    return { success: false };
  };

  // Rejeter un changement de skill_used par son nom
  const rejectSkillUsed = async (skillName) => {
    const change = findSkillUsedChange(skillName);
    if (change) {
      return review.reject(change.id);
    }
    return { success: false };
  };

  return {
    ...review,
    // Index de l'expérience
    expIndex,
    // Changements par champ
    titleChange,
    companyChange,
    locationChange,
    responsibilitiesChange,
    deliverablesChange,
    descriptionChange,
    // Skills used
    skillsUsedChanges,
    findSkillUsedChange,
    acceptSkillUsed,
    rejectSkillUsed,
    // Helpers
    findFieldChange,
    hasFieldChange: (field) => !!findFieldChange(field),
  };
}

/**
 * Hook agrégé pour toutes les expériences
 * Utilisé pour les actions globales sur la section experience
 *
 * @returns {Object} State et actions de review pour toutes les expériences
 */
export function useAllExperiencesReview() {
  // Récupérer le filename au niveau du hook (pas dans les callbacks)
  const { filename, broadcastUpdate } = useReviewContext();

  // On utilise le hook de section sans expIndex pour avoir tous les changements
  const review = useSectionReview({ section: "experience" });

  // Grouper les changements par expIndex
  const changesByExpIndex = useMemo(() => {
    const grouped = {};
    review.changes.forEach((change) => {
      const idx = change.expIndex ?? -1; // -1 pour les changements sans expIndex
      if (!grouped[idx]) {
        grouped[idx] = [];
      }
      grouped[idx].push(change);
    });
    return grouped;
  }, [review.changes]);

  // Liste des expIndexes qui ont des changements
  const expIndexesWithChanges = useMemo(() => {
    return Object.keys(changesByExpIndex)
      .map(Number)
      .filter((idx) => idx >= 0)
      .sort((a, b) => a - b);
  }, [changesByExpIndex]);

  // Helper pour obtenir les changements d'une expérience
  const getChangesForExp = useCallback((expIndex) => {
    return changesByExpIndex[expIndex] || [];
  }, [changesByExpIndex]);

  // Helper pour vérifier si une expérience a des changements
  const hasChangesForExp = useCallback((expIndex) => {
    return (changesByExpIndex[expIndex]?.length || 0) > 0;
  }, [changesByExpIndex]);

  // Accepter tous les changements d'une expérience
  const acceptAllForExp = useCallback(async (expIndex) => {
    const changes = changesByExpIndex[expIndex] || [];
    if (changes.length === 0) return { success: true };

    const changeIds = changes.map((c) => c.id);

    try {
      const response = await fetch("/api/cvs/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          changeIds,
          action: "accept",
          section: "experience",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        broadcastUpdate("experience");
        return { success: true, ...result };
      }
      return { success: false };
    } catch (err) {
      console.error("[useAllExperiencesReview] AcceptAll error:", err);
      return { success: false };
    }
  }, [filename, changesByExpIndex, broadcastUpdate]);

  // Rejeter tous les changements d'une expérience
  const rejectAllForExp = useCallback(async (expIndex) => {
    const changes = changesByExpIndex[expIndex] || [];
    if (changes.length === 0) return { success: true };

    const changeIds = changes.map((c) => c.id);

    try {
      const response = await fetch("/api/cvs/changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          changeIds,
          action: "reject",
          section: "experience",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        broadcastUpdate("experience");
        return { success: true, ...result };
      }
      return { success: false };
    } catch (err) {
      console.error("[useAllExperiencesReview] RejectAll error:", err);
      return { success: false };
    }
  }, [filename, changesByExpIndex, broadcastUpdate]);

  return {
    ...review,
    // Changements groupés
    changesByExpIndex,
    expIndexesWithChanges,
    // Helpers
    getChangesForExp,
    hasChangesForExp,
    acceptAllForExp,
    rejectAllForExp,
  };
}
