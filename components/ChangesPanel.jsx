"use client";
import React, { useState } from "react";
import Modal from "./ui/Modal";
import { useHighlight } from "./HighlightProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function ChangesPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { changesMade, isImprovedCv } = useHighlight();
  const { language } = useLanguage();

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
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        title={labels.title}
      >
        {labels.button}
        <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 rounded-full">
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
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(changesBySection).length === 0 ? (
            <p className="text-gray-500 text-center py-8">{labels.noChanges}</p>
          ) : (
            Object.entries(changesBySection).map(([section, changes]) => (
              <div key={section} className="border-l-4 border-gray-200 pl-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {getSectionLabel(section)}
                </h3>
                <div className="space-y-2">
                  {changes.map((change, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      {change.change && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">{labels.change}:</span> {change.change}
                        </p>
                      )}
                      {change.reason && (
                        <p className="text-xs text-gray-500 mt-1 italic">
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
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {labels.close}
          </button>
        </div>
      </Modal>
    </>
  );
}