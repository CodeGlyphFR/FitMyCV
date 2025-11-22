'use client';

import { useState, useEffect, useRef } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAdmin } from '@/components/admin/AdminProvider';
import { getStepById } from '@/lib/onboarding/onboardingSteps';
import { isAiGenerationTask, isMatchScoreTask, isImprovementTask } from '@/lib/backgroundTasks/taskTypes';
import { extractCvFilename } from '@/lib/onboarding/cvFilenameUtils';
import { ONBOARDING_EVENTS, emitOnboardingEvent } from '@/lib/onboarding/onboardingEvents';
import OnboardingModal from './OnboardingModal';
import OnboardingCompletionModal from './OnboardingCompletionModal';
import OnboardingTooltip from './OnboardingTooltip';
import OnboardingHighlight from './OnboardingHighlight';
import confetti from 'canvas-confetti';

/**
 * Orchestrateur des 8 étapes d'onboarding (optimisé v3)
 *
 * Changements v3 :
 * - Étape 7 : Historique uniquement (validée à la fermeture du modal historique)
 * - Étape 8 : Export avec modal tutoriel 3 écrans (validée au clic sur export)
 * - Total 8 étapes
 */

// Constantes
const MODAL_CLOSE_ANIMATION_DURATION = 300; // ms - durée de l'animation CSS du modal
const BUTTON_POLLING_INTERVAL = 200; // ms - intervalle de polling pour trouver les boutons
const BUTTON_POLLING_TIMEOUT = 10000; // ms - timeout max pour trouver un bouton (10s)
const STEP_VALIDATION_DELAY = 500; // ms - délai pour permettre aux animations et requêtes async de se terminer avant validation

export default function OnboardingOrchestrator() {
  const {
    currentStep,
    isActive,
    markStepComplete,
    goToNextStep,
    completeOnboarding,
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
  const [cvGenerated, setCvGenerated] = useState(false);
  const [generatedCvFilename, setGeneratedCvFilename] = useState(null);

  // Ref pour tracker l'état précédent du mode édition (étape 1)
  const prevEditingRef = useRef(editing);

  // Ref pour tracker si le modal step 1 a été complété (empêche tooltip de réapparaître)
  const step1ModalCompletedRef = useRef(false);

  // Ref pour tracker si le modal step 1 a été montré (permet toggle normal du bouton après)
  const step1ModalShownRef = useRef(false);

  // Ref pour tracker si le modal step 2 a été complété (empêche tooltip de réapparaître)
  const step2ModalCompletedRef = useRef(false);

  // Ref pour tracker si le modal step 2 a été montré (permet ouverture normale du generator après)
  const step2ModalShownRef = useRef(false);

  // Ref pour tracker si le modal step 6 a été complété (empêche tooltip de réapparaître)
  const step6ModalCompletedRef = useRef(false);

  // Ref pour tracker si le modal step 6 a été montré
  const step6ModalShownRef = useRef(false);

  // Ref pour tracker si le modal step 8 a été complété (empêche tooltip de réapparaître)
  const step8ModalCompletedRef = useRef(false);

  // Ref pour tracker si le modal step 8 a été montré
  const step8ModalShownRef = useRef(false);

  // Ref pour le handler export-clicked (pattern stable comme step 7)
  const handleExportClickedRef = useRef();

  // Réinitialiser tooltipClosed et prevEditingRef à chaque changement d'étape
  useEffect(() => {
    // Only reset tooltipClosed if modal wasn't completed for step 1, 2, 6 or 8
    if (currentStep === 1 && step1ModalCompletedRef.current) {
      // Keep tooltipClosed = true to prevent reappearing after modal completion
      console.log('[Onboarding] Step 1: Modal completed, keeping tooltip closed');
    } else if (currentStep === 2 && step2ModalCompletedRef.current) {
      // Keep tooltipClosed = true to prevent reappearing after modal completion
      console.log('[Onboarding] Step 2: Modal completed, keeping tooltip closed');
    } else if (currentStep === 6 && step6ModalCompletedRef.current) {
      // Keep tooltipClosed = true to prevent reappearing after modal completion
      console.log('[Onboarding] Step 6: Modal completed, keeping tooltip closed');
    } else if (currentStep === 8 && step8ModalCompletedRef.current) {
      // Keep tooltipClosed = true to prevent reappearing after modal completion
      console.log('[Onboarding] Step 8: Modal completed, keeping tooltip closed');
    } else {
      setTooltipClosed(false);
    }

    // Réinitialiser prevEditingRef pour éviter des validations incorrectes si on revient à step 1
    if (currentStep === 1) {
      prevEditingRef.current = editing;
    }
  }, [currentStep]); // REMOVED 'editing' from deps to prevent re-triggering on edit mode change

  // Cleanup : Reset step 1 refs when leaving the step
  useEffect(() => {
    if (currentStep !== 1) {
      step1ModalShownRef.current = false;
      step1ModalCompletedRef.current = false;
    }
  }, [currentStep]);

  // Cleanup : Reset step 2 refs when leaving the step
  useEffect(() => {
    if (currentStep !== 2) {
      step2ModalShownRef.current = false;
      step2ModalCompletedRef.current = false;
    }
  }, [currentStep]);

  // Cleanup : Reset step 6 refs when leaving the step
  useEffect(() => {
    if (currentStep !== 6) {
      step6ModalShownRef.current = false;
      step6ModalCompletedRef.current = false;
    }
  }, [currentStep]);

  // Cleanup : Reset step 8 refs when leaving the step
  useEffect(() => {
    if (currentStep !== 8) {
      step8ModalShownRef.current = false;
      step8ModalCompletedRef.current = false;
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
        console.log('[Onboarding] Step 1: Modal already shown, allowing normal button behavior');
        return; // Don't prevent default, let the button toggle edit mode normally
      }

      // First click: prevent default and open modal
      e.preventDefault(); // Empêcher l'activation du mode édition
      e.stopPropagation();

      // Mark modal as shown
      step1ModalShownRef.current = true;

      // Fermer le tooltip immédiatement
      setTooltipClosed(true);

      // Ouvrir le modal onboarding
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
        console.error(`[Onboarding] Étape 1 : Bouton mode édition non trouvé après ${BUTTON_POLLING_TIMEOUT}ms`);
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
    if (currentStep !== 1 || modalOpen) return;

    // Détecter la transition editing: true → false (utilisateur quitte le mode édition)
    // La validation se déclenche uniquement sur true → false, donc pas de faux positifs
    // lors de l'activation du mode édition (false → true)
    if (prevEditingRef.current === true && editing === false) {
      console.log('[Onboarding] Step 1 : Utilisateur a quitté le mode édition, validation du step');
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
        console.log('[Onboarding] Step 2: Modal already shown, allowing normal button behavior');
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
        console.error(`[Onboarding] Étape 2 : Bouton AI Generate non trouvé après ${BUTTON_POLLING_TIMEOUT}ms`);
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
        console.log('[Onboarding] Step 2 : Génération IA détectée, validation du step');

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
          console.warn('[Onboarding] task:completed event missing task detail');
          return;
        }

        // Vérifier si c'est une tâche de génération IA
        if (isAiGenerationTask(task)) {
          console.log('[Onboarding] Tâche de génération IA terminée, stockage du résultat');

          // Extraire le nom du fichier CV généré de manière cohérente
          const cvFilename = extractCvFilename(task.result);
          if (!cvFilename) {
            console.warn('[Onboarding] Tâche IA terminée mais pas de fichier CV trouvé');
            return;
          }

          // Stocker que la tâche est complétée, mais NE PAS déclencher step 4 immédiatement
          // Step 4 se déclenchera seulement après validation de step 3
          setTaskCompleted(true);
          setCompletedTaskResult({ cvFilename });

          console.log('[Onboarding] Tâche complétée, en attente de validation step 3');
        }

        // Vérifier si c'est une tâche de calcul de match score (step 5)
        if (isMatchScoreTask(task) && currentStep === 5) {
          console.log('[Onboarding] Step 5 : Calcul de match score terminé, validation du step');

          // Délai pour permettre aux animations et requêtes async de se terminer
          setTimeout(() => {
            markStepComplete(5);
            // Émettre l'événement pour la précondition du step 6
            emitOnboardingEvent(ONBOARDING_EVENTS.MATCH_SCORE_CALCULATED);
          }, STEP_VALIDATION_DELAY);
        }
      } catch (error) {
        console.error('[Onboarding] Error in handleTaskCompleted:', error);
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
        console.log('[Onboarding] Step 3 : Task manager ouvert, validation immédiate du step');

        // Valider step 3 immédiatement (c'est suffisant pour compléter l'étape)
        markStepComplete(3);

        // Si la tâche est déjà complétée, déclencher step 4 immédiatement
        if (taskCompleted && completedTaskResult?.cvFilename) {
          console.log('[Onboarding] Tâche déjà complétée, déclenchement step 4');
          setCvGenerated(true);
          setGeneratedCvFilename(completedTaskResult.cvFilename);
          emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, {
            cvFilename: completedTaskResult.cvFilename
          });
        }
      } catch (error) {
        console.error('[Onboarding] Error in handleTaskManagerOpened:', error);
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
    console.log('[Onboarding] Step 3 validé + tâche complétée → déclenchement step 4');
    setCvGenerated(true);
    setGeneratedCvFilename(completedTaskResult.cvFilename);
    emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, {
      cvFilename: completedTaskResult.cvFilename
    });
  }, [currentStep, taskCompleted, completedTaskResult, cvGenerated]);

  // ========== STEP 4 : NE DÉCLENCHER QUE SI cvGenerated EST TRUE ==========
  useEffect(() => {
    // Si on est sur le step 4 mais que cvGenerated n'est pas true,
    // on ne doit PAS afficher le step 4 (précondition non remplie)
    if (currentStep === 4 && !cvGenerated) {
      console.log('[Onboarding] Step 4 : Précondition cvGenerated non remplie, step ignoré');
    }
  }, [currentStep, cvGenerated]);

  // ========== STEP 4 : ÉCOUTER generatedCvOpened POUR VALIDER ==========
  // Utilisation de useRef pour éviter la re-registration
  const handleGeneratedCvOpenedRef = useRef();

  // Mettre à jour la ref quand les dépendances changent
  useEffect(() => {
    handleGeneratedCvOpenedRef.current = (event) => {
      if (currentStep !== 4) return; // Filtrer dans le handler

      try {
        const cvFilename = event.detail?.cvFilename;
        console.log('[Onboarding] Step 4 : CV récemment généré sélectionné:', cvFilename);

        // Valider le step 4
        markStepComplete(4);
      } catch (error) {
        console.error('[Onboarding] Error in handleGeneratedCvOpened:', error);
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
        console.log('[Onboarding] Step 5 : Score déjà calculé, auto-validation');
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
        console.log('[Onboarding] Step 6: Modal already shown, allowing normal button behavior');
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
        console.log('[Onboarding] Step 6 : Optimisation terminée, validation du step');

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

      console.log('[Onboarding] Step 7 : Modal historique fermé, validation du step');
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
        console.log('[Onboarding] Step 8: Modal already shown, allowing normal button behavior');
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

      console.log('[Onboarding] Step 8 : Export cliqué, validation du step');

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
    // Marquer l'onboarding comme complété
    await completeOnboarding();
  };

  // Ne rien afficher si pas actif, SAUF si le modal de complétion doit être affiché
  if (!isActive || currentStep === 0) {
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

  const handleCloseModal = () => {
    setModalOpen(false);
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
      console.warn('[Onboarding] Invalid screen index:', screenIndex);
      return;
    }

    const maxScreen = (step.modal?.screens?.length || 0) - 1;
    if (screenIndex > maxScreen) {
      console.warn('[Onboarding] Screen index out of bounds:', screenIndex, 'max:', maxScreen);
      return;
    }

    setCurrentScreen(screenIndex);
  };

  const handleModalComplete = () => {
    setModalOpen(false);

    // Étape 1 : Activer le mode édition après fermeture du modal
    // NOTE: Step 1 validation happens when user EXITS edit mode (see validation useEffect lines 170-183)
    if (currentStep === 1) {
      // Marquer le modal comme complété (empêche tooltip de réapparaître)
      step1ModalCompletedRef.current = true;

      // Attendre que l'animation CSS du modal soit terminée
      setTimeout(async () => {
        try {
          await setEditing(true);

          // Validation : vérifier que le mode édition a bien été activé
          const editingState = localStorage.getItem('admin:editing');
          if (editingState !== '1') {
            console.error('[Onboarding] Étape 1 : Mode édition non activé après complétion');
            // Note : En production, afficher une notification à l'utilisateur
          }
        } catch (error) {
          console.error('[Onboarding] Étape 1 : Erreur activation mode édition:', error);
          // Note : En production, afficher une notification d'erreur à l'utilisateur
        }
      }, MODAL_CLOSE_ANIMATION_DURATION);
    }

    // Étape 2 : Ouvrir automatiquement le panel de génération IA
    // Raison : Après avoir vu le modal éducatif, on ouvre directement le panel
    // Validation se fait via MutationObserver (lignes 169-204) quand tâche créée
    if (currentStep === 2) {
      // Marquer le modal comme complété (empêche tooltip de réapparaître)
      step2ModalCompletedRef.current = true;

      // Ouvrir le panel après fermeture du modal explicatif
      // IMPORTANT : On utilise un custom event au lieu d'un clic simulé pour éviter
      // que le listener d'onboarding (lignes 128-141) n'intercepte le clic et ré-ouvre le modal
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR);
        console.log('[Onboarding] Step 2 : Event émis pour ouverture automatique du panel');
      }, MODAL_CLOSE_ANIMATION_DURATION); // 300ms - attendre fin animation modal

      return; // Ne pas valider l'étape (validation lors de la génération réelle)
    }

    // Étape 6 : Ouvrir automatiquement le panel d'optimisation
    // Raison : Après avoir vu le modal éducatif, on ouvre directement le panel
    // Validation se fait via task:completed quand l'optimisation est terminée
    if (currentStep === 6) {
      step6ModalCompletedRef.current = true;

      // Ouvrir le panel après fermeture du modal explicatif
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_OPTIMIZER);
        console.log('[Onboarding] Step 6 : Event émis pour ouverture automatique du panel optimisation');
      }, MODAL_CLOSE_ANIMATION_DURATION);

      return; // Ne pas valider l'étape (validation lors de l'optimisation réelle)
    }

    // Étape 8 : Ouvrir automatiquement le modal d'export PDF
    // Raison : Après avoir vu le modal tutoriel, on ouvre directement le modal d'export
    // Validation se fait via EXPORT_CLICKED quand l'utilisateur clique sur "Exporter en PDF"
    if (currentStep === 8) {
      step8ModalCompletedRef.current = true;

      // Ouvrir le modal d'export après fermeture du modal tutoriel
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_EXPORT);
        console.log('[Onboarding] Step 8 : Event émis pour ouverture automatique du modal export');
      }, MODAL_CLOSE_ANIMATION_DURATION);

      return; // Ne pas valider l'étape (validation lors du clic sur export)
    }
  };

  const handleModalSkip = () => {
    setModalOpen(false);

    // Mark modal as completed for steps with tracking refs
    if (currentStep === 1) {
      step1ModalCompletedRef.current = true;
    } else if (currentStep === 2) {
      step2ModalCompletedRef.current = true;
    } else if (currentStep === 6) {
      step6ModalCompletedRef.current = true;
    } else if (currentStep === 8) {
      step8ModalCompletedRef.current = true;
    }

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
      console.error('[Onboarding] Erreur confetti:', error);
    }
  };

  /**
   * Handler tooltip close
   * Gère la fermeture individuelle des tooltips avec validation conditionnelle
   */
  const handleTooltipClose = async () => {
    try {
      // Étape 1 : Fermer tooltip = masquer simplement le tooltip
      // La validation se fera quand l'utilisateur quittera le mode édition
      if (currentStep === 1) {
        setTooltipClosed(true);
        return;
      }

      // Étape 3 : Fermer tooltip = masquer simplement le tooltip
      // La validation se fait automatiquement quand l'utilisateur clique sur le task manager
      if (currentStep === 3) {
        setTooltipClosed(true);
        return;
      }

      // Étape 7 : Fermer tooltip = masquer simplement le tooltip
      // La validation se fait quand l'utilisateur ferme le modal historique
      if (currentStep === 7) {
        setTooltipClosed(true);
        return;
      }

      // Étape 8 : Fermer tooltip = masquer simplement le tooltip
      // La validation se fait quand l'utilisateur clique sur export
      if (currentStep === 8) {
        setTooltipClosed(true);
        return;
      }

      // Autres étapes (2, 4, 5, 6) : simplement masquer le tooltip
      setTooltipClosed(true);
    } catch (error) {
      console.error('[Onboarding] Erreur fermeture tooltip:', error);
      // En cas d'erreur de validation, on cache quand même le tooltip
      setTooltipClosed(true);
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
            show={!modalOpen}
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
            show={!modalOpen}
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
            show={true}
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
        console.log('[Onboarding] Step 4 : En attente de la génération d\'un CV...');
        return null;
      }

      return (
        <>
          {/* Highlight : ring toujours visible, blur seulement quand tooltip affichée */}
          <OnboardingHighlight
            show={true}
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
            show={true}
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
            show={!modalOpen}
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
            show={true}
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
            show={!modalOpen}
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
