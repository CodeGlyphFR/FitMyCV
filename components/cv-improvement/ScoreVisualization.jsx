"use client";

import React from "react";

/**
 * Fonction pour obtenir la couleur de fond du score
 */
function getScoreBgColor(score) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 65) return 'bg-yellow-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Fonction pour normaliser les scores
 */
function normalizeScore(score, maxScore) {
  if (!score || !maxScore) return 0;
  return Math.round((score / 100) * maxScore);
}

/**
 * Composant pour visualiser le score de matching du CV
 */
export default function ScoreVisualization({
  matchScore,
  animatedScore,
  scoreBreakdown,
  isAnimationReady,
  labels
}) {
  return (
    <div className="space-y-4 animate-slide-in-left">
      {/* Score principal avec cercle animé */}
      {matchScore !== null && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="text-center">
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-4">
              {labels.matchScore}
            </div>
            <div className="flex items-center justify-center gap-2">
              {/* Cercle de progression animé */}
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={
                        matchScore >= 80 ? '#22c55e' :
                        matchScore >= 65 ? '#eab308' :
                        matchScore >= 50 ? '#f97316' : '#ef4444'
                      } />
                      <stop offset="100%" stopColor={
                        matchScore >= 80 ? '#16a34a' :
                        matchScore >= 65 ? '#ca8a04' :
                        matchScore >= 50 ? '#ea580c' : '#dc2626'
                      } />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="url(#scoreGradient)"
                    strokeWidth="8"
                    fill="none"
                    pathLength="100"
                    strokeDasharray="100"
                    strokeDashoffset={100 - animatedScore}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                  />
                </svg>
                {/* Score au centre */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`absolute w-24 h-24 rounded-full ${getScoreBgColor(animatedScore)} shadow-lg transition-colors duration-300`} />
                  <div className="relative flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-white transition-all duration-300">
                      {animatedScore}
                    </span>
                    <span className="text-sm text-white/80 font-medium">/100</span>
                  </div>
                </div>
                {/* Effet shimmer sur score élevé */}
                {matchScore >= 90 && (
                  <div className="absolute inset-0 shimmer-bg rounded-full opacity-30" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Détail du score avec barres de progression */}
      {Object.keys(scoreBreakdown).length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-4">
            {labels.scoreBreakdown}
          </h3>
          <div className="space-y-3">
            {/* Compétences techniques */}
            <div style={{ animationDelay: '0.1s' }} className="animate-scale-in">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💻</span>
                  <span className="text-xs font-medium text-white">{labels.technicalSkills}</span>
                </div>
                <span className="text-xs font-bold text-white">
                  {normalizeScore(scoreBreakdown.technical_skills, 35)}/35
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: isAnimationReady ? `${(normalizeScore(scoreBreakdown.technical_skills, 35) / 35) * 100}%` : '0%',
                    transitionDelay: '0.2s'
                  }}
                />
              </div>
            </div>

            {/* Expérience */}
            <div style={{ animationDelay: '0.2s' }} className="animate-scale-in">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💼</span>
                  <span className="text-xs font-medium text-white">{labels.experience}</span>
                </div>
                <span className="text-xs font-bold text-white">
                  {normalizeScore(scoreBreakdown.experience, 30)}/30
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: isAnimationReady ? `${(normalizeScore(scoreBreakdown.experience, 30) / 30) * 100}%` : '0%',
                    transitionDelay: '0.3s'
                  }}
                />
              </div>
            </div>

            {/* Formation */}
            <div style={{ animationDelay: '0.3s' }} className="animate-scale-in">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎓</span>
                  <span className="text-xs font-medium text-white">{labels.education}</span>
                </div>
                <span className="text-xs font-bold text-white">
                  {normalizeScore(scoreBreakdown.education, 20)}/20
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: isAnimationReady ? `${(normalizeScore(scoreBreakdown.education, 20) / 20) * 100}%` : '0%',
                    transitionDelay: '0.4s'
                  }}
                />
              </div>
            </div>

            {/* Soft skills */}
            <div style={{ animationDelay: '0.4s' }} className="animate-scale-in">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <span className="text-xs font-medium text-white">{labels.softSkills}</span>
                </div>
                <span className="text-xs font-bold text-white">
                  {normalizeScore(scoreBreakdown.soft_skills_languages || scoreBreakdown.soft_skills, 15)}/15
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: isAnimationReady ? `${(normalizeScore(scoreBreakdown.soft_skills_languages || scoreBreakdown.soft_skills, 15) / 15) * 100}%` : '0%',
                    transitionDelay: '0.5s'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
