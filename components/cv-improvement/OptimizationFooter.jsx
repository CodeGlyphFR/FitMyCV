"use client";

import React from "react";
import CreditCostDisplay from "@/components/ui/CreditCostDisplay";

/**
 * Composant footer avec les boutons d'action et affichage des crédits
 */
export default function OptimizationFooter({
  suggestions,
  missingSkills,
  showCosts,
  optimizeCost,
  canOptimize,
  hasSelection,
  selectedCount,
  cvData,
  onImprove,
  onClose,
  labels,
  t
}) {
  return (
    <div className="flex-shrink-0">
      <div className="border-t border-white/10" />

      {/* Affichage du coût en crédits (mode crédits-only uniquement) */}
      {suggestions.length > 0 && showCosts && optimizeCost > 0 && (
        <div className="px-4 pt-4 md:px-6 md:pt-6">
          <CreditCostDisplay cost={optimizeCost} show={true} />
        </div>
      )}

      <div className="flex justify-center items-center gap-3 p-4 md:p-6">
        {/* Bouton amélioration automatique */}
        {(suggestions.length > 0 || missingSkills.length > 0) && (
          <>
            {!canOptimize ? (
              // Amélioration ou calcul en cours
              <button
                disabled
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-white/10 text-white/60 cursor-not-allowed animate-pulse inline-flex items-center gap-2"
              >
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {cvData?.optimiseStatus === 'inprogress'
                  ? labels.improvementInProgress
                  : labels.calculatingScore}
              </button>
            ) : !hasSelection ? (
              // Aucune sélection - bouton désactivé
              <button
                disabled
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-white/10 text-white/40 cursor-not-allowed"
                title={t('optimization.noSelection') || 'Sélectionnez au moins une amélioration'}
              >
                {labels.autoImprove}
              </button>
            ) : (
              // Bouton actif avec sélections
              <button
                onClick={onImprove}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white hover:shadow-lg transition-all duration-200"
              >
                {labels.autoImprove}
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                  {selectedCount}
                </span>
              </button>
            )}
          </>
        )}

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          {labels.close}
        </button>
      </div>
    </div>
  );
}
