"use client";
import React, { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CVImprovementPanel({ cvFile, refreshCount = 0, canRefresh = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cvData, setCvData] = useState(null);
  const [error, setError] = useState(null);
  const { t, language } = useLanguage();

  // Fonction pour charger les données
  const fetchCvData = React.useCallback(async () => {
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

  // Charger les données du CV dès que le composant est monté
  useEffect(() => {
    fetchCvData();
  }, [fetchCvData]);

  // Écouter les changements de score (événement déclenché par le MatchScore)
  useEffect(() => {
    const handleScoreUpdate = (event) => {
      // Recharger les données quand le score est mis à jour
      if (event.detail?.cvFile === cvFile) {
        console.log('[CVImprovementPanel] Score mis à jour, rechargement des données...');
        fetchCvData();
      }
    };

    window.addEventListener('score:updated', handleScoreUpdate);
    window.addEventListener('cv:selected', fetchCvData);

    return () => {
      window.removeEventListener('score:updated', handleScoreUpdate);
      window.removeEventListener('cv:selected', fetchCvData);
    };
  }, [cvFile, fetchCvData]);

  // Parser les données JSON
  const parseJson = (jsonString, defaultValue = null) => {
    if (!jsonString) return defaultValue;
    try {
      return JSON.parse(jsonString);
    } catch {
      return defaultValue;
    }
  };

  const suggestions = parseJson(cvData?.improvementSuggestions, []);
  const scoreBreakdown = parseJson(cvData?.scoreBreakdown, {});
  const missingSkills = parseJson(cvData?.missingSkills, []);
  const matchingSkills = parseJson(cvData?.matchingSkills, []);

  // Vérifier si le CV a été modifié après le dernier calcul de score
  const isModifiedAfterScore = () => {
    if (!cvData) return false;
    if (!cvData.matchScoreUpdatedAt) return true; // Pas de score calculé

    const updatedAt = new Date(cvData.updatedAt);
    const scoreUpdatedAt = new Date(cvData.matchScoreUpdatedAt);

    // Si le CV a été modifié après le calcul du score (avec une marge de 5 secondes)
    return updatedAt > new Date(scoreUpdatedAt.getTime() + 5000);
  };

  // Polling pour vérifier les mises à jour du score
  useEffect(() => {
    // Fonction pour vérifier si on a besoin de faire du polling
    const needsPolling = () => {
      if (!cvData) return true; // Pas encore de données

      // Si le CV a été modifié après le score et qu'on n'a pas encore de nouvelles suggestions
      if (isModifiedAfterScore() && (!cvData.improvementSuggestions || cvData.improvementSuggestions === '[]')) {
        return true;
      }

      return false;
    };

    if (needsPolling()) {
      const interval = setInterval(() => {
        console.log('[CVImprovementPanel] Polling pour nouvelles données...');
        fetchCvData();
      }, 2000); // Vérifier toutes les 2 secondes

      return () => clearInterval(interval);
    }
  }, [cvData, fetchCvData]);

  // État pour l'anti-spam sur le bouton "Améliorer automatiquement"
  const [isImproving, setIsImproving] = useState(false);

  // Polling pour détecter la fin de l'optimisation et recharger la page
  useEffect(() => {
    if (!cvData || cvData.optimiseStatus !== 'inprogress') return;

    console.log('[CVImprovementPanel] Polling activé - optimisation en cours...');

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/cv/metadata?file=${encodeURIComponent(cvFile)}`);
        if (!response.ok) return;

        const data = await response.json();
        console.log('[CVImprovementPanel] Polling status:', data.optimiseStatus);

        // Si l'optimisation est terminée (idle) ou a échoué (failed)
        if (data.optimiseStatus === 'idle') {
          console.log('[CVImprovementPanel] Optimisation terminée - rechargement de la page...');
          clearInterval(interval);

          // RECHARGEMENT COMPLET DE LA PAGE
          window.location.reload();
        } else if (data.optimiseStatus === 'failed') {
          console.error('[CVImprovementPanel] Optimisation échouée');
          clearInterval(interval);
          setCvData(data); // Mettre à jour pour afficher l'erreur
          setIsImproving(false);
        }
      } catch (error) {
        console.error('[CVImprovementPanel] Erreur polling:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [cvData?.optimiseStatus, cvFile]);

  // Calculer le nombre d'actions restantes (partagé avec le calcul de score)
  const actionsLeft = 5 - refreshCount;

  // Vérifier si le bouton doit être grisé
  const shouldDisableButton =
    cvData?.matchScoreStatus === 'inprogress' ||
    cvData?.optimiseStatus === 'inprogress';

  // Désactiver le bouton si pas de suggestions, si CV modifié après le score, ou si tâche en cours
  const canImprove = suggestions.length > 0 && !isModifiedAfterScore() && !shouldDisableButton;

  // Vérifier si plus de tokens disponibles
  const noTokensLeft = actionsLeft === 0;

  // Fonction pour obtenir la couleur selon la priorité
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Fonction pour obtenir la couleur du score
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 65) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  // Fonction pour lancer l'amélioration automatique
  const handleImprove = async () => {
    // Anti-spam : empêcher les clics multiples
    if (isImproving) return;
    setIsImproving(true);

    try {
      const response = await fetch("/api/cv/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cvFile,
          analysisLevel: "deep", // Utiliser le niveau max pour l'amélioration
          replaceExisting: true, // Remplacer le CV existant au lieu d'en créer un nouveau
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setIsImproving(false);

        // Gestion spéciale pour la limite de rate
        if (response.status === 429) {
          alert(`⏱️ ${error.details || error.error}`);
          return;
        }

        throw new Error(error.error || "Erreur lors de l'amélioration");
      }

      // Fermer immédiatement la modal après avoir lancé le job
      setIsOpen(false);

      // Recharger les données pour obtenir le nouveau statut (optimiseStatus = 'inprogress')
      await fetchCvData();

      // Le polling détectera quand l'optimisation est terminée et rechargera la page
    } catch (err) {
      console.error("Erreur amélioration:", err);
      setIsImproving(false);
      alert(err.message);
    }
  };

  // Labels traduits
  const labels = {
    title: language === 'fr' ? "Analyse et Optimisation" : "Analysis & Optimization",
    matchScore: language === 'fr' ? "Score de correspondance" : "Match Score",
    scoreBreakdown: language === 'fr' ? "Détail du score" : "Score Breakdown",
    suggestions: language === 'fr' ? "Suggestions d'amélioration" : "Improvement Suggestions",
    missingSkills: language === 'fr' ? "Compétences manquantes" : "Missing Skills",
    matchingSkills: language === 'fr' ? "Compétences correspondantes" : "Matching Skills",
    technicalSkills: language === 'fr' ? "Compétences techniques" : "Technical Skills",
    experience: language === 'fr' ? "Expérience" : "Experience",
    education: language === 'fr' ? "Formation" : "Education",
    softSkills: language === 'fr' ? "Soft skills & langues" : "Soft Skills & Languages",
    priority: language === 'fr' ? "Priorité" : "Priority",
    impact: language === 'fr' ? "Impact" : "Impact",
    high: language === 'fr' ? "Haute" : "High",
    medium: language === 'fr' ? "Moyenne" : "Medium",
    low: language === 'fr' ? "Basse" : "Low",
    noData: language === 'fr' ? "Aucune donnée d'optimisation disponible" : "No optimization data available",
    loading: language === 'fr' ? "Chargement..." : "Loading...",
    close: language === 'fr' ? "Fermer" : "Close",
    optimize: language === 'fr' ? "🎯 Optimiser" : "🎯 Optimize",
    autoImprove: language === 'fr' ? "🚀 Améliorer automatiquement" : "🚀 Auto-Improve",
    improving: language === 'fr' ? "Amélioration en cours..." : "Improving...",
    improveSuccess: language === 'fr' ? "✅ CV amélioré ! Rechargement..." : "✅ CV improved! Reloading...",
    needNewScore: language === 'fr' ? "⚠️ Recalculer le score d'abord" : "⚠️ Recalculate score first",
    modifiedWarning: language === 'fr' ? "Le CV a été modifié. Recalculez le score pour pouvoir l'optimiser." : "CV has been modified. Recalculate the score to enable optimization.",
    improvementInProgress: language === 'fr' ? "⏳ Amélioration en cours..." : "⏳ Improvement in progress...",
    calculatingScore: language === 'fr' ? "📊 Calcul du score en cours..." : "📊 Calculating score...",
  };

  // Fonction pour la couleur du badge selon les actions restantes
  const getBadgeColor = () => {
    if (actionsLeft === 0) return "bg-gray-400";
    if (actionsLeft === 1) return "bg-red-500";
    if (actionsLeft === 2) return "bg-orange-500";
    if (actionsLeft === 3) return "bg-yellow-500";
    return "bg-green-500";
  };

  // Ne pas afficher le bouton si:
  // 1. On a fini de charger ET il n'y a pas de données
  // 2. Le CV a été modifié après le calcul du score (sauf si une tâche est en cours)
  if (!loading && cvData && !cvData.matchScore && !cvData.improvementSuggestions) {
    return null;
  }

  // Si le CV a été modifié ET qu'aucune tâche n'est en cours, ne pas afficher le bouton
  if (isModifiedAfterScore() && !shouldDisableButton) {
    return null;
  }

  return (
    <>
      {/* Bouton d'ouverture en petite bulle circulaire */}
      <button
        onClick={() => setIsOpen(true)}
        disabled={shouldDisableButton || noTokensLeft}
        className={`
          w-9 h-9 rounded-full flex items-center justify-center
          shadow-lg border transition-all duration-300
          ${shouldDisableButton
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed animate-pulse opacity-60'
            : noTokensLeft
            ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50 grayscale'
            : 'bg-white border-neutral-200 cursor-pointer hover:shadow-xl'
          }
        `}
        title={shouldDisableButton
          ? (cvData?.optimiseStatus === 'inprogress' ? labels.improvementInProgress : labels.calculatingScore)
          : noTokensLeft
          ? (language === 'fr' ? '❌ Plus de tokens disponibles' : '❌ No tokens left')
          : labels.title}
      >
        <span className={`text-base leading-none ${shouldDisableButton ? 'animate-bounce' : ''}`}>
          {shouldDisableButton ? '📈' : '🎯'}
        </span>
      </button>

      {/* Modal avec les suggestions */}
      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={labels.title}
        size="large"
      >
        <div className="p-4 space-y-6">
          {loading && (
            <div className="text-center py-8 text-gray-500">
              {labels.loading}
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              {error}
            </div>
          )}

          {!loading && !error && cvData && (
            <>
              {/* Score principal */}
              {cvData.matchScore !== null && (
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">{labels.matchScore}</div>
                  <div className={`text-5xl font-bold ${getScoreColor(cvData.matchScore)}`}>
                    {cvData.matchScore}
                  </div>
                </div>
              )}

              {/* Détail du score */}
              {Object.keys(scoreBreakdown).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">{labels.scoreBreakdown}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{labels.technicalSkills}:</span>
                      <span className="font-medium">{scoreBreakdown.technical_skills || 0}/35</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{labels.experience}:</span>
                      <span className="font-medium">{scoreBreakdown.experience || 0}/30</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{labels.education}:</span>
                      <span className="font-medium">{scoreBreakdown.education || 0}/20</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>{labels.softSkills}:</span>
                      <span className="font-medium">{scoreBreakdown.soft_skills || 0}/15</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions d'amélioration */}
              {suggestions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">{labels.suggestions}</h3>
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${getPriorityColor(suggestion.priority)}`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-semibold uppercase">
                            {labels.priority}: {labels[suggestion.priority?.toLowerCase()] || suggestion.priority}
                          </span>
                          {suggestion.impact && (
                            <span className="text-xs font-medium">
                              {labels.impact}: {suggestion.impact}
                            </span>
                          )}
                        </div>
                        <p className="text-sm">{suggestion.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compétences manquantes */}
              {missingSkills.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-red-600">{labels.missingSkills}</h3>
                  <div className="flex flex-wrap gap-2">
                    {missingSkills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Compétences correspondantes */}
              {matchingSkills.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 text-green-600">{labels.matchingSkills}</h3>
                  <div className="flex flex-wrap gap-2">
                    {matchingSkills.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                      >
                        ✓ {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Message si aucune donnée */}
              {!cvData.matchScore && suggestions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {labels.noData}
                </div>
              )}
            </>
          )}

          {/* Boutons d'action */}
          <div className="flex justify-between items-center pt-4 border-t">
            {/* Bouton amélioration automatique */}
            {suggestions.length > 0 && (
              <>
                {noTokensLeft ? (
                  // Plus de tokens disponibles
                  <div className="flex flex-col items-center gap-2">
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-400 cursor-not-allowed grayscale"
                    >
                      {labels.autoImprove}
                    </button>
                    <p className="text-sm text-red-600 text-center">
                      {language === 'fr' ? '❌ Plus de tokens disponibles' : '❌ No tokens left'}
                    </p>
                  </div>
                ) : shouldDisableButton || isImproving ? (
                  // Amélioration ou calcul en cours
                  <button
                    disabled
                    className="px-4 py-2 rounded-lg font-medium bg-gray-300 text-gray-500 cursor-not-allowed animate-pulse"
                  >
                    {cvData?.optimiseStatus === 'inprogress' || isImproving
                      ? labels.improvementInProgress
                      : labels.calculatingScore}
                  </button>
                ) : canImprove ? (
                  // Bouton actif
                  <button
                    onClick={handleImprove}
                    disabled={isImproving}
                    className="px-4 py-2 rounded-lg font-medium transition-all bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {labels.autoImprove}
                  </button>
                ) : (
                  // CV modifié, besoin de recalculer le score
                  <div className="flex flex-col items-center gap-2">
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg font-medium bg-gray-300 text-gray-500 cursor-not-allowed"
                    >
                      {labels.needNewScore}
                    </button>
                    <p className="text-sm text-orange-600 text-center">
                      {labels.modifiedWarning}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Spacer si pas de bouton amélioration */}
            {suggestions.length === 0 && <div />}

            {/* Bouton fermer */}
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              {labels.close}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}