'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, Upload, FileText } from 'lucide-react';
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

  if (!open) return null;

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
          relative w-full max-w-4xl
          bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30 shadow-2xl
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-2xl">🎉</span>
            </div>
            <div>
              <h2
                id="completion-modal-title"
                className="text-xl font-bold text-white"
              >
                Félicitations !
              </h2>
              <p className="text-sm text-white/60">
                Découvrez encore plus de fonctionnalités
              </p>
            </div>
          </div>

          {/* Bouton fermeture */}
          <button
            onClick={onComplete}
            className="
              p-2 rounded-lg
              text-white/70 hover:text-white hover:bg-white/10
              transition-colors
            "
            aria-label="Fermer le modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Carousel Container */}
        <div className="relative min-h-[400px] overflow-hidden" role="tabpanel" aria-live="polite">
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
              className="absolute inset-0 p-6 pb-20 cursor-grab active:cursor-grabbing"
            >
              <div className="flex flex-col items-center justify-center space-y-6 h-full">
                {/* Icône */}
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  {IconComponent && (
                    <IconComponent className="w-12 h-12 text-emerald-400" />
                  )}
                </div>

                {/* Titre */}
                <h3 className="text-2xl font-bold text-white text-center">
                  {currentScreenData?.title}
                </h3>

                {/* Description */}
                <p className="text-white/90 text-lg leading-relaxed text-center max-w-2xl">
                  {currentScreenData?.description}
                </p>

                {/* Emoji décoratif */}
                <div className="text-6xl opacity-20">
                  {currentScreenData?.emoji}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          <motion.button
            onClick={handlePrev}
            disabled={currentScreen === 0}
            {...createChevronAnimations(shouldReduceMotion, 'left')}
            animate={{
              opacity: currentScreen === 0 ? 0.3 : 1,
            }}
            transition={transitions.default}
            className="
              absolute left-4 top-1/2 -translate-y-1/2 z-10
              w-11 h-11 rounded-full
              bg-emerald-500/50 hover:bg-emerald-500/70
              disabled:pointer-events-none
              text-white
              flex items-center justify-center
              backdrop-blur-sm
            "
            aria-label="Écran précédent"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>

          <motion.button
            onClick={handleNext}
            disabled={currentScreen >= COMPLETION_SCREENS.length - 1}
            {...createChevronAnimations(shouldReduceMotion, 'right')}
            animate={{
              opacity: currentScreen >= COMPLETION_SCREENS.length - 1 ? 0.3 : 1,
            }}
            transition={transitions.default}
            className="
              absolute right-4 top-1/2 -translate-y-1/2 z-10
              w-11 h-11 rounded-full
              bg-emerald-500/50 hover:bg-emerald-500/70
              disabled:pointer-events-none
              text-white
              flex items-center justify-center
              backdrop-blur-sm
            "
            aria-label="Écran suivant"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>

          {/* Pagination Bullets */}
          <motion.div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1 z-20"
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
        <div className="flex items-center justify-between p-6 border-t border-white/20">
          {/* Indicateur de progression */}
          <p className="text-sm text-white/60">
            {currentScreen + 1} / {COMPLETION_SCREENS.length}
          </p>

          {/* Bouton principal */}
          <button
            onClick={handleNext}
            className="
              px-8 py-3 rounded-lg
              bg-emerald-500 hover:bg-emerald-600
              text-white font-semibold
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
