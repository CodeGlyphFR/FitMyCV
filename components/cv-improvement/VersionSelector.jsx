"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useReview } from "@/components/providers/ReviewProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";

/**
 * Dropdown compact pour naviguer entre les versions du CV
 */
export default function VersionSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const { t } = useLanguage();
  const { settings } = useSettings();
  const {
    versions,
    currentVersion,
    contentVersion,
    selectVersion,
    restoreVersion,
    hasUnreviewedChanges,
    reviewProgress,
    isLatestVersion,
    isRestoring,
  } = useReview();

  // Calculer la position du dropdown
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 200;

      let left = rect.right - dropdownWidth;
      if (left < 16) left = 16;

      setDropdownPosition({
        top: rect.bottom + 4,
        left: left,
      });
    }
  }, [isOpen]);

  // Fermer le dropdown si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Ne pas afficher si la feature est désactivée
  if (!settings.feature_history) {
    return null;
  }

  // Ne pas afficher si il n'y a qu'une seule version (pas d'historique)
  // sauf si il y a des modifications en attente de review
  if (versions.length === 0 && !hasUnreviewedChanges) {
    return null;
  }

  // Formater la date courte
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    });
  };

  // Obtenir la couleur du score
  const getScoreColor = (score) => {
    if (score === null || score === undefined) return "text-white/40";
    if (score > 90) return "text-yellow-400";
    if (score >= 80) return "text-green-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  };

  // Calculer les numéros de version pour l'affichage (séquentiels à partir de 1)
  // La version actuelle est toujours le dernier numéro
  // Les versions historiques sont numérotées séquentiellement
  const sortedVersions = [...versions].sort((a, b) => a.version - b.version);
  const displayVersionNumber = sortedVersions.length + 1; // Version actuelle
  const getDisplayNumber = (version) => {
    const index = sortedVersions.findIndex((v) => v.version === version);
    return index + 1; // v1, v2, v3...
  };

  // Handler pour restaurer la version courante
  const handleRestore = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRestoring || isLatestVersion) return;

    await restoreVersion(currentVersion);
  };

  // Rendu du dropdown via Portal
  const renderDropdown = () => {
    if (!isOpen || typeof document === "undefined") return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed w-[200px] bg-slate-900/95 backdrop-blur-md border border-white/20 rounded-lg shadow-xl overflow-hidden"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          zIndex: 99999,
        }}
      >
        {/* Header compact */}
        {hasUnreviewedChanges && (
          <div className="px-3 py-2 bg-emerald-500/10 border-b border-white/10">
            <p className="text-xs text-emerald-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              {reviewProgress.pending} {t("review.pending") || "en attente"}
            </p>
          </div>
        )}

        {/* Liste des versions */}
        <div className="max-h-48 overflow-y-auto custom-scrollbar py-1">
          {/* Version actuelle */}
          <button
            onClick={() => {
              selectVersion("latest");
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left hover:bg-white/5 flex items-center justify-between ${
              currentVersion === "latest" ? "bg-emerald-500/10" : ""
            }`}
          >
            <span className="text-sm text-white">
              v{displayVersionNumber} {t("versions.current") || "Actuel"}
            </span>
            {currentVersion === "latest" && (
              <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1.1.5.010 1.414l-8 8a1.1.5.01-1.414 0l-4-4a1.1.5.011.414-1.414L8 12.586l7.293-7.293a1.1.5.011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          {/* Séparateur */}
          {versions.length > 0 && (
            <div className="mx-3 my-1 border-t border-white/10" />
          )}

          {/* Versions historiques (triées par version croissante, affichées en décroissant) */}
          {[...sortedVersions].reverse().map((v) => (
            <button
              key={v.version}
              onClick={() => {
                selectVersion(v.version);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-white/5 flex items-center justify-between ${
                currentVersion === v.version ? "bg-emerald-500/10" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white flex items-center justify-between">
                  <span>
                    v{getDisplayNumber(v.version)}
                    {v.changeType === "optimization" && (
                      <span className="ml-1.5 text-[10px] text-amber-400">Opt.</span>
                    )}
                    {v.changeType === "adaptation" && (
                      <span className="ml-1.5 text-[10px] text-sky-400">Gen.</span>
                    )}
                    {v.changeType === "restore" && (
                      <span className="ml-1.5 text-[10px] text-violet-400">Rest.</span>
                    )}
                  </span>
                  {/* Score de la version */}
                  {v.matchScore !== null && v.matchScore !== undefined && (
                    <span className={`text-[11px] font-medium ${getScoreColor(v.matchScore)}`}>
                      {v.matchScore}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-white/40 truncate">
                  {formatDate(v.createdAt)}
                </div>
              </div>
              {currentVersion === v.version && (
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1.1.5.010 1.414l-8 8a1.1.5.01-1.414 0l-4-4a1.1.5.011.414-1.414L8 12.586l7.293-7.293a1.1.5.011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}

          {/* État vide - Ne pas afficher si on est en mode review */}
          {versions.length === 0 && !hasUnreviewedChanges && (
            <div className="px-3 py-4 text-center">
              <p className="text-white/40 text-xs">
                {t("versions.noVersions") || "Aucune version"}
              </p>
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  };

  // Spinner de chargement
  const LoadingSpinner = () => (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  return (
    <div className="flex items-center gap-2" data-onboarding="history">
      {/* Lien Restaurer - visible uniquement sur une version précédente */}
      {!isLatestVersion && (
        <button
          onClick={handleRestore}
          disabled={isRestoring}
          className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={t("versions.restoreTitle") || "Restaurer cette version"}
        >
          {isRestoring ? (
            <LoadingSpinner />
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          )}
          {t("versions.restore") || "Restaurer"}
        </button>
      )}

      {/* Bouton principal */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-white rounded-lg transition-colors ${
          isOpen
            ? "bg-emerald-500/20 border-emerald-400/50"
            : "bg-white/10 hover:bg-white/20 border-white/20"
        } border`}
        title={t("versions.title") || "Versions"}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>

        <span className="hidden sm:inline text-xs">
          {currentVersion === "latest"
            ? `v${displayVersionNumber}`
            : `v${getDisplayNumber(currentVersion)}`}
        </span>

        {/* Badge modifications en attente */}
        {hasUnreviewedChanges && isLatestVersion && (
          <span className="flex items-center justify-center min-w-[16px] h-[16px] text-[9px] font-bold bg-emerald-500 text-white rounded-full">
            {reviewProgress.pending}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown via Portal */}
      {renderDropdown()}
    </div>
  );
}
