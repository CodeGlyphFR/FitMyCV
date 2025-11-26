'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight, X, Pencil } from 'lucide-react';
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
 * RESPONSIVE BREAKPOINTS:
 * - Mobile: 0-990px (barres de progression, swipe hint, pas de chevrons)
 * - Desktop: 991px+ (chevrons visibles, pas de barres, textes/espacements plus grands)
 * Note: md: breakpoint personnalisé à 991px dans tailwind.config.js (pas le défaut 768px)
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
  title = "Guide du mode édition", // Titre du modal (défaut pour rétrocompatibilité)
  IconComponent = Pencil, // Icône Lucide du modal
  iconBg = 'bg-emerald-500/20', // Background de l'icône
  iconColor = 'text-emerald-400', // Couleur de l'icône
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
  const isDraggingRef = useRef(false);

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
    // Ignorer si on vient de faire un drag (évite la fermeture accidentelle)
    if (isDraggingRef.current) return;

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

  // Classes de taille (unifié max-w-2xl comme WelcomeModal)
  const sizeClasses = {
    default: 'max-w-full mx-2 md:mx-4 md:max-w-2xl',
    large: 'max-w-full mx-2 md:mx-4 md:max-w-2xl',
  };

  // Ne pas render si pas ouvert ou screens vides
  if (!open || !screens || screens.length === 0) return null;

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
        <div>
          {/* Titre et boutons */}
          <div className="flex items-center justify-between p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                {IconComponent && <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${iconColor}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="onboarding-modal-title"
                  className="text-base md:text-lg font-bold text-white mb-1 line-clamp-2"
                >
                  {screens[currentScreen]?.title || title}
                </h2>
                <p className="text-xs md:text-sm text-slate-400">
                  {currentScreen + 1} / {screens.length}
                </p>

                {/* Screen reader only announcement */}
                <div className="sr-only md:hidden" role="status" aria-live="polite" aria-atomic="true">
                  Étape {currentScreen + 1} sur {screens.length}
                </div>
              </div>
            </div>

            {/* Boutons alignés à droite */}
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {/* Bouton Passer */}
              {showSkipButton && onSkip && (
                <button
                  onClick={onSkip}
                  className="text-xs md:text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  Passer
                </button>
              )}

              {/* X Button - Allows user to exit mid-tutorial (different from WelcomeModal where X advances) */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label="Fermer le modal"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Progress Bars - Pleine largeur au-dessus de la bordure */}
          <div className="md:hidden px-4 pb-3" aria-hidden="true">
            <div className="flex gap-1">
              {screens.map((_, idx) => (
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
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 p-4 md:p-6 pb-14 md:pb-16 cursor-grab active:cursor-grabbing"
            >
              {screens[currentScreen]?.image ? (
                /* Mode avec image (si screen.image existe) */
                <div className="flex flex-col items-center text-center space-y-3 md:space-y-4">
                  <div className="w-full h-48 md:h-64 rounded-xl overflow-hidden bg-white/10">
                    <img
                      src={screens[currentScreen].image}
                      alt={screens[currentScreen].title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-base md:text-lg text-white/90 max-w-xl">
                    {screens[currentScreen].description}
                  </p>
                </div>
              ) : (
                /* Mode texte seul - aligné gauche comme WelcomeModal */
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen]?.description}
                    </p>
                  </div>
                </div>
              )}
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

          {/* Bouton Suivant ou Compris (droite) */}
          <button
            onClick={handleNext}
            className="
              px-6 md:px-8 py-2.5 md:py-3 rounded-lg
              bg-emerald-500 hover:bg-emerald-600
              text-white text-sm md:text-base font-semibold
              transition-colors
            "
          >
            {currentScreen >= screens.length - 1 ? 'Compris !' : 'Suivant'}
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
