'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
 * Modal d'onboarding avec carousel (Framer Motion)
 *
 * Props:
 * - open: boolean - État d'ouverture du modal
 * - screens: array - Liste des écrans à afficher
 * - currentScreen: number - Index de l'écran actuel (0-based)
 * - onNext: function - Callback pour passer à l'écran suivant
 * - onPrev: function - Callback pour passer à l'écran précédent
 * - onComplete: function - Callback quand le modal est complété
 * - onSkip: function - Callback pour skip le modal
 * - onClose: function - Callback pour fermer le modal
 * - showSkipButton: boolean - Afficher le bouton "Passer"
 * - disableEscapeKey: boolean - Désactiver la fermeture avec Escape
 * - disableBackdropClick: boolean - Désactiver la fermeture avec clic backdrop
 * - size: string - Taille du modal ('default' | 'large')
 */

export default function OnboardingModal({
  open = false,
  screens = [],
  currentScreen = 0,
  onNext,
  onPrev,
  onJumpTo, // NEW: Direct jump to specific screen
  onComplete,
  onSkip,
  onClose,
  showSkipButton = true,
  disableEscapeKey = false,
  disableBackdropClick = false,
  size = 'large',
}) {
  const [direction, setDirection] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  // Handlers boutons (useCallback pour éviter stale closures)
  const handleNext = useCallback(() => {
    if (currentScreen >= screens.length - 1) {
      // Dernier écran → compléter
      if (onComplete) onComplete();
    } else {
      // Écran suivant
      setDirection(1);
      if (onNext) onNext();
    }
  }, [currentScreen, screens.length, onComplete, onNext]);

  const handlePrev = useCallback(() => {
    if (currentScreen > 0) {
      setDirection(-1);
      if (onPrev) onPrev();
    }
  }, [currentScreen, onPrev]);

  // Gestion du scroll body (prévenir scroll chaining)
  useEffect(() => {
    if (!open) return;

    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.paddingRight = `${scrollbarWidth}px`; // Prevent layout shift
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
  }, [open]);

  // Gestion clavier (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !disableEscapeKey && onClose) {
        onClose();
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
  }, [open, handleNext, handlePrev, disableEscapeKey, onClose]);

  // Gestion clic backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !disableBackdropClick && onClose) {
      onClose();
    }
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
  };

  // Handler bullet click (jump to specific slide)
  const handleBulletClick = useCallback((idx) => {
    if (idx === currentScreen) return;

    setDirection(idx > currentScreen ? 1 : -1);

    // Call parent with direct jump (single callback)
    if (onJumpTo) {
      onJumpTo(idx);
    }
  }, [currentScreen, onJumpTo]);

  // Handler mobile swipe/drag
  const handleDragEnd = (e, { offset, velocity }) => {
    const swipe = calculateSwipePower(offset.x, velocity.x);

    if (swipe < -SWIPE_CONFIG.confidenceThreshold) {
      handleNext();
    } else if (swipe > SWIPE_CONFIG.confidenceThreshold) {
      handlePrev();
    }
  };

  // Ne pas render si pas ouvert
  if (!open) return null;

  // Classes de taille
  const sizeClasses = {
    default: 'max-w-2xl',
    large: 'max-w-4xl',
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none" />

      {/* Modal */}
      <div
        className={`
          relative w-full ${sizeClasses[size] || sizeClasses.default}
          bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl
          overflow-hidden
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-2xl">✏️</span>
            </div>
            <div>
              <h2
                id="onboarding-modal-title"
                className="text-xl font-bold text-white"
              >
                Guide du mode édition
              </h2>
              <p className="text-sm text-slate-400">
                {currentScreen + 1} / {screens.length}
              </p>
            </div>
          </div>

          {/* Bouton fermeture */}
          {onClose && (
            <button
              onClick={onClose}
              className="
                p-2 rounded-lg
                text-slate-400 hover:text-white hover:bg-white/10
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
          )}
        </div>

        {/* Carousel Container */}
        <div className="relative min-h-[450px] overflow-hidden" role="tabpanel" aria-live="polite">
          <AnimatePresence initial={true} custom={direction} mode="wait">
            <motion.div
              id="onboarding-carousel-content"
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
              {screens[currentScreen]?.image ? (
                /* Mode avec image (si screen.image existe) */
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-full h-64 rounded-xl overflow-hidden bg-white/10">
                    <img
                      src={screens[currentScreen].image}
                      alt={screens[currentScreen].title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-lg text-white/90 max-w-xl">
                    {screens[currentScreen].description}
                  </p>
                </div>
              ) : (
                /* Mode texte seul (si pas d'image) */
                <div className="flex flex-col items-center justify-center space-y-6 max-h-[360px] overflow-y-auto px-2 custom-scrollbar touch-pan-y">
                  {/* Titre de l'écran */}
                  <h3 className="text-2xl font-bold text-white text-center flex-shrink-0">
                    {screens[currentScreen]?.title}
                  </h3>

                  {/* Description longue */}
                  <div className="text-white/90 text-lg leading-relaxed space-y-4 text-center max-w-2xl">
                    <p>{screens[currentScreen]?.description}</p>
                  </div>

                  {/* Icône décorative (optionnel) */}
                  {screens[currentScreen]?.icon && (
                    <div className="flex justify-center mt-4 flex-shrink-0">
                      <div className="text-6xl opacity-20">
                        {screens[currentScreen].icon}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
            disabled={currentScreen >= screens.length - 1}
            {...createChevronAnimations(shouldReduceMotion, 'right')}
            animate={{
              opacity: currentScreen >= screens.length - 1 ? 0.3 : 1,
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
            {screens.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={() => handleBulletClick(idx)}
                role="tab"
                aria-selected={idx === currentScreen}
                aria-controls="onboarding-carousel-content"
                variants={paginationDot}
                animate={idx === currentScreen ? 'active' : 'inactive'}
                {...createDotAnimations(shouldReduceMotion)}
                transition={transitions.snappy}
                className="
                  relative w-8 h-8
                  flex items-center justify-center
                "
                aria-label={`Aller à l'écran ${idx + 1} sur ${screens.length}`}
              >
                <span className={`
                  block rounded-full transition-colors duration-200
                  ${
                    idx === currentScreen
                      ? 'w-2 h-2 bg-emerald-500'
                      : 'w-[5px] h-[5px] bg-white/40'
                  }
                `} />
              </motion.button>
            ))}
          </motion.div>
        </div>

        {/* Footer avec boutons */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          {/* Bouton Skip (gauche) */}
          {showSkipButton && (
            <button
              onClick={handleSkip}
              className="
                px-4 py-2 text-sm
                text-slate-400 hover:text-white
                transition-colors
              "
            >
              Passer le tutoriel
            </button>
          )}

          {/* Spacer ou bouton Compris (sur dernier écran) */}
          {currentScreen >= screens.length - 1 ? (
            <button
              onClick={handleNext}
              className="
                px-8 py-3 rounded-lg
                bg-emerald-500 hover:bg-emerald-600
                text-white font-semibold
                transition-colors
                ml-auto
              "
            >
              Compris !
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );

  // Portal pour éviter problèmes z-index
  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
