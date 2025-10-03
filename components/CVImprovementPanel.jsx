"use client";
import React, { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function CVImprovementPanel({ cvFile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cvData, setCvData] = useState(null);
  const [error, setError] = useState(null);
  const [isImproving, setIsImproving] = useState(false);
  const [improveSuccess, setImproveSuccess] = useState(false);
  const { t, language } = useLanguage();

  // Charger les données du CV dès que le composant est monté
  useEffect(() => {
    if (!cvFile) return;

    async function fetchCvData() {
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
    }

    fetchCvData();
  }, [cvFile]); // Retirer isOpen de la dépendance pour charger dès le montage

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
    setIsImproving(true);
    setImproveSuccess(false);
    try {
      const response = await fetch("/api/cv/improve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cvFile,
          analysisLevel: "deep", // Utiliser le niveau max pour l'amélioration
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'amélioration");
      }

      const data = await response.json();
      setImproveSuccess(true);

      // Rafraîchir la page après 3 secondes pour voir le nouveau CV
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err) {
      console.error("Erreur amélioration:", err);
      alert(err.message);
    } finally {
      setIsImproving(false);
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
  };

  // Ne pas afficher le bouton seulement si on a fini de charger ET qu'il n'y a pas de données
  // Pendant le chargement initial (loading=true, cvData=null), on affiche quand même le bouton
  if (!loading && cvData && !cvData.matchScore && !cvData.improvementSuggestions) {
    return null;
  }

  return (
    <>
      {/* Bouton d'ouverture */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
        title={labels.title}
      >
        {labels.optimize}
      </button>

      {/* Modal avec les suggestions */}
      <Modal
        isOpen={isOpen}
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
                    {cvData.matchScore}/100
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
            {suggestions.length > 0 && !improveSuccess && (
              <button
                onClick={handleImprove}
                disabled={isImproving}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isImproving
                    ? 'bg-gray-300 text-gray-500 cursor-wait'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-lg'
                }`}
              >
                {isImproving ? labels.improving : labels.autoImprove}
              </button>
            )}

            {/* Message de succès */}
            {improveSuccess && (
              <div className="text-green-600 font-medium animate-pulse">
                {labels.improveSuccess}
              </div>
            )}

            {/* Spacer si pas de bouton amélioration */}
            {(suggestions.length === 0 || improveSuccess) && <div />}

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