'use client';

import { useOnboarding } from '@/hooks/useOnboarding';
import { ONBOARDING_STEPS } from '@/lib/onboarding/onboardingSteps';

/**
 * Checklist flottante pour afficher la progression de l'onboarding
 *
 * Position : Fixed top-left sous la topbar
 * État : Collapse/expand avec persistence localStorage
 * Contenu : Liste 9 étapes avec état visuel
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

  // Ne pas afficher si onboarding pas actif et pas complété
  if (!isActive && !hasCompleted) return null;

  // Calculer le nombre effectif d'étapes complétées
  // Inclut les steps explicitement complétés ET les steps implicitement complétés (avant currentStep)
  const effectiveCompletedCount = Math.max(completedSteps.length, currentStep - 1);

  // Calculer progression sur 7 étapes
  const progress = Math.round((effectiveCompletedCount / 7) * 100);

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

  return (
    <div
      className={`
        fixed bottom-3 right-20 w-80
        bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30 shadow-2xl
        z-[10001]
        origin-bottom
        transition-all duration-300
        ${checklistExpanded ? 'max-h-[600px]' : 'max-h-16'}
      `}
      role="region"
      aria-label="Progression du tutoriel"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/20">
        <div className="flex items-center gap-3">
          {/* Afficher l'étape en cours quand réduit, progression quand étendu */}
          {!checklistExpanded ? (
            <>
              <span className="text-2xl">
                {ONBOARDING_STEPS[currentStep - 1]?.emoji || '📚'}
              </span>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  Étape {currentStep}/7
                </h3>
                <p className="text-white/70 text-xs truncate max-w-[180px]">
                  {ONBOARDING_STEPS[currentStep - 1]?.title}
                </p>
              </div>
            </>
          ) : (
            <>
              <span className="text-2xl">📚</span>
              <div>
                <h3 className="text-white font-semibold text-sm">
                  Votre progression
                </h3>
                <p className="text-white/70 text-xs">
                  {effectiveCompletedCount}/7 étapes
                </p>
              </div>
            </>
          )}
        </div>

        {/* Bouton collapse/expand */}
        <button
          onClick={toggleChecklist}
          className="
            p-2 rounded-lg
            text-white/70 hover:text-white hover:bg-white/10
            transition-colors
          "
          aria-label={checklistExpanded ? 'Réduire' : 'Agrandir'}
          aria-expanded={checklistExpanded}
        >
          <svg
            className={`w-5 h-5 transition-transform ${
              checklistExpanded ? '' : 'rotate-180'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Contenu expansible */}
      {checklistExpanded && (
        <div className="p-4">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-white/70 mb-2">
              <span>Progression</span>
              <span className="font-semibold text-emerald-400">{progress}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Liste des étapes */}
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {ONBOARDING_STEPS.map((step, idx) => {
              const stepNumber = idx + 1;
              // Considérer les étapes précédentes comme complétées même si pas dans completedSteps
              // (au cas où l'état n'est pas restauré après rechargement)
              const isCompleted = completedSteps.includes(stepNumber) || stepNumber < currentStep;
              const isCurrent = currentStep === stepNumber;
              const isUpcoming = stepNumber > currentStep;

              return (
                <li
                  key={step.id}
                  className={`
                    flex items-center gap-3 p-2 rounded-lg
                    transition-colors
                    ${isCurrent ? 'bg-white/10' : ''}
                  `}
                  role="listitem"
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {/* Icône état */}
                  {isCompleted ? (
                    <span
                      className="flex-shrink-0 text-emerald-400 text-lg"
                      aria-label="Étape complétée"
                    >
                      ✅
                    </span>
                  ) : isCurrent ? (
                    <span
                      className="flex-shrink-0 text-blue-400 text-lg animate-pulse"
                      aria-label="Étape en cours"
                    >
                      🔵
                    </span>
                  ) : (
                    <span
                      className="flex-shrink-0 text-gray-500 text-lg"
                      aria-label="Étape non atteinte"
                    >
                      ⚪
                    </span>
                  )}

                  {/* Numéro + titre */}
                  <span
                    className={`
                      text-sm
                      ${
                        isCompleted
                          ? 'text-white'
                          : isCurrent
                          ? 'text-white font-medium'
                          : 'text-white/50'
                      }
                    `}
                  >
                    {stepNumber}. {step.title}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Bouton Skip (si pas encore complété) */}
          {!hasCompleted && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <button
                onClick={handleSkip}
                className="
                  w-full py-2 px-4 text-sm
                  text-white/70 hover:text-white
                  hover:bg-white/10
                  rounded-lg
                  transition-colors
                "
              >
                Passer le tutoriel
              </button>
            </div>
          )}

          {/* Message de félicitations si complété */}
          {hasCompleted && (
            <div className="mt-4 pt-4 border-t border-white/20 text-center">
              <span className="text-2xl">🎉</span>
              <p className="text-white/90 text-sm mt-2">
                Tutoriel complété !
              </p>
            </div>
          )}
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.5);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.7);
        }
      `}</style>
    </div>
  );
}
