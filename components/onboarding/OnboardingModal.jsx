'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronRight, X, Pencil, Check } from 'lucide-react';
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
  title, // Titre du modal (passé par le parent avec traduction)
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
  const { t } = useLanguage();
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
      <div className="absolute inset-0 bg-black/70 pointer-events-none" />

      {/* Modal */}
      <div
        className={`relative w-full ${sizeClasses[size] || sizeClasses.default} bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          {/* Titre et boutons */}
          <div className="flex items-center justify-between p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              {IconComponent && (
                typeof IconComponent === 'string'
                  ? <img src={IconComponent} alt="" className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0" />
                  : (
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${iconColor}`} />
                    </div>
                  )
              )}
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
                  {t('onboarding.common.aria.screenReaderStep', { current: currentScreen + 1, total: screens.length })}
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
                  {t('onboarding.common.buttons.skip')}
                </button>
              )}

              {/* X Button - Allows user to exit mid-tutorial (different from WelcomeModal where X advances) */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label={t('onboarding.common.aria.closeModal')}
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
        <div className="relative overflow-hidden" role="tabpanel" aria-live="polite">
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
              className="p-4 md:p-6 md:pb-16 cursor-grab active:cursor-grabbing"
            >
              {/* customRender : le parent contrôle le rendu */}
              {screens[currentScreen]?.customRender
                ? screens[currentScreen].customRender(screens[currentScreen])
                : (
                <>
              {/* Écran type: master_cv */}
              {screens[currentScreen]?.type === 'master_cv' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left mb-6">
                      {screens[currentScreen].description}
                    </p>
                    <div className="space-y-3 ml-4">
                      {screens[currentScreen].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: control */}
              {screens[currentScreen]?.type === 'control' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left mb-4">
                      {screens[currentScreen].description}
                    </p>
                    <p className="text-white/60 text-sm md:text-base text-left mb-4">
                      {screens[currentScreen].subtitle}
                    </p>
                    <div className="space-y-3">
                      {screens[currentScreen].actions.map((action, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                            <img src={action.icon} alt="" className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{action.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{action.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: sections */}
              {screens[currentScreen]?.type === 'sections' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <div className="space-y-4">
                      {screens[currentScreen].blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-2xl flex-shrink-0">{block.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{block.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{block.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Fallback: écrans avec image */}
              {screens[currentScreen]?.image && (
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
              )}

              {/* Écran type: ext_install (Installation extension navigateur) */}
              {screens[currentScreen]?.type === 'ext_install' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    {/* Étapes numérotées */}
                    {screens[currentScreen].steps && (
                      <div className="space-y-3 ml-2">
                        {screens[currentScreen].steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3 text-left">
                            <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-sky-400">{idx + 1}</span>
                            </div>
                            <span className="text-white/80 text-sm md:text-base">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Boutons store ou message "bientôt disponible" */}
                    {screens[currentScreen].storeButtons && (
                      <div className="space-y-2 pt-2">
                        {screens[currentScreen].storeButtons.map((btn, idx) => (
                          <a
                            key={idx}
                            href={btn.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              btn.primary
                                ? 'bg-sky-500 hover:bg-sky-600 text-white'
                                : 'bg-white/10 hover:bg-white/15 text-white/80 border border-white/20'
                            }`}
                          >
                            {btn.label}
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Message "bientôt disponible" si pas de boutons store */}
                    {screens[currentScreen].comingSoon && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-300 text-sm font-medium">{screens[currentScreen].comingSoon.title}</p>
                        <p className="text-white/60 text-xs mt-1">{screens[currentScreen].comingSoon.hint}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Écran type: step2_intro (Step 2 - Écran 1/3) */}
              {screens[currentScreen]?.type === 'step2_intro' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <p className="text-white font-medium text-sm md:text-base text-left">
                      {screens[currentScreen].subtitle}
                    </p>

                    <div className="space-y-3">
                      {screens[currentScreen].blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-2xl flex-shrink-0">{block.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{block.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{block.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step2_methods (Step 2 - Écran 2/3) */}
              {screens[currentScreen]?.type === 'step2_methods' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    {/* Blocs principaux (URL, PDF) */}
                    <div className="space-y-3">
                      {screens[currentScreen].blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-2xl flex-shrink-0">{block.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{block.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{block.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bloc Historique (style distinct avec bordure emerald) */}
                    {screens[currentScreen].historyBlock && (
                      <div className="p-3 bg-emerald-500/5 border border-emerald-500/30 rounded-lg">
                        <div className="flex items-start gap-3 text-left">
                          <span className="text-xl flex-shrink-0">{screens[currentScreen].historyBlock.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm">{screens[currentScreen].historyBlock.title}</p>
                            <p className="text-white/60 text-xs">{screens[currentScreen].historyBlock.description}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {screens[currentScreen].tip && (
                    <TipBox className="mt-4">
                      {screens[currentScreen].tip}
                    </TipBox>
                  )}
                </div>
              )}

              {/* Écran type: step2_ai_behavior (Step 2 - Écran 3/3) */}
              {screens[currentScreen]?.type === 'step2_ai_behavior' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <p className="text-white font-medium text-sm md:text-base text-left">
                      {screens[currentScreen].subtitle}
                    </p>

                    <div className="space-y-2">
                      {screens[currentScreen].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white/80 text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step5_review_intro (Step 5 - Écran 1/2) */}
              {screens[currentScreen]?.type === 'step5_review_intro' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <div className="space-y-3">
                      {screens[currentScreen].blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-2xl flex-shrink-0">{block.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{block.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{block.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step5_review_actions (Step 5 - Écran 2/2) */}
              {screens[currentScreen]?.type === 'step5_review_actions' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <div className="space-y-2">
                      {screens[currentScreen].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white/80 text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step7_score_analysis (Step 7 - Écran 1/2) */}
              {screens[currentScreen]?.type === 'step7_score_analysis' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <p className="text-white font-medium text-sm md:text-base text-left">
                      {screens[currentScreen].subtitle}
                    </p>

                    <div className="space-y-3">
                      {screens[currentScreen].blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-2xl flex-shrink-0">{block.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{block.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{block.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step7_apply_improvements (Step 7 - Écran 2/2) */}
              {screens[currentScreen]?.type === 'step7_apply_improvements' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <div className="space-y-2">
                      {screens[currentScreen].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white/80 text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>

                    <p className="text-white font-medium text-sm md:text-base text-left pt-2">
                      {screens[currentScreen].subtitle}
                    </p>

                    <p className="text-white/60 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].transparencyText}
                    </p>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step8_version_system (Step 8 - Écran 1/2) */}
              {screens[currentScreen]?.type === 'step8_version_system' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <div className="space-y-3">
                      {screens[currentScreen].blocks.map((block, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-2xl flex-shrink-0">{block.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{block.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{block.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step8_restore_version (Step 8 - Écran 2/2) */}
              {screens[currentScreen]?.type === 'step8_restore_version' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>

                    <div className="space-y-2">
                      {screens[currentScreen].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white/80 text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <TipBox className="mt-4">
                    {screens[currentScreen].tip}
                  </TipBox>
                </div>
              )}

              {/* Écran type: step9_export (Step 9 - Écrans 1-2) */}
              {(screens[currentScreen]?.type === 'step9_export_ready' ||
                screens[currentScreen]?.type === 'step9_export_custom') && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 space-y-4">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen].description}
                    </p>
                    <div className="space-y-3">
                      {screens[currentScreen].checklist.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white/80 text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {screens[currentScreen].tip && (
                    <TipBox className="mt-4">
                      {screens[currentScreen].tip}
                    </TipBox>
                  )}
                </div>
              )}

              {/* Fallback: écrans sans type (description simple) */}
              {!screens[currentScreen]?.type && !screens[currentScreen]?.image && (
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                      {screens[currentScreen]?.description}
                    </p>
                  </div>
                </div>
              )}
                </>
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
                className="relative w-8 h-8 flex items-center justify-center"
                aria-label={t('onboarding.common.aria.goToScreen', { current: idx + 1, total: screens.length })}
              >
                <span className={`block rounded-full transition-colors duration-200 ${idx === currentScreen ? 'w-2 h-2 bg-emerald-500' : 'w-[5px] h-[5px] bg-white/40'}`} />
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
              className="px-3 md:px-4 py-2 text-xs md:text-sm text-slate-400 hover:text-white transition-colors"
            >
              {t('onboarding.common.buttons.previous')}
            </button>
          ) : (
            <div />
          )}

          {/* Bouton Suivant ou Compris (droite) */}
          <button
            onClick={handleNext}
            className="px-6 md:px-8 py-2.5 md:py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm md:text-base font-semibold transition-colors"
          >
            {currentScreen >= screens.length - 1 ? t('onboarding.common.buttons.understood') : t('onboarding.common.buttons.next')}
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
