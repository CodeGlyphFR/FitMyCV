'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingSteps } from '@/lib/onboarding/useOnboardingSteps';
import { getStepById } from '@/lib/onboarding/onboardingSteps';
import { ONBOARDING_TIMINGS, STEP_TO_MODAL_KEY } from '@/lib/onboarding/onboardingConfig';
import { isOnboardingStateLoaded } from '@/lib/onboarding/onboardingState';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';
import { isAiGenerationTask, isMatchScoreTask, isImprovementTask } from '@/lib/background-jobs/taskTypes';
import { extractCvFilename } from '@/lib/onboarding/cvFilenameUtils';
import { ONBOARDING_EVENTS, emitOnboardingEvent } from '@/lib/onboarding/onboardingEvents';
import { useDebouncedPersist, useStableEventListener } from './hooks';
import { triggerCompletionConfetti, triggerStepCelebration, triggerFinalCelebration } from './ConfettiCelebration';
import StepRenderer, { TooltipOnlyStep } from './StepRenderer';
import OnboardingModal from './OnboardingModal';
import OnboardingCompletionModal from './OnboardingCompletionModal';
import OnboardingTooltip from './OnboardingTooltip';
import OnboardingHighlight from './OnboardingHighlight';
import OnboardingMultiHighlight from './OnboardingMultiHighlight';
import { Pencil, Sparkles, ClipboardList, FileText, Search, Target, Rocket, RotateCcw, Download } from 'lucide-react';

// Mapping emoji → composant Lucide
const EMOJI_TO_ICON = {
  '✏️': Pencil,
  '✨': Sparkles,
  '📋': ClipboardList,
  '📄': FileText,
  '🔍': Search,
  '🎯': Target,
  '🚀': Rocket,
  '🔄': RotateCcw,
  '📥': Download,
};

const { MODAL_CLOSE_ANIMATION_DURATION, BUTTON_POLLING_INTERVAL, BUTTON_POLLING_TIMEOUT, STEP_VALIDATION_DELAY, MODAL_ANIMATION_DELAY, STEP_CELEBRATION_DURATION } = ONBOARDING_TIMINGS;

export default function OnboardingOrchestrator() {
  const {
    currentStep, isActive, isLoading, completedSteps, onboardingState, hasCompleted,
    markStepComplete, completeOnboarding, updateOnboardingState, markModalCompleted, markTooltipClosed,
  } = useOnboarding();

  const onboardingSteps = useOnboardingSteps();

  // État local pour les modals
  const [modalOpen, setModalOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(0);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [tooltipClosed, setTooltipClosed] = useState(false);

  // État pour la génération de CV (step 3 → 4)
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [completedTaskResult, setCompletedTaskResult] = useState(null);
  const [cvGenerated, setCvGenerated] = useState(onboardingState?.step4?.cvGenerated || false);
  const [generatedCvFilename, setGeneratedCvFilename] = useState(onboardingState?.step4?.cvFilename || null);

  // État pour le step 7 (optimisation → review)
  const [optimizationTaskDone, setOptimizationTaskDone] = useState(false);

  // Refs
  const step1ModalShownRef = useRef(false);
  const step2ModalShownRef = useRef(false);
  const step2CompletedRef = useRef(false);
  const step3CelebratedRef = useRef(false);
  const step5ModalShownRef = useRef(false);
  const step7ModalShownRef = useRef(false);
  const step7ReviewHandledRef = useRef(false);
  const step8ModalShownRef = useRef(false);
  const step9ModalShownRef = useRef(false);
  const celebrateAndCompleteRef = useRef(null);

  // Debounced persistence
  const { queueUpdate } = useDebouncedPersist(updateOnboardingState);

  // Celebration wrapper — déclenche confetti + son, puis complète l'étape après un délai
  const celebrateAndComplete = useCallback((step) => {
    triggerStepCelebration();
    setTimeout(() => markStepComplete(step), STEP_CELEBRATION_DURATION);
  }, [markStepComplete]);

  useEffect(() => { celebrateAndCompleteRef.current = celebrateAndComplete; }, [celebrateAndComplete]);

  // ========== RESTORATION DES ÉTATS ==========
  useEffect(() => {
    if (!isOnboardingStateLoaded(onboardingState)) return;

    if (onboardingState.step4?.cvGenerated) setCvGenerated(true);
    if (onboardingState.step4?.cvFilename) setGeneratedCvFilename(onboardingState.step4.cvFilename);

    // Ne jamais écraser un ref à false s'il est déjà true dans la session.
    // Les refs trackent "le modal a été montré dans cette session", ce qui est un fait
    // irréversible. Les remettre à false causerait des bugs (ex: Phase B du step 1
    // ne s'active pas car le ref est reset par un changement d'onboardingState non lié).
    // Le reset à false est géré par les effects de sortie de step (ex: currentStep !== 1).
    if (onboardingState.modals) {
      if (onboardingState.modals.step1?.completed) step1ModalShownRef.current = true;
      if (onboardingState.modals.step2?.completed) step2ModalShownRef.current = true;
      if (onboardingState.modals.step5?.completed) step5ModalShownRef.current = true;
      if (onboardingState.modals.step7?.completed) step7ModalShownRef.current = true;
      if (onboardingState.modals.step8?.completed) step8ModalShownRef.current = true;
      if (onboardingState.modals.step9?.completed) step9ModalShownRef.current = true;
    }
  }, [onboardingState]);

  // ========== PERSISTENCE ==========
  useEffect(() => {
    queueUpdate({
      step4: { cvGenerated, cvFilename: generatedCvFilename },
    });
  }, [cvGenerated, generatedCvFilename, queueUpdate]);

  // ========== TOOLTIP LOGIC ==========
  useEffect(() => {
    if (!isOnboardingStateLoaded(onboardingState)) {
      setTooltipClosed(false);
      return;
    }

    // Step 0 (welcome modal) n'a pas de tooltip dans l'orchestrateur.
    // Éviter de calculer tooltipClosed pour step 0, sinon la complétion
    // du welcome modal met tooltipClosed=true, et cette valeur stale
    // fait sauter le tooltip du step 1 lors de la transition 0→1.
    if (currentStep === 0) {
      setTooltipClosed(false);
      return;
    }

    const manuallyClosedByUser = onboardingState?.tooltips?.[String(currentStep)]?.closedManually || false;
    const stepCompleted = completedSteps.includes(currentStep);
    const modalKey = STEP_TO_MODAL_KEY[currentStep];
    const modalCompleted = modalKey ? (onboardingState?.modals?.[modalKey]?.completed || false) : false;

    setTooltipClosed(manuallyClosedByUser || stepCompleted || modalCompleted);
  }, [currentStep, onboardingState, completedSteps]);

  // Reset modal refs when leaving step
  useEffect(() => { if (currentStep !== 1) step1ModalShownRef.current = false; }, [currentStep]);
  useEffect(() => { if (currentStep !== 2) { step2ModalShownRef.current = false; step2CompletedRef.current = false; } }, [currentStep]);
  useEffect(() => { if (currentStep !== 3) step3CelebratedRef.current = false; }, [currentStep]);
  useEffect(() => { if (currentStep !== 5) step5ModalShownRef.current = false; }, [currentStep]);
  useEffect(() => {
    if (currentStep !== 7) {
      step7ModalShownRef.current = false;
      step7ReviewHandledRef.current = false;
      setOptimizationTaskDone(false);
    }
  }, [currentStep]);
  useEffect(() => { if (currentStep !== 8) step8ModalShownRef.current = false; }, [currentStep]);
  useEffect(() => { if (currentStep !== 9) step9ModalShownRef.current = false; }, [currentStep]);

  // ========== STEP 1 PHASE A: TOOLTIP VISIBLE → BLOCK CLICKS (EXCEPT X) / RESTORED → SHOW MODAL ==========
  // Pour un CV vide (pas d'expériences), l'élément cible n'existe pas encore.
  // On "pause" le step : l'UI reste interactive, l'utilisateur peut ajouter des expériences.
  // Dès que l'élément apparaît, le click-blocking et le tooltip s'activent normalement.
  const [step1TargetReady, setStep1TargetReady] = useState(false);

  useEffect(() => {
    if (currentStep !== 1 || step1ModalShownRef.current) return;

    // Tooltip already closed (restoration) — show modal directly
    if (tooltipClosed) {
      step1ModalShownRef.current = true;
      setStep1TargetReady(true);
      setModalOpen(true);
      setCurrentScreen(0);
      return;
    }

    // Vérifier si l'élément cible existe déjà (CV importé avec expériences)
    if (document.querySelector('[data-onboarding="edit-experience"]')) {
      setStep1TargetReady(true);
    } else {
      setStep1TargetReady(false);
    }

    // Observer le DOM pour détecter l'apparition de l'élément cible
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-onboarding="edit-experience"]')) {
        setStep1TargetReady(true);
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [currentStep, tooltipClosed]);

  // Click-blocking activé uniquement quand l'élément cible est prêt
  useEffect(() => {
    if (currentStep !== 1 || step1ModalShownRef.current || tooltipClosed || !step1TargetReady) return;

    const handleClick = (e) => {
      if (step1ModalShownRef.current) return;
      if (e.target.closest('[data-onboarding-tooltip-close]')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [currentStep, tooltipClosed, step1TargetReady]);

  // ========== STEP 1 PHASE B: AFTER MODAL CLOSED → WATCH KEBAB INTERACTION → COMPLETE STEP ==========
  useEffect(() => {
    if (currentStep !== 1 || modalOpen || !step1ModalShownRef.current) return;

    // Activer les highlights kebab (nécessaire au refresh : Phase A sort tôt
    // quand le modal est déjà complété et ne set jamais step1TargetReady).
    setStep1TargetReady(true);

    let menuWasSeen = false;
    let timeoutId = null;

    const checkState = () => {
      const menus = document.querySelectorAll('[role="menu"]');
      const dialogs = document.querySelectorAll('[role="dialog"]');

      if (menus.length > 0) menuWasSeen = true;

      if (menuWasSeen && menus.length === 0 && dialogs.length === 0) {
        observer.disconnect();
        timeoutId = setTimeout(() => celebrateAndCompleteRef.current(1), 300);
      }
    };

    const observer = new MutationObserver(checkState);
    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentStep, modalOpen]);

  // Step 1 validation is now handled in handleModalComplete (editing is always active)

  // ========== STEP 2: AI GENERATE BUTTON INTERCEPTION ==========
  useEffect(() => {
    if (currentStep !== 2) return;

    let aiGenerateButton = null;
    let isCleanedUp = false;
    let attempts = 0;
    const maxAttempts = Math.ceil(BUTTON_POLLING_TIMEOUT / BUTTON_POLLING_INTERVAL);

    const handleAiGenerateButtonClick = (e) => {
      if (isCleanedUp || step2ModalShownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      step2ModalShownRef.current = true;
      setTooltipClosed(true);
      setModalOpen(true);
      setCurrentScreen(0);
    };

    const handleTaskAdded = (event) => {
      if (isCleanedUp || step2CompletedRef.current) return;
      const task = event.detail?.task;
      if (isAiGenerationTask(task)) {
        step2CompletedRef.current = true;
        setTimeout(() => { if (!isCleanedUp) celebrateAndComplete(2); }, STEP_VALIDATION_DELAY);
      }
    };

    const interval = setInterval(() => {
      if (isCleanedUp) return clearInterval(interval);
      aiGenerateButton = document.querySelector('[data-onboarding="ai-generate"]');
      if (aiGenerateButton) {
        aiGenerateButton.addEventListener('click', handleAiGenerateButtonClick, { capture: true });
        clearInterval(interval);
      } else if (++attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, BUTTON_POLLING_INTERVAL);

    window.addEventListener('task:added', handleTaskAdded);

    return () => {
      isCleanedUp = true;
      clearInterval(interval);
      if (aiGenerateButton) aiGenerateButton.removeEventListener('click', handleAiGenerateButtonClick, { capture: true });
      window.removeEventListener('task:added', handleTaskAdded);
    };
  }, [currentStep, celebrateAndComplete]);

  // ========== TASK COMPLETED HANDLER (steps 3, 6) ==========
  const handleTaskCompleted = useCallback((event) => {
    if (!isActive) return;
    const task = event.detail?.task;
    if (!task) return;

    if (isAiGenerationTask(task)) {
      const cvFilename = extractCvFilename(task.result);
      if (cvFilename) {
        setTaskCompleted(true);
        setCompletedTaskResult({ cvFilename });

        // Si on est à l'étape 3, célébrer et compléter immédiatement
        if (currentStep === 3 && !step3CelebratedRef.current) {
          step3CelebratedRef.current = true;
          setCvGenerated(true);
          setGeneratedCvFilename(cvFilename);
          emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, { cvFilename });
          celebrateAndComplete(3);
        }
      }
    }

    if (isMatchScoreTask(task) && currentStep === 6) {
      setTimeout(() => {
        celebrateAndComplete(6);
        emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
      }, STEP_VALIDATION_DELAY);
    }
  }, [isActive, currentStep, celebrateAndComplete]);

  useStableEventListener('task:completed', handleTaskCompleted);

  // ========== STEP 3: TASK MANAGER OPENED ==========
  const handleTaskManagerOpened = useCallback(() => {
    if (currentStep !== 3) return;

    // Ne compléter step 3 QUE si la tâche AI est déjà terminée (cas: tâche finie avant d'arriver au step 3)
    if (taskCompleted && completedTaskResult?.cvFilename && !step3CelebratedRef.current) {
      step3CelebratedRef.current = true;
      setCvGenerated(true);
      setGeneratedCvFilename(completedTaskResult.cvFilename);
      emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, { cvFilename: completedTaskResult.cvFilename });
      celebrateAndComplete(3);
    }
    // Sinon, on ne fait rien — on attend que handleTaskCompleted détecte la fin
  }, [currentStep, taskCompleted, completedTaskResult, celebrateAndComplete]);

  useStableEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, handleTaskManagerOpened);

  // ========== STEP 3 → 4 TRANSITION ==========
  useEffect(() => {
    if (currentStep < 4 || !taskCompleted || !completedTaskResult?.cvFilename || cvGenerated) return;
    setCvGenerated(true);
    setGeneratedCvFilename(completedTaskResult.cvFilename);
    emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, { cvFilename: completedTaskResult.cvFilename });
  }, [currentStep, taskCompleted, completedTaskResult, cvGenerated]);

  // ========== STEP 4: CV OPENED ==========
  const handleGeneratedCvOpened = useCallback((event) => {
    if (currentStep !== 4) return;
    celebrateAndComplete(4);
  }, [currentStep, celebrateAndComplete]);

  useStableEventListener(ONBOARDING_EVENTS.GENERATED_CV_OPENED, handleGeneratedCvOpened);

  // ========== STEP 5: AI REVIEW ==========
  // Phase 1: Modal s'ouvre automatiquement (2 pages)
  // Phase 2: Après fermeture modal → scroll vers premier élément review + highlight
  // Completion: Event 'onboarding:all-reviews-completed' (émis par ReviewProvider)
  useEffect(() => {
    if (currentStep !== 5) return;

    // Si modal déjà montré (restoration), ne pas le réouvrir
    if (step5ModalShownRef.current) return;

    // Poller pour attendre que les éléments de review apparaissent dans le DOM.
    // Au step 4→5, le CV vient d'être ouvert et les composants de review ne sont pas
    // encore montés. On poll pendant 5s max avant de skip.
    let attempts = 0;
    const maxAttempts = 25; // 25 × 200ms = 5s

    const interval = setInterval(() => {
      if (step5ModalShownRef.current) {
        clearInterval(interval);
        return;
      }

      const pendingElements = document.querySelectorAll('[data-review-change-pending]');
      if (pendingElements.length > 0) {
        // Éléments trouvés → ouvrir le modal
        clearInterval(interval);
        step5ModalShownRef.current = true;
        setModalOpen(true);
        setCurrentScreen(0);
      } else if (++attempts >= maxAttempts) {
        // Timeout : pas de pending changes → skip automatique
        clearInterval(interval);
        celebrateAndComplete(5);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentStep, celebrateAndComplete]);

  // Step 5 Phase 2: Après fermeture du modal → scroll vers premier élément review
  useEffect(() => {
    if (currentStep !== 5 || modalOpen || !step5ModalShownRef.current) return;

    // Chercher d'abord un élément ambre (modified), sinon le premier pending
    const amberElement = document.querySelector('[data-review-change-pending][data-review-change-type="modified"]');
    const firstPending = amberElement || document.querySelector('[data-review-change-pending]');

    if (firstPending) {
      firstPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, modalOpen]);

  // Step 5 & 7: Écouter l'événement all-reviews-completed
  const handleAllReviewsCompleted = useCallback(() => {
    if (currentStep === 5) {
      celebrateAndComplete(5);
    } else if (currentStep === 7 && optimizationTaskDone && !step7ReviewHandledRef.current) {
      step7ReviewHandledRef.current = true;
      celebrateAndComplete(7);
    }
  }, [currentStep, optimizationTaskDone, celebrateAndComplete]);

  useStableEventListener(ONBOARDING_EVENTS.ALL_REVIEWS_COMPLETED, handleAllReviewsCompleted);

  // ========== STEP 6: AUTO-VALIDATION (match score) ==========
  useEffect(() => {
    if (currentStep !== 6) return;
    let attempts = 0;
    const interval = setInterval(() => {
      const matchScoreElement = document.querySelector('[data-onboarding="match-score"]');
      if (matchScoreElement?.textContent?.includes('%')) {
        setTimeout(() => {
          celebrateAndComplete(6);
          emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
        }, STEP_VALIDATION_DELAY);
        clearInterval(interval);
      } else if (++attempts >= 10) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentStep, celebrateAndComplete]);

  // ========== STEP 7: OPTIMIZE BUTTON INTERCEPTION ==========
  useEffect(() => {
    if (currentStep !== 7) return;
    let isCleanedUp = false;

    const handleOptimizeButtonClick = (e) => {
      if (isCleanedUp) return;
      const optimizeButton = e.target.closest('[data-onboarding="optimize"]');
      if (!optimizeButton || step7ModalShownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      step7ModalShownRef.current = true;
      setTooltipClosed(true);
      setModalOpen(true);
      setCurrentScreen(0);
    };

    // Phase 2: quand la tâche d'optimisation se termine, on ne complète PAS tout de suite.
    // On attend que l'utilisateur ait reviewé toutes les modifications.
    const handleTaskCompleted = (event) => {
      if (isCleanedUp || step7ReviewHandledRef.current) return;
      const task = event.detail?.task;
      if (isImprovementTask(task)) {
        // Attendre un délai pour laisser le DOM se mettre à jour avec les review items
        setTimeout(() => {
          if (isCleanedUp || step7ReviewHandledRef.current) return;
          const pendingElements = document.querySelectorAll('[data-review-change-pending]');
          if (pendingElements.length === 0) {
            // Cas edge : pas de modifications → compléter immédiatement
            step7ReviewHandledRef.current = true;
            celebrateAndComplete(7);
          } else {
            // Des modifications existent → attendre les reviews
            setOptimizationTaskDone(true);
          }
        }, 1000);
      }
    };

    // Fallback robustesse: si on arrive au step 7 et des pending existent déjà (refresh page)
    const pendingAtMount = document.querySelectorAll('[data-review-change-pending]');
    if (pendingAtMount.length > 0) {
      setOptimizationTaskDone(true);
    }

    document.addEventListener('click', handleOptimizeButtonClick, { capture: true });
    window.addEventListener('task:completed', handleTaskCompleted);

    return () => {
      isCleanedUp = true;
      document.removeEventListener('click', handleOptimizeButtonClick, { capture: true });
      window.removeEventListener('task:completed', handleTaskCompleted);
    };
  }, [currentStep, celebrateAndComplete]);

  // ========== STEP 8: VERSION MANAGEMENT (tooltip → modal) ==========
  // Quand le tooltip est fermé → ouvrir le modal
  // On utilise onboardingState.tooltips["8"].closedManually (persisté en DB) au lieu de
  // tooltipClosed (state local) pour éviter un faux positif lors de la transition step 7→8
  // (tooltipClosed reste à true du step précédent avant que le useEffect tooltip ne le reset)
  useEffect(() => {
    if (currentStep !== 8 || step8ModalShownRef.current || modalOpen) return;

    const step8TooltipClosed = onboardingState?.tooltips?.["8"]?.closedManually || false;
    if (!step8TooltipClosed) return;

    step8ModalShownRef.current = true;
    setModalOpen(true);
    setCurrentScreen(0);
  }, [currentStep, onboardingState, modalOpen]);

  // ========== STEP 9: EXPORT BUTTON INTERCEPTION ==========
  useEffect(() => {
    if (currentStep !== 9) return;

    const handleExportButtonClick = (e) => {
      const exportButton = e.target.closest('[data-onboarding="export"]');
      if (!exportButton || step9ModalShownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      step9ModalShownRef.current = true;
      setTooltipClosed(true);
      setModalOpen(true);
      setCurrentScreen(0);
    };

    document.addEventListener('click', handleExportButtonClick, { capture: true });
    return () => document.removeEventListener('click', handleExportButtonClick, { capture: true });
  }, [currentStep]);

  // ========== STEP 9: EXPORT CLICKED ==========
  const handleExportClicked = useCallback(async () => {
    if (currentStep !== 9) return;
    markStepComplete(9);
    // Célébration finale avec applaudissements, puis modal de complétion
    await triggerFinalCelebration(2500);
    setShowCompletionModal(true);
  }, [currentStep, markStepComplete]);

  useStableEventListener(ONBOARDING_EVENTS.EXPORT_CLICKED, handleExportClicked);

  // ========== STEP 10: COMPLETION MODAL ==========
  useEffect(() => {
    if (currentStep === 10 && !showCompletionModal && !hasCompleted && !isCompletingOnboarding) {
      setShowCompletionModal(true);
    }
  }, [currentStep, showCompletionModal, hasCompleted, isCompletingOnboarding]);

  // ========== HANDLERS ==========
  const handleCompletionModalClose = async ({ completed = false } = {}) => {
    setIsCompletingOnboarding(true);
    setShowCompletionModal(false);
    if (completed) {
      try { await markModalCompleted('completion'); } catch (e) { /* continue */ }
    }
    await completeOnboarding();
  };

  // Early return si pas actif
  if (!isActive || currentStep === 0 || isLoading) {
    return showCompletionModal ? (
      <OnboardingCompletionModal open={showCompletionModal} onComplete={handleCompletionModalClose} />
    ) : null;
  }

  const step = getStepById(onboardingSteps, currentStep);
  if (!step) {
    return showCompletionModal ? (
      <OnboardingCompletionModal open={showCompletionModal} onComplete={handleCompletionModalClose} />
    ) : null;
  }

  // ========== MODAL HANDLERS ==========
  const handleModalNext = () => {
    if (currentScreen < (step.modal?.screens?.length || 0) - 1) setCurrentScreen(prev => prev + 1);
  };

  const handleModalPrev = () => {
    if (currentScreen > 0) setCurrentScreen(prev => prev - 1);
  };

  const handleModalJumpTo = (screenIndex) => {
    const maxScreen = (step.modal?.screens?.length || 0) - 1;
    if (typeof screenIndex === 'number' && screenIndex >= 0 && screenIndex <= maxScreen) {
      setCurrentScreen(screenIndex);
    }
  };

  const handleCloseModal = async () => {
    setModalOpen(false);
    setTooltipClosed(true);

    // Actions spécifiques par étape (même si fermé par X)
    // Step 1: persister que le modal a été vu (pour éviter qu'il se réouvre au refresh),
    // mais ne PAS compléter le step — l'utilisateur doit d'abord interagir avec un kebab.
    if (currentStep === 1) {
      try { await markModalCompleted('step1'); } catch (e) { /* continue */ }
    }
    if (currentStep === 2) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR), MODAL_ANIMATION_DELAY);
    }
    if (currentStep === 7) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER), MODAL_ANIMATION_DELAY);
    }
    if (currentStep === 8) {
      celebrateAndComplete(8);
    }
    if (currentStep === 9) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_EXPORT), MODAL_ANIMATION_DELAY);
    }
  };

  const handleModalComplete = async () => {
    setModalOpen(false);
    setTooltipClosed(true);

    const modalKey = STEP_TO_MODAL_KEY[currentStep];
    if (modalKey) {
      try { await markModalCompleted(modalKey); } catch (e) { return; }
    }

    // Step 1: ne pas compléter ici — l'utilisateur doit d'abord interagir avec un kebab
    if (currentStep === 2) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR), MODAL_CLOSE_ANIMATION_DURATION);
    } else if (currentStep === 7) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER), MODAL_CLOSE_ANIMATION_DURATION);
    } else if (currentStep === 8) {
      celebrateAndComplete(8);
    } else if (currentStep === 9) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_EXPORT), MODAL_CLOSE_ANIMATION_DURATION);
    }
  };

  const handleModalSkip = () => {
    setModalOpen(false);
    markStepComplete(currentStep);
  };

  const handleTooltipClose = async () => {
    const previousState = tooltipClosed;
    try {
      setTooltipClosed(true);

      // Step 1: closing the tooltip opens the onboarding modal
      if (currentStep === 1 && !step1ModalShownRef.current) {
        step1ModalShownRef.current = true;
        setModalOpen(true);
        setCurrentScreen(0);
      }

      // Step 8: closing the tooltip opens the version management modal
      // (handled by the useEffect above, tooltipClosed triggers it)

      await markTooltipClosed(currentStep);
    } catch (error) {
      setTooltipClosed(previousState);
    }
  };

  // ========== RENDER ==========
  const IconComponent = EMOJI_TO_ICON[step.emoji] || Pencil;

  // Étapes avec modal (1, 2, 5, 7, 8, 9)
  if ([1, 2, 5, 7, 8, 9].includes(currentStep)) {
    const showForStep9 = currentStep !== 9 || !showCompletionModal;

    return showForStep9 ? (
      <>
        <OnboardingHighlight
          show={!modalOpen && currentStep === step.id && (currentStep !== 1 || step1TargetReady)}
          blurEnabled={!tooltipClosed}
          targetSelector={step.targetSelector}
          additionalCutoutSelector={currentStep === 1 ? '[data-onboarding-edit-kebab]' : undefined}
        />
        {currentStep === 1 && step1TargetReady && (
          <OnboardingMultiHighlight
            selector="[data-onboarding-edit-kebab]"
            excludeSelector='[data-onboarding="edit-experience"]'
            show={!modalOpen}
            borderRadius={12}
          />
        )}
        <OnboardingTooltip
          show={!modalOpen && !tooltipClosed && (currentStep !== 1 || step1TargetReady)}
          targetSelector={step.targetSelector}
          content={step.tooltip.content}
          position={step.tooltip.position}
          closable={true}
          onClose={handleTooltipClose}
        />
        <OnboardingModal
          open={modalOpen}
          screens={step.modal.screens}
          currentScreen={currentScreen}
          title={step.title}
          IconComponent={IconComponent}
          onNext={handleModalNext}
          onPrev={handleModalPrev}
          onJumpTo={handleModalJumpTo}
          onComplete={handleModalComplete}
          onClose={handleCloseModal}
          size="large"
        />
        {currentStep === 9 && (
          <OnboardingCompletionModal open={showCompletionModal} onComplete={handleCompletionModalClose} />
        )}
      </>
    ) : (
      <OnboardingCompletionModal open={showCompletionModal} onComplete={handleCompletionModalClose} />
    );
  }

  // Étapes tooltip-only (3, 6)
  if ([3, 6].includes(currentStep)) {
    return (
      <TooltipOnlyStep
        step={step}
        currentStep={currentStep}
        tooltipClosed={tooltipClosed}
        onTooltipClose={handleTooltipClose}
        persistent={currentStep === 3}
      />
    );
  }

  // Étape 4 avec précondition
  if (currentStep === 4) {
    if (!cvGenerated) return null;
    return (
      <TooltipOnlyStep
        step={step}
        currentStep={currentStep}
        tooltipClosed={tooltipClosed}
        onTooltipClose={handleTooltipClose}
        preconditionMet={cvGenerated}
      />
    );
  }

  return null;
}
