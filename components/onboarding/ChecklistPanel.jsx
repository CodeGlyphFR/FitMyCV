'use client';

import { motion } from 'framer-motion';
import { useOnboarding } from '@/hooks/useOnboarding';
import { ONBOARDING_STEPS } from '@/lib/onboarding/onboardingSteps';

/**
 * Checklist flottante pour afficher la progression de l'onboarding
 * Design style Stripe - fond solide, sans blur
 *
 * Position : Fixed bottom-right
 * État : Collapse/expand avec persistence localStorage
 */
export default function ChecklistPanel() {
  const {
    currentStep,
    completedSteps,
    isActive,
    hasCompleted,
    checklistExpanded,
    toggleChecklist,
    skipOnboarding,
  } = useOnboarding();

  // Ne pas afficher si onboarding pas actif
  if (!isActive) return null;

  // Calculer le nombre effectif d'étapes complétées
  const effectiveCompletedCount = Math.max(completedSteps.length, currentStep - 1);

  // Calculer progression sur 7 étapes
  const progress = Math.round((effectiveCompletedCount / 7) * 100);

  // Étape courante
  const currentStepData = ONBOARDING_STEPS[currentStep - 1];

  /**
   * Handler skip avec confirmation
   */
  const handleSkip = () => {
    const confirmed = confirm(
      'Êtes-vous sûr de vouloir passer le tutoriel ? Vous pourrez le relancer depuis les paramètres.'
    );
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="fixed bottom-6 right-20 w-80 bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl z-[10001] overflow-hidden"
      role="region"
      aria-label="Progression du tutoriel"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-white font-semibold text-sm">Guide de démarrage</h3>
        <div className="flex items-center gap-1">
          {/* Bouton expand/collapse */}
          <button
            onClick={toggleChecklist}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={checklistExpanded ? 'Réduire' : 'Agrandir'}
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
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Fermer le guide"
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

      {/* Mode réduit : Étape suivante */}
      {!checklistExpanded && (
        <div className="px-4 py-3 flex items-baseline gap-2">
          <span className="text-slate-400 text-xs whitespace-nowrap">Étape suivante</span>
          <span className="text-emerald-400 text-sm truncate">
            {currentStepData?.title || 'Terminé'}
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
                Passer le tutoriel
              </button>
            </div>
          )}

          {/* Message de complétion */}
          {hasCompleted && (
            <div className="mt-4 pt-3 border-t border-white/10 text-center">
              <span className="text-2xl">🎉</span>
              <p className="text-white/90 text-sm mt-2">Tutoriel complété !</p>
            </div>
          )}
        </div>
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
