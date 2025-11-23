'use client';

import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ONBOARDING_STEPS, getStepById, isCompositeStep, getCompositeFeature, getTotalSteps } from '@/lib/onboarding/onboardingSteps';
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
import { ONBOARDING_EVENTS } from '@/lib/onboarding/onboardingEvents';
import { LOADING_EVENTS } from '@/lib/loading/loadingEvents';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';
import ChecklistPanel from './ChecklistPanel';
import OnboardingOrchestrator from './OnboardingOrchestrator';
import WelcomeModal from './WelcomeModal';

/**
 * Context pour l'onboarding
 */
export const OnboardingContext = createContext(null);

/**
 * Constantes pour les timers de transition entre étapes
 * Importées depuis le fichier de configuration centralisé
 */
const STEP_TRANSITION_DELAY = ONBOARDING_TIMINGS.STEP_TRANSITION_DELAY;
const STEPS_WITHOUT_TIMER = ONBOARDING_TIMINGS.STEPS_WITHOUT_TIMER;

/**
 * Provider pour le système d'onboarding
 *
 * Gère l'état global de l'onboarding :
 * - Étape en cours
 * - Étapes complétées
 * - État actif/complété/skippé
 * - Checklist expanded
 * - Actions de navigation
 */
export default function OnboardingProvider({ children }) {
  const { data: session, status } = useSession();

  // Timer refs pour cleanup (éviter memory leaks)
  const welcomeTimerRef = useRef(null);
  const stepTimerRef = useRef(null);
  const loadingToOnboardingTimerRef = useRef(null);
  const listenerAttachedRef = useRef(false);
  const loadingClosedWhileBusyRef = useRef(false); // Flag: LOADING_SCREEN_CLOSED reçu pendant isLoading=true

  // Ref pour capturer l'état actuel (utilisé dans le handler auto-start)
  // Permet d'éviter les valeurs "stale" dans les closures
  const stateRef = useRef({
    currentStep: 0,
    hasCompleted: false,
    hasSkipped: false,
    isActive: false,
    showWelcomeModal: false,
    isLoading: true,
    cvCount: 0, // Nombre de CVs de l'utilisateur (mis à jour via TOPBAR_READY event)
  });

  // État global
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [isActive, setIsActive] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasSkipped, setHasSkipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [checklistExpanded, setChecklistExpanded] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Timestamps pour tracking
  const [onboardingStartTime, setOnboardingStartTime] = useState(null);
  const [stepStartTime, setStepStartTime] = useState(null);

  /**
   * Cleanup effect pour tous les timers (éviter memory leaks)
   * Nettoie les timers lorsque le composant unmount
   */
  useEffect(() => {
    return () => {
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }
    };
  }, []);

  // Valeurs par défaut si non authentifié (éviter crash du hook)
  const defaultValue = {
    currentStep: 0,
    completedSteps: [],
    isActive: false,
    hasCompleted: false,
    hasSkipped: false,
    isLoading: false,
    checklistExpanded: false,
    onboardingStartTime: null,
    stepStartTime: null,
    startOnboarding: () => onboardingLogger.warn('[OnboardingProvider] Not authenticated'),
    goToNextStep: () => {},
    goToPrevStep: () => {},
    goToStep: () => {},
    markStepComplete: () => {},
    skipOnboarding: () => {},
    completeOnboarding: () => {},
    resetOnboarding: () => {},
    toggleChecklist: () => {},
    checkStepConditions: () => false,
    trackEvent: () => {},
    steps: ONBOARDING_STEPS,
  };

  // Check si authentifié (utilisé pour conditionner la logique)
  const isAuthenticated = status !== 'loading' && session;

  // Maintenir stateRef à jour pour éviter les valeurs stale dans les handlers
  // Note: cvCount est mis à jour séparément via l'événement TOPBAR_READY
  useEffect(() => {
    stateRef.current = {
      ...stateRef.current, // Conserver cvCount (mis à jour par event listener)
      currentStep,
      hasCompleted,
      hasSkipped,
      isActive,
      showWelcomeModal,
      isLoading,
    };
  }, [currentStep, hasCompleted, hasSkipped, isActive, showWelcomeModal, isLoading]);

  /**
   * Écouter l'événement TOPBAR_READY pour mettre à jour cvCount
   * Nécessaire pour vérifier si l'utilisateur a des CVs avant de démarrer l'onboarding
   */
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleTopBarReady = (event) => {
      const itemsCount = event?.detail?.itemsCount || 0;
      onboardingLogger.log(`[OnboardingProvider] TOPBAR_READY received, cvCount=${itemsCount}`);
      stateRef.current.cvCount = itemsCount;
    };

    window.addEventListener(LOADING_EVENTS.TOPBAR_READY, handleTopBarReady);

    return () => {
      window.removeEventListener(LOADING_EVENTS.TOPBAR_READY, handleTopBarReady);
    };
  }, [isAuthenticated]);

  /**
   * Charger l'état d'onboarding depuis l'API
   */
  const fetchOnboardingState = useCallback(async () => {
    try {
      const res = await fetch('/api/user/onboarding');

      if (!res.ok) {
        onboardingLogger.error('[OnboardingProvider] Failed to fetch state:', res.status);
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      setCurrentStep(data.currentStep);
      setHasCompleted(data.hasCompleted);
      setHasSkipped(data.isSkipped);

      // Si on est sur une étape > 0 et pas complété, c'est qu'on est en cours
      if (data.currentStep > 0 && !data.hasCompleted && !data.isSkipped) {
        setIsActive(true);
      }

      setIsLoading(false);
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error fetching state:', error);
      setIsLoading(false);
    }
  }, []);

  /**
   * Charger l'état au montage
   * Conditionné : ne s'exécute que si authentifié
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (session?.user?.id) {
      fetchOnboardingState();
    }
  }, [isAuthenticated, session?.user?.id, fetchOnboardingState]);

  /**
   * Démarrer l'onboarding
   */
  const startOnboarding = useCallback(async () => {
    try {
      // Clear any existing welcome timer
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }

      setIsActive(true);
      onboardingLogger.log(`[OnboardingProvider] Onboarding activé, démarrage dans ${STEP_TRANSITION_DELAY}ms`);

      // Timer de 2 secondes avant d'afficher la première étape
      welcomeTimerRef.current = setTimeout(async () => {
        welcomeTimerRef.current = null;

        try {
          setCurrentStep(1);
          setOnboardingStartTime(Date.now());
          setStepStartTime(Date.now());

          // Update API
          await fetch('/api/user/onboarding', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: 1 }),
          });
        } catch (error) {
          onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
        }
      }, STEP_TRANSITION_DELAY);
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error starting onboarding:', error);
    }
  }, []);

  /**
   * Aller à l'étape suivante
   */
  const goToNextStep = useCallback(async () => {
    if (currentStep >= 9) {
      // Dernière étape → compléter onboarding
      await completeOnboarding();
      return;
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setStepStartTime(Date.now());

    // Update API
    try {
      await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep }),
      });
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [currentStep]);

  /**
   * Aller à l'étape précédente
   */
  const goToPrevStep = useCallback(async () => {
    if (currentStep <= 1) return;

    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setStepStartTime(Date.now());

    // Update API
    try {
      await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: prevStep }),
      });
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [currentStep]);

  /**
   * Aller directement à une étape
   */
  const goToStep = useCallback(async (step) => {
    if (step < 0 || step > 9) {
      onboardingLogger.error('[OnboardingProvider] Invalid step:', step);
      return;
    }

    setCurrentStep(step);
    setStepStartTime(Date.now());

    // Update API
    try {
      await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, []);

  /**
   * Compléter l'onboarding
   * IMPORTANT: Défini avant markStepComplete car utilisé dans ses dépendances
   */
  const completeOnboarding = useCallback(async () => {
    try {
      // Clear all active timers FIRST (prevent race conditions)
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      const res = await fetch('/api/user/onboarding?action=complete', {
        method: 'POST',
      });

      if (res.ok) {
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(9);

        // Ajouter toutes les étapes aux complétées
        setCompletedSteps([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error completing onboarding:', error);
    }
  }, []);

  /**
   * Marquer une étape comme complétée
   */
  const markStepComplete = useCallback(async (step) => {
    // Clear any existing timer first
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    // Ajouter à la liste des étapes complétées (retire le highlight immédiatement)
    setCompletedSteps(prev => {
      if (prev.includes(step)) return prev;
      return [...prev, step];
    });

    // Si c'est la dernière étape (8), ne rien faire d'autre
    // Le modal de complétion s'affichera et completeOnboarding() sera
    // appelé quand l'utilisateur fermera le modal
    const totalSteps = getTotalSteps();
    if (step >= totalSteps) {
      onboardingLogger.log('[OnboardingProvider] Step final complété, en attente fermeture modal');
      return; // Ne pas appeler goToNextStep() ni completeOnboarding()
    }

    // Déterminer si on applique un timer de transition
    // Steps 2→3 et 3→4 s'enchaînent sans délai
    const needsTimer = !STEPS_WITHOUT_TIMER.includes(step);

    if (needsTimer) {
      // Timer de 2 secondes avant de passer à l'étape suivante
      onboardingLogger.log(`[OnboardingProvider] Step ${step} complété, transition dans ${STEP_TRANSITION_DELAY}ms`);

      stepTimerRef.current = setTimeout(async () => {
        stepTimerRef.current = null;

        try {
          await goToNextStep();
        } catch (error) {
          onboardingLogger.error('[OnboardingProvider] Error during step transition:', error);
        }
      }, STEP_TRANSITION_DELAY);
    } else {
      // Transition immédiate (steps 2 et 3)
      onboardingLogger.log(`[OnboardingProvider] Step ${step} complété, transition immédiate`);

      try {
        await goToNextStep();
      } catch (error) {
        onboardingLogger.error('[OnboardingProvider] Error during immediate step transition:', error);
      }
    }
  }, [goToNextStep]);

  /**
   * Skip l'onboarding
   */
  const skipOnboarding = useCallback(async () => {
    try {
      // Clear all active timers FIRST (prevent race conditions)
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      const res = await fetch('/api/user/onboarding?action=skip', {
        method: 'POST',
      });

      if (res.ok) {
        setHasSkipped(true);
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(0);
        setCompletedSteps([]);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error skipping onboarding:', error);
    }
  }, []);

  /**
   * Reset l'onboarding (pour relancer depuis settings)
   */
  const resetOnboarding = useCallback(async () => {
    try {
      // Clear all active timers FIRST (prevent race conditions)
      if (welcomeTimerRef.current) {
        clearTimeout(welcomeTimerRef.current);
        welcomeTimerRef.current = null;
      }
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      const res = await fetch('/api/user/onboarding?action=reset', {
        method: 'POST',
      });

      if (res.ok) {
        setHasCompleted(false);
        setHasSkipped(false);
        setIsActive(false);
        setCurrentStep(0);
        setCompletedSteps([]);
        setOnboardingStartTime(null);
        setStepStartTime(null);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error resetting onboarding:', error);
    }
  }, []);

  /**
   * Toggle checklist
   */
  const toggleChecklist = useCallback(() => {
    setChecklistExpanded(prev => {
      const newValue = !prev;
      // Persist dans localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('onboarding-checklist-expanded', JSON.stringify(newValue));
      }
      return newValue;
    });
  }, []);

  /**
   * Charger état checklist depuis localStorage
   * Conditionné : ne s'exécute que si authentifié
   */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('onboarding-checklist-expanded');
      if (saved !== null) {
        try {
          setChecklistExpanded(JSON.parse(saved));
        } catch (e) {
          // Ignore parsing errors
        }
      }
    }
  }, [isAuthenticated]);

  /**
   * Vérifier conditions d'une étape
   */
  const checkStepConditions = useCallback((stepId) => {
    const step = getStepById(stepId);
    if (!step) return false;

    // Si pas de précondition, l'étape est toujours accessible
    if (!step.precondition) return true;

    const { precondition } = step;

    // Vérification multi-conditions (toutes doivent être remplies)
    if (precondition.type === 'multi') {
      return precondition.conditions.every((cond) => {
        // Récursivement vérifier chaque condition
        return checkSingleCondition(cond);
      });
    }

    // Vérification simple
    return checkSingleCondition(precondition);
  }, []);

  /**
   * Helper pour vérifier une condition simple
   */
  const checkSingleCondition = (condition) => {
    if (!condition || !condition.type) return true;

    switch (condition.type) {
      case 'element_visible':
        // Vérifier si l'élément existe et est visible dans le DOM
        if (!condition.selector) return false;
        const element = document.querySelector(condition.selector);
        return element && element.offsetParent !== null;

      case 'state_check':
        // Vérifier un état via événement custom
        // Les composants de l'app doivent émettre ces événements
        if (condition.key === 'editModeActive') {
          // Vérifier si le bouton edit existe (proxy pour edit mode)
          return !!document.querySelector('[data-onboarding="edit-button"]');
        }
        if (condition.key === 'generationInProgress') {
          // Vérifier s'il y a des tasks actives (proxy)
          const taskButton = document.querySelector('[data-onboarding="task-manager"]');
          return taskButton && taskButton.querySelector('.animate-pulse');
        }
        if (condition.key === 'matchScoreCalculated') {
          // Vérifier si le match score a été calculé (présence du score visible)
          const matchScoreElement = document.querySelector('[data-onboarding="match-score"]');
          // Le score est calculé si l'élément existe et contient un pourcentage
          return matchScoreElement && matchScoreElement.textContent?.includes('%');
        }
        return true; // Par défaut on considère la condition remplie

      case 'data_check':
        // Vérifications de données (limitées sans accès direct aux contexts)
        if (condition.check === 'currentCvHasJobSummary') {
          // Vérifier si le match score est visible (proxy pour jobSummary)
          return !!document.querySelector('[data-onboarding="match-score"]');
        }
        return true;

      case 'timeout':
        // Les timeouts sont gérés par le step lui-même
        return true;

      default:
        onboardingLogger.warn('[OnboardingProvider] Unknown condition type:', condition.type);
        return true;
    }
  };

  /**
   * Tracker un event (pour télémétrie)
   */
  const trackEvent = useCallback(async (eventType, metadata = {}) => {
    // Calculer durée depuis début de l'étape
    const duration = stepStartTime ? Date.now() - stepStartTime : null;

    try {
      await fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: `ONBOARDING_${eventType.toUpperCase()}`,
          category: 'onboarding',
          metadata: {
            step: currentStep,
            duration,
            ...metadata,
          },
        }),
      });
    } catch (error) {
      // Silent fail (télémétrie non-critique)
      onboardingLogger.error('[OnboardingProvider] Track error:', error);
    }
  }, [currentStep, stepStartTime]);

  /**
   * Auto-start onboarding pour nouveaux utilisateurs
   * Conditions :
   * - Authentifié
   * - currentStep === 0 (jamais démarré)
   * - !hasCompleted et !hasSkipped
   * - Loading screen fermé (événement loadingScreenClosed)
   *
   * Workflow : Loading screen ferme → 3s de délai → WelcomeModal s'affiche
   *
   * IMPORTANT: Ce useEffect attache le listener IMMÉDIATEMENT au montage
   * (sans attendre isLoading=false) pour éviter la race condition où
   * LoadingOverlay émet LOADING_SCREEN_CLOSED avant que le listener soit attaché.
   * Les conditions sont vérifiées DANS le handler avec stateRef.current.
   */
  useEffect(() => {
    // Conditionné : ne s'exécute que si authentifié
    if (!isAuthenticated) return;

    // Only attach once (évite double-attachement si useEffect re-run)
    if (listenerAttachedRef.current) return;

    // Écouter l'événement de fermeture du loading screen
    const handleLoadingClosed = (event) => {
      // Récupérer l'état actuel via stateRef (évite valeurs stale)
      const state = stateRef.current;

      // Vérifier si c'est un nouvel utilisateur qui n'a jamais fait l'onboarding
      const shouldAutoStart =
        state.currentStep === 0 &&
        !state.hasCompleted &&
        !state.hasSkipped &&
        !state.isActive &&
        !state.showWelcomeModal &&
        !state.isLoading && // Attendre que l'état soit chargé depuis l'API
        state.cvCount === 0; // Ne démarrer QUE si l'utilisateur n'a AUCUN CV

      if (!shouldAutoStart) {
        // Si isLoading=true, marquer le flag pour vérifier plus tard (fallback)
        if (state.isLoading) {
          loadingClosedWhileBusyRef.current = true;
          onboardingLogger.log(
            `[OnboardingProvider] Loading closed while busy (isLoading=true), ` +
            `will check again when loading completes`
          );
        } else {
          onboardingLogger.log(
            `[OnboardingProvider] Loading closed but conditions not met: ` +
            `step=${state.currentStep}, completed=${state.hasCompleted}, ` +
            `skipped=${state.hasSkipped}, active=${state.isActive}, ` +
            `modal=${state.showWelcomeModal}, loading=${state.isLoading}, ` +
            `cvCount=${state.cvCount}`
          );
        }
        return;
      }

      // Reset flag (conditions OK maintenant)
      loadingClosedWhileBusyRef.current = false;

      // Clear any existing timer first (évite multiple timers si événement émis plusieurs fois)
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      const trigger = event?.detail?.trigger || 'unknown';
      onboardingLogger.log(
        `[OnboardingProvider] Loading screen closed via ${trigger}, ` +
        `conditions met (cvCount=${state.cvCount}), ` +
        `waiting ${ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY}ms before welcome modal`
      );

      // Délai de 3 secondes avant d'afficher le welcome modal
      loadingToOnboardingTimerRef.current = setTimeout(() => {
        loadingToOnboardingTimerRef.current = null;
        onboardingLogger.log('[OnboardingProvider] Showing welcome modal after delay');
        setShowWelcomeModal(true);
      }, ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY);
    };

    // S'abonner à l'événement IMMÉDIATEMENT (ne pas attendre isLoading=false)
    window.addEventListener(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, handleLoadingClosed);
    listenerAttachedRef.current = true;

    onboardingLogger.log('[OnboardingProvider] Listener attached for LOADING_SCREEN_CLOSED (immediate)');

    // Cleanup
    return () => {
      // Clear timer if component unmounts during delay
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      // Only remove listener if it was actually attached
      if (listenerAttachedRef.current) {
        window.removeEventListener(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, handleLoadingClosed);
        listenerAttachedRef.current = false;
        onboardingLogger.log('[OnboardingProvider] Listener removed for LOADING_SCREEN_CLOSED');
      }
    };
  }, [isAuthenticated]);

  /**
   * Fallback effect : Si LOADING_SCREEN_CLOSED est arrivé pendant isLoading=true,
   * vérifier quand isLoading devient false si les conditions sont remplies
   * pour démarrer l'onboarding
   */
  useEffect(() => {
    // Skip si pas de flag marqué
    if (!loadingClosedWhileBusyRef.current) return;

    // Skip si isLoading encore true (attendre qu'il devienne false)
    if (isLoading) return;

    onboardingLogger.log('[OnboardingProvider] Fallback: isLoading became false, checking conditions');

    // isLoading vient de passer à false, vérifier si on doit démarrer l'onboarding
    const state = stateRef.current;
    const shouldAutoStart =
      state.currentStep === 0 &&
      !state.hasCompleted &&
      !state.hasSkipped &&
      !state.isActive &&
      !state.showWelcomeModal &&
      state.cvCount === 0;

    if (shouldAutoStart) {
      onboardingLogger.log(
        `[OnboardingProvider] Fallback: Conditions met, starting onboarding ` +
        `(cvCount=${state.cvCount})`
      );

      // Reset flag
      loadingClosedWhileBusyRef.current = false;

      // Clear any existing timer
      if (loadingToOnboardingTimerRef.current) {
        clearTimeout(loadingToOnboardingTimerRef.current);
        loadingToOnboardingTimerRef.current = null;
      }

      // Démarrer l'onboarding après délai
      loadingToOnboardingTimerRef.current = setTimeout(() => {
        loadingToOnboardingTimerRef.current = null;
        onboardingLogger.log('[OnboardingProvider] Fallback: Showing welcome modal after delay');
        setShowWelcomeModal(true);
      }, ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY);
    } else {
      // Conditions toujours pas remplies, reset flag
      loadingClosedWhileBusyRef.current = false;
      onboardingLogger.log(
        `[OnboardingProvider] Fallback: Conditions still not met after loading: ` +
        `step=${state.currentStep}, cvCount=${state.cvCount}, ` +
        `completed=${state.hasCompleted}, skipped=${state.hasSkipped}`
      );
    }
  }, [isLoading]);

  /**
   * Handlers pour le WelcomeModal
   */
  const handleWelcomeComplete = useCallback(() => {
    setShowWelcomeModal(false);
    startOnboarding();
  }, [startOnboarding]);

  const handleWelcomeSkip = useCallback(() => {
    setShowWelcomeModal(false);
    skipOnboarding();
  }, [skipOnboarding]);

  /**
   * Context value
   * Si authentifié : vraie logique avec tous les hooks
   * Sinon : defaultValue avec no-ops
   */
  const value = {
    // State
    currentStep,
    completedSteps,
    isActive,
    hasCompleted,
    hasSkipped,
    isLoading,
    checklistExpanded,

    // Timestamps
    onboardingStartTime,
    stepStartTime,

    // Navigation
    startOnboarding,
    goToNextStep,
    goToPrevStep,
    goToStep,
    markStepComplete,

    // Actions
    skipOnboarding,
    completeOnboarding,
    resetOnboarding,

    // UI
    toggleChecklist,

    // Helpers
    checkStepConditions,
    trackEvent,

    // Steps config (pour accès facile)
    steps: ONBOARDING_STEPS,
  };

  // Toujours retourner la même structure JSX
  // Utiliser condition ternaire pour la value du Provider
  return (
    <OnboardingContext.Provider value={isAuthenticated ? value : defaultValue}>
      {children}
      {/* Modal de bienvenue (avant l'onboarding) - seulement si authentifié */}
      {isAuthenticated && (
        <WelcomeModal
          open={showWelcomeModal}
          onComplete={handleWelcomeComplete}
          onSkip={handleWelcomeSkip}
        />
      )}
      {/* Checklist flottante (affichée si onboarding actif ou complété) - seulement si authentifié */}
      {isAuthenticated && <ChecklistPanel />}
      {/* Orchestrateur gérant l'affichage des 9 étapes - seulement si authentifié */}
      {isAuthenticated && <OnboardingOrchestrator />}
    </OnboardingContext.Provider>
  );
}
