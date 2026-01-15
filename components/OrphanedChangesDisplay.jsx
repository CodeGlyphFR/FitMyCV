"use client";
import React from "react";
import { useHighlight } from "./HighlightProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * Affiche les changements orphelins (non visibles dans l'UI principale)
 * Cela inclut les changements pour des sections sans ChangeHighlight :
 * - education, languages, projects, header
 * - items supprimés dans des sections cachées
 */
export default function OrphanedChangesDisplay() {
  const { t } = useLanguage();
  const { pendingChanges, isLatestVersion, acceptChange, rejectChange } = useHighlight();

  // Filtrer pour n'afficher que les suppressions importantes et les move_to_projects
  // Les compétences (skills) sont gérées visuellement dans leur section
  const orphanedChanges = pendingChanges.filter((c) => {
    if (c.status !== "pending") return false;

    // Expériences supprimées
    if (c.section === "experience" && c.changeType === "experience_removed") return true;

    // Expériences déplacées vers projets
    if (c.section === "experience" && c.changeType === "move_to_projects") return true;

    // Suppressions d'extras (certifications, publications, etc.)
    if (c.section === "extras" && c.changeType === "removed") return true;

    // Suppressions de langues
    if (c.section === "languages" && c.changeType === "removed") return true;

    // Suppressions de formations
    if (c.section === "education" && c.changeType === "removed") return true;

    // Suppressions de projets
    if (c.section === "projects" && c.changeType === "removed") return true;

    // Ajouts de projets (nouveaux projets créés)
    // Affiché ici ET visuellement dans la section Projects
    if (c.section === "projects" && c.changeType === "added") return true;

    // Tout le reste n'est pas affiché dans ce bloc
    return false;
  });

  if (!isLatestVersion || orphanedChanges.length === 0) {
    return null;
  }

  const handleAccept = async (changeId) => {
    await acceptChange(changeId);
  };

  const handleReject = async (changeId) => {
    await rejectChange(changeId);
  };

  // Grouper par section pour un meilleur affichage
  const groupedChanges = orphanedChanges.reduce((acc, change) => {
    const key = change.section;
    if (!acc[key]) acc[key] = [];
    acc[key].push(change);
    return acc;
  }, {});

  const sectionLabels = {
    education: t("cvSections.education") || "Formation",
    languages: t("cvSections.languages") || "Langues",
    projects: t("cvSections.projects") || "Projets",
    header: t("cvSections.header") || "En-tête",
    experience: t("cvSections.experience") || "Expérience",
    skills: t("cvSections.skills") || "Compétences",
    extras: t("cvSections.extras") || "Extras",
  };

  return (
    <div className="mt-4 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 no-print">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm font-medium text-amber-300">
          {orphanedChanges.length} {orphanedChanges.length === 1
            ? (t("review.pendingImportantSingular") || "modification importante en attente")
            : (t("review.pendingImportantPlural") || "modifications importantes en attente")}
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedChanges).map(([section, changes]) => (
          <div key={section}>
            <div className="text-xs text-white/50 mb-1">{sectionLabels[section] || section}</div>
            <div className="space-y-2">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start justify-between gap-3 p-2 rounded-lg bg-white/5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 truncate">
                      {change.change || change.field || "Modification"}
                    </div>
                    {change.reason && (
                      <div className="text-xs text-white/50 mt-0.5 italic">
                        {t("review.reason") || "Raison"} : {change.reason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(change.id)}
                      className="w-5 h-5 flex items-center justify-center rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                      title={t("review.accept") || "Accepter"}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleReject(change.id)}
                      className="w-5 h-5 flex items-center justify-center rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                      title={t("review.reject") || "Rejeter"}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
