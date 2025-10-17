"use client";
import React, { useState } from "react";
import Modal from "./ui/Modal";
import { useHighlight } from "./HighlightProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";

export default function ChangesPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { changesMade, isImprovedCv } = useHighlight();
  const { language } = useLanguage();
  const { settings } = useSettings();

  // Ne pas afficher si la feature est désactivée
  if (!settings.feature_history) {
    return null;
  }

  // Ne pas afficher si ce n'est pas un CV amélioré ou s'il n'y a pas de changements
  if (!isImprovedCv || !changesMade || changesMade.length === 0) {
    return null;
  }

  const labels = {
    title: language === 'fr' ? "Historique des modifications" : "Change History",
    button: language === 'fr' ? "📝 Historique" : "📝 History",
    section: language === 'fr' ? "Section" : "Section",
    change: language === 'fr' ? "Modification" : "Change",
    reason: language === 'fr' ? "Raison" : "Reason",
    close: language === 'fr' ? "Fermer" : "Close",
    noChanges: language === 'fr' ? "Aucune modification enregistrée" : "No changes recorded",
  };

  // Grouper les changements par section
  const changesBySection = changesMade.reduce((acc, change) => {
    if (!acc[change.section]) {
      acc[change.section] = [];
    }
    acc[change.section].push(change);
    return acc;
  }, {});

  const getSectionLabel = (section) => {
    const sectionLabels = {
      summary: language === 'fr' ? "Résumé" : "Summary",
      skills: language === 'fr' ? "Compétences" : "Skills",
      experience: language === 'fr' ? "Expérience" : "Experience",
      education: language === 'fr' ? "Formation" : "Education",
      languages: language === 'fr' ? "Langues" : "Languages",
      projects: language === 'fr' ? "Projets" : "Projects",
    };
    return sectionLabels[section] || section;
  };

  return (
    <>
      {/* Bouton d'ouverture */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-white/20 hover:bg-white/30 backdrop-blur-xl border-2 border-white/30 hover:border-white/40 rounded-lg shadow-2xl hover:shadow-xl transition-all duration-200 drop-shadow"
        title={labels.title}
      >
        {labels.button}
        <span className="px-1.5 py-0.5 text-xs bg-white/30 text-white rounded-full border border-white/40">
          {changesMade.length}
        </span>
      </button>

      {/* Modal avec l'historique */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={labels.title}
        size="large"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(changesBySection).length === 0 ? (
            <p className="text-white/60 text-center py-8 drop-shadow">{labels.noChanges}</p>
          ) : (
            Object.entries(changesBySection).map(([section, changes]) => (
              <div key={section} className="border-l-4 border-emerald-300/50 pl-4">
                <h3 className="font-semibold text-emerald-300 mb-2 drop-shadow">
                  {getSectionLabel(section)}
                </h3>
                <div className="space-y-2">
                  {changes.map((change, index) => (
                    <div key={index} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3">
                      {change.change && (
                        <p className="text-sm text-white drop-shadow">
                          <span className="font-medium text-emerald-300">{labels.change}:</span> {change.change}
                        </p>
                      )}
                      {change.reason && (
                        <p className="text-xs text-white/70 mt-1 italic drop-shadow">
                          <span className="font-medium">{labels.reason}:</span> {change.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bouton fermer */}
        <div className="flex justify-end pt-4 border-t border-white/20">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border-2 border-white/40 rounded-lg transition-all duration-200 text-white font-medium text-sm drop-shadow"
          >
            {labels.close}
          </button>
        </div>
      </Modal>
    </>
  );
}