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
 * Boutons "Tout accepter" / "Tout refuser" pour une section entière
 * Affiche uniquement si il y a des changements pending pour cette section
 *
 * @param {string} section - La section à filtrer (skills, experience, etc.)
 */
export default function SectionReviewActions({ section }) {
  const { t } = useLanguage();
  const {
    pendingChanges,
    isLatestVersion,
    acceptAllChanges,
    rejectAllChanges,
    isBatchProcessing,
  } = useReview();

  // Filtrer les changements pending pour cette section
  const sectionChanges = pendingChanges.filter(
    (c) => c.section === section && c.status === "pending"
  );

  // Ne rien afficher si pas de changements ou pas sur la dernière version
  if (!isLatestVersion || sectionChanges.length === 0) {
    return null;
  }

  const handleAcceptAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing) return;

    const changeIds = sectionChanges.map((c) => c.id);
    await acceptAllChanges(changeIds);
  };

  const handleRejectAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing) return;

    const changeIds = sectionChanges.map((c) => c.id);
    await rejectAllChanges(changeIds);
  };

  return (
    <div className="flex items-center gap-2 text-xs no-print">
      {isBatchProcessing ? (
        <span className="inline-flex items-center gap-2 text-white/70">
          <LoadingSpinner />
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
            {t("review.acceptAll") || "Tout accepter"}
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
            {t("review.rejectAll") || "Tout refuser"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Version utilisant les nouveaux hooks de section review
 * À utiliser avec ReviewProvider
 *
 * @param {Object} props
 * @param {Object} props.review - Hook de review de la section (ex: useSkillsReview('hard_skills'))
 */
export function SectionReviewActionsV2({ review }) {
  const { t } = useLanguage();

  const { changes, isProcessing, acceptAll, rejectAll } = review;

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
    <div className="flex items-center gap-2 text-xs no-print">
      {isProcessing ? (
        <span className="inline-flex items-center gap-2 text-white/70">
          <LoadingSpinner />
        </span>
      ) : (
        <>
          <button
            onClick={handleAcceptAll}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {t("review.acceptAll") || "Tout accepter"}
          </button>
          <span className="text-white/30">•</span>
          <button
            onClick={handleRejectAll}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t("review.rejectAll") || "Tout refuser"}
          </button>
        </>
      )}
    </div>
  );
}
