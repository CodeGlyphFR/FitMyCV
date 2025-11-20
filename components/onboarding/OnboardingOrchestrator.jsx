'use client';

import { useState, useEffect, useRef } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAdmin } from '@/components/admin/AdminProvider';
import { getStepById } from '@/lib/onboarding/onboardingSteps';
import { isAiGenerationTask } from '@/lib/backgroundTasks/taskTypes';
import { extractCvFilename } from '@/lib/onboarding/cvFilenameUtils';
import { ONBOARDING_EVENTS, emitOnboardingEvent } from '@/lib/onboarding/onboardingEvents';
import OnboardingModal from './OnboardingModal';
import OnboardingHighlight from './OnboardingHighlight';
import PulsingDot from './PulsingDot';
import OnboardingTooltip from './OnboardingTooltip';
import confetti from 'canvas-confetti';

/**
 * Orchestrateur des 7 étapes d'onboarding (optimisé v2)
 *
 * Changements :
 * - Étape 1 : Interception clic bouton mode édition (modal AVANT activation)
 * - Étape 2 : Fusion Génération IA (invitation + modal)
 * - Étape 6 : Fusion Optimisation (invitation + modal)
 * - Total 7 étapes au lieu de 9
 */

// Constantes
const MODAL_CLOSE_ANIMATION_DURATION = 300; // ms - durée de l'animation CSS du modal
const BUTTON_POLLING_INTERVAL = 200; // ms - intervalle de polling pour trouver les boutons
const BUTTON_POLLING_TIMEOUT = 10000; // ms - timeout max pour trouver un bouton (10s)

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

  // État pour gérer les 2 phases du step 7 (ancien 9)
  const [step7Phase, setStep7Phase] = useState(1);

  // État pour gérer la fermeture individuelle des tooltips
  const [tooltipClosed, setTooltipClosed] = useState(false);

  // États pour les validations du step 3 (multi-conditions)
  const [step3Validations, setStep3Validations] = useState({
    generationCompleted: false,
    task_manager_opened: false,
    tooltip_closed: false,
  });

  // État pour la précondition du step 4
  const [cvGenerated, setCvGenerated] = useState(false);
  const [generatedCvFilename, setGeneratedCvFilename] = useState(null);

  // Ref pour tracker l'état précédent du mode édition (étape 1)
  const prevEditingRef = useRef(editing);

  // Ref pour tracker si le modal step 1 a été complété (empêche tooltip de réapparaître)
  const step1ModalCompletedRef = useRef(false);

  // Ref pour tracker si le modal step 1 a été montré (permet toggle normal du bouton après)
  const step1ModalShownRef = useRef(false);

  // Réinitialiser step7Phase quand on entre dans le step 7
  useEffect(() => {
    if (currentStep === 7) {
      setStep7Phase(1);
    }
  }, [currentStep]);

  // Réinitialiser tooltipClosed et prevEditingRef à chaque changement d'étape
  useEffect(() => {
    // Only reset tooltipClosed if modal wasn't completed for step 1
    if (currentStep === 1 && step1ModalCompletedRef.current) {
      // Keep tooltipClosed = true to prevent reappearing after modal completion
      console.log('[Onboarding] Step 1: Modal completed, keeping tooltip closed');
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

      // Si le modal n'a pas encore été vu (modalOpen === false), on l'ouvre
      if (!modalOpen) {
        e.preventDefault();
        e.stopPropagation();

        // Ouvrir le modal explicatif
        setModalOpen(true);
        setCurrentScreen(0);
      }
      // Sinon, laisser le clic normal se produire (génération IA)
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
        markStepComplete(2);
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
  }, [currentStep, modalOpen, markStepComplete]);

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
          console.log('[Onboarding] Tâche de génération IA terminée, émission cvGenerated');

          // Marquer la validation "generationCompleted" pour le step 3
          setStep3Validations(prev => ({
            ...prev,
            generationCompleted: true,
          }));

          // Extraire le nom du fichier CV généré de manière cohérente
          const cvFilename = extractCvFilename(task.result);
          if (!cvFilename) {
            console.warn('[Onboarding] Tâche IA terminée mais pas de fichier CV trouvé');
            return;
          }

          // Émettre l'événement cvGenerated pour déclencher le step 4
          setCvGenerated(true);
          setGeneratedCvFilename(cvFilename);

          // Émettre l'événement global pour les autres composants
          emitOnboardingEvent(ONBOARDING_EVENTS.CV_GENERATED, { cvFilename });
        }
      } catch (error) {
        console.error('[Onboarding] Error in handleTaskCompleted:', error);
      }
    };
  }, [isActive]);

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

  // Mettre à jour la ref quand currentStep change
  useEffect(() => {
    handleTaskManagerOpenedRef.current = () => {
      if (currentStep !== 3) return; // Filtrer dans le handler

      try {
        console.log('[Onboarding] Step 3 : Task manager ouvert, marquage de la validation');
        setStep3Validations(prev => ({
          ...prev,
          task_manager_opened: true,
        }));
      } catch (error) {
        console.error('[Onboarding] Error in handleTaskManagerOpened:', error);
      }
    };
  }, [currentStep]);

  // Enregistrer le listener une seule fois
  useEffect(() => {
    const stableHandler = () => handleTaskManagerOpenedRef.current?.();

    window.addEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, stableHandler);
    return () => {
      window.removeEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, stableHandler);
    };
  }, []); // Empty deps - register once

  // ========== STEP 3 : VÉRIFIER SI TOUTES LES VALIDATIONS SONT REMPLIES ==========
  useEffect(() => {
    if (currentStep !== 3) return;

    const { generationCompleted, task_manager_opened, tooltip_closed } = step3Validations;

    // Si les 3 conditions sont remplies, valider le step
    if (generationCompleted && task_manager_opened && tooltip_closed) {
      console.log('[Onboarding] Step 3 : Toutes les validations remplies, validation du step');
      markStepComplete(3);
    }
  }, [currentStep, step3Validations, markStepComplete]);

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

  // Ne rien afficher si pas actif
  if (!isActive || currentStep === 0) return null;

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
      // Ouvrir le panel après fermeture du modal explicatif
      // IMPORTANT : On utilise un custom event au lieu d'un clic simulé pour éviter
      // que le listener d'onboarding (lignes 128-141) n'intercepte le clic et ré-ouvre le modal
      setTimeout(() => {
        emitOnboardingEvent(ONBOARDING_EVENTS.OPEN_GENERATOR);
        console.log('[Onboarding] Step 2 : Event émis pour ouverture automatique du panel');
      }, MODAL_CLOSE_ANIMATION_DURATION); // 300ms - attendre fin animation modal

      return; // Ne pas valider l'étape (validation lors de la génération réelle)
    }

    // Étape 6 : Marquer comme complétée après modal
    if (currentStep === 6) {
      markStepComplete(currentStep);
    }
  };

  const handleModalSkip = () => {
    setModalOpen(false);
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

      // Étape 3 : Fermer tooltip = marquer la condition tooltip_closed
      // La validation se fera automatiquement quand les 3 conditions seront remplies
      if (currentStep === 3) {
        setStep3Validations(prev => ({
          ...prev,
          tooltip_closed: true,
        }));
        setTooltipClosed(true);
        return;
      }

      // Étape 7 Phase 1 : Fermer tooltip historique = passer à Phase 2
      if (currentStep === 7 && step7Phase === 1) {
        setStep7Phase(2);
        setTooltipClosed(false); // Réinitialiser pour afficher tooltip Phase 2
        return;
      }

      // Étape 7 Phase 2 : Fermer tooltip export = valider PUIS confetti
      if (currentStep === 7 && step7Phase === 2) {
        try {
          await markStepComplete(currentStep);
          // Confetti seulement si validation réussie
          triggerCompletionConfetti();
          return;
        } catch (error) {
          console.error('[Onboarding] Step 7 validation failed:', error);
          setTooltipClosed(true); // Fermer le tooltip même en cas d'erreur
          // TODO: Afficher une notification d'erreur à l'utilisateur en production
          return;
        }
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
          {/* Pulsing dot : disparaît quand modal ouvert */}
          <PulsingDot
            show={!modalOpen}
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
          {/* Pulsing dot */}
          <PulsingDot
            show={true}
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
            onNext={handleModalNext}
            onPrev={handleModalPrev}
            onJumpTo={handleModalJumpTo}
            onComplete={handleModalComplete}
            onClose={handleCloseModal}
            showSkipButton={false}
            size="large"
          />
        </>
      );
    }

    // ========== ÉTAPE 3 : TASK MANAGER (ANCIEN 4) ==========
    if (currentStep === 3) {
      return (
        <>
          <PulsingDot
            show={true}
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
          {/* Highlight glow sur sélecteur CV */}
          <OnboardingHighlight
            show={true}
            targetSelector={step.targetSelector}
          />

          <PulsingDot
            show={true}
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
          <PulsingDot
            show={true}
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
          {/* Pulsing dot */}
          <PulsingDot
            show={true}
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
            onNext={handleModalNext}
            onPrev={handleModalPrev}
            onJumpTo={handleModalJumpTo}
            onComplete={handleModalComplete}
            onClose={handleCloseModal}
            showSkipButton={false}
            size="large"
          />
        </>
      );
    }

    // ========== ÉTAPE 7 : HISTORIQUE + EXPORT (ANCIEN 9, 2 PHASES) ==========
    if (currentStep === 7) {
      return (
        <>
          {/* Phase 1 : Historique */}
          {step7Phase === 1 && (
            <>
              <PulsingDot
                show={true}
                targetSelector='[data-onboarding="history"]'
              />

              <OnboardingTooltip
                show={!tooltipClosed}
                targetSelector='[data-onboarding="history"]'
                content="📝 Découvrez toutes les modifications apportées par l'IA"
                position="left"
                closable={true}
                onClose={handleTooltipClose}
              />
            </>
          )}

          {/* Phase 2 : Export */}
          {step7Phase === 2 && (
            <>
              <PulsingDot
                show={true}
                targetSelector='[data-onboarding="export"]'
              />

              <OnboardingTooltip
                show={!tooltipClosed}
                targetSelector='[data-onboarding="export"]'
                content="📄 Téléchargez votre CV optimisé au format PDF !"
                position="left"
                closable={true}
                onClose={handleTooltipClose}
              />
            </>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <>
      {renderStep()}
    </>
  );
}
