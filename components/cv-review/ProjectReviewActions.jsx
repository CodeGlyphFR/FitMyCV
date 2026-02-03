"use client";
import React from "react";
import { useReview } from "@/components/providers/ReviewProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Spinner de chargement réutilisable
 */
const LoadingSpinner = () => (
  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/**
 * Boutons "Accepter" / "Refuser" pour un projet individuel
 * Affiche uniquement si le projet a des changements pending (ex: nouveau projet ajouté)
 *
 * @param {number} projectIndex - L'index du projet dans le tableau
 * @param {string} projectName - Le nom du projet (pour matcher le changement)
 */
export default function ProjectReviewActions({ projectIndex, projectName }) {
  const { t } = useLanguage();
  const {
    pendingChanges,
    isLatestVersion,
    acceptChange,
    rejectChange,
    isBatchProcessing,
  } = useReview();

  // Filtrer les changements pending pour ce projet
  // Les projets ajoutés ont section="projects", changeType="added"
  const projectChanges = pendingChanges.filter((c) => {
    if (c.section !== "projects" || c.status !== "pending") return false;

    // Matcher par nom de projet (itemName contient le nom)
    if (c.itemName && projectName) {
      return c.itemName.toLowerCase() === projectName.toLowerCase();
    }

    // Ou matcher par path si disponible
    if (c.path && c.path.includes(`projects[${projectIndex}]`)) {
      return true;
    }

    return false;
  });

  // Ne rien afficher si pas de changements ou pas sur la dernière version
  if (!isLatestVersion || projectChanges.length === 0) {
    return null;
  }

  const handleAccept = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing) return;

    // Accepter tous les changements pour ce projet
    for (const change of projectChanges) {
      await acceptChange(change.id);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing) return;

    // Rejeter tous les changements pour ce projet
    for (const change of projectChanges) {
      await rejectChange(change.id);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs no-print">
      {isBatchProcessing ? (
        <LoadingSpinner />
      ) : (
        <>
          <button
            onClick={handleAccept}
            disabled={isBatchProcessing}
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("review.accept") || "Accepter"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("review.accept") || "Accepter"}
          </button>
          <span className="text-white/30">•</span>
          <button
            onClick={handleReject}
            disabled={isBatchProcessing}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("review.reject") || "Refuser"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t("review.reject") || "Refuser"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Hook pour vérifier si un projet a des changements pending (pour le highlighting)
 */
export function useProjectHasChanges(projectName) {
  const { pendingChanges, isLatestVersion } = useReview();

  if (!isLatestVersion || !projectName) return { hasChanges: false, isAdded: false };

  const projectChange = pendingChanges.find((c) => {
    if (c.section !== "projects" || c.status !== "pending") return false;
    if (c.itemName && projectName) {
      return c.itemName.toLowerCase() === projectName.toLowerCase();
    }
    return false;
  });

  return {
    hasChanges: !!projectChange,
    isAdded: projectChange?.changeType === "added",
    isRemoved: projectChange?.changeType === "removed",
    isMoved: projectChange?.changeType === "move_to_projects",
    change: projectChange,
  };
}

/**
 * Version utilisant les nouveaux hooks de section review
 * À utiliser avec ReviewProvider et useProjectsReview
 *
 * @param {Object} props
 * @param {Object} props.review - Hook de review des projets (useProjectsReview())
 * @param {string} props.projectName - Nom du projet à filtrer
 */
export function ProjectReviewActionsV2({ review, projectName }) {
  const { t } = useLanguage();

  const { findProjectChange, acceptProject, rejectProject, isProcessing } = review;

  const projectChange = findProjectChange(projectName);

  // Ne rien afficher si pas de changement
  if (!projectChange || projectChange.status !== "pending") {
    return null;
  }

  const handleAccept = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing) return;
    await acceptProject(projectName);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing) return;
    await rejectProject(projectName);
  };

  return (
    <div className="flex items-center gap-2 text-xs no-print">
      {isProcessing ? (
        <LoadingSpinner />
      ) : (
        <>
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("review.accept") || "Accepter"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("review.accept") || "Accepter"}
          </button>
          <span className="text-white/30">•</span>
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t("review.reject") || "Refuser"}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t("review.reject") || "Refuser"}
          </button>
        </>
      )}
    </div>
  );
}
