'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingSteps } from '@/lib/onboarding/useOnboardingSteps';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Checklist flottante pour afficher la progression de l'onboarding
 * Design style Stripe - fond solide, sans blur
 *
 * Position : Fixed bottom-right
 * État : Collapse/expand avec persistence localStorage
 */
export default function ChecklistPanel() {
  const { t } = useLanguage();
  const ONBOARDING_STEPS = useOnboardingSteps();

  const {
    currentStep,
    completedSteps,
    isActive,
    hasCompleted,
    checklistExpanded,
    toggleChecklist,
    skipOnboarding,
  } = useOnboarding();

  // Détection mobile (< 768px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Ne pas afficher si onboarding pas actif
  if (!isActive) return null;

  // Calculer le nombre effectif d'étapes complétées
  const effectiveCompletedCount = Math.max(completedSteps.length, currentStep - 1);

  // Calculer progression sur le nombre total d'étapes (dynamique)
  const totalSteps = ONBOARDING_STEPS.length; // 8
  const progress = Math.round((effectiveCompletedCount / totalSteps) * 100);

  // Étape courante
  const currentStepData = ONBOARDING_STEPS[currentStep - 1];

  /**
   * Handler skip avec confirmation
   */
  const handleSkip = () => {
    const confirmed = confirm(t('onboarding.common.checklist.confirmSkip'));
    if (confirmed) {
      skipOnboarding();
    }
  };

  /**
   * Icône checkmark pour étape complétée
   */
  const CheckIcon = () => (
    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );

  /**
   * Icône cercle pour étape en cours (avec pulse)
   */
  const CurrentIcon = () => (
    <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-emerald-500 animate-pulse" />
  );

  /**
   * Icône cercle gris pour étape à venir
   */
  const UpcomingIcon = () => (
    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-600" />
  );

  /**
   * Donut progress pour mode mobile réduit
   * Taille: 36px, avec pourcentage au centre
   */
  const DonutProgress = ({ percentage }) => {
    const size = 36;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(51, 65, 85)"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgb(16, 185, 129)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {/* Percentage text */}
        <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-medium">
          {percentage}%
        </span>
      </div>
    );
  };

  // Mode mobile réduit : affichage compact
  const isMobileCollapsed = isMobile && !checklistExpanded;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`fixed bg-[rgb(2,6,23)] border border-white/20 shadow-2xl z-[10001] overflow-hidden ${
        isMobileCollapsed
          ? 'bottom-4 right-20 rounded-full px-2 py-1.5'
          : 'bottom-6 right-20 w-80 rounded-xl'
      }`}
      role="region"
      aria-label={t('onboarding.common.checklist.progressLabel')}
      aria-live="polite"
    >
      {/* Mode mobile réduit : Donut + boutons uniquement */}
      {isMobileCollapsed ? (
        <div className="flex items-center gap-2">
          <DonutProgress percentage={progress} />
          {/* Bouton expand */}
          <button
            onClick={toggleChecklist}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t('onboarding.common.aria.expandChecklist')}
            aria-expanded={false}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>
          {/* Bouton close */}
          <button
            onClick={handleSkip}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={t('onboarding.common.aria.closeGuide')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-white font-semibold text-sm">{t('onboarding.common.checklist.title')}</h3>
            <div className="flex items-center gap-1">
              {/* Bouton expand/collapse */}
              <button
                onClick={toggleChecklist}
                className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={checklistExpanded ? t('onboarding.common.aria.collapseChecklist') : t('onboarding.common.aria.expandChecklist')}
                aria-expanded={checklistExpanded}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {checklistExpanded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
                  )}
                </svg>
              </button>
              {/* Bouton close (skip) */}
              <button
                onClick={handleSkip}
                className="p-1.5 rounded-sm text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={t('onboarding.common.aria.closeGuide')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar - toujours visible */}
          <div className="h-1 bg-slate-700">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Mode réduit desktop : En cours */}
          {!checklistExpanded && (
            <div className="px-4 py-3 flex items-baseline gap-2">
              <span className="text-slate-400 text-xs whitespace-nowrap">{t('onboarding.common.checklist.inProgress')}</span>
              <span className="text-emerald-400 text-sm truncate">
                {currentStepData?.title || t('onboarding.common.checklist.completed')}
              </span>
            </div>
          )}

          {/* Mode étendu : Liste des étapes */}
          {checklistExpanded && (
            <div className="p-4">
              <ul className="space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {ONBOARDING_STEPS.map((step, idx) => {
                  const stepNumber = idx + 1;
                  const isCompleted = completedSteps.includes(stepNumber) || stepNumber < currentStep;
                  const isCurrent = currentStep === stepNumber;

                  return (
                    <li
                      key={step.id}
                      className="flex items-center gap-3"
                      role="listitem"
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {/* Icône état */}
                      {isCompleted ? <CheckIcon /> : isCurrent ? <CurrentIcon /> : <UpcomingIcon />}

                      {/* Titre */}
                      <span
                        className={`text-sm ${
                          isCompleted
                            ? 'text-white'
                            : isCurrent
                            ? 'text-emerald-400 font-medium'
                            : 'text-slate-500'
                        }`}
                      >
                        {step.title}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* Bouton Skip */}
              {!hasCompleted && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <button
                    onClick={handleSkip}
                    className="w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {t('onboarding.common.checklist.skipTutorial')}
                  </button>
                </div>
              )}

              {/* Message de complétion */}
              {hasCompleted && (
                <div className="mt-4 pt-3 border-t border-white/10 text-center">
                  <span className="text-2xl">🎉</span>
                  <p className="text-white/90 text-sm mt-2">{t('onboarding.common.checklist.completed')}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.4);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.6);
        }
      `}</style>
    </motion.div>
  );
}
