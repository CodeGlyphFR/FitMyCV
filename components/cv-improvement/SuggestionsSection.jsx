"use client";

import React from "react";

/**
 * Composant pour afficher et sélectionner les suggestions d'amélioration
 */
export default function SuggestionsSection({
  suggestions,
  selectedSuggestions,
  suggestionContexts,
  onToggleSuggestion,
  onUpdateContext,
  labels,
  t
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="animate-slide-in-right">
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-4 flex items-center gap-2">
          <span>💡</span>
          {labels.suggestions}
        </h3>
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => {
            const isSelected = selectedSuggestions.has(index);
            const priorityLower = suggestion.priority?.toLowerCase();

            return (
              <div
                key={index}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => onToggleSuggestion(index)}
                className={`p-3 rounded-xl border-l-4 transition-all duration-300 cursor-pointer animate-scale-in ${
                  priorityLower === 'high'
                    ? isSelected
                      ? 'bg-red-500/30 border-red-500 ring-2 ring-red-500/50 ring-inset'
                      : 'bg-red-500/10 border-red-500 hover:bg-red-500/20'
                    : priorityLower === 'medium'
                    ? isSelected
                      ? 'bg-yellow-500/30 border-yellow-500 ring-2 ring-yellow-500/50 ring-inset'
                      : 'bg-yellow-500/10 border-yellow-500 hover:bg-yellow-500/20'
                    : isSelected
                      ? 'bg-green-500/30 border-green-500 ring-2 ring-green-500/50 ring-inset'
                      : 'bg-green-500/10 border-green-500 hover:bg-green-500/20'
                }`}
              >
                <div className="flex items-start justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-2">
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                      isSelected
                        ? priorityLower === 'high'
                          ? 'bg-red-500 border-red-500'
                          : priorityLower === 'medium'
                          ? 'bg-yellow-500 border-yellow-500'
                          : 'bg-green-500 border-green-500'
                        : 'border-white/40 bg-transparent'
                    }`}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${
                      priorityLower === 'high'
                        ? 'bg-red-500/30 text-white'
                        : priorityLower === 'medium'
                        ? 'bg-yellow-500/30 text-white'
                        : 'bg-green-500/30 text-white'
                    } ${priorityLower === 'high' && !isSelected ? 'animate-pulse' : ''}`}>
                      {priorityLower === 'high' ? '🔥' :
                       priorityLower === 'medium' ? '⚡' : '✨'}
                      {labels[priorityLower] || suggestion.priority}
                    </span>
                  </div>
                  {suggestion.impact && (
                    <span className="text-[10px] font-semibold text-white whitespace-nowrap bg-white/10 px-2 py-0.5 rounded-full">
                      {suggestion.impact}
                    </span>
                  )}
                </div>
                {suggestion.title && (
                  <h4 className="text-sm font-semibold text-white mb-1">
                    {suggestion.title}
                  </h4>
                )}
                <p className="text-xs leading-relaxed text-white/80 break-words">
                  {suggestion.suggestion}
                </p>
                {/* Champ contexte visible quand la suggestion est sélectionnée */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <textarea
                      onClick={(e) => e.stopPropagation()}
                      value={suggestionContexts.get(index) || ''}
                      onChange={(e) => onUpdateContext(index, e.target.value)}
                      placeholder={t('optimization.contextPlaceholder') || 'Ajoutez du contexte (optionnel)...'}
                      maxLength={500}
                      rows={2}
                      className="w-full px-3 py-2 !text-xs !leading-relaxed bg-black/20 border border-white/10 rounded-lg text-white placeholder-white/40 resize-none focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/20"
                    />
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] text-white/40">
                        {(suggestionContexts.get(index) || '').length}/500
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Note sur la langue du contenu */}
        <div className="mt-4 text-center">
          <p className="text-xs text-white/60 italic">
            ℹ️ {t('optimization.languageNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
