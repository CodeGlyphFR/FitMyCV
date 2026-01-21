"use client";

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Composant pour afficher et sélectionner les compétences manquantes
 */
export default function MissingSkillsSection({
  missingSkills,
  visibleMissingSkills,
  hiddenMissingCount,
  showAllMissingSkills,
  setShowAllMissingSkills,
  selectedMissingSkills,
  openSkillMenu,
  setOpenSkillMenu,
  onSelectSkill,
  onDeselectSkill,
  skillLevels,
  labels,
  t
}) {
  if (missingSkills.length === 0) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 animate-scale-in">
      <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>❌</span>
        {labels.missingSkills}
      </h3>
      <div className="flex flex-wrap gap-2">
        {visibleMissingSkills.map((skill, index) => {
          const isSelected = selectedMissingSkills.has(skill);
          const selectedLevel = selectedMissingSkills.get(skill);
          const isMenuOpen = openSkillMenu === skill;

          return (
            <div key={index} className="relative">
              {isMenuOpen ? (
                // Dropdown inline pour sélectionner le niveau
                <div
                  data-skill-dropdown={skill}
                  className="relative z-20 flex flex-col bg-slate-800 rounded-lg border border-red-400/50 overflow-hidden min-w-[160px]"
                >
                  <div className="px-3 py-1.5 text-xs font-medium text-white border-b border-white/10 bg-slate-900/50">
                    {skill}
                  </div>
                  {/* Liste scrollable des niveaux - affiche 2 et scroll pour le reste */}
                  <div className="max-h-[76px] overflow-y-auto scrollbar-thin scrollbar-thumb-red-500/50 scrollbar-track-slate-700/30">
                    {skillLevels.map((level) => (
                      <button
                        key={level.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSkill(skill, level.value);
                        }}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-red-500/30 transition-colors ${
                          selectedLevel === level.value ? 'bg-red-500/40 text-white font-medium' : 'text-white/80'
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                  {/* Bouton désélectionner uniquement si déjà sélectionné */}
                  {isSelected && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeselectSkill(skill);
                      }}
                      className="px-3 py-1.5 text-xs text-center text-red-400 hover:bg-red-500/20 border-t border-white/10 transition-colors"
                    >
                      {t('optimization.deselect') || 'Désélectionner'}
                    </button>
                  )}
                </div>
              ) : isSelected ? (
                // Badge sélectionné avec niveau - reste rouge avec coche
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenSkillMenu(skill);
                  }}
                  className="flex flex-col items-start px-3 py-1.5 bg-red-400/20 text-white rounded-lg text-xs font-medium border border-red-400/40 hover:bg-red-400/30 transition-all duration-200 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    {/* Checkbox cochée */}
                    <div className="w-3.5 h-3.5 rounded border-2 border-red-400 bg-red-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {skill}
                  </span>
                  <span className="text-[10px] text-white/50 mt-0.5 ml-5">
                    {skillLevels.find(l => l.value === selectedLevel)?.label || selectedLevel}
                  </span>
                </button>
              ) : (
                // Badge normal (non sélectionné) avec checkbox vide
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenSkillMenu(skill);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-400/20 text-white rounded-lg text-xs font-medium border border-red-400/40 hover:bg-red-400/30 hover:border-red-400/60 transition-all duration-200 cursor-pointer"
                >
                  {/* Checkbox vide pour indiquer que c'est cliquable */}
                  <div className="w-3.5 h-3.5 rounded border-2 border-red-400/60 bg-transparent flex-shrink-0" />
                  {skill}
                </button>
              )}
            </div>
          );
        })}
        {/* Bouton toggle si plus de 5 skills */}
        {hiddenMissingCount > 0 && (
          <button
            onClick={() => setShowAllMissingSkills(!showAllMissingSkills)}
            className="px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-xs font-medium border border-red-400/40 hover:bg-red-500/30 hover:border-red-400/60 transition-all duration-200 cursor-pointer inline-flex items-center gap-1"
          >
            {showAllMissingSkills ? (
              <>
                <ChevronUp className="w-3 h-3" />
                {labels.showLess}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                +{hiddenMissingCount} {labels.showMore}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
