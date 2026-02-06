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
import { triggerCompletionConfetti } from './ConfettiCelebration';
import StepRenderer, { TooltipOnlyStep } from './StepRenderer';
import OnboardingModal from './OnboardingModal';
import OnboardingCompletionModal from './OnboardingCompletionModal';
import OnboardingTooltip from './OnboardingTooltip';
import OnboardingHighlight from './OnboardingHighlight';
import OnboardingMultiHighlight from './OnboardingMultiHighlight';
import { Pencil, Sparkles, ClipboardList, FileText, Target, Rocket, History, Download } from 'lucide-react';

// Mapping emoji → composant Lucide
const EMOJI_TO_ICON = {
  '✏️': Pencil,
  '✨': Sparkles,
  '📋': ClipboardList,
  '📄': FileText,
  '🎯': Target,
  '🚀': Rocket,
  '📝': History,
  '📥': Download,
};

const { MODAL_CLOSE_ANIMATION_DURATION, BUTTON_POLLING_INTERVAL, BUTTON_POLLING_TIMEOUT, STEP_VALIDATION_DELAY, MODAL_ANIMATION_DELAY } = ONBOARDING_TIMINGS;

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

  // Refs
  const step1ModalShownRef = useRef(false);
  const step2ModalShownRef = useRef(false);
  const step6ModalShownRef = useRef(false);
  const step8ModalShownRef = useRef(false);

  // Debounced persistence
  const { queueUpdate } = useDebouncedPersist(updateOnboardingState);

  // ========== RESTORATION DES ÉTATS ==========
  useEffect(() => {
    if (!isOnboardingStateLoaded(onboardingState)) return;

    if (onboardingState.step4?.cvGenerated) setCvGenerated(true);
    if (onboardingState.step4?.cvFilename) setGeneratedCvFilename(onboardingState.step4.cvFilename);

    if (onboardingState.modals) {
      step1ModalShownRef.current = onboardingState.modals.step1?.completed || false;
      step2ModalShownRef.current = onboardingState.modals.step2?.completed || false;
      step6ModalShownRef.current = onboardingState.modals.step6?.completed || false;
      step8ModalShownRef.current = onboardingState.modals.step8?.completed || false;
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

    const manuallyClosedByUser = onboardingState?.tooltips?.[String(currentStep)]?.closedManually || false;
    const stepCompleted = completedSteps.includes(currentStep);
    const modalKey = STEP_TO_MODAL_KEY[currentStep];
    const modalCompleted = modalKey ? (onboardingState?.modals?.[modalKey]?.completed || false) : false;

    setTooltipClosed(manuallyClosedByUser || stepCompleted || modalCompleted);
  }, [currentStep, onboardingState, completedSteps]);

  // Reset modal refs when leaving step
  useEffect(() => { if (currentStep !== 1) step1ModalShownRef.current = false; }, [currentStep]);
  useEffect(() => { if (currentStep !== 2) step2ModalShownRef.current = false; }, [currentStep]);
  useEffect(() => { if (currentStep !== 6) step6ModalShownRef.current = false; }, [currentStep]);
  useEffect(() => { if (currentStep !== 8) step8ModalShownRef.current = false; }, [currentStep]);

  // ========== STEP 1 PHASE A: TOOLTIP VISIBLE → BLOCK CLICKS (EXCEPT X) / RESTORED → SHOW MODAL ==========
  useEffect(() => {
    if (currentStep !== 1 || step1ModalShownRef.current) return;

    // Tooltip already closed (restoration) — show modal directly
    if (tooltipClosed) {
      step1ModalShownRef.current = true;
      setModalOpen(true);
      setCurrentScreen(0);
      return;
    }

    // Tooltip visible — block all clicks except the close button
    const handleClick = (e) => {
      if (step1ModalShownRef.current) return;
      if (e.target.closest('[data-onboarding-tooltip-close]')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => document.removeEventListener('click', handleClick, { capture: true });
  }, [currentStep, tooltipClosed]);

  // ========== STEP 1 PHASE B: AFTER MODAL CLOSED → WATCH KEBAB INTERACTION → COMPLETE STEP ==========
  useEffect(() => {
    if (currentStep !== 1 || modalOpen || !step1ModalShownRef.current) return;

    let menuWasSeen = false;
    let timeoutId = null;

    const checkState = () => {
      const menus = document.querySelectorAll('[role="menu"]');
      const dialogs = document.querySelectorAll('[role="dialog"]');

      if (menus.length > 0) menuWasSeen = true;

      if (menuWasSeen && menus.length === 0 && dialogs.length === 0) {
        observer.disconnect();
        timeoutId = setTimeout(() => markStepComplete(1), 300);
      }
    };

    const observer = new MutationObserver(checkState);
    observer.observe(document.body, { childList: true });

    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentStep, modalOpen, markStepComplete]);

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
      if (isCleanedUp) return;
      const task = event.detail?.task;
      if (isAiGenerationTask(task)) {
        setTimeout(() => { if (!isCleanedUp) markStepComplete(2); }, STEP_VALIDATION_DELAY);
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
  }, [currentStep, markStepComplete]);

  // ========== TASK COMPLETED HANDLER (steps 3, 5) ==========
  const handleTaskCompleted = useCallback((event) => {
    if (!isActive) return;
    const task = event.detail?.task;
    if (!task) return;

    if (isAiGenerationTask(task)) {
      const cvFilename = extractCvFilename(task.result);
      if (cvFilename) {
        setTaskCompleted(true);
        setCompletedTaskResult({ cvFilename });
      }
    }

    if (isMatchScoreTask(task) && currentStep === 5) {
      setTimeout(() => {
        markStepComplete(5);
        emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
      }, STEP_VALIDATION_DELAY);
    }
  }, [isActive, currentStep, markStepComplete]);

  useStableEventListener('task:completed', handleTaskCompleted);

  // ========== STEP 3: TASK MANAGER OPENED ==========
  const handleTaskManagerOpened = useCallback(() => {
    if (currentStep !== 3) return;
    markStepComplete(3);
    if (taskCompleted && completedTaskResult?.cvFilename) {
      setCvGenerated(true);
      setGeneratedCvFilename(completedTaskResult.cvFilename);
      emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, { cvFilename: completedTaskResult.cvFilename });
    }
  }, [currentStep, taskCompleted, completedTaskResult, markStepComplete]);

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
    markStepComplete(4);
  }, [currentStep, markStepComplete]);

  useStableEventListener(ONBOARDING_EVENTS.GENERATED_CV_OPENED, handleGeneratedCvOpened);

  // ========== STEP 5: AUTO-VALIDATION ==========
  useEffect(() => {
    if (currentStep !== 5) return;
    let attempts = 0;
    const interval = setInterval(() => {
      const matchScoreElement = document.querySelector('[data-onboarding="match-score"]');
      if (matchScoreElement?.textContent?.includes('%')) {
        setTimeout(() => {
          markStepComplete(5);
          emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
        }, STEP_VALIDATION_DELAY);
        clearInterval(interval);
      } else if (++attempts >= 10) {
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [currentStep, markStepComplete]);

  // ========== STEP 6: OPTIMIZE BUTTON INTERCEPTION ==========
  useEffect(() => {
    if (currentStep !== 6) return;
    let isCleanedUp = false;

    const handleOptimizeButtonClick = (e) => {
      if (isCleanedUp) return;
      const optimizeButton = e.target.closest('[data-onboarding="optimize"]');
      if (!optimizeButton || step6ModalShownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      step6ModalShownRef.current = true;
      setTooltipClosed(true);
      setModalOpen(true);
      setCurrentScreen(0);
    };

    const handleTaskCompleted = (event) => {
      if (isCleanedUp) return;
      const task = event.detail?.task;
      if (isImprovementTask(task)) {
        setTimeout(() => { if (!isCleanedUp) markStepComplete(6); }, STEP_VALIDATION_DELAY);
      }
    };

    document.addEventListener('click', handleOptimizeButtonClick, { capture: true });
    window.addEventListener('task:completed', handleTaskCompleted);

    return () => {
      isCleanedUp = true;
      document.removeEventListener('click', handleOptimizeButtonClick, { capture: true });
      window.removeEventListener('task:completed', handleTaskCompleted);
    };
  }, [currentStep, markStepComplete]);

  // ========== STEP 7: HISTORY CLOSED ==========
  const handleHistoryClosed = useCallback(() => {
    if (currentStep !== 7) return;
    markStepComplete(7);
  }, [currentStep, markStepComplete]);

  useStableEventListener(ONBOARDING_EVENTS.HISTORY_CLOSED, handleHistoryClosed);

  // ========== STEP 8: EXPORT BUTTON INTERCEPTION ==========
  useEffect(() => {
    if (currentStep !== 8) return;

    const handleExportButtonClick = (e) => {
      const exportButton = e.target.closest('[data-onboarding="export"]');
      if (!exportButton || step8ModalShownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      step8ModalShownRef.current = true;
      setTooltipClosed(true);
      setModalOpen(true);
      setCurrentScreen(0);
    };

    document.addEventListener('click', handleExportButtonClick, { capture: true });
    return () => document.removeEventListener('click', handleExportButtonClick, { capture: true });
  }, [currentStep]);

  // ========== STEP 8: EXPORT CLICKED ==========
  const handleExportClicked = useCallback(() => {
    if (currentStep !== 8) return;
    triggerCompletionConfetti();
    setShowCompletionModal(true);
    markStepComplete(8);
  }, [currentStep, markStepComplete]);

  useStableEventListener(ONBOARDING_EVENTS.EXPORT_CLICKED, handleExportClicked);

  // ========== STEP 9: COMPLETION MODAL ==========
  useEffect(() => {
    if (currentStep === 9 && !showCompletionModal && !hasCompleted && !isCompletingOnboarding) {
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
    // Step 1: ne pas compléter ici — l'utilisateur doit d'abord interagir avec un kebab
    if (currentStep === 2) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR), MODAL_ANIMATION_DELAY);
    }
    if (currentStep === 6) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER), MODAL_ANIMATION_DELAY);
    }
    if (currentStep === 8) {
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
    } else if (currentStep === 6) {
      setTimeout(() => emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER), MODAL_CLOSE_ANIMATION_DURATION);
    } else if (currentStep === 8) {
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

      await markTooltipClosed(currentStep);
    } catch (error) {
      setTooltipClosed(previousState);
    }
  };

  // ========== RENDER ==========
  const IconComponent = EMOJI_TO_ICON[step.emoji] || Pencil;

  // Étapes avec modal (1, 2, 6, 8)
  if ([1, 2, 6, 8].includes(currentStep)) {
    const showForStep8 = currentStep !== 8 || !showCompletionModal;

    return showForStep8 ? (
      <>
        <OnboardingHighlight
          show={!modalOpen && currentStep === step.id}
          blurEnabled={!tooltipClosed}
          targetSelector={step.targetSelector}
          additionalCutoutSelector={currentStep === 1 ? '[data-onboarding-edit-kebab]' : undefined}
        />
        {currentStep === 1 && (
          <OnboardingMultiHighlight
            selector="[data-onboarding-edit-kebab]"
            excludeSelector='[data-onboarding="edit-experience"]'
            show={!modalOpen}
            borderRadius={12}
          />
        )}
        <OnboardingTooltip
          show={!modalOpen && !tooltipClosed}
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
          onSkip={handleModalSkip}
          onClose={handleCloseModal}
          showSkipButton={true}
          size="large"
        />
        {currentStep === 8 && (
          <OnboardingCompletionModal open={showCompletionModal} onComplete={handleCompletionModalClose} />
        )}
      </>
    ) : (
      <OnboardingCompletionModal open={showCompletionModal} onComplete={handleCompletionModalClose} />
    );
  }

  // Étapes tooltip-only (3, 4, 5, 7)
  if ([3, 5, 7].includes(currentStep)) {
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
