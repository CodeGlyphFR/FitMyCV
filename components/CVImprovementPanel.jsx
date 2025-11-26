"use client";
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { RefreshCw, X, BarChart3 } from "lucide-react";
import { parseApiError } from "@/lib/utils/errorHandler";

export default function CVImprovementPanel({ cvFile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cvData, setCvData] = useState(null);
  const [error, setError] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isAnimationReady, setIsAnimationReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const { addNotification } = useNotifications();
  const animationRef = useRef(null);
  const scrollYRef = useRef(0);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const isDraggingRef = useRef(false);
  const router = useRouter();

  // Mount state for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Gestion du scroll body quand le modal est ouvert (pattern WelcomeModal)
  useEffect(() => {
    if (!isOpen || !mounted) return;

    scrollYRef.current = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.touchAction = 'none'; // iOS fix

    return () => {
      const currentTop = parseInt(document.body.style.top || '0', 10);
      const restoreY = Math.abs(currentTop);

      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.paddingRight = '';
      document.body.style.touchAction = '';

      window.scrollTo(0, restoreY);
    };
  }, [isOpen, mounted]);

  // Focus management - save and restore focus
  useEffect(() => {
    if (!isOpen || !mounted || !modalRef.current) return;

    // Sauvegarder le focus actuel
    previousFocusRef.current = document.activeElement;

    // Déplacer le focus vers le premier élément focusable
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      // Restaurer le focus
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, mounted]);

  // Focus trap - Tab key cycling
  useEffect(() => {
    if (!isOpen || !mounted || !modalRef.current) return;

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusableElements = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isOpen, mounted]);

  // Gestion de la touche Escape
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, mounted]);

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

  // Charger les données dès le montage pour savoir si le bouton doit être affiché
  useEffect(() => {
    fetchCvData();
  }, [fetchCvData]);

  // Écouter les mises à jour temps réel du CV
  useEffect(() => {
    const handleRealtimeCvUpdate = () => {
      console.log('[CVImprovementPanel] CV mis à jour en temps réel, rechargement des métadonnées...');
      fetchCvData();
    };

    window.addEventListener('realtime:cv:metadata:updated', handleRealtimeCvUpdate);
    return () => window.removeEventListener('realtime:cv:metadata:updated', handleRealtimeCvUpdate);
  }, [fetchCvData]);

  // Écouter l'événement onboarding pour ouvrir automatiquement le panel
  useEffect(() => {
    const handleOpenOptimizer = () => {
      console.log('[CVImprovementPanel] Événement onboarding:open-optimizer reçu, ouverture du panel');
      setIsOpen(true);
    };

    window.addEventListener('onboarding:open-optimizer', handleOpenOptimizer);
    return () => window.removeEventListener('onboarding:open-optimizer', handleOpenOptimizer);
  }, []);

  // Gérer le blur initial pour éviter le flicker
  useEffect(() => {
    if (isOpen) {
      // Réinitialiser l'état
      setIsAnimationReady(false);
      // Attendre que le navigateur ait rendu le DOM
      const timer = setTimeout(() => {
        setIsAnimationReady(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsAnimationReady(false);
    }
  }, [isOpen]);

  // Les données sont chargées au montage uniquement

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

  // Vérifier si une tâche est en cours (optimisation ou calcul de score)
  const shouldDisableButton =
    cvData?.matchScoreStatus === 'inprogress' ||
    cvData?.optimiseStatus === 'inprogress';

  // Bouton Optimiser est cliquable sauf si optimiseStatus === 'inprogress'
  const canOptimize = cvData?.optimiseStatus !== 'inprogress';

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

  // Fonction pour obtenir la couleur du score (texte)
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 65) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  // Fonction pour obtenir la couleur de fond du score
  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 65) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Fonction pour lancer l'amélioration automatique
  const handleImprove = async () => {
    // Bloquer si optimisation déjà en cours (sécurité anti-spam)
    if (!canOptimize) {
      console.log('[CVImprovementPanel] Optimisation déjà en cours, clic ignoré');
      return;
    }

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
        const errorData = await response.json();
        const apiError = parseApiError(response, errorData);

        // Gestion spéciale pour la limite de rate
        if (response.status === 429) {
          alert(`⏱️ ${errorData.details || apiError.message}`);
          return;
        }

        // Check if action is required (e.g., need to buy credits)
        if (apiError.actionRequired && apiError.redirectUrl) {
          setIsOpen(false);
          addNotification({
            type: 'error',
            message: apiError.message,
            redirectUrl: apiError.redirectUrl,
            linkText: 'Voir les options',
            duration: 10000,
          });
          return;
        }

        throw new Error(apiError.message || "Erreur lors de l'amélioration");
      }

      // Fermer la modal immédiatement - le job mettra à jour optimiseStatus dans Prisma
      setIsOpen(false);
    } catch (err) {
      console.error("Erreur amélioration:", err);
      addNotification({
        type: 'error',
        message: err.message || "Erreur lors de l'amélioration",
        duration: 5000,
      });
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
    optimize: language === 'fr' ? "Optimiser" : "Optimize",
    autoImprove: language === 'fr' ? "Améliorer automatiquement" : "Auto-Improve",
    improving: language === 'fr' ? "Amélioration en cours..." : "Improving...",
    improveSuccess: language === 'fr' ? "CV amélioré ! Rechargement..." : "CV improved! Reloading...",
    improvementInProgress: language === 'fr' ? "Amélioration en cours..." : "Improvement in progress...",
    calculatingScore: language === 'fr' ? "Calcul du score en cours..." : "Calculating score...",
  };

  // Fonction pour normaliser les scores (convertir de /100 à leurs échelles respectives)
  const normalizeScore = (score, maxScore) => {
    if (!score || !maxScore) return 0;
    return Math.round((score / 100) * maxScore);
  };

  // Animation count-up pour le score
  useEffect(() => {
    if (isOpen && cvData?.matchScore !== null) {
      const targetScore = cvData.matchScore;
      const duration = 1500; // 1.5 secondes
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentScore = Math.round(easeOut * targetScore);

        setAnimatedScore(currentScore);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setAnimatedScore(0);
    }
  }, [isOpen, cvData?.matchScore]);

  // Condition ultime d'affichage: afficher uniquement si scoreBreakdown existe dans la base ET si la feature est activée
  if (!loading && cvData && !cvData.scoreBreakdown) {
    return null;
  }

  // Ne pas afficher si la feature optimize est désactivée
  if (!settings.feature_optimize) {
    return null;
  }

  return (
    <>
      {/* Bouton d'ouverture en petite bulle circulaire */}
      <button
        data-onboarding="optimize"
        onClick={() => setIsOpen(true)}
        disabled={shouldDisableButton}
        className={`
          relative w-9 h-9 rounded-full flex items-center justify-center
          bg-white/20 backdrop-blur-md ios-blur-medium border-2 border-white/30 shadow-2xl gpu-accelerate
          transition-all duration-300
          ${shouldDisableButton
            ? 'cursor-not-allowed'
            : 'cursor-pointer hover:shadow-xl hover:bg-white/30'
          }
        `}
        title={shouldDisableButton
          ? (cvData?.optimiseStatus === 'inprogress' ? labels.improvementInProgress : labels.calculatingScore)
          : labels.title}
      >
        {/* Icône principale avec blur pendant le chargement */}
        <span
          className={`
            transition-all duration-300
            ${shouldDisableButton ? 'blur-sm' : 'blur-0'}
          `}
        >
          <img src="/icons/analyzer.png" alt="Analyzer" className="h-4 w-4" />
        </span>

        {/* Icône de chargement en rotation pendant le chargement */}
        {shouldDisableButton && (
          <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
            <RefreshCw
              className="w-4 h-4 text-white opacity-80 drop-shadow"
              strokeWidth={2.5}
            />
          </div>
        )}
      </button>

      {/* Modal avec les suggestions - Portal custom */}
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
            onClick={() => {
              if (isDraggingRef.current) return; // Prevent close after drag/scroll
              setIsOpen(false);
            }}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            ref={modalRef}
            className="relative z-10 w-full max-w-4xl bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <style jsx>{`
              @keyframes slideInLeft {
                from {
                  opacity: 0;
                  transform: translateX(-30px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }

              @keyframes slideInRight {
                from {
                  opacity: 0;
                  transform: translateX(30px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }

              @keyframes scaleIn {
                from {
                  opacity: 0;
                  transform: scale(0.9);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }

              @keyframes shimmer {
                0% {
                  background-position: -1000px 0;
                }
                100% {
                  background-position: 1000px 0;
                }
              }

              .animate-slide-in-left {
                animation: slideInLeft 0.5s ease-out forwards;
              }

              .animate-slide-in-right {
                animation: slideInRight 0.5s ease-out forwards;
              }

              .animate-scale-in {
                animation: scaleIn 0.4s ease-out forwards;
              }

              .shimmer-bg {
                background: linear-gradient(
                  90deg,
                  rgba(255, 255, 255, 0) 0%,
                  rgba(255, 255, 255, 0.3) 50%,
                  rgba(255, 255, 255, 0) 100%
                );
                background-size: 1000px 100%;
                animation: shimmer 3s infinite;
              }
            `}</style>

            {/* Header */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between p-4 md:p-6">
                <div className="flex items-center gap-3">
                  {/* Icône ronde */}
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                  </div>
                  {/* Titre */}
                  <h2 id="optimization-modal-title" className="text-lg font-bold text-white">
                    {labels.title}
                  </h2>
                </div>
                {/* Bouton fermer (X) */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label={labels.close}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Divider */}
              <div className="border-b border-white/10" />
            </div>

            {/* Content - Scrollable */}
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                      {/* COLONNE GAUCHE : Score + Breakdown */}
                      <div className="space-y-4 animate-slide-in-left">
                        {/* Score principal avec cercle animé */}
                        {cvData.matchScore !== null && (
                          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <div className="text-center">
                              <div className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-4">
                                {labels.matchScore}
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                {/* Cercle de progression animé */}
                                <div className="relative w-32 h-32">
                                  <svg className="w-32 h-32 transform -rotate-90">
                                    {/* Cercle de fond avec dégradé */}
                                    <defs>
                                      <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={
                                          cvData.matchScore >= 80 ? '#22c55e' :
                                          cvData.matchScore >= 65 ? '#eab308' :
                                          cvData.matchScore >= 50 ? '#f97316' : '#ef4444'
                                        } />
                                        <stop offset="100%" stopColor={
                                          cvData.matchScore >= 80 ? '#16a34a' :
                                          cvData.matchScore >= 65 ? '#ca8a04' :
                                          cvData.matchScore >= 50 ? '#ea580c' : '#dc2626'
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
                                    {/* Cercle de progression avec gradient */}
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
                                  {/* Score au centre avec animation et fond coloré */}
                                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    {/* Cercle de fond coloré selon le score */}
                                    <div className={`absolute w-24 h-24 rounded-full ${getScoreBgColor(animatedScore)} shadow-lg transition-colors duration-300`} />
                                    {/* Contenu du score */}
                                    <div className="relative flex flex-col items-center justify-center">
                                      <span className="text-4xl font-bold text-white transition-all duration-300">
                                        {animatedScore}
                                      </span>
                                      <span className="text-sm text-white/80 font-medium">/100</span>
                                    </div>
                                  </div>
                                  {/* Effet shimmer sur score élevé */}
                                  {cvData.matchScore >= 90 && (
                                    <div className="absolute inset-0 shimmer-bg rounded-full opacity-30" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Détail du score avec barres de progression animées */}
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

                      {/* COLONNE DROITE : Suggestions */}
                      <div className="animate-slide-in-right">
                        {/* Suggestions d'amélioration */}
                        {suggestions.length > 0 && (
                          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-4 flex items-center gap-2">
                              <span>💡</span>
                              {labels.suggestions}
                            </h3>
                            <div className="space-y-2">
                              {suggestions.map((suggestion, index) => (
                                <div
                                  key={index}
                                  style={{ animationDelay: `${index * 0.1}s` }}
                                  className={`
                                    p-3 rounded-xl border-l-4 transition-all duration-300 hover:-translate-y-0.5
                                    ${suggestion.priority?.toLowerCase() === 'high'
                                      ? 'bg-red-500/10 border-red-500 hover:bg-red-500/20'
                                      : suggestion.priority?.toLowerCase() === 'medium'
                                      ? 'bg-yellow-500/10 border-yellow-500 hover:bg-yellow-500/20'
                                      : 'bg-green-500/10 border-green-500 hover:bg-green-500/20'
                                    }
                                    animate-scale-in
                                  `}
                                >
                                  <div className="flex items-start justify-between mb-1.5 gap-2">
                                    <span className={`
                                      inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap
                                      ${suggestion.priority?.toLowerCase() === 'high'
                                        ? 'bg-red-500/30 text-white animate-pulse'
                                        : suggestion.priority?.toLowerCase() === 'medium'
                                        ? 'bg-yellow-500/30 text-white'
                                        : 'bg-green-500/30 text-white'
                                      }
                                    `}>
                                      {suggestion.priority?.toLowerCase() === 'high' ? '🔥' :
                                       suggestion.priority?.toLowerCase() === 'medium' ? '⚡' : '✨'}
                                      {labels[suggestion.priority?.toLowerCase()] || suggestion.priority}
                                    </span>
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
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section compétences en bas - 2 colonnes */}
                    {(missingSkills.length > 0 || matchingSkills.length > 0) && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Compétences manquantes (bas gauche) */}
                        {missingSkills.length > 0 && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 animate-scale-in">
                            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <span>❌</span>
                              {labels.missingSkills}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {missingSkills.map((skill, index) => (
                                <span
                                  key={index}
                                  style={{ animationDelay: `${index * 0.05}s` }}
                                  className="
                                    px-3 py-1 bg-red-500/20 text-white
                                    rounded-full text-xs font-medium border border-red-400/30
                                    hover:scale-105 hover:bg-red-500/30 transition-all duration-200
                                    animate-scale-in
                                  "
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Compétences correspondantes (bas droite) */}
                        {matchingSkills.length > 0 && (
                          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 animate-scale-in">
                            <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                              <span>✅</span>
                              {labels.matchingSkills}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {matchingSkills.map((skill, index) => (
                                <span
                                  key={index}
                                  style={{ animationDelay: `${index * 0.05}s` }}
                                  className="
                                    px-3 py-1 bg-green-500/20 text-white
                                    rounded-full text-xs font-medium border border-green-400/30
                                    hover:scale-105 hover:bg-green-500/30 transition-all duration-200
                                    animate-scale-in inline-flex items-center gap-1
                                  "
                                >
                                  <span className="text-green-300">✓</span>
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
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

            {/* Footer avec divider */}
            <div className="flex-shrink-0">
              <div className="border-t border-white/10" />
              <div className="flex justify-center items-center gap-3 p-4 md:p-6">
                {/* Bouton amélioration automatique */}
                {suggestions.length > 0 && (
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
                    ) : (
                      // Bouton actif
                      <button
                        onClick={handleImprove}
                        className="
                          px-6 py-2.5 rounded-lg text-sm font-semibold
                          bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600
                          text-white hover:shadow-lg
                          transition-all duration-200
                        "
                      >
                        {labels.autoImprove}
                      </button>
                    )}
                  </>
                )}

                {/* Bouton fermer */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="
                    px-4 py-2.5 text-sm
                    text-slate-400 hover:text-white
                    transition-colors
                  "
                >
                  {labels.close}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}