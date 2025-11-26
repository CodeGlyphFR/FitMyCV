'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAdmin } from '@/components/admin/AdminProvider';
import { getStepById } from '@/lib/onboarding/onboardingSteps';
import { ONBOARDING_TIMINGS, STEP_TO_MODAL_KEY, ONBOARDING_API } from '@/lib/onboarding/onboardingConfig';
import { isOnboardingStateLoaded } from '@/lib/onboarding/onboardingState';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';
import { isAiGenerationTask, isMatchScoreTask, isImprovementTask } from '@/lib/backgroundTasks/taskTypes';
import { extractCvFilename } from '@/lib/onboarding/cvFilenameUtils';
import { ONBOARDING_EVENTS, emitOnboardingEvent } from '@/lib/onboarding/onboardingEvents';
import OnboardingModal from './OnboardingModal';
import OnboardingCompletionModal from './OnboardingCompletionModal';
import OnboardingTooltip from './OnboardingTooltip';
import OnboardingHighlight from './OnboardingHighlight';
import confetti from 'canvas-confetti';
import { Pencil, Sparkles, ClipboardList, FileText, Target, Rocket, History, Download } from 'lucide-react';

// Mapping emoji → composant Lucide pour les icônes des modaux
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

/**
 * Orchestrateur des 8 étapes d'onboarding (optimisé v3)
 *
 * Changements v3 :
 * - Étape 7 : Historique uniquement (validée à la fermeture du modal historique)
 * - Étape 8 : Export avec modal tutoriel 3 écrans (validée au clic sur export)
 * - Total 8 étapes
 */

// Constantes importées du fichier de configuration centralisé
const MODAL_CLOSE_ANIMATION_DURATION = ONBOARDING_TIMINGS.MODAL_CLOSE_ANIMATION_DURATION;
const BUTTON_POLLING_INTERVAL = ONBOARDING_TIMINGS.BUTTON_POLLING_INTERVAL;
const BUTTON_POLLING_TIMEOUT = ONBOARDING_TIMINGS.BUTTON_POLLING_TIMEOUT;
const STEP_VALIDATION_DELAY = ONBOARDING_TIMINGS.STEP_VALIDATION_DELAY;

export default function OnboardingOrchestrator() {
  const {
    currentStep,
    isActive,
    isLoading,
    completedSteps,
    onboardingState,
    markStepComplete,
    goToNextStep,
    completeOnboarding,
    updateOnboardingState,
    markModalCompleted,
    markTooltipClosed,
  } = useOnboarding();

  const { editing, setEditing } = useAdmin();

  // État local pour les modals
  const [modalOpen, setModalOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(0);

  // État pour le modal de complétion (affiché après step 8)
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  // État pour gérer la fermeture individuelle des tooltips
  const [tooltipClosed, setTooltipClosed] = useState(false);

  // État pour tracker si une tâche de génération est complétée (mais ne déclenche PAS step 4 immédiatement)
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [completedTaskResult, setCompletedTaskResult] = useState(null);

  // État pour la précondition du step 4 (ne se définit qu'APRÈS validation step 3)
  const [cvGenerated, setCvGenerated] = useState(onboardingState?.step4?.cvGenerated || false);
  const [generatedCvFilename, setGeneratedCvFilename] = useState(onboardingState?.step4?.cvFilename || null);

  // Ref pour tracker l'état précédent du mode édition (étape 1)
  const prevEditingRef = useRef(editing);

  // Refs pour tracker si les modals ont été montrés (pas besoin de persister)
  const step1ModalShownRef = useRef(false);
  const step2ModalShownRef = useRef(false);
  const step6ModalShownRef = useRef(false);
  const step8ModalShownRef = useRef(false);

  // Ref pour le handler export-clicked (pattern stable comme step 7)
  const handleExportClickedRef = useRef();

  // ========== RESTORATION DES ÉTATS DEPUIS onboardingState (AU MOUNT) ==========

  // Restaurer les états depuis onboardingState quand il est chargé depuis l'API
  useEffect(() => {
    // Wait for onboardingState to load (avoid race condition with empty state during initial mount)
    if (!isOnboardingStateLoaded(onboardingState)) {
      onboardingLogger.log('[Onboarding] Restoration waiting for onboardingState to load...');
      return;
    }

    // Validation et restauration step4 state
    if (onboardingState.step4 && typeof onboardingState.step4 === 'object') {
      if (typeof onboardingState.step4.cvGenerated === 'boolean') {
        setCvGenerated(onboardingState.step4.cvGenerated);
      }
      if (typeof onboardingState.step4.cvFilename === 'string') {
        setGeneratedCvFilename(onboardingState.step4.cvFilename);
      }
    }

    // Note: Modal completion flags are now read directly from onboardingState.modals
    // No need to copy to local state

    // Sync modal shown refs with DB state (allow re-opening if not completed)
    // If modal.completed = false → ref = false → modal can re-open on next click
    // If modal.completed = true → ref = true → modal won't re-open
    if (onboardingState.modals && typeof onboardingState.modals === 'object') {
      if (onboardingState.modals.step1) {
        step1ModalShownRef.current = onboardingState.modals.step1.completed || false;
      }
      if (onboardingState.modals.step2) {
        step2ModalShownRef.current = onboardingState.modals.step2.completed || false;
      }
      if (onboardingState.modals.step6) {
        step6ModalShownRef.current = onboardingState.modals.step6.completed || false;
      }
      if (onboardingState.modals.step8) {
        step8ModalShownRef.current = onboardingState.modals.step8.completed || false;
      }
    }

    // Logging for debugging (show what was restored)
    onboardingLogger.log(
      '[Onboarding] State restored from DB: ' +
      `step4.cvGenerated=${onboardingState.step4?.cvGenerated}, ` +
      `modals=${Object.keys(onboardingState.modals || {}).length}, ` +
      `tooltips=${Object.keys(onboardingState.tooltips || {}).length}, ` +
      `step1Modal=${step1ModalShownRef.current}, ` +
      `step2Modal=${step2ModalShownRef.current}, ` +
      `step6Modal=${step6ModalShownRef.current}, ` +
      `step8Modal=${step8ModalShownRef.current}`
    );
  }, [onboardingState]); // Trigger uniquement quand onboardingState change

  // ========== FIN RESTORATION ==========

  // ========== PERSISTENCE DES ÉTATS DANS onboardingState ==========

  // Ref pour accumuler les updates avant persistence (évite race conditions)
  const pendingUpdatesRef = useRef({});
  const persistTimeoutRef = useRef(null);
  const persistInProgressRef = useRef(false); // Track requête en cours (empêche parallèles)

  // Stocker updateOnboardingState dans une ref pour stabilité (évite re-création de debouncedPersist)
  const updateOnboardingStateRef = useRef();
  useEffect(() => {
    updateOnboardingStateRef.current = updateOnboardingState;
  }, [updateOnboardingState]);

  // Fonction debouncée pour batch toutes les updates ensemble (STABLE - pas de deps)
  const debouncedPersist = useCallback(() => {
    // Clear timeout précédent
    if (persistTimeoutRef.current) {
      clearTimeout(persistTimeoutRef.current);
      persistTimeoutRef.current = null;
    }

    // Debounce basé sur CACHE_TTL pour cohérence avec l'API
    persistTimeoutRef.current = setTimeout(async () => {
      persistTimeoutRef.current = null;

      // Skip si pas d'updates ou requête déjà en cours
      if (!updateOnboardingStateRef.current || Object.keys(pendingUpdatesRef.current).length === 0 || persistInProgressRef.current) {
        return;
      }

      const updates = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {}; // Clear pending

      // Marquer requête en cours
      persistInProgressRef.current = true;

      try {
        await updateOnboardingStateRef.current(updates);
      } catch (error) {
        onboardingLogger.error('[Onboarding] Error persisting state:', error);
      } finally {
        persistInProgressRef.current = false;
      }
    }, ONBOARDING_API.CACHE_TTL); // Synchronisé avec CACHE_TTL de l'API
  }, []); // ← VIDE deps pour stabilité (pas de re-création)

  // Single effect consolidé pour tous les états à persister
  // Note: Modals sont maintenant persistés via markModalCompleted() directement
  useEffect(() => {
    if (!updateOnboardingStateRef.current) return;

    // Accumuler tous les updates (step4 uniquement, modals gérés par markModalCompleted)
    pendingUpdatesRef.current = {
      step4: {
        cvGenerated,
        cvFilename: generatedCvFilename,
      },
    };

    // Déclencher persistence debouncée
    debouncedPersist();
  }, [
    cvGenerated,
    generatedCvFilename,
    debouncedPersist, // ← OK car debouncedPersist est STABLE maintenant (deps vides)
  ]);

  // Cleanup du timeout au unmount (avec flush des pending updates)
  useEffect(() => {
    return () => {
      if (persistTimeoutRef.current) {
        clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;

        // Flush pending updates immédiatement pour ne pas perdre de données
        if (updateOnboardingStateRef.current &&
            Object.keys(pendingUpdatesRef.current).length > 0 &&
            !persistInProgressRef.current) {
          const updates = { ...pendingUpdatesRef.current };
          pendingUpdatesRef.current = {};

          onboardingLogger.log('[Onboarding] Flush pending updates au unmount:', updates);

          // Fire-and-forget (async sans await pour ne pas bloquer unmount)
          updateOnboardingStateRef.current(updates).catch(err => {
            onboardingLogger.error('[Onboarding] Failed to flush on unmount:', err);
          });
        }
      }
    };
  }, []);

  // ========== FIN PERSISTENCE ==========

  // ========== CONSOLIDATED TOOLTIP LOGIC ==========
  // Manages tooltip visibility based on:
  //   1. Manual close by user (onboardingState.tooltips[step].closedManually)
  //   2. Step completion (completedSteps.includes(currentStep))
  //
  // IMPORTANT: prevEditingRef is intentionally NOT reset here to avoid race condition
  //
  // Race condition scenario (BEFORE fix):
  //   1. User exits edit mode (editing: true → false)
  //   2. This effect runs first, resets prevEditingRef to false
  //   3. Validation effect (lines 334-353) runs, sees prevEditingRef=false, editing=false
  //   4. No transition detected → Step 1 never validates ❌
  //
  // Fixed behavior (AFTER removing prevEditingRef reset):
  //   1. User exits edit mode (editing: true → false)
  //   2. This effect runs, only manages tooltip (prevEditingRef unchanged)
  //   3. Validation effect runs, sees prevEditingRef=true, editing=false
  //   4. Transition detected → Step 1 validates correctly ✅
  //
  // prevEditingRef is now managed ONLY by the validation effect itself (line 352)
  useEffect(() => {
    // Wait for onboardingState to load (avoid race condition with empty state during initial mount)
    if (!isOnboardingStateLoaded(onboardingState)) {
      // Default behavior: show tooltip until we know better from DB
      setTooltipClosed(false);
      onboardingLogger.log('[Onboarding] Tooltip waiting for onboardingState to load...');
      return;
    }

    // Condition 1: User closed tooltip manually
    const manuallyClosedByUser = onboardingState?.tooltips?.[String(currentStep)]?.closedManually || false;

    // Condition 2: Step completed
    const stepCompleted = completedSteps.includes(currentStep);

    // Condition 3: Modal completed for this step (user clicked "Compris")
    const modalKey = STEP_TO_MODAL_KEY[currentStep];
    const modalCompleted = modalKey ? (onboardingState?.modals?.[modalKey]?.completed || false) : false;

    // Tooltip should be closed if ANY of these conditions is true
    const shouldCloseTooltip = manuallyClosedByUser || stepCompleted || modalCompleted;

    setTooltipClosed(shouldCloseTooltip);

    // Logging for debugging (always log to track behavior, not just when closed)
    onboardingLogger.log(
      `[Onboarding] Tooltip step ${currentStep}: ` +
      `show=${!shouldCloseTooltip}, manual=${manuallyClosedByUser}, completed=${stepCompleted}, modal=${modalCompleted}`
    );
  }, [currentStep, onboardingState, completedSteps]);

  // Cleanup : Reset step refs when leaving the step
  useEffect(() => {
    if (currentStep !== 1) {
      step1ModalShownRef.current = false;
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 2) {
      step2ModalShownRef.current = false;
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 6) {
      step6ModalShownRef.current = false;
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep !== 8) {
      step8ModalShownRef.current = false;
    }
  }, [currentStep]);

  // ========== ÉTAPE 1 : INTERCEPTION CLIC BOUTON MODE ÉDITION ==========
  useEffect(() => {
    if (currentStep !== 1) return;

    /**
     * Intercepter le clic pour ouvrir le modal AVANT l'activation du mode édition
     * ONLY on the first click (before modal is shown)
     */
    const handleEditModeButtonClick = (e) => {
      // If modal was already shown, let the normal click behavior proceed
      if (step1ModalShownRef.current) {
        onboardingLogger.log('[Onboarding] Step 1: Modal already shown, allowing normal button behavior');
        return; // Don't prevent default, let the button toggle edit mode normally
      }

      // First click: prevent default and open modal
      e.preventDefault(); // Empêcher l'activation du mode édition
      e.stopPropagation();

      // Mark modal as shown
      step1ModalShownRef.current = true;

      // Fermer le tooltip temporairement (UI seulement)
      // Ne PAS persister en DB car le tooltip n'a pas été fermé manuellement par X
      setTooltipClosed(true);

      // Ouvrir le modal onboarding (s'exécute immédiatement sans attendre)
      setModalOpen(true);
      setCurrentScreen(0);
    };

    // Retry mechanism : polling pour trouver le bouton
    let attempts = 0;
    const maxAttempts = Math.ceil(BUTTON_POLLING_TIMEOUT / BUTTON_POLLING_INTERVAL);
    let editModeButton = null;

    const attachListener = () => {
      editModeButton = document.querySelector('[data-onboarding="edit-mode-button"]');

      if (editModeButton) {
        // Bouton trouvé → attacher le listener
        editModeButton.addEventListener('click', handleEditModeButtonClick, { capture: true });
        return true; // Stop polling
      }

      attempts++;
      if (attempts >= maxAttempts) {
        onboardingLogger.error(`[Onboarding] Étape 1 : Bouton mode édition non trouvé après ${BUTTON_POLLING_TIMEOUT}ms`);
        return true; // Stop polling après timeout
      }

      return false; // Continue polling
    };

    // Polling
    const interval = setInterval(() => {
      const attached = attachListener();
      if (attached) clearInterval(interval);
    }, BUTTON_POLLING_INTERVAL);

    return () => {
      clearInterval(interval);
      if (editModeButton) {
        editModeButton.removeEventListener('click', handleEditModeButtonClick, { capture: true });
      }
    };
  }, [currentStep]);

  // ========== ÉTAPE 1 : VALIDATION QUAND L'UTILISATEUR QUITTE LE MODE ÉDITION ==========
  useEffect(() => {
    if (currentStep !== 1) return;

    // Skip validation if modal is open to avoid premature validation during modal close animation
    if (modalOpen) {
      onboardingLogger.log('[Onboarding] Step 1: Skipping validation while modal open');
      return;
    }

    // Détecter la transition editing: true → false (utilisateur quitte le mode édition)
    // La validation se déclenche uniquement sur true → false, donc pas de faux positifs
    // lors de l'activation du mode édition (false → true)
    if (prevEditingRef.current === true && editing === false) {
      onboardingLogger.log('[Onboarding] Step 1 : Utilisateur a quitté le mode édition, validation du step');
      markStepComplete(1);
    }

    // Mettre à jour la ref pour la prochaine vérification
    prevEditingRef.current = editing;
  }, [currentStep, editing, modalOpen, markStepComplete]);

  // ========== ÉTAPE 2 : INTERCEPTION CLIC BOUTON AI GENERATE + VALIDATION ==========
  useEffect(() => {
    if (currentStep !== 2) return;

    let aiGenerateButton = null;
    let buttonInterval = null;
    let isCleanedUp = false; // Track cleanup state pour éviter les actions après unmount

    /**
     * Intercepter le clic sur le bouton AI Generate pour ouvrir le modal explicatif
     * AVANT de permettre la génération
     */
    const handleAiGenerateButtonClick = (e) => {
      if (isCleanedUp) return; // Prevent execution after cleanup

      // If modal was already shown, let the normal click behavior proceed
      if (step2ModalShownRef.current) {
        onboardingLogger.log('[Onboarding] Step 2: Modal already shown, allowing normal button behavior');
        return; // Don't prevent default, let the button open generator normally
      }

      // First click: prevent default and open modal
      e.preventDefault();
      e.stopPropagation();

      // Mark modal as shown
      step2ModalShownRef.current = true;

      // Fermer le tooltip immédiatement
      setTooltipClosed(true);

      // Ouvrir le modal explicatif
      setModalOpen(true);
      setCurrentScreen(0);
    };

    // Retry mechanism : polling pour trouver le bouton
    let attempts = 0;
    const maxAttempts = Math.ceil(BUTTON_POLLING_TIMEOUT / BUTTON_POLLING_INTERVAL);

    const attachListener = () => {
      if (isCleanedUp) return true; // Stop if cleaned up

      aiGenerateButton = document.querySelector('[data-onboarding="ai-generate"]');

      if (aiGenerateButton) {
        // Bouton trouvé → attacher le listener
        aiGenerateButton.addEventListener('click', handleAiGenerateButtonClick, { capture: true });
        return true; // Stop polling
      }

      attempts++;
      if (attempts >= maxAttempts) {
        onboardingLogger.error(`[Onboarding] Étape 2 : Bouton AI Generate non trouvé après ${BUTTON_POLLING_TIMEOUT}ms`);
        return true; // Stop polling après timeout
      }

      return false; // Continue polling
    };

    // Polling
    buttonInterval = setInterval(() => {
      const attached = attachListener();
      if (attached) clearInterval(buttonInterval);
    }, BUTTON_POLLING_INTERVAL);

    // Écouter l'événement task:added pour détecter la génération IA
    const handleTaskAdded = (event) => {
      if (isCleanedUp) return;

      const task = event.detail?.task;

      // Vérifier que c'est bien une tâche de génération IA
      // Utilise les constantes centralisées pour éviter les erreurs de typage
      if (isAiGenerationTask(task)) {
        onboardingLogger.log('[Onboarding] Step 2 : Génération IA détectée, validation du step');

        // Ajouter un délai pour permettre à toutes les opérations async de se terminer
        // avant de valider le step et déclencher la transition
        setTimeout(() => {
          if (!isCleanedUp) {
            markStepComplete(2);
          }
        }, STEP_VALIDATION_DELAY);
      }
    };

    window.addEventListener('task:added', handleTaskAdded);

    // Cleanup function
    return () => {
      isCleanedUp = true; // Mark as cleaned up

      if (buttonInterval) clearInterval(buttonInterval);
      if (aiGenerateButton) {
        aiGenerateButton.removeEventListener('click', handleAiGenerateButtonClick, { capture: true });
      }
      window.removeEventListener('task:added', handleTaskAdded);
    };
  }, [currentStep, markStepComplete]);

  // ========== STEP 3 : ÉCOUTER task:completed POUR DÉTECTER FIN DE GÉNÉRATION ==========
  // IMPORTANT: Utilisation de useRef pour éviter la re-registration lors des changements de isActive
  const handleTaskCompletedRef = useRef();

  // Mettre à jour la ref quand les dépendances changent
  useEffect(() => {
    handleTaskCompletedRef.current = (event) => {
      if (!isActive) return; // Filtrer par isActive

      try {
        const task = event.detail?.task;
        if (!task) {
          onboardingLogger.warn('[Onboarding] task:completed event missing task detail');
          return;
        }

        // Vérifier si c'est une tâche de génération IA
        if (isAiGenerationTask(task)) {
          onboardingLogger.log('[Onboarding] Tâche de génération IA terminée, stockage du résultat');

          // Extraire le nom du fichier CV généré de manière cohérente
          const cvFilename = extractCvFilename(task.result);
          if (!cvFilename) {
            onboardingLogger.warn('[Onboarding] Tâche IA terminée mais pas de fichier CV trouvé');
            return;
          }

          // Stocker que la tâche est complétée, mais NE PAS déclencher step 4 immédiatement
          // Step 4 se déclenchera seulement après validation de step 3
          setTaskCompleted(true);
          setCompletedTaskResult({ cvFilename });

          onboardingLogger.log('[Onboarding] Tâche complétée, en attente de validation step 3');
        }

        // Vérifier si c'est une tâche de calcul de match score (step 5)
        if (isMatchScoreTask(task) && currentStep === 5) {
          onboardingLogger.log('[Onboarding] Step 5 : Calcul de match score terminé, validation du step');

          // Délai pour permettre aux animations et requêtes async de se terminer
          setTimeout(() => {
            markStepComplete(5);
            // Émettre l'événement pour la précondition du step 6
            emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
          }, STEP_VALIDATION_DELAY);
        }
      } catch (error) {
        onboardingLogger.error('[Onboarding] Error in handleTaskCompleted:', error);
      }
    };
  }, [isActive, currentStep, markStepComplete]);

  // Enregistrer le listener une seule fois avec un wrapper stable
  useEffect(() => {
    const stableHandler = (event) => handleTaskCompletedRef.current?.(event);

    window.addEventListener('task:completed', stableHandler);
    return () => {
      window.removeEventListener('task:completed', stableHandler);
    };
  }, []); // Empty deps - register once

  // ========== STEP 3 : ÉCOUTER task_manager_opened ==========
  // Utilisation de useRef pour éviter la re-registration
  const handleTaskManagerOpenedRef = useRef();

  // Mettre à jour la ref quand les dépendances changent
  useEffect(() => {
    handleTaskManagerOpenedRef.current = () => {
      if (currentStep !== 3) return; // Filtrer dans le handler

      try {
        onboardingLogger.log('[Onboarding] Step 3 : Task manager ouvert, validation immédiate du step');

        // Valider step 3 immédiatement (c'est suffisant pour compléter l'étape)
        markStepComplete(3);

        // Si la tâche est déjà complétée, déclencher step 4 immédiatement
        if (taskCompleted && completedTaskResult?.cvFilename) {
          onboardingLogger.log('[Onboarding] Tâche déjà complétée, déclenchement step 4');
          setCvGenerated(true);
          setGeneratedCvFilename(completedTaskResult.cvFilename);
          emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, {
            cvFilename: completedTaskResult.cvFilename
          });
        }
      } catch (error) {
        onboardingLogger.error('[Onboarding] Error in handleTaskManagerOpened:', error);
      }
    };
  }, [currentStep, taskCompleted, completedTaskResult, markStepComplete]);

  // Enregistrer le listener une seule fois
  useEffect(() => {
    const stableHandler = () => handleTaskManagerOpenedRef.current?.();

    window.addEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, stableHandler);
    return () => {
      window.removeEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, stableHandler);
    };
  }, []); // Empty deps - register once

  // ========== STEP 3 → STEP 4 : DÉCLENCHER STEP 4 QUAND TÂCHE SE TERMINE (APRÈS VALIDATION STEP 3) ==========
  useEffect(() => {
    // Déclencher step 4 seulement si:
    // - On a validé step 3 (currentStep >= 4 signifie qu'on a déjà passé step 3)
    // - Une tâche est complétée
    // - cvGenerated n'est pas encore défini (pour éviter de déclencher plusieurs fois)
    if (currentStep < 4 || !taskCompleted || !completedTaskResult?.cvFilename || cvGenerated) return;

    // Step 3 est validé, et la tâche est complétée → déclencher step 4
    onboardingLogger.log('[Onboarding] Step 3 validé + tâche complétée → déclenchement step 4');
    setCvGenerated(true);
    setGeneratedCvFilename(completedTaskResult.cvFilename);
    emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, {
      cvFilename: completedTaskResult.cvFilename
    });
  }, [currentStep, taskCompleted, completedTaskResult, cvGenerated]);

  // ========== STEP 4 : ÉCOUTER generatedCvOpened POUR VALIDER ==========
  // Utilisation de useRef pour éviter la re-registration
  const handleGeneratedCvOpenedRef = useRef();

  // Mettre à jour la ref quand les dépendances changent
  useEffect(() => {
    handleGeneratedCvOpenedRef.current = (event) => {
      if (currentStep !== 4) return; // Filtrer dans le handler

      try {
        const cvFilename = event.detail?.cvFilename;
        onboardingLogger.log('[Onboarding] Step 4 : CV récemment généré sélectionné:', cvFilename);

        // Valider le step 4
        markStepComplete(4);
      } catch (error) {
        onboardingLogger.error('[Onboarding] Error in handleGeneratedCvOpened:', error);
      }
    };
  }, [currentStep, markStepComplete]);

  // Enregistrer le listener une seule fois
  useEffect(() => {
    const stableHandler = (event) => handleGeneratedCvOpenedRef.current?.(event);

    window.addEventListener(ONBOARDING_EVENTS.GENERATED_CV_OPENED, stableHandler);
    return () => {
      window.removeEventListener(ONBOARDING_EVENTS.GENERATED_CV_OPENED, stableHandler);
    };
  }, []); // Empty deps - register once

  // ========== STEP 5 : VÉRIFIER SI SCORE DÉJÀ CALCULÉ (AUTO-VALIDATION) ==========
  useEffect(() => {
    if (currentStep !== 5) return;

    // Vérifier si le match score est déjà calculé (ex: session précédente)
    const checkExistingScore = () => {
      const matchScoreElement = document.querySelector('[data-onboarding="match-score"]');
      if (matchScoreElement && matchScoreElement.textContent?.includes('%')) {
        onboardingLogger.log('[Onboarding] Step 5 : Score déjà calculé, auto-validation');
        setTimeout(() => {
          markStepComplete(5);
          emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
        }, STEP_VALIDATION_DELAY);
        return true;
      }
      return false;
    };

    // Polling pour attendre que le DOM soit prêt
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      if (checkExistingScore() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [currentStep, markStepComplete]);

  // ========== ÉTAPE 6 : INTERCEPTION CLIC BOUTON OPTIMIZE + VALIDATION ==========
  useEffect(() => {
    if (currentStep !== 6) return;

    let isCleanedUp = false;

    /**
     * Intercepter le clic sur le bouton Optimize pour ouvrir le modal explicatif
     * AVANT de permettre l'optimisation
     * Utilise event delegation sur document pour gérer les re-renders du composant
     */
    const handleOptimizeButtonClick = (e) => {
      if (isCleanedUp) return;

      // Vérifier si le clic est sur le bouton optimize (ou un de ses enfants)
      const optimizeButton = e.target.closest('[data-onboarding="optimize"]');
      if (!optimizeButton) return;

      // If modal was already shown, let the normal click behavior proceed
      if (step6ModalShownRef.current) {
        onboardingLogger.log('[Onboarding] Step 6: Modal already shown, allowing normal button behavior');
        return;
      }

      // First click: prevent default and open modal
      e.preventDefault();
      e.stopPropagation();

      // Mark modal as shown
      step6ModalShownRef.current = true;

      // Fermer le tooltip immédiatement
      setTooltipClosed(true);

      // Ouvrir le modal explicatif
      setModalOpen(true);
      setCurrentScreen(0);
    };

    // Utiliser event delegation sur document (capture phase)
    // Cela fonctionne même si le bouton est re-rendu par React
    document.addEventListener('click', handleOptimizeButtonClick, { capture: true });

    // Écouter l'événement task:completed pour détecter la fin de l'optimisation
    const handleTaskCompleted = (event) => {
      if (isCleanedUp) return;

      const task = event.detail?.task;

      if (isImprovementTask(task)) {
        onboardingLogger.log('[Onboarding] Step 6 : Optimisation terminée, validation du step');

        setTimeout(() => {
          if (!isCleanedUp) {
            markStepComplete(6);
          }
        }, STEP_VALIDATION_DELAY);
      }
    };

    window.addEventListener('task:completed', handleTaskCompleted);

    // Cleanup function
    return () => {
      isCleanedUp = true;
      document.removeEventListener('click', handleOptimizeButtonClick, { capture: true });
      window.removeEventListener('task:completed', handleTaskCompleted);
    };
  }, [currentStep, markStepComplete]);

  // ========== STEP 7 : ÉCOUTER history-closed ==========
  // Utilisation de useRef pour éviter la re-registration (pattern stable)
  const handleHistoryClosedRef = useRef();

  // Mettre à jour la ref quand les dépendances changent
  useEffect(() => {
    handleHistoryClosedRef.current = () => {
      if (currentStep !== 7) return; // Filtrer dans le handler

      onboardingLogger.log('[Onboarding] Step 7 : Modal historique fermé, validation du step');
      markStepComplete(7);
    };
  }, [currentStep, markStepComplete]);

  // Enregistrer le listener une seule fois avec un wrapper stable
  useEffect(() => {
    const stableHandler = () => handleHistoryClosedRef.current?.();

    window.addEventListener(ONBOARDING_EVENTS.HISTORY_CLOSED, stableHandler);
    return () => {
      window.removeEventListener(ONBOARDING_EVENTS.HISTORY_CLOSED, stableHandler);
    };
  }, []); // Empty deps - register once

  // ========== ÉTAPE 8 : INTERCEPTION CLIC BOUTON EXPORT ==========
  useEffect(() => {
    if (currentStep !== 8) return;

    /**
     * Intercepter le clic sur le bouton Export pour ouvrir le modal tutoriel
     * AVANT d'ouvrir le modal d'export réel
     */
    const handleExportButtonClick = (e) => {
      // Vérifier si le clic est sur le bouton export (ou un de ses enfants)
      const exportButton = e.target.closest('[data-onboarding="export"]');
      if (!exportButton) return;

      // If modal was already shown, let the normal click behavior proceed
      if (step8ModalShownRef.current) {
        onboardingLogger.log('[Onboarding] Step 8: Modal already shown, allowing normal button behavior');
        return;
      }

      // First click: prevent default and open tutorial modal
      e.preventDefault();
      e.stopPropagation();

      // Mark modal as shown
      step8ModalShownRef.current = true;

      // Fermer le tooltip immédiatement
      setTooltipClosed(true);

      // Ouvrir le modal tutoriel
      setModalOpen(true);
      setCurrentScreen(0);
    };

    // Utiliser event delegation sur document (capture phase)
    document.addEventListener('click', handleExportButtonClick, { capture: true });

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleExportButtonClick, { capture: true });
    };
  }, [currentStep]);

  // ========== STEP 8 : ÉCOUTER export-clicked ==========
  // Utilisation de useRef pour éviter la re-registration (pattern stable comme step 7)
  useEffect(() => {
    handleExportClickedRef.current = () => {
      if (currentStep !== 8) return; // Filtrer dans le handler

      onboardingLogger.log('[Onboarding] Step 8 : Export cliqué, validation du step');

      // Confetti pour célébrer
      triggerCompletionConfetti();

      // IMPORTANT: Afficher le modal de complétion AVANT markStepComplete
      // car markStepComplete(8) rend isActive = false, ce qui pourrait
      // empêcher le rendu du modal
      setShowCompletionModal(true);

      // Marquer le step comme complété
      markStepComplete(8);
    };
  }, [currentStep, markStepComplete]);

  // Enregistrer le listener une seule fois avec un wrapper stable
  useEffect(() => {
    const stableHandler = () => handleExportClickedRef.current?.();

    window.addEventListener(ONBOARDING_EVENTS.EXPORT_CLICKED, stableHandler);
    return () => {
      window.removeEventListener(ONBOARDING_EVENTS.EXPORT_CLICKED, stableHandler);
    };
  }, []); // Empty deps - register once

  /**
   * Handler pour la fermeture du modal de complétion
   * Appelé quand l'utilisateur termine le carrousel de fin ou ferme le modal
   * IMPORTANT: Défini ici car utilisé dans le early return ci-dessous
   */
  const handleCompletionModalClose = async () => {
    setShowCompletionModal(false);

    // Mark completion modal as completed in DB
    try {
      await markModalCompleted('completion');
    } catch (error) {
      onboardingLogger.error('[Onboarding] Failed to persist completion modal:', error);
      // Continue anyway - onboarding completion is more critical
    }

    // Marquer l'onboarding comme complété
    await completeOnboarding();
  };

  // Ne rien afficher si pas actif, en cours de chargement, SAUF si le modal de complétion doit être affiché
  if (!isActive || currentStep === 0 || isLoading) {
    // Toujours rendre le modal de complétion même si l'onboarding n'est plus actif
    return showCompletionModal ? (
      <OnboardingCompletionModal
        open={showCompletionModal}
        onComplete={handleCompletionModalClose}
      />
    ) : null;
  }

  // Récupérer config de l'étape actuelle
  const step = getStepById(currentStep);
  if (!step) return null;

  /**
   * Handlers modal
   */
  const handleOpenModal = () => {
    if (step.modal) {
      setModalOpen(true);
      setCurrentScreen(0);
    }
  };

  const handleCloseModal = async () => {
    setModalOpen(false);
    setTooltipClosed(true); // Fermer le tooltip aussi

    // Ne PAS persister modal completion lors de fermeture par X
    // La croix (X) ne marque pas le modal comme complété
    // Seul le bouton "Compris" marque le modal comme complété (voir handleModalComplete)

    // Étape 1 : Activer le mode édition même si fermé par X
    if (currentStep === 1) {
      setTimeout(() => {
        prevEditingRef.current = false;
        setEditing(true).catch(error => {
          onboardingLogger.error('[Onboarding] Step 1: Failed to activate edit mode:', error);
        });
      }, ONBOARDING_TIMINGS.MODAL_ANIMATION_DELAY);
    }

    // Étape 2 : Ouvrir le panel de génération IA même si fermé par X
    if (currentStep === 2) {
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR);
        onboardingLogger.log('[Onboarding] Step 2 : Event émis pour ouverture panel (fermeture X)');
      }, ONBOARDING_TIMINGS.MODAL_ANIMATION_DELAY);
    }

    // Étape 6 : Ouvrir le panel d'optimisation même si fermé par X
    if (currentStep === 6) {
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER);
        onboardingLogger.log('[Onboarding] Step 6 : Event émis pour ouverture panel (fermeture X)');
      }, ONBOARDING_TIMINGS.MODAL_ANIMATION_DELAY);
    }

    // Étape 8 : Ouvrir le modal d'export même si fermé par X
    if (currentStep === 8) {
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_EXPORT);
        onboardingLogger.log('[Onboarding] Step 8 : Event émis pour ouverture export (fermeture X)');
      }, ONBOARDING_TIMINGS.MODAL_ANIMATION_DELAY);
    }
  };

  const handleModalNext = () => {
    if (currentScreen < (step.modal?.screens?.length || 0) - 1) {
      setCurrentScreen(prev => prev + 1);
    }
  };

  const handleModalPrev = () => {
    if (currentScreen > 0) {
      setCurrentScreen(prev => prev - 1);
    }
  };

  const handleModalJumpTo = (screenIndex) => {
    // Validate bounds
    if (typeof screenIndex !== 'number' || screenIndex < 0) {
      onboardingLogger.warn('[Onboarding] Invalid screen index:', screenIndex);
      return;
    }

    const maxScreen = (step.modal?.screens?.length || 0) - 1;
    if (screenIndex > maxScreen) {
      onboardingLogger.warn('[Onboarding] Screen index out of bounds:', screenIndex, 'max:', maxScreen);
      return;
    }

    setCurrentScreen(screenIndex);
  };

  const handleModalComplete = async () => {
    setModalOpen(false);
    setTooltipClosed(true); // Fermer le tooltip après complétion du modal

    // Persist modal completion to DB
    const modalKey = STEP_TO_MODAL_KEY[currentStep];
    if (modalKey) {
      try {
        await markModalCompleted(modalKey);
      } catch (error) {
        onboardingLogger.error(`[Onboarding] Failed to persist ${modalKey} modal:`, error);
        return; // Don't proceed if persistence failed
      }
    }

    // Étape 1 : Activer le mode édition après fermeture du modal
    // NOTE: Step 1 validation happens when user EXITS edit mode (see useEffect handling prevEditingRef transition)
    if (currentStep === 1) {
      // Attendre que l'animation CSS du modal soit terminée
      setTimeout(() => {
        // Reset prevEditingRef pour éviter validation incorrecte
        prevEditingRef.current = false;

        // Activer le mode édition (fire-and-forget, async géré par setEditing)
        setEditing(true).catch(error => {
          onboardingLogger.error('[Onboarding] Step 1: Failed to activate edit mode:', error);
        });

        onboardingLogger.log('[Onboarding] Step 1: Edit mode activation requested, validation will occur when user exits edit mode');
        // NOTE: Validation happens when user EXITS edit mode (see useEffect detecting editing: true → false)
      }, MODAL_CLOSE_ANIMATION_DURATION);
    }

    // Étape 2 : Ouvrir automatiquement le panel de génération IA
    // Raison : Après avoir vu le modal éducatif, on ouvre directement le panel
    // Validation se fait via MutationObserver (lignes 169-204) quand tâche créée
    if (currentStep === 2) {
      // Ouvrir le panel après fermeture du modal explicatif
      // IMPORTANT : On utilise un custom event au lieu d'un clic simulé pour éviter
      // que le listener d'onboarding (lignes 128-141) n'intercepte le clic et ré-ouvre le modal
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR);
        onboardingLogger.log('[Onboarding] Step 2 : Event émis pour ouverture automatique du panel');
      }, MODAL_CLOSE_ANIMATION_DURATION); // 300ms - attendre fin animation modal

      return; // Ne pas valider l'étape (validation lors de la génération réelle)
    }

    // Étape 6 : Ouvrir automatiquement le panel d'optimisation
    // Raison : Après avoir vu le modal éducatif, on ouvre directement le panel
    // Validation se fait via task:completed quand l'optimisation est terminée
    if (currentStep === 6) {
      // Ouvrir le panel après fermeture du modal explicatif
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER);
        onboardingLogger.log('[Onboarding] Step 6 : Event émis pour ouverture automatique du panel optimisation');
      }, MODAL_CLOSE_ANIMATION_DURATION);

      return; // Ne pas valider l'étape (validation lors de l'optimisation réelle)
    }

    // Étape 8 : Ouvrir automatiquement le modal d'export PDF
    // Raison : Après avoir vu le modal tutoriel, on ouvre directement le modal d'export
    // Validation se fait via EXPORT_CLICKED quand l'utilisateur clique sur "Exporter en PDF"
    if (currentStep === 8) {
      // Ouvrir le modal d'export après fermeture du modal tutoriel
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_EXPORT);
        onboardingLogger.log('[Onboarding] Step 8 : Event émis pour ouverture automatique du modal export');
      }, MODAL_CLOSE_ANIMATION_DURATION);

      return; // Ne pas valider l'étape (validation lors du clic sur export)
    }
  };

  const handleModalSkip = async () => {
    setModalOpen(false);

    // Ne PAS marquer le modal comme complété lors du skip
    // "Passer" = skip le step entier, pas completion du modal
    // On marque directement le step comme complété
    markStepComplete(currentStep);
  };

  /**
   * Déclenche l'animation de confetti pour célébrer la complétion
   * Utilisé uniquement pour l'étape 7 Phase 2 (fin de l'onboarding)
   */
  const triggerCompletionConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10B981', '#34D399', '#6EE7B7'],
      });

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10B981', '#34D399', '#6EE7B7'],
        });
      }, 250);

      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10B981', '#34D399', '#6EE7B7'],
        });
      }, 400);
    } catch (error) {
      onboardingLogger.error('[Onboarding] Erreur confetti:', error);
    }
  };

  /**
   * Handler tooltip close
   * Gère la fermeture individuelle des tooltips avec validation conditionnelle
   * Includes rollback logic to keep UI/DB in sync on failure
   */
  const handleTooltipClose = async () => {
    // Save previous state for rollback
    const previousState = tooltipClosed;

    try {
      // Optimistic update - close tooltip immediately for better UX
      setTooltipClosed(true);

      // Persist to DB
      await markTooltipClosed(currentStep);

      onboardingLogger.log(`[Onboarding] Tooltip step ${currentStep} closed and persisted to DB`);
    } catch (error) {
      onboardingLogger.error('[Onboarding] Failed to persist tooltip close, rolling back:', error);

      // Rollback UI to previous state on failure
      setTooltipClosed(previousState);

      // Optional: Show user-facing error notification
      // window.dispatchEvent(new CustomEvent('notification:show', {
      //   detail: {
      //     type: 'error',
      //     message: 'Unable to save progress. Please try again.'
      //   }
      // }));
    }
  };

  /**
   * Render des composants selon l'étape
   */
  const renderStep = () => {
    // ========== ÉTAPE 1 : MODE ÉDITION ==========
    if (currentStep === 1) {
      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={!modalOpen && currentStep === 1}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          {/* Tooltip : disparaît quand modal ouvert ou fermé manuellement */}
          <OnboardingTooltip
            show={!modalOpen && !tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />

          {/* Modal carousel (5 écrans) - s'ouvre via event listener clic bouton */}
          <OnboardingModal
            open={modalOpen}
            screens={step.modal.screens}
            currentScreen={currentScreen}
            title={step.title}
            IconComponent={EMOJI_TO_ICON[step.emoji] || Pencil}
            onNext={handleModalNext}
            onPrev={handleModalPrev}
            onJumpTo={handleModalJumpTo}
            onComplete={handleModalComplete}
            onSkip={handleModalSkip}
            onClose={handleCloseModal}
            showSkipButton={true}
            size="large"
          />
        </>
      );
    }

    // ========== ÉTAPE 2 : GÉNÉRATION IA (FUSION 2+3) ==========
    if (currentStep === 2) {
      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={!modalOpen && currentStep === 2}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          {/* Tooltip invitation - closable pour permettre de fermer */}
          <OnboardingTooltip
            show={!modalOpen && !tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />

          {/* Modal explicatif (3 écrans IA) */}
          <OnboardingModal
            open={modalOpen}
            screens={step.modal.screens}
            currentScreen={currentScreen}
            title={step.title}
            IconComponent={EMOJI_TO_ICON[step.emoji] || Pencil}
            onNext={handleModalNext}
            onPrev={handleModalPrev}
            onJumpTo={handleModalJumpTo}
            onComplete={handleModalComplete}
            onClose={handleCloseModal}
            showSkipButton={true}
            size="large"
          />
        </>
      );
    }

    // ========== ÉTAPE 3 : TASK MANAGER (ANCIEN 4) ==========
    if (currentStep === 3) {
      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={currentStep === 3}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          <OnboardingTooltip
            show={!tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            persistent={true}
            onClose={handleTooltipClose}
          />
        </>
      );
    }

    // ========== ÉTAPE 4 : OUVERTURE DU CV GÉNÉRÉ (ANCIEN 5, RENOMMÉ) ==========
    if (currentStep === 4) {
      // Vérifier la précondition : ne s'affiche QUE si un CV a été généré
      if (!cvGenerated) {
        onboardingLogger.log('[Onboarding] Step 4 : En attente de la génération d\'un CV...');
        return null;
      }

      return (
        <>
          {/* Highlight : ring toujours visible sur le bouton principal, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={currentStep === 4}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          <OnboardingTooltip
            show={!tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />
        </>
      );
    }

    // ========== ÉTAPE 5 : SCORE DE MATCH (ANCIEN 6) ==========
    if (currentStep === 5) {
      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={currentStep === 5}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          <OnboardingTooltip
            show={!tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />
        </>
      );
    }

    // ========== ÉTAPE 6 : OPTIMISATION (FUSION 7+8) ==========
    if (currentStep === 6) {
      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={!modalOpen && currentStep === 6}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          {/* Tooltip invitation - closable pour permettre de fermer */}
          <OnboardingTooltip
            show={!modalOpen && !tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />

          {/* Modal explicatif (3 écrans Optimisation) */}
          <OnboardingModal
            open={modalOpen}
            screens={step.modal.screens}
            currentScreen={currentScreen}
            title={step.title}
            IconComponent={EMOJI_TO_ICON[step.emoji] || Pencil}
            onNext={handleModalNext}
            onPrev={handleModalPrev}
            onJumpTo={handleModalJumpTo}
            onComplete={handleModalComplete}
            onClose={handleCloseModal}
            showSkipButton={true}
            size="large"
          />
        </>
      );
    }

    // ========== ÉTAPE 7 : HISTORIQUE ==========
    if (currentStep === 7) {
      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={currentStep === 7}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          <OnboardingTooltip
            show={!tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />
        </>
      );
    }

    // ========== ÉTAPE 8 : EXPORT ==========
    if (currentStep === 8) {
      // Ne rien afficher si le modal de complétion est ouvert
      if (showCompletionModal) return null;

      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={!modalOpen && currentStep === 8}
            blurEnabled={!tooltipClosed}
            targetSelector={step.targetSelector}
          />

          {/* Tooltip invitation - closable pour permettre de fermer */}
          <OnboardingTooltip
            show={!modalOpen && !tooltipClosed}
            targetSelector={step.targetSelector}
            content={step.tooltip.content}
            position={step.tooltip.position}
            closable={true}
            onClose={handleTooltipClose}
          />

          {/* Modal tutoriel export (3 écrans) */}
          <OnboardingModal
            open={modalOpen}
            screens={step.modal.screens}
            currentScreen={currentScreen}
            title={step.title}
            IconComponent={EMOJI_TO_ICON[step.emoji] || Pencil}
            onNext={handleModalNext}
            onPrev={handleModalPrev}
            onJumpTo={handleModalJumpTo}
            onComplete={handleModalComplete}
            onClose={handleCloseModal}
            showSkipButton={true}
            size="large"
          />
        </>
      );
    }

    return null;
  };

  return (
    <>
      {renderStep()}

      {/* Modal de complétion (affiché après step 8) */}
      <OnboardingCompletionModal
        open={showCompletionModal}
        onComplete={handleCompletionModalClose}
      />
    </>
  );
}
