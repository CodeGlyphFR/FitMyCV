'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, Upload, FileText, X } from 'lucide-react';
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

const COMPLETION_SCREENS = [
  {
    icon: Search,
    title: 'Générez des CV par métier',
    description:
      'Utilisez la barre de recherche pour générer instantanément un template de CV adapté à n\'importe quel poste. Tapez simplement le titre du poste (ex: "Développeur React", "Chef de projet") et laissez l\'IA créer un CV professionnel pour vous.',
    emoji: '🔍',
  },
  {
    icon: Upload,
    title: 'Importez vos CV existants',
    description:
      'Vous avez déjà un CV ? Importez-le au format PDF ! L\'IA analysera son contenu et l\'optimisera automatiquement. Vous pourrez ensuite le personnaliser et l\'adapter à chaque offre d\'emploi.',
    emoji: '📤',
  },
  {
    icon: FileText,
    title: 'Créez un CV de zéro',
    description:
      'Préférez partir d\'une page blanche ? Créez un CV manuellement et ajoutez vos expériences, formations et compétences section par section. L\'IA vous assistera pour optimiser chaque élément.',
    emoji: '📝',
  },
];

export default function OnboardingCompletionModal({
  open = false,
  onComplete,
}) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [direction, setDirection] = useState(0);
  const shouldReduceMotion = useReducedMotion();

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
      // Dernier écran → compléter
      if (onComplete) onComplete();
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
        if (onComplete) onComplete();
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
    if (e.target === e.currentTarget && onComplete) {
      onComplete();
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
  const handleDragEnd = (e, { offset, velocity }) => {
    const swipe = calculateSwipePower(offset.x, velocity.x);

    if (swipe < -SWIPE_CONFIG.confidenceThreshold) {
      handleNext();
    } else if (swipe > SWIPE_CONFIG.confidenceThreshold) {
      handlePrev();
    }
  };

  // Ne pas render si pas ouvert ou screens vides
  if (!open || COMPLETION_SCREENS.length === 0) return null;

  const currentScreenData = COMPLETION_SCREENS[currentScreen];
  const IconComponent = currentScreenData?.icon;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none" />

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
                {IconComponent && <IconComponent className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="completion-modal-title"
                  className="text-base md:text-lg font-bold text-white mb-1 line-clamp-2"
                >
                  {currentScreenData?.title || 'Félicitations !'}
                </h2>
                <p className="text-xs md:text-sm text-slate-400">
                  {currentScreen + 1} / {COMPLETION_SCREENS.length}
                </p>

                {/* Screen reader only announcement */}
                <div className="sr-only md:hidden" role="status" aria-live="polite" aria-atomic="true">
                  Étape {currentScreen + 1} sur {COMPLETION_SCREENS.length}
                </div>
              </div>
            </div>

            {/* Boutons alignés à droite */}
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {/* X Button - Complete onboarding (same effect as "Commencer!" button) */}
              <button
                onClick={onComplete}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Fermer le modal"
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
        <div className="relative min-h-[470px] md:min-h-[500px] overflow-hidden" role="tabpanel" aria-live="polite">
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
              onDragEnd={handleDragEnd}
              className="absolute inset-0 p-4 md:p-6 pb-14 md:pb-16 cursor-grab active:cursor-grabbing"
            >
              {/* Mode texte seul - aligné gauche comme WelcomeModal */}
              <div className="flex flex-col h-full">
                <div className="flex-1">
                  <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                    {currentScreenData?.description}
                  </p>
                </div>
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
                aria-label={`Aller à l'écran ${idx + 1} sur ${COMPLETION_SCREENS.length}`}
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
              Précédent
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
              ? 'Commencer !'
              : 'Suivant'}
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
