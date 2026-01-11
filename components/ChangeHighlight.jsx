"use client";
import React, { useState, useRef } from "react";
import { useHighlight } from "./HighlightProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import ChangeReviewPopover from "./ChangeReviewPopover";
import InlineDiff from "./InlineDiff";

/**
 * Wrapper pour surligner le contenu modifié par l'IA
 * Affiche une surbrillance et permet de reviewer le changement
 *
 * Pour les champs texte, affiche un diff inline (barré/surligné)
 * Pour les autres types, entoure le contenu avec une surbrillance
 *
 * Usage:
 * <ChangeHighlight section="summary" field="description">
 *   <p>{summary.description}</p>
 * </ChangeHighlight>
 */
export default function ChangeHighlight({
  children,
  section,
  field,
  path,
  expIndex,
  className = "",
}) {
  const [showPopover, setShowPopover] = useState(false);
  const highlightRef = useRef(null);

  const {
    pendingChanges,
    isLatestVersion,
    acceptChange,
    rejectChange,
  } = useHighlight();

  // Trouver le changement correspondant
  // Si expIndex est fourni, on doit aussi matcher sur expIndex
  const changePath = path || (expIndex !== undefined
    ? `${section}[${expIndex}].${field}`
    : `${section}.${field}`);

  const change = pendingChanges.find((c) => {
    // Match par path exact
    if (c.path === changePath) return true;

    // Match par section/field, avec expIndex si fourni
    if (c.section === section && c.field === field) {
      // Si expIndex est fourni, il doit matcher
      if (expIndex !== undefined) {
        return c.expIndex === expIndex;
      }
      // Si pas d'expIndex, match simple
      return true;
    }

    return false;
  });

  // Déterminer si on doit afficher la surbrillance
  const isPending = change?.status === "pending";
  const shouldHighlight = isLatestVersion && isPending;

  // Si pas de surbrillance, afficher le contenu normalement
  if (!shouldHighlight) {
    return <>{children}</>;
  }

  const handleClick = (e) => {
    e.stopPropagation();
    setShowPopover(true);
  };

  const handleAccept = async () => {
    await acceptChange(change.id);
    setShowPopover(false);
  };

  const handleReject = async () => {
    await rejectChange(change.id);
    setShowPopover(false);
  };

  // Vérifier si on peut faire un diff inline (champ texte avec before/after)
  const hasTextDiff = change.beforeDisplay !== undefined &&
                      change.afterDisplay !== undefined &&
                      typeof change.beforeDisplay === 'string' &&
                      typeof change.afterDisplay === 'string';

  // Pour les champs texte, afficher le diff inline
  // On préserve le style du children (text-sm, etc.) via le className
  if (hasTextDiff) {
    return (
      <>
        <span
          ref={highlightRef}
          onClick={handleClick}
          className={`relative cursor-pointer ${className}`}
        >
          {/* Diff inline - hérite des classes de style du parent */}
          <InlineDiff
            beforeText={change.beforeDisplay}
            afterText={change.afterDisplay}
            showRemoved={true}
            className={`leading-relaxed ${className}`}
          />
        </span>

        {/* Popover de review */}
        {showPopover && (
          <ChangeReviewPopover
            change={change}
            onAccept={handleAccept}
            onReject={handleReject}
            onClose={() => setShowPopover(false)}
            anchorRef={highlightRef}
          />
        )}
      </>
    );
  }

  // Pour les autres types (arrays, objects), utiliser le wrapper classique
  return (
    <>
      <span
        ref={highlightRef}
        onClick={handleClick}
        className={`relative cursor-pointer inline bg-emerald-400/20 hover:bg-emerald-400/30 rounded px-1 transition-all duration-200 ${className}`}
      >
        {children}
      </span>

      {/* Popover de review */}
      {showPopover && (
        <ChangeReviewPopover
          change={change}
          onAccept={handleAccept}
          onReject={handleReject}
          onClose={() => setShowPopover(false)}
          anchorRef={highlightRef}
        />
      )}
    </>
  );
}

/**
 * Hook utilitaire pour trouver un changement par section et field
 */
export function useFindChange(section, field) {
  const { pendingChanges, isLatestVersion } = useHighlight();

  const change = pendingChanges.find(
    (c) => c.section === section && c.field === field
  );

  return {
    change,
    isPending: change?.status === "pending",
    shouldHighlight: isLatestVersion && change?.status === "pending",
    changeId: change?.id,
  };
}

/**
 * Composant pour afficher les actions globales de review (Tout accepter / Tout refuser)
 */
export function GlobalReviewActions() {
  const { t } = useLanguage();
  const {
    hasUnreviewedChanges,
    reviewProgress,
    isLatestVersion,
    pendingChanges,
    acceptAllChanges,
    rejectAllChanges,
    isBatchProcessing,
  } = useHighlight();

  if (!isLatestVersion || !hasUnreviewedChanges) {
    return null;
  }

  // Récupérer tous les IDs des changements pending
  const pendingIds = pendingChanges
    .filter((c) => c.status === "pending")
    .map((c) => c.id);

  const handleAcceptAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing || pendingIds.length === 0) return;
    await acceptAllChanges(pendingIds);
  };

  const handleRejectAll = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isBatchProcessing || pendingIds.length === 0) return;
    await rejectAllChanges(pendingIds);
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
 * @deprecated Utilisez GlobalReviewActions à la place
 */
export function ReviewProgressBar() {
  return <GlobalReviewActions />;
}
