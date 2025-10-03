"use client";
import React from "react";
import { useHighlight } from "./HighlightProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function HighlightToggle() {
  const { isHighlightEnabled, toggleHighlight, isImprovedCv, changesMade } = useHighlight();
  const { language } = useLanguage();

  // Ne pas afficher si ce n'est pas un CV amélioré
  if (!isImprovedCv || !changesMade || changesMade.length === 0) {
    return null;
  }

  const labels = {
    showChanges: language === 'fr' ? "Voir les modifications" : "Show changes",
    hideChanges: language === 'fr' ? "Masquer les modifications" : "Hide changes",
  };

  return (
    <button
      onClick={toggleHighlight}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
        isHighlightEnabled
          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
      }`}
      title={isHighlightEnabled ? labels.hideChanges : labels.showChanges}
    >
      <span className="text-base">
        {isHighlightEnabled ? '👁️' : '👁️‍🗨️'}
      </span>
      <span className="font-medium">
        {isHighlightEnabled ? labels.hideChanges : labels.showChanges}
      </span>
      {changesMade.length > 0 && (
        <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
          isHighlightEnabled
            ? 'bg-yellow-200 text-yellow-800'
            : 'bg-gray-200 text-gray-700'
        }`}>
          {changesMade.length}
        </span>
      )}
    </button>
  );
}