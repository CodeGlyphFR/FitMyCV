"use client";

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Composant pour afficher les compétences correspondantes
 */
export default function MatchingSkillsSection({
  matchingSkills,
  visibleMatchingSkills,
  hiddenMatchingCount,
  showAllMatchingSkills,
  setShowAllMatchingSkills,
  labels
}) {
  if (matchingSkills.length === 0) return null;

  return (
    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 animate-scale-in">
      <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span>✅</span>
        {labels.matchingSkills}
      </h3>
      <div className="flex flex-wrap gap-2">
        {visibleMatchingSkills.map((skill, index) => (
          <span
            key={index}
            className="px-3 py-1 bg-green-500/20 text-white rounded-full text-xs font-medium border border-green-400/30 hover:scale-105 hover:bg-green-500/30 transition-all duration-200 inline-flex items-center gap-1"
          >
            <span className="text-green-300">✓</span>
            {skill}
          </span>
        ))}
        {/* Bouton toggle si plus de 5 skills */}
        {hiddenMatchingCount > 0 && (
          <button
            onClick={() => setShowAllMatchingSkills(!showAllMatchingSkills)}
            className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-medium border border-green-400/40 hover:bg-green-500/30 hover:border-green-400/60 transition-all duration-200 cursor-pointer inline-flex items-center gap-1"
          >
            {showAllMatchingSkills ? (
              <>
                <ChevronUp className="w-3 h-3" />
                {labels.showLess}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                +{hiddenMatchingCount} {labels.showMore}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
