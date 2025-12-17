"use client";
import React from "react";
import { useHighlight } from "./HighlightProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Liens "Tout accepter" / "Tout refuser" pour une expérience
 * Affiche uniquement si il y a des changements pending pour cette expérience
 * Utilise les fonctions batch pour éviter les multiples refreshs
 */
export default function ExperienceReviewActions({ expIndex }) {
  const { t } = useLanguage();
  const {
    pendingChanges,
    isLatestVersion,
    acceptAllChanges,
    rejectAllChanges,
    isBatchProcessing,
  } = useHighlight();

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

  // Spinner de chargement
  const LoadingSpinner = () => (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  return (
    <div className="flex items-center gap-3 text-xs no-print">
      {isBatchProcessing ? (
        <span className="inline-flex items-center gap-2 text-white/70">
          <LoadingSpinner />
          {t("review.processing") || "Traitement en cours..."}
        </span>
      ) : (
        <>
          <button
            onClick={handleAcceptAll}
            disabled={isBatchProcessing}
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("review.acceptAll")}
          </button>
          <span className="text-white/30">•</span>
          <button
            onClick={handleRejectAll}
            disabled={isBatchProcessing}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t("review.rejectAll")}
          </button>
        </>
      )}
    </div>
  );
}
