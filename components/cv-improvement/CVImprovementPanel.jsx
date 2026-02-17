"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { RefreshCw, X, BarChart3 } from "lucide-react";
import { parseApiError } from "@/lib/utils/errorHandler";
import { useCreditCost } from "@/hooks/useCreditCost";
import {
  ScoreVisualization,
  SuggestionsSection,
  MissingSkillsSection,
  MatchingSkillsSection,
  OptimizationFooter,
  useAnimatedScore,
  useModalAccessibility
} from "@/components/cv-improvement";

// Constantes
const SKILLS_VISIBLE_DEFAULT = 5;

// Niveaux de compétences disponibles
const getSkillLevels = (t) => [
  { value: 'awareness', label: t('skillLevels.awareness') || 'Notions' },
  { value: 'beginner', label: t('skillLevels.beginner') || 'Débutant' },
  { value: 'intermediate', label: t('skillLevels.intermediate') || 'Intermédiaire' },
  { value: 'proficient', label: t('skillLevels.proficient') || 'Compétent' },
  { value: 'advanced', label: t('skillLevels.advanced') || 'Avancé' },
  { value: 'expert', label: t('skillLevels.expert') || 'Expert' },
];

// Labels traduits
const getLabels = (t) => ({
  title: t('optimization.title'),
  matchScore: t('optimization.matchScore'),
  scoreBreakdown: t('optimization.scoreBreakdown'),
  suggestions: t('optimization.suggestions'),
  missingSkills: t('optimization.missingSkills'),
  matchingSkills: t('optimization.matchingSkills'),
  technicalSkills: t('optimization.technicalSkills'),
  experience: t('optimization.experience'),
  education: t('optimization.education'),
  softSkills: t('optimization.softSkills'),
  priority: t('optimization.priority'),
  impact: t('optimization.impact'),
  high: t('optimization.high'),
  medium: t('optimization.medium'),
  low: t('optimization.low'),
  noData: t('optimization.noData'),
  loading: t('optimization.loading'),
  close: t('optimization.close'),
  optimize: t('optimization.optimize'),
  autoImprove: t('optimization.autoImprove'),
  improving: t('optimization.improving'),
  improveSuccess: t('optimization.improveSuccess'),
  improvementInProgress: t('optimization.improvementInProgress'),
  calculatingScore: t('optimization.calculatingScore'),
  showMore: t('optimization.showMore'),
  showLess: t('optimization.showLess'),
});

// Helper pour parser JSON
const parseJson = (jsonString, defaultValue = null) => {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch {
    return defaultValue;
  }
};

export default function CVImprovementPanel({ cvFile, matchScoreStatus: parentMatchScoreStatus, optimiseStatus: parentOptimiseStatus }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cvData, setCvData] = useState(null);
  const [error, setError] = useState(null);
  const [isAnimationReady, setIsAnimationReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showAllMissingSkills, setShowAllMissingSkills] = useState(false);
  const [showAllMatchingSkills, setShowAllMatchingSkills] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState(new Set());
  const [selectedMissingSkills, setSelectedMissingSkills] = useState(new Map());
  const [openSkillMenu, setOpenSkillMenu] = useState(null);
  const [suggestionContexts, setSuggestionContexts] = useState(new Map());

  const { t } = useLanguage();
  const { settings } = useSettings();
  const { addNotification } = useNotifications();
  const { showCosts, getCost } = useCreditCost();
  const optimizeCost = getCost("optimize_cv");
  const isDraggingRef = useRef(false);

  const labels = getLabels(t);
  const skillLevels = getSkillLevels(t);

  // Hooks extraits
  const animatedScore = useAnimatedScore(isOpen, cvData?.matchScore);
  const { modalRef } = useModalAccessibility(isOpen, mounted, () => setIsOpen(false));

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fonction pour charger les données
  const fetchCvData = useCallback(async () => {
    if (!cvFile) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cv/metadata?file=${encodeURIComponent(cvFile)}`);
      if (!response.ok) throw new Error("Erreur lors du chargement");
      const data = await response.json();
      setCvData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cvFile]);

  // Charger les données au montage
  useEffect(() => {
    fetchCvData();
  }, [fetchCvData]);

  // Écouter les mises à jour temps réel du CV
  useEffect(() => {
    const handleRealtimeCvUpdate = () => {
      fetchCvData();
    };
    const handleTaskCompleted = (event) => {
      const task = event.detail?.task;
      if (task?.type === 'calculate-match-score') {
        fetchCvData();
      }
    };
    window.addEventListener('realtime:cv:metadata:updated', handleRealtimeCvUpdate);
    window.addEventListener('task:completed', handleTaskCompleted);
    return () => {
      window.removeEventListener('realtime:cv:metadata:updated', handleRealtimeCvUpdate);
      window.removeEventListener('task:completed', handleTaskCompleted);
    };
  }, [fetchCvData]);

  // Écouter l'événement onboarding pour ouvrir le panel
  useEffect(() => {
    const handleOpenOptimizer = () => {
      setIsOpen(true);
    };
    window.addEventListener('onboarding:open-optimizer', handleOpenOptimizer);
    return () => window.removeEventListener('onboarding:open-optimizer', handleOpenOptimizer);
  }, []);

  // Gérer le blur initial
  useEffect(() => {
    if (isOpen) {
      setIsAnimationReady(false);
      const timer = setTimeout(() => setIsAnimationReady(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsAnimationReady(false);
    }
  }, [isOpen]);

  // Fermer le dropdown skill quand on clique en dehors
  useEffect(() => {
    if (!openSkillMenu) return;
    const handleClickOutside = (e) => {
      const dropdown = document.querySelector(`[data-skill-dropdown="${openSkillMenu}"]`);
      if (dropdown && !dropdown.contains(e.target)) {
        setOpenSkillMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [openSkillMenu]);

  // Données parsées
  const suggestions = parseJson(cvData?.improvementSuggestions, []);
  const scoreBreakdown = parseJson(cvData?.scoreBreakdown, {});
  const missingSkills = parseJson(cvData?.missingSkills, []);
  const matchingSkills = parseJson(cvData?.matchingSkills, []);

  // Skills visibles avec toggle
  const visibleMissingSkills = showAllMissingSkills
    ? missingSkills
    : missingSkills.slice(0, SKILLS_VISIBLE_DEFAULT);
  const hiddenMissingCount = missingSkills.length - SKILLS_VISIBLE_DEFAULT;
  const visibleMatchingSkills = showAllMatchingSkills
    ? matchingSkills
    : matchingSkills.slice(0, SKILLS_VISIBLE_DEFAULT);
  const hiddenMatchingCount = matchingSkills.length - SKILLS_VISIBLE_DEFAULT;

  // États dérivés — le bouton utilise les props du Header (source de vérité, mis à jour au changement de CV)
  const shouldDisableButton = parentMatchScoreStatus === 'inprogress' || parentOptimiseStatus === 'inprogress';
  const canOptimize = parentOptimiseStatus !== 'inprogress';
  const hasSelection = selectedSuggestions.size > 0 || selectedMissingSkills.size > 0;
  const selectedCount = selectedSuggestions.size + selectedMissingSkills.size;

  // Handlers
  const toggleSuggestion = (index) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
        setSuggestionContexts(prevContexts => {
          const newContexts = new Map(prevContexts);
          newContexts.delete(index);
          return newContexts;
        });
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const updateSuggestionContext = (index, context) => {
    setSuggestionContexts(prev => {
      const newMap = new Map(prev);
      if (context.trim()) {
        newMap.set(index, context);
      } else {
        newMap.delete(index);
      }
      return newMap;
    });
  };

  const selectMissingSkill = (skill, level) => {
    setSelectedMissingSkills(prev => {
      const newMap = new Map(prev);
      newMap.set(skill, level);
      return newMap;
    });
    setOpenSkillMenu(null);
  };

  const deselectMissingSkill = (skill) => {
    setSelectedMissingSkills(prev => {
      const newMap = new Map(prev);
      newMap.delete(skill);
      return newMap;
    });
    setOpenSkillMenu(null);
  };

  const handleImprove = async () => {
    if (!canOptimize || !hasSelection) return;

    const missingSkillsToAdd = Array.from(selectedMissingSkills.entries()).map(([skill, level]) => ({
      skill,
      level
    }));

    const suggestionsWithContext = Array.from(selectedSuggestions).map(index => ({
      index,
      context: suggestionContexts.get(index) || ''
    }));

    try {
      const response = await fetch("/api/cv/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvFile,
          replaceExisting: true,
          suggestionsWithContext: suggestionsWithContext.length > 0 ? suggestionsWithContext : [],
          missingSkillsToAdd: missingSkillsToAdd.length > 0 ? missingSkillsToAdd : [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const apiError = parseApiError(response, errorData);

        if (response.status === 429) {
          alert(`⏱️ ${errorData.details || apiError.message}`);
          return;
        }

        if (apiError.actionRequired && apiError.redirectUrl) {
          setIsOpen(false);
          addNotification({
            type: 'error',
            message: apiError.message,
            redirectUrl: apiError.redirectUrl,
            linkText: t('notifications.viewOptions'),
            duration: 10000,
          });
          return;
        }

        throw new Error(apiError.message || t('errors.api.cv.improveError'));
      }

      setIsOpen(false);
    } catch (err) {
      addNotification({
        type: 'error',
        message: err.message || t('errors.api.cv.improveError'),
        duration: 5000,
      });
    }
  };

  // Conditions d'affichage
  if (!loading && cvData && !cvData.scoreBreakdown) return null;
  if (!settings.feature_optimize) return null;

  return (
    <>
      {/* Bouton d'ouverture */}
      <button
        data-onboarding="optimize"
        onClick={() => setIsOpen(true)}
        disabled={shouldDisableButton}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-md ios-blur-medium border-2 border-white/30 shadow-2xl gpu-accelerate transition-all duration-300 ${shouldDisableButton ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-xs-xl hover:bg-white/30'}`}
        title={shouldDisableButton
          ? (cvData?.optimiseStatus === 'inprogress' ? labels.improvementInProgress : labels.calculatingScore)
          : labels.title}
      >
        <span className={`transition-all duration-300 ${shouldDisableButton ? 'blur-sm' : 'blur-0'}`}>
          <img src="/icons/analyzer.svg" alt="Analyzer" className="h-4 w-4" />
        </span>
        {shouldDisableButton && (
          <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
            <RefreshCw className="w-4 h-4 text-white opacity-80 drop-shadow" strokeWidth={2.5} />
          </div>
        )}
      </button>

      {/* Modal */}
      {isOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="optimization-modal-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => { if (!isDraggingRef.current) setIsOpen(false); }}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            ref={modalRef}
            className="relative z-10 w-full max-w-4xl bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-9rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <style jsx>{`
              @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
              @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
              @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
              @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
              .animate-slide-in-left { animation: slideInLeft 0.5s ease-out forwards; }
              .animate-slide-in-right { animation: slideInRight 0.5s ease-out forwards; }
              .animate-scale-in { animation: scaleIn 0.4s ease-out forwards; }
              .shimmer-bg { background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%); background-size: 1000px 100%; animation: shimmer 3s infinite; }
            `}</style>

            {/* Header */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between p-4 md:p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h2 id="optimization-modal-title" className="text-lg font-bold text-white">
                    {labels.title}
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label={labels.close}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="border-b border-white/10" />
            </div>

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar"
              style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
              onTouchStart={() => { isDraggingRef.current = false; }}
              onTouchMove={() => { isDraggingRef.current = true; }}
              onTouchEnd={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
              onMouseDown={() => { isDraggingRef.current = false; }}
              onMouseMove={(e) => { if (e.buttons > 0) isDraggingRef.current = true; }}
              onMouseUp={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
            >
              <div className={`space-y-6 transition-all duration-300 ${!isAnimationReady && !loading ? 'blur-sm opacity-0' : 'blur-0 opacity-100'}`}>
                {loading && (
                  <div className="text-center py-12 text-white/70 text-sm">
                    <div className="inline-block w-8 h-8 border-4 border-white/30 border-t-blue-500 rounded-full animate-spin mb-3" />
                    <div>{labels.loading}</div>
                  </div>
                )}

                {error && (
                  <div className="text-center py-12">
                    <div className="text-white text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                      {error}
                    </div>
                  </div>
                )}

                {!loading && !error && cvData && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Score + Breakdown */}
                      <ScoreVisualization
                        matchScore={cvData.matchScore}
                        animatedScore={animatedScore}
                        scoreBreakdown={scoreBreakdown}
                        isAnimationReady={isAnimationReady}
                        labels={labels}
                      />

                      {/* Suggestions */}
                      <SuggestionsSection
                        suggestions={suggestions}
                        selectedSuggestions={selectedSuggestions}
                        suggestionContexts={suggestionContexts}
                        onToggleSuggestion={toggleSuggestion}
                        onUpdateContext={updateSuggestionContext}
                        labels={labels}
                        t={t}
                      />
                    </div>

                    {/* Skills sections */}
                    {(missingSkills.length > 0 || matchingSkills.length > 0) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <MissingSkillsSection
                          missingSkills={missingSkills}
                          visibleMissingSkills={visibleMissingSkills}
                          hiddenMissingCount={hiddenMissingCount}
                          showAllMissingSkills={showAllMissingSkills}
                          setShowAllMissingSkills={setShowAllMissingSkills}
                          selectedMissingSkills={selectedMissingSkills}
                          openSkillMenu={openSkillMenu}
                          setOpenSkillMenu={setOpenSkillMenu}
                          onSelectSkill={selectMissingSkill}
                          onDeselectSkill={deselectMissingSkill}
                          skillLevels={skillLevels}
                          labels={labels}
                          t={t}
                        />

                        <MatchingSkillsSection
                          matchingSkills={matchingSkills}
                          visibleMatchingSkills={visibleMatchingSkills}
                          hiddenMatchingCount={hiddenMatchingCount}
                          showAllMatchingSkills={showAllMatchingSkills}
                          setShowAllMatchingSkills={setShowAllMatchingSkills}
                          labels={labels}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Message si aucune donnée */}
                {!loading && !error && cvData && !cvData.matchScore && suggestions.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-white/40 text-5xl mb-4">📊</div>
                    <div className="text-white/70 text-sm font-medium">{labels.noData}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <OptimizationFooter
              suggestions={suggestions}
              missingSkills={missingSkills}
              showCosts={showCosts}
              optimizeCost={optimizeCost}
              canOptimize={canOptimize}
              hasSelection={hasSelection}
              selectedCount={selectedCount}
              cvData={cvData}
              onImprove={handleImprove}
              onClose={() => setIsOpen(false)}
              labels={labels}
              t={t}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
