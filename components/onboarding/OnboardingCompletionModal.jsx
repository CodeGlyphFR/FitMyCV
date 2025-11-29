'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, X, PartyPopper } from 'lucide-react';
import TipBox from '@/components/ui/TipBox';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  slideVariants,
  paginationDotsContainer,
  paginationDot,
  createChevronAnimations,
  createDotAnimations,
  transitions,
  calculateSwipePower,
  SWIPE_CONFIG,
} from '@/lib/animations/variants';

/**
 * Modal de complétion de l'onboarding avec carousel (3 écrans)
 * Affiché quand l'utilisateur termine le tutoriel (step 7)
 *
 * RESPONSIVE BREAKPOINTS:
 * - Mobile: 0-990px (barres de progression, swipe hint, pas de chevrons)
 * - Desktop: 991px+ (chevrons visibles, pas de barres, textes/espacements plus grands)
 * Note: md: breakpoint personnalisé à 991px dans tailwind.config.js (pas le défaut 768px)
 *
 * Props:
 * - open: boolean - État d'ouverture du modal
 * - onComplete: function - Callback quand le modal est complété/fermé
 */

// Composants inline pour les écrans du carousel
const ChecklistItem = ({ children }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
      <Check className="w-3 h-3 text-emerald-400" />
    </div>
    <span className="text-white/80 text-sm">{children}</span>
  </div>
);

const HighlightBox = ({ emoji, children }) => (
  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
    <div className="flex items-start gap-3">
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <p className="text-white/90 text-sm font-medium">{children}</p>
    </div>
  </div>
);

const FeatureBlock = ({ icon, title, description }) => (
  <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-white font-medium text-sm mb-0.5">{title}</h4>
      <p className="text-white/60 text-xs leading-relaxed">{description}</p>
    </div>
  </div>
);

const ComingSoonItem = ({ emoji, title, description }) => (
  <div className="flex items-start gap-3 py-2">
    <span className="text-lg flex-shrink-0">{emoji}</span>
    <div className="flex-1 min-w-0">
      <span className="text-white font-medium text-sm">{title}</span>
      <span className="text-white/60 text-sm"> — {description}</span>
    </div>
  </div>
);

// Mapping des clés features vers les icônes (identiques à TopBar)
const FEATURE_ICONS = {
  import: '/icons/import.png',
  create: '/icons/add.png',
  generate: '/icons/openai-symbol.png',
  delete: '/icons/delete.png',
  translate: '/icons/translate.png',
};

/**
 * Factory function to create translated completion screens
 * @param {Function} t - Translation function from useLanguage
 * @returns {Array} List of translated completion screens
 */
function createCompletionScreens(t) {
  return [
    {
      id: 'congratulations',
      title: t('onboarding.completion.screen1.title'),
      type: 'congratulations',
      description: t('onboarding.completion.screen1.description'),
      checklist: t('onboarding.completion.screen1.checklist'),
      highlight: t('onboarding.completion.screen1.highlight'),
    },
    {
      id: 'features',
      title: t('onboarding.completion.screen2.title'),
      type: 'features',
      description: t('onboarding.completion.screen2.description'),
      features: t('onboarding.completion.screen2.features'),
      tip: t('onboarding.completion.screen2.tip'),
    },
    {
      id: 'coming-soon',
      title: t('onboarding.completion.screen3.title'),
      type: 'coming-soon',
      description: t('onboarding.completion.screen3.description'),
      comingSoon: t('onboarding.completion.screen3.comingSoon'),
      tip: t('onboarding.completion.screen3.tip'),
    },
  ];
}

export default function OnboardingCompletionModal({
  open = false,
  onComplete,
}) {
  const { t } = useLanguage();
  const COMPLETION_SCREENS = useMemo(() => createCompletionScreens(t), [t]);

  const [currentScreen, setCurrentScreen] = useState(0);
  const [direction, setDirection] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const isDraggingRef = useRef(false);

  // Reset screen when modal opens
  useEffect(() => {
    if (open) {
      setCurrentScreen(0);
      setDirection(0);
    }
  }, [open]);

  // Handlers boutons
  const handleNext = useCallback(() => {
    if (currentScreen >= COMPLETION_SCREENS.length - 1) {
      // Dernier écran → compléter (terminé normalement)
      if (onComplete) onComplete({ completed: true });
    } else {
      setDirection(1);
      setCurrentScreen((prev) => prev + 1);
    }
  }, [currentScreen, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentScreen > 0) {
      setDirection(-1);
      setCurrentScreen((prev) => prev - 1);
    }
  }, [currentScreen]);

  // Gestion du scroll body
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.touchAction = 'none';

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
  }, [open]);

  // Gestion clavier
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Fermé par Escape → pas de complétion du modal
        if (onComplete) onComplete({ completed: false });
      }
      if (e.key === 'ArrowRight') {
        handleNext();
      }
      if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNext, handlePrev, onComplete]);

  // Handler backdrop click
  const handleBackdropClick = (e) => {
    // Ignorer si on vient de faire un drag (évite la fermeture accidentelle)
    if (isDraggingRef.current) return;

    // Fermé par backdrop → pas de complétion du modal
    if (e.target === e.currentTarget && onComplete) {
      onComplete({ completed: false });
    }
  };

  // Handler bullet click
  const handleBulletClick = useCallback(
    (idx) => {
      if (idx === currentScreen) return;
      setDirection(idx > currentScreen ? 1 : -1);
      setCurrentScreen(idx);
    },
    [currentScreen]
  );

  // Handler mobile swipe/drag
  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (e, { offset, velocity }) => {
    const swipe = calculateSwipePower(offset.x, velocity.x);

    if (swipe < -SWIPE_CONFIG.confidenceThreshold) {
      handleNext();
    } else if (swipe > SWIPE_CONFIG.confidenceThreshold) {
      handlePrev();
    }

    // Reset le flag après un court délai pour éviter les faux clics
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // Ne pas render si pas ouvert ou screens vides
  if (!open || COMPLETION_SCREENS.length === 0) return null;

  const currentScreenData = COMPLETION_SCREENS[currentScreen];

  const modalContent = (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 pointer-events-none" />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-full mx-2 md:mx-4 md:max-w-2xl
          bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          {/* Titre et boutons */}
          <div className="flex items-center justify-between p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <PartyPopper className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="completion-modal-title"
                  className="text-base md:text-lg font-bold text-white mb-1 line-clamp-2"
                >
                  {currentScreenData?.title || t('onboarding.completion.screen1.title')}
                </h2>
                <p className="text-xs md:text-sm text-slate-400">
                  {currentScreen + 1} / {COMPLETION_SCREENS.length}
                </p>

                {/* Screen reader only announcement */}
                <div className="sr-only md:hidden" role="status" aria-live="polite" aria-atomic="true">
                  {t('onboarding.common.aria.screenReaderStep', { current: currentScreen + 1, total: COMPLETION_SCREENS.length })}
                </div>
              </div>
            </div>

            {/* Bouton fermer */}
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              <button
                onClick={() => onComplete && onComplete({ completed: false })}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label={t('onboarding.common.aria.closeModal')}
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Progress Bars - Pleine largeur au-dessus de la bordure */}
          <div className="md:hidden px-4 pb-3" aria-hidden="true">
            <div className="flex gap-1">
              {COMPLETION_SCREENS.map((_, idx) => (
                <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-emerald-500 transition-[width] duration-300 ${
                      idx <= currentScreen ? 'w-full' : 'w-0'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ligne de séparation */}
          <div className="border-b border-white/10" />
        </div>

        {/* Carousel Container */}
        <div className="relative overflow-hidden" role="tabpanel" aria-live="polite">
          <AnimatePresence initial={true} custom={direction} mode="wait">
            <motion.div
              key={currentScreen}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className="p-4 md:p-6 md:pb-16 cursor-grab active:cursor-grabbing"
            >
              {/* Contenu conditionnel par type d'écran */}
              <div className="flex flex-col">
                {currentScreenData?.type === 'congratulations' && (
                  <div className="space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {currentScreenData.description}
                    </p>
                    <div className="space-y-1 ml-4">
                      {currentScreenData.checklist?.map((item, idx) => (
                        <ChecklistItem key={idx}>{item}</ChecklistItem>
                      ))}
                    </div>
                    <HighlightBox emoji="🚀">
                      {currentScreenData.highlight}
                    </HighlightBox>
                  </div>
                )}

                {currentScreenData?.type === 'features' && (
                  <div className="space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {currentScreenData.description}
                    </p>
                    <div className="space-y-2">
                      {Object.entries(currentScreenData.features || {}).map(([key, feature], idx) => (
                        <FeatureBlock
                          key={idx}
                          icon={<img src={FEATURE_ICONS[key]} alt="" className="h-5 w-5" />}
                          title={feature.title}
                          description={feature.description}
                        />
                      ))}
                    </div>
                    <TipBox>
                      {currentScreenData.tip}
                    </TipBox>
                  </div>
                )}

                {currentScreenData?.type === 'coming-soon' && (
                  <div className="space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {currentScreenData.description}
                    </p>
                    <div className="space-y-1">
                      {currentScreenData.comingSoon?.map((item, idx) => (
                        <ComingSoonItem
                          key={idx}
                          emoji={item.emoji}
                          title={item.title}
                          description={item.description}
                        />
                      ))}
                    </div>
                    <TipBox>
                      {currentScreenData.tip}
                    </TipBox>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Pagination Bullets (Desktop only) */}
          <motion.div
            className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 gap-1 z-20"
            role="tablist"
            variants={paginationDotsContainer}
            initial="hidden"
            animate="visible"
          >
            {COMPLETION_SCREENS.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={() => handleBulletClick(idx)}
                role="tab"
                aria-selected={idx === currentScreen}
                variants={paginationDot}
                animate={idx === currentScreen ? 'active' : 'inactive'}
                {...createDotAnimations(shouldReduceMotion)}
                transition={transitions.snappy}
                className="
                  relative w-8 h-8
                  flex items-center justify-center
                "
                aria-label={t('onboarding.common.aria.goToScreen', { current: idx + 1, total: COMPLETION_SCREENS.length })}
              >
                <span
                  className={`
                  block rounded-full transition-colors duration-200
                  ${
                    idx === currentScreen
                      ? 'w-2 h-2 bg-emerald-500'
                      : 'w-[5px] h-[5px] bg-white/40'
                  }
                `}
                />
              </motion.button>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 md:p-6 border-t border-white/10">
          {/* Bouton Précédent (gauche, masqué au premier écran) */}
          {currentScreen > 0 ? (
            <button
              onClick={handlePrev}
              className="
                px-3 md:px-4 py-2 text-xs md:text-sm
                text-slate-400 hover:text-white
                transition-colors
              "
            >
              {t('onboarding.common.buttons.previous')}
            </button>
          ) : (
            <div />
          )}

          {/* Bouton Suivant ou Commencer (droite) */}
          <button
            onClick={handleNext}
            className="
              px-6 md:px-8 py-2.5 md:py-3 rounded-lg
              bg-emerald-500 hover:bg-emerald-600
              text-white text-sm md:text-base font-semibold
              transition-colors
            "
          >
            {currentScreen >= COMPLETION_SCREENS.length - 1
              ? t('onboarding.common.buttons.start')
              : t('onboarding.common.buttons.next')}
          </button>
        </div>
      </div>
    </div>
  );

  // Portal pour éviter problèmes z-index
  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
