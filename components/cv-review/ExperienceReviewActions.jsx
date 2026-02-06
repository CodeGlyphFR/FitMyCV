"use client";
import React from "react";
import { useReview } from "@/components/providers/ReviewProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Check, X } from "lucide-react";

/**
 * Spinner de chargement réutilisable
 */
const LoadingSpinner = () => (
  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/**
 * Boutons Accept/Reject compacts pour une expérience
 * Affiche uniquement une coche et une croix, à placer en haut à droite de la carte
 * Utilise les fonctions batch pour traiter tous les changements de l'expérience
 */
export default function ExperienceReviewActions({ expIndex }) {
  const { t } = useLanguage();
  const {
    pendingChanges,
    isLatestVersion,
    acceptAllChanges,
    rejectAllChanges,
    isBatchProcessing,
  } = useReview();

  // Filtrer les changements pending pour cette expérience
  const expChanges = pendingChanges.filter(
    (c) =>
      c.section === "experience" &&
      c.expIndex === expIndex &&
      c.status === "pending"
  );

  // Ne rien afficher si pas de changements ou pas sur la dernière version
  if (!isLatestVersion || expChanges.length === 0) {
    return null;
  }

  const handleAcceptAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing) return;

    // Utiliser la fonction batch avec tous les IDs et l'index de l'expérience
    const changeIds = expChanges.map((c) => c.id);
    await acceptAllChanges(changeIds, { expIndex });
  };

  const handleRejectAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing) return;

    // Utiliser la fonction batch avec tous les IDs et l'index de l'expérience
    const changeIds = expChanges.map((c) => c.id);
    await rejectAllChanges(changeIds, { expIndex });
  };

  return (
    <div className="flex items-center gap-2 no-print">
      {isBatchProcessing ? (
        <span className="text-white/70">
          <LoadingSpinner />
        </span>
      ) : (
        <>
          <button
            onClick={handleAcceptAll}
            disabled={isBatchProcessing}
            className="p-1 rounded-md flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            title={t("review.acceptAll")}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleRejectAll}
            disabled={isBatchProcessing}
            className="p-1 rounded-md flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            title={t("review.rejectAll")}
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Version utilisant les nouveaux hooks de section review
 * À utiliser avec ReviewProvider et useExperienceReview
 *
 * @param {Object} props
 * @param {Object} props.review - Hook de review de l'expérience (useExperienceReview(expIndex))
 */
export function ExperienceReviewActionsV2({ review }) {
  const { t } = useLanguage();

  const { changes, isProcessing, acceptAll, rejectAll, expIndex } = review;

  // Ne rien afficher si pas de changements
  if (changes.length === 0) {
    return null;
  }

  const handleAcceptAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing) return;
    await acceptAll();
  };

  const handleRejectAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isProcessing) return;
    await rejectAll();
  };

  return (
    <div className="flex items-center gap-2 no-print">
      {isProcessing ? (
        <span className="text-white/70">
          <LoadingSpinner />
        </span>
      ) : (
        <>
          <button
            onClick={handleAcceptAll}
            disabled={isProcessing}
            className="p-1 rounded-md flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            title={t("review.acceptAll")}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleRejectAll}
            disabled={isProcessing}
            className="p-1 rounded-md flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            title={t("review.rejectAll")}
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
