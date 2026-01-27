"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getSkillLevelLabel } from "@/lib/i18n/cvLabels";

/**
 * Popover pour reviewer une modification individuelle
 * Affiche la raison et permet accept/reject
 * Utilise un Portal pour s'afficher au-dessus de tout
 */
export default function ChangeReviewPopover({
  change,
  onAccept,
  onReject,
  onClose,
  anchorRef,
  showBeforeText = false,
}) {
  const { t } = useLanguage();
  const popoverRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [position, setPosition] = useState(null); // null jusqu'au calcul
  const [placement, setPlacement] = useState("below"); // "below" ou "above"
  const [mounted, setMounted] = useState(false);

  // S'assurer qu'on est côté client pour le Portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calculer la position du popover
  const calculatePosition = useCallback(() => {
    if (!anchorRef?.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Dimensions estimées du popover compact
    const popoverWidth = 280;
    const popoverHeight = popoverRef.current?.offsetHeight || 80;

    let top = anchorRect.bottom + 8;
    let left = anchorRect.left;
    let newPlacement = "below";

    // Ajuster si dépasse à droite
    if (left + popoverWidth > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - popoverWidth - 16);
    }

    // Ajuster si dépasse à gauche
    if (left < 16) {
      left = 16;
    }

    // Ajuster si dépasse en bas - afficher au-dessus
    if (top + popoverHeight > viewportHeight - 16) {
      top = Math.max(16, anchorRect.top - popoverHeight - 8);
      newPlacement = "above";
    }

    setPosition({ top, left });
    setPlacement(newPlacement);
  }, [anchorRef]);

  useEffect(() => {
    if (!mounted) return;

    // Calculer immédiatement
    calculatePosition();

    // Recalculer après un court délai pour avoir les dimensions réelles
    const timer = setTimeout(calculatePosition, 50);

    // Fermer sur scroll externe (pas sur scroll à l'intérieur du popover)
    const handleScroll = (e) => {
      // Ignorer le scroll si c'est à l'intérieur du popover
      if (popoverRef.current && popoverRef.current.contains(e.target)) {
        return;
      }
      onClose();
    };
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [mounted, calculatePosition, onClose]);

  // Fermer si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorRef]);

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      await onAccept();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject();
    } finally {
      setIsProcessing(false);
    }
  };

  // Ne pas rendre tant que la position n'est pas calculée
  if (!change || !mounted || !position) return null;

  // Animation différente selon le placement
  const animationClass = placement === "above"
    ? "animate-in fade-in slide-in-from-bottom-2"
    : "animate-in fade-in slide-in-from-top-2";

  const popoverContent = (
    <div
      ref={popoverRef}
      className={`fixed bg-slate-900/98 backdrop-blur-xl border border-white/30 rounded-lg shadow-2xl overflow-hidden ${animationClass} duration-150`}
      style={{ top: position.top, left: position.left, zIndex: 99999 }}
    >
      <div className="px-3 pt-2.5 pb-2 space-y-2">
        {/* Pour les langues: afficher le changement de niveau de façon lisible */}
        {change.section === "languages" && change.beforeValue && change.afterValue && (
          <p className="text-xs text-amber-300/90 max-w-[250px]">
            <span className="font-medium text-white/90">{t("review.levelChange") || "Niveau"} : </span>
            <span className="line-through opacity-70">{change.beforeValue?.level || change.beforeValue}</span>
            <span className="mx-1.5">→</span>
            <span className="font-medium">{change.afterValue?.level || change.afterValue}</span>
          </p>
        )}

        {/* Pour les skills modifiés (traductions): afficher avant → après de façon compacte */}
        {showBeforeText && change.changeType === "modified" && change.beforeValue && change.afterValue &&
         (change.field === "skills_used" || change.section === "skills") && (
          <p className="text-xs text-amber-300/90 max-w-[250px]">
            <span className="line-through opacity-70">{change.beforeDisplay || change.beforeValue}</span>
            <span className="mx-1.5">→</span>
            <span className="font-medium">{change.afterDisplay || change.afterValue}</span>
          </p>
        )}

        {/* Pour les extras modifiés */}
        {change.section === "extras" && change.changeType === "modified" && change.beforeValue && change.afterValue && (
          <div className="text-xs text-amber-300/90 max-w-[250px] space-y-1">
            {change.beforeValue?.name !== change.afterValue?.name && (
              <p>
                <span className="font-medium text-white/90">Titre : </span>
                <span className="line-through opacity-70">{change.beforeValue?.name}</span>
                <span className="mx-1.5">→</span>
                <span className="font-medium">{change.afterValue?.name}</span>
              </p>
            )}
            {change.beforeValue?.summary !== change.afterValue?.summary && (
              <p>
                <span className="font-medium text-white/90">Description modifiée</span>
              </p>
            )}
          </div>
        )}

        {/* Ancien contenu - format différent selon le type de champ (sauf langues et skills modifiés déjà traités) */}
        {showBeforeText && change.beforeValue && change.section !== "languages" &&
         !(change.changeType === "modified" && (change.field === "skills_used" || change.section === "skills")) && (
          <div className="max-w-[320px]">
            <p className="text-xs font-medium text-white/60 mb-1">{t("review.previousText") || "Texte précédent"} :</p>
            {/* Pour responsibilities/deliverables: afficher en liste */}
            {(change.field === 'responsibilities' || change.field === 'deliverables') && Array.isArray(change.beforeValue) ? (
              <ul className="list-disc pl-4 text-sm text-white/50 italic leading-relaxed max-h-40 overflow-y-auto pr-2 space-y-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                {change.beforeValue.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            ) : (
              /* Pour les autres champs (description, summary, etc.): texte simple */
              <p className="text-sm text-white/50 italic leading-relaxed max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
                {change.beforeDisplay || change.beforeValue}
              </p>
            )}
          </div>
        )}

        {/* Pour les changements de niveau de skills, afficher avant/après avec labels traduits */}
        {change.changeType === "level_adjusted" && change.section !== "languages" && change.beforeValue !== undefined && change.afterValue !== undefined && (
          <p className="text-xs text-amber-300/90 max-w-[250px]">
            <span className="line-through opacity-70">{getSkillLevelLabel(change.beforeValue, t) || change.beforeValue}</span>
            <span className="mx-1.5">→</span>
            <span className="font-medium">{getSkillLevelLabel(change.afterValue, t) || change.afterValue}</span>
          </p>
        )}

        {/* Raison (si disponible) */}
        {change.reason && (
          <p className="text-xs text-white/70 max-w-[250px]">
            <span className="font-medium text-white/90">{t("review.reason") || "Raison"} : </span>
            {change.reason}
          </p>
        )}

        {/* Actions - liens style alignés à droite */}
        <div className="flex items-center justify-end gap-3 text-xs">
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {t("review.accept") || "Accepter"}
          </button>
          <span className="text-white/30">•</span>
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {t("review.reject") || "Rejeter"}
          </button>
        </div>
      </div>
    </div>
  );

  // Utiliser un Portal pour rendre au niveau root du DOM
  return createPortal(popoverContent, document.body);
}
