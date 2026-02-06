"use client";
/**
 * Hook de review pour la section Skills
 *
 * Gère l'état et les actions de review pour chaque catégorie de skills :
 * - skills.hard_skills
 * - skills.soft_skills
 * - skills.tools
 * - skills.methodologies
 */

import { useSectionReview } from "./useSectionReview";

/**
 * Types de catégories de skills
 */
export const SKILL_FIELDS = {
  HARD_SKILLS: "hard_skills",
  SOFT_SKILLS: "soft_skills",
  TOOLS: "tools",
  METHODOLOGIES: "methodologies",
};

/**
 * Hook pour la review d'une catégorie de skills spécifique
 *
 * @param {string} field - La catégorie de skills (hard_skills, soft_skills, tools, methodologies)
 * @returns {Object} State et actions de review
 */
export function useSkillsReview(field) {
  const review = useSectionReview({ section: "skills", field });

  // Helper pour trouver un changement par nom de skill
  const findSkillChange = (skillName) => {
    if (!skillName) return null;
    return review.changes.find(
      (c) => c.itemName?.toLowerCase() === skillName.toLowerCase()
    );
  };

  // Helper pour vérifier si un skill a un changement pending
  const hasSkillChange = (skillName) => {
    const change = findSkillChange(skillName);
    return change?.status === "pending";
  };

  // Helper pour obtenir le type de changement d'un skill
  const getSkillChangeType = (skillName) => {
    const change = findSkillChange(skillName);
    return change?.changeType || null;
  };

  // Accepter le changement d'un skill par son nom
  const acceptSkill = async (skillName) => {
    const change = findSkillChange(skillName);
    if (change) {
      return review.accept(change.id);
    }
    return { success: false };
  };

  // Rejeter le changement d'un skill par son nom
  const rejectSkill = async (skillName) => {
    const change = findSkillChange(skillName);
    if (change) {
      return review.reject(change.id);
    }
    return { success: false };
  };

  return {
    ...review,
    // Helpers spécifiques aux skills
    findSkillChange,
    hasSkillChange,
    getSkillChangeType,
    acceptSkill,
    rejectSkill,
    // Catégorie actuelle
    field,
  };
}

/**
 * Hook agrégé pour toute la section skills (toutes catégories)
 *
 * @returns {Object} State et actions de review pour toutes les catégories
 */
export function useAllSkillsReview() {
  const hardSkills = useSkillsReview(SKILL_FIELDS.HARD_SKILLS);
  const softSkills = useSkillsReview(SKILL_FIELDS.SOFT_SKILLS);
  const tools = useSkillsReview(SKILL_FIELDS.TOOLS);
  const methodologies = useSkillsReview(SKILL_FIELDS.METHODOLOGIES);

  // Agréger les données
  const allChanges = [
    ...hardSkills.changes,
    ...softSkills.changes,
    ...tools.changes,
    ...methodologies.changes,
  ];

  const totalPendingCount =
    hardSkills.pendingCount +
    softSkills.pendingCount +
    tools.pendingCount +
    methodologies.pendingCount;

  const isLoading =
    hardSkills.isLoading ||
    softSkills.isLoading ||
    tools.isLoading ||
    methodologies.isLoading;

  const isProcessing =
    hardSkills.isProcessing ||
    softSkills.isProcessing ||
    tools.isProcessing ||
    methodologies.isProcessing;

  // Accepter tous les changements de toutes les catégories
  const acceptAll = async () => {
    const results = await Promise.all([
      hardSkills.changes.length > 0 ? hardSkills.acceptAll() : { success: true },
      softSkills.changes.length > 0 ? softSkills.acceptAll() : { success: true },
      tools.changes.length > 0 ? tools.acceptAll() : { success: true },
      methodologies.changes.length > 0 ? methodologies.acceptAll() : { success: true },
    ]);
    return { success: results.every((r) => r.success) };
  };

  // Rejeter tous les changements de toutes les catégories
  const rejectAll = async () => {
    const results = await Promise.all([
      hardSkills.changes.length > 0 ? hardSkills.rejectAll() : { success: true },
      softSkills.changes.length > 0 ? softSkills.rejectAll() : { success: true },
      tools.changes.length > 0 ? tools.rejectAll() : { success: true },
      methodologies.changes.length > 0 ? methodologies.rejectAll() : { success: true },
    ]);
    return { success: results.every((r) => r.success) };
  };

  return {
    // Reviews par catégorie
    hardSkills,
    softSkills,
    tools,
    methodologies,
    // Données agrégées
    allChanges,
    totalPendingCount,
    hasChanges: totalPendingCount > 0,
    isLoading,
    isProcessing,
    // Actions globales
    acceptAll,
    rejectAll,
  };
}
