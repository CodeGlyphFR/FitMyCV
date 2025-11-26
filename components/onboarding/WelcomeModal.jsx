'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, HelpCircle, Rocket, X, Check, Lightbulb } from 'lucide-react';
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
import {
  slideVariants,
  paginationDotsContainer,
  paginationDot,
  createDotAnimations,
  transitions,
  calculateSwipePower,
  SWIPE_CONFIG,
} from '@/lib/animations/variants';

/**
 * Animation swipe simplifiée - Disque avec effet de traînée (mobile uniquement)
 */
function SwipeAnimation() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{
        duration: 5.1,
        times: [0, 0.05, 1],
      }}
      className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
      aria-hidden="true"
    >
      <motion.div
        animate={{
          x: [60, -60, 60, -60, 60, -60],
        }}
        transition={{
          duration: 5.1,
          times: [0, 0.33, 0.33, 0.66, 0.66, 1],
          ease: "easeInOut",
        }}
        className="relative"
      >
        {/* Traînée (cercles avec opacité décroissante) */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: 5.1,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-emerald-400/60 blur-sm ml-5" />
        </motion.div>
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 5.1,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          }}
        >
          <div className="w-6 h-6 rounded-full bg-emerald-400/70 blur-sm ml-2.5" />
        </motion.div>

        {/* Disque principal */}
        <motion.div
          animate={{
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 5.1,
            times: [0, 0.5, 1],
            ease: "easeInOut",
          }}
          className="w-8 h-8 rounded-full bg-emerald-400 shadow-lg shadow-emerald-500/50"
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Modal de bienvenue affiché avant le début de l'onboarding
 *
 * RESPONSIVE BREAKPOINTS:
 * - Mobile: 0-990px (barres de progression, swipe hint, pas de chevrons)
 * - Desktop: 991px+ (chevrons visibles, pas de barres, textes/espacements plus grands)
 * Note: md: breakpoint personnalisé à 991px dans tailwind.config.js (pas le défaut 768px)
 *
 * Props:
 * - open: boolean - État d'ouverture du modal
 * - onComplete: function - Callback quand l'utilisateur clique "Commencer"
 * - onSkip: function - Callback pour skip le tutorial
 */

const WELCOME_SCREENS = [
  {
    type: 'welcome',
    title: 'Bienvenue sur FitMyCV 👋',
    description: "Bienvenue ! Ce tutoriel va vous apprendre les bases pour créer rapidement des CV adaptés à chaque offre.",
    icon: Sparkles,
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    checklist: [
      'Un CV sur-mesure par offre',
      'Format optimisé ATS*',
      'Conçu pour convaincre les recruteurs',
      'Prêt en quelques minutes',
    ],
    atsExplanation: "ATS (Applicant Tracking System) : logiciel utilisé par les recruteurs pour filtrer automatiquement les CV. Un format optimisé ATS augmente vos chances d'être vu.",
    solution: {
      title: 'Astuce',
      description: "Collez simplement les liens de vos offres, on analyse tout automatiquement !",
    },
  },
  {
    type: 'problems',
    title: 'Pourquoi vos candidatures restent-elles sans réponse ?',
    icon: HelpCircle,
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
    problems: [
      {
        emoji: '😤',
        title: 'Des dizaines de CV envoyés, zéro réponse',
        description: 'Vous passez des heures à postuler mais n\'obtenez que du silence.',
      },
      {
        emoji: '🤖',
        title: 'Votre CV doit d\'abord convaincre un logiciel',
        description: '88% des grandes entreprises utilisent des systèmes ATS qui analysent structure et mots-clés avant qu\'un humain ne voie votre CV.',
      },
      {
        emoji: '👤',
        title: 'Puis séduire un recruteur en quelques secondes',
        description: 'S\'il passe le filtre, un recruteur le parcourt rapidement pour décider qui rencontrer.',
      },
      {
        emoji: '🎯',
        title: 'Le défi : réussir les deux avec un CV générique',
        description: 'Mission impossible sans adapter votre CV à chaque offre.',
      },
    ],
    solution: {
      title: 'FitMyCV résout ce double défi',
      description: "Notre IA adapte votre CV pour passer les filtres automatiques ET capter l'attention des recruteurs. Un CV sur-mesure par offre, en quelques clics, pour augmenter drastiquement vos chances d'obtenir un premier entretien.",
    },
  },
  {
    type: 'features',
    title: 'Prêt pour une visite de 2 minutes ? ⏱️',
    subtitle: 'Découvrez les 5 fonctionnalités qui vont changer votre façon de postuler',
    icon: Rocket,
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-400',
    features: [
      { emoji: '✏️', title: 'Créer et éditer votre CV', description: 'Interface intuitive et format optimisé ATS' },
      { emoji: '🤖', title: 'Générer avec l\'IA', description: 'CV adapté automatiquement à chaque offre d\'emploi' },
      { emoji: '📊', title: 'Calculer votre score', description: 'Mesurez votre compatibilité avec une offre' },
      { emoji: '⚡', title: 'Optimiser en 1 clic', description: 'L\'IA améliore votre CV automatiquement' },
      { emoji: '📄', title: 'Exporter en format pro', description: 'PDF parfait pour postuler partout' },
    ],
    tip: 'Suivez la visite, vous créerez votre premier CV juste après !',
  },
];

// Configuration de l'animation morphing
// Utilise la config centralisée (ms → secondes pour Framer Motion)
const MORPH_DURATION = ONBOARDING_TIMINGS.WELCOME_MORPH_DURATION / 1000; // 700ms → 0.7s
const CHECKLIST_POSITION = {
  bottom: 24, // bottom-6 = 24px
  right: 80,  // right-20 = 80px
  width: 320, // w-80 = 320px
  height: 56, // Hauteur header ChecklistPanel approximative
};

/**
 * Calcule le déplacement nécessaire pour aller du centre vers le coin inférieur droit
 */
const calculateMorphTransform = () => {
  if (typeof window === 'undefined') return { x: 0, y: 0 };

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Position du modal centré
  const centerX = viewportWidth / 2;
  const centerY = viewportHeight / 2;

  // Position cible (coin inférieur droit, centre du ChecklistPanel)
  const targetX = viewportWidth - CHECKLIST_POSITION.right - CHECKLIST_POSITION.width / 2;
  const targetY = viewportHeight - CHECKLIST_POSITION.bottom - CHECKLIST_POSITION.height / 2;

  return {
    x: targetX - centerX,
    y: targetY - centerY,
  };
};

export default function WelcomeModal({
  open = false,
  onComplete,
  onSkip,
  onClose, // Nouveau: handler pour la croix (X)
}) {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isMorphing, setIsMorphing] = useState(false);
  const [morphTransform, setMorphTransform] = useState({ x: 0, y: 0 });
  const shouldReduceMotion = useReducedMotion();

  // Reset screen when modal opens
  useEffect(() => {
    if (open) {
      setCurrentScreen(0);
      setDirection(0);
      setIsMorphing(false);
    }
  }, [open]);

  // Handler pour démarrer l'animation morphing
  const startMorphAnimation = useCallback(() => {
    if (shouldReduceMotion) {
      // Si réduction de mouvement, skip l'animation
      if (onComplete) onComplete();
      return;
    }
    // Calculer la transformation avant de démarrer
    const transform = calculateMorphTransform();
    setMorphTransform(transform);
    setIsMorphing(true);
  }, [onComplete, shouldReduceMotion]);

  // Handler appelé à la fin de l'animation morphing
  const handleMorphComplete = useCallback(() => {
    if (onComplete) onComplete();
  }, [onComplete]);

  // Handlers boutons
  const handleNext = useCallback(() => {
    if (currentScreen >= WELCOME_SCREENS.length - 1) {
      // Dernier écran → lancer l'animation morphing
      startMorphAnimation();
    } else {
      setDirection(1);
      setCurrentScreen((prev) => prev + 1);
    }
  }, [currentScreen, startMorphAnimation]);

  const handlePrev = useCallback(() => {
    if (currentScreen > 0) {
      setDirection(-1);
      setCurrentScreen((prev) => prev - 1);
    }
  }, [currentScreen]);

  // Handler bullet click
  const handleBulletClick = useCallback(
    (idx) => {
      if (idx === currentScreen) return;
      setDirection(idx > currentScreen ? 1 : -1);
      setCurrentScreen(idx);
    },
    [currentScreen]
  );

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
      if (e.key === 'ArrowRight') {
        handleNext();
      }
      if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNext, handlePrev]);

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
  if (!open || WELCOME_SCREENS.length === 0) return null;

  const currentScreenData = WELCOME_SCREENS[currentScreen];
  const IconComponent = currentScreenData.icon;
  const isLastScreen = currentScreen >= WELCOME_SCREENS.length - 1;

  const modalContent = (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      {/* Backdrop - fade out pendant le morphing */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-none"
        animate={{ opacity: isMorphing ? 0 : 1 }}
        transition={{ duration: MORPH_DURATION * 0.5 }}
      />

      {/* Modal avec animation morphing */}
      <motion.div
        initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        animate={isMorphing ? {
          // Animation vers le coin inférieur droit
          x: morphTransform.x,
          y: morphTransform.y,
          width: CHECKLIST_POSITION.width,
          height: CHECKLIST_POSITION.height,
          opacity: 0,
          scale: 0.98,
        } : {
          // Position initiale (centré)
          x: 0,
          y: 0,
          opacity: 1,
          scale: 1,
        }}
        transition={{
          duration: MORPH_DURATION,
          ease: [0.4, 0, 0.2, 1], // cubic-bezier pour un mouvement naturel
          opacity: { duration: MORPH_DURATION * 0.4, delay: MORPH_DURATION * 0.5 },
          width: { duration: MORPH_DURATION * 0.8 },
          height: { duration: MORPH_DURATION * 0.8 },
        }}
        onAnimationComplete={() => {
          if (isMorphing) {
            handleMorphComplete();
          }
        }}
        className={`
          relative bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl
          overflow-hidden
          ${isMorphing ? '' : 'w-full max-w-full mx-2 md:mx-4 md:max-w-2xl'}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Contenu avec fade-out pendant le morphing */}
        <motion.div
          animate={{ opacity: isMorphing ? 0 : 1 }}
          transition={{ duration: MORPH_DURATION * 0.3 }}
        >
        {/* Header */}
        <div>
          {/* Titre et boutons */}
          <div className="flex items-center justify-between p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full ${currentScreenData.iconBg} flex items-center justify-center flex-shrink-0`}>
                <IconComponent className={`w-4 h-4 md:w-5 md:h-5 ${currentScreenData.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="welcome-modal-title"
                  className="text-base md:text-lg font-bold text-white mb-1 line-clamp-2"
                >
                  {currentScreenData.title}
                </h2>
                <p className="text-xs md:text-sm text-slate-400">
                  {currentScreen + 1} / {WELCOME_SCREENS.length}
                </p>

                {/* Screen reader only announcement */}
                <div className="sr-only md:hidden" role="status" aria-live="polite" aria-atomic="true">
                  Étape {currentScreen + 1} sur {WELCOME_SCREENS.length}
                </div>
              </div>
            </div>

            {/* Boutons alignés à droite */}
            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
              {/* Bouton Passer - skip TOUT le tutoriel */}
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="text-xs md:text-sm text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  Passer
                </button>
              )}

              {/* X Button - Close modal (different from "Compris": doesn't mark modal as completed) */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  aria-label="Fermer et commencer l'onboarding"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Progress Bars - Pleine largeur au-dessus de la bordure */}
          <div className="md:hidden px-4 pb-3" aria-hidden="true">
            <div className="flex gap-1">
              {WELCOME_SCREENS.map((_, idx) => (
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
              id="welcome-carousel-content"
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
              {/* Écran 1: Welcome + Checklist + Tip */}
              {currentScreenData.type === 'welcome' && (
                <div className="flex flex-col h-full">
                  {/* Contenu en haut */}
                  <div className="flex-1">
                    {/* Description */}
                    <p className="text-white/80 text-sm md:text-base leading-relaxed text-left mb-6">
                      {currentScreenData.description}
                    </p>

                    {/* Checklist avec checkmarks */}
                    <div className="space-y-3 ml-4">
                      {currentScreenData.checklist.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-left">
                          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                            <Check className="w-3 h-3 text-emerald-400" />
                          </div>
                          <span className="text-white text-sm md:text-base">{item}</span>
                        </div>
                      ))}
                    </div>

                    {/* ATS explanation discret avec barre gauche */}
                    {currentScreenData.atsExplanation && (
                      <div className="mt-6 pl-4 border-l-2 border-white/20">
                        <p className="text-white/50 text-sm leading-relaxed text-left">
                          <span className="text-white/70 font-medium">*</span> {currentScreenData.atsExplanation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tip box vert (avantage FitMyCV) */}
                  <div className="mt-5 p-3 md:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-emerald-400 font-semibold text-sm md:text-base">
                        {currentScreenData.solution.title}
                      </p>
                    </div>
                    <p className="text-white/80 text-xs md:text-sm leading-relaxed text-left">
                      {currentScreenData.solution.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Écran 2: Problèmes + Solution */}
              {currentScreenData.type === 'problems' && (
                <div className="flex flex-col h-full">
                  {/* Contenu en haut */}
                  <div className="flex-1">
                    {/* Liste des problèmes */}
                    <div className="space-y-3">
                      {currentScreenData.problems.map((problem, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-xl flex-shrink-0">{problem.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{problem.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{problem.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Solution mise en avant (en bas) */}
                  <div className="mt-4 p-3 md:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <p className="text-emerald-400 font-semibold text-sm md:text-base">
                        {currentScreenData.solution.title}
                      </p>
                    </div>
                    <p className="text-white/80 text-xs md:text-sm leading-relaxed text-left">
                      {currentScreenData.solution.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Écran 3: Features + Tip */}
              {currentScreenData.type === 'features' && (
                <div className="flex flex-col h-full">
                  {/* Contenu en haut */}
                  <div className="flex-1">
                    {/* Sous-titre */}
                    <p className="text-white/60 text-sm md:text-base text-left mb-4">
                      {currentScreenData.subtitle}
                    </p>

                    {/* Liste des features */}
                    <div className="space-y-3 md:space-y-4">
                      {currentScreenData.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-left">
                          <span className="text-xl flex-shrink-0">{feature.emoji}</span>
                          <div>
                            <p className="text-white font-medium text-sm md:text-base">{feature.title}</p>
                            <p className="text-white/60 text-xs md:text-sm">{feature.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tip box en bas */}
                  <div className="mt-auto p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed text-left">
                        {currentScreenData.tip}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Swipe Animation (mobile only, first screen only) */}
              {currentScreen === 0 && <SwipeAnimation />}
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
            {WELCOME_SCREENS.map((_, idx) => (
              <motion.button
                key={idx}
                onClick={() => handleBulletClick(idx)}
                role="tab"
                aria-selected={idx === currentScreen}
                aria-controls="welcome-carousel-content"
                variants={paginationDot}
                animate={idx === currentScreen ? 'active' : 'inactive'}
                {...createDotAnimations(shouldReduceMotion)}
                transition={transitions.snappy}
                className="
                  relative w-8 h-8
                  flex items-center justify-center
                "
                aria-label={`Aller à l'écran ${idx + 1} sur ${WELCOME_SCREENS.length}`}
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
            {isLastScreen ? 'Compris' : 'Suivant'}
          </button>
        </div>
        </motion.div>
      </motion.div>
    </div>
  );

  // Portal pour éviter problèmes z-index
  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
