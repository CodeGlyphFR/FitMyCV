'use client';

import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { ONBOARDING_STEPS, getStepById, isCompositeStep, getCompositeFeature, getTotalSteps } from '@/lib/onboarding/onboardingSteps';
import { ONBOARDING_TIMINGS, ONBOARDING_API } from '@/lib/onboarding/onboardingConfig';
import { ONBOARDING_EVENTS } from '@/lib/onboarding/onboardingEvents';
import { LOADING_EVENTS } from '@/lib/loading/loadingEvents';
import { onboardingLogger } from '@/lib/utils/onboardingLogger';
import { DEFAULT_ONBOARDING_STATE, normalizeOnboardingState, markModalCompleted as markModalCompletedHelper, markTooltipClosed as markTooltipClosedHelper, markStepCompleted as markStepCompletedHelper } from '@/lib/onboarding/onboardingState';
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
  const pathname = usePathname();

  // Cacher l'onboarding UI sur les routes admin
  const isAdminRoute = pathname?.startsWith('/admin');

  // Timer refs pour cleanup (éviter memory leaks)
  const welcomeTimerRef = useRef(null);
  const stepTimerRef = useRef(null);
  const loadingToOnboardingTimerRef = useRef(null);
  const listenerAttachedRef = useRef(false);
  const loadingClosedWhileBusyRef = useRef(false); // Flag: LOADING_SCREEN_CLOSED reçu pendant isLoading=true

  // Refs pour queue d'updates (éviter race conditions)
  const updateInProgressRef = useRef(false);
  const pendingUpdateRef = useRef(null);
  const retryAttemptsRef = useRef(0); // Compteur pour éviter boucle infinie
  const MAX_RETRY_ATTEMPTS = ONBOARDING_API.MAX_RETRY_ATTEMPTS;

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
  const [onboardingState, setOnboardingState] = useState(DEFAULT_ONBOARDING_STATE); // État complet (step4, modals, tooltips) - Initialisé avec valeurs par défaut pour éviter race conditions
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
      setCompletedSteps(data.completedSteps || []);
      setOnboardingState(data.onboardingState || DEFAULT_ONBOARDING_STATE); // L'API normalise déjà, mais fallback pour robustesse

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
   * SSE: Synchronisation temps réel multi-device
   * Écoute les événements onboarding:updated et onboarding:reset
   */
  useEffect(() => {
    if (!isAuthenticated || !session?.user?.id) return;

    let eventSource = null;
    let reconnectTimeout = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

    const connect = () => {
      try {
        eventSource = new EventSource('/api/user/onboarding/subscribe');

        eventSource.addEventListener('connected', (event) => {
          onboardingLogger.log('[SSE] Connexion établie:', JSON.parse(event.data));
          reconnectAttempts = 0; // Reset counter on success
        });

        eventSource.addEventListener('onboarding:updated', (event) => {
          const data = JSON.parse(event.data);
          onboardingLogger.log('[SSE] onboarding:updated reçu:', data);

          // Protection anti-régression multi-device :
          // N'accepter que les updates avec un step >= au step local actuel
          // Cela évite qu'un client désynchronisé propage une régression via SSE
          const localStep = stateRef.current.currentStep || 0;
          const serverStep = data.currentStep ?? localStep;

          if (serverStep < localStep) {
            onboardingLogger.log(
              `[SSE] Ignoring update with inferior step: server=${serverStep}, local=${localStep}`
            );
            return; // Ignorer cette update (notre état local est plus avancé)
          }

          // Mise à jour de l'état depuis autre device
          if (data.onboardingState) {
            setOnboardingState(data.onboardingState);
            setCompletedSteps(data.onboardingState.completedSteps || []);
          }
          if (data.currentStep !== undefined) {
            setCurrentStep(data.currentStep);
          }
          if (data.hasCompleted !== undefined) {
            setHasCompleted(data.hasCompleted);
          }
        });

        eventSource.addEventListener('onboarding:reset', (event) => {
          const data = JSON.parse(event.data);
          onboardingLogger.log('[SSE] onboarding:reset reçu, reset complet UI');

          // Reset complet de l'UI
          setOnboardingState(data.onboardingState);
          setCompletedSteps(data.onboardingState.completedSteps || []);
          setCurrentStep(0);
          setHasCompleted(false);
          setHasSkipped(false);
          setIsActive(false);
          setShowWelcomeModal(false);
        });

        eventSource.onerror = (error) => {
          onboardingLogger.error('[SSE] Erreur connexion:', error);
          eventSource.close();

          // Reconnect avec exponential backoff
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAYS[reconnectAttempts] || 16000;
            onboardingLogger.log(`[SSE] Reconnexion dans ${delay}ms (tentative ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);

            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, delay);
          } else {
            onboardingLogger.error('[SSE] Max reconnect attempts atteint, abandon');
          }
        };

      } catch (error) {
        onboardingLogger.error('[SSE] Erreur création EventSource:', error);
      }
    };

    // Établir connexion SSE
    connect();

    // Cleanup
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isAuthenticated, session?.user?.id]);


  /**
   * Aller à l'étape suivante
   */
  const goToNextStep = useCallback(async () => {
    if (currentStep > getTotalSteps()) {
      // Dépassé la dernière étape → compléter onboarding
      await completeOnboarding();
      return;
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setStepStartTime(Date.now());

    // Update API
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: nextStep }),
      });

      // Désync détectée (client en retard sur le serveur) → reload silencieux
      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }
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
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: prevStep }),
      });

      // Désync détectée (client en retard sur le serveur) → reload silencieux
      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [currentStep]);

  /**
   * Aller directement à une étape
   */
  const goToStep = useCallback(async (step) => {
    if (step < 0 || step > getTotalSteps()) {
      onboardingLogger.error('[OnboardingProvider] Invalid step:', step);
      return;
    }

    setCurrentStep(step);
    setStepStartTime(Date.now());

    // Update API
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });

      // Désync détectée (client en retard sur le serveur) → reload silencieux
      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }
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
        setCurrentStep(getTotalSteps());

        // Ajouter toutes les étapes aux complétées
        setCompletedSteps([1, 2, 3, 4, 5, 6, 7, 8]);
        setShowWelcomeModal(false);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error completing onboarding:', error);
    }
  }, []);

  /**
   * Marquer une étape comme complétée (avec optimistic update + rollback)
   * Utilise onboardingState comme source unique de vérité
   */
  const markStepComplete = useCallback(async (step) => {
    // Clear any existing timer first
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }

    // Sauvegarder état précédent pour rollback potentiel
    const previousOnboardingState = onboardingState;
    const previousCompletedSteps = completedSteps;
    const previousCurrentStep = currentStep;

    // Skip si déjà complété
    if (onboardingState?.completedSteps?.includes(step)) {
      onboardingLogger.log(`[OnboardingProvider] Step ${step} déjà complété, skip`);
      return;
    }

    // Optimistic update (UI immédiate) - utiliser helper pour cohérence
    const newOnboardingState = markStepCompletedHelper(onboardingState, step);

    setOnboardingState(newOnboardingState);
    setCompletedSteps(newOnboardingState.completedSteps);
    setCurrentStep(newOnboardingState.currentStep); // ✅ Synchroniser avec le helper

    // Persister en DB avec error handling (une seule requête PATCH atomique)
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingState: newOnboardingState }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      onboardingLogger.log(`[OnboardingProvider] Step ${step} persisté avec succès (completedSteps: ${newOnboardingState.completedSteps}, currentStep: ${newOnboardingState.currentStep})`);
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Persistence failed, rolling back:', error);

      // Rollback vers état précédent
      setOnboardingState(previousOnboardingState);
      setCompletedSteps(previousCompletedSteps);
      setCurrentStep(previousCurrentStep);

      // Ne pas continuer la progression si la persistence a échoué
      return;
    }

    // Si c'est la dernière étape (8), ne rien faire d'autre
    // Le modal de complétion s'affichera et completeOnboarding() sera
    // appelé quand l'utilisateur fermera le modal
    const totalSteps = getTotalSteps();
    if (step >= totalSteps) {
      onboardingLogger.log('[OnboardingProvider] Step final complété, en attente fermeture modal');
      return;
    }

    // currentStep est déjà incrémenté par le helper (ligne 470)
    // Pas besoin de timer car la transition est immédiate
    onboardingLogger.log(`[OnboardingProvider] Step ${step} complété, transition immédiate vers step ${newOnboardingState.currentStep}`);
  }, [onboardingState, completedSteps, currentStep]);

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
        setHasCompleted(false); // Skip n'est PAS une complétion normale
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
        setOnboardingState({}); // Reset état complet (modals, step4, etc.)
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
   * Deep merge helper pour éviter perte de données dans objets imbriqués
   */
  const deepMerge = useCallback((target, source) => {
    const output = { ...target };
    if (typeof target === 'object' && typeof source === 'object') {
      Object.keys(source).forEach(key => {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }, []);

  /**
   * Mettre à jour l'état d'onboarding (update partiel avec queue anti-race)
   * @param {object} updates - Objet avec les updates partiels (ex: { step4: { cvGenerated: true } })
   */
  const updateOnboardingState = useCallback(async (updates) => {
    // Si update déjà en cours, merger avec pending update (évite race condition)
    if (updateInProgressRef.current) {
      onboardingLogger.log('[OnboardingProvider] Update déjà en cours, merge avec pending');
      pendingUpdateRef.current = pendingUpdateRef.current
        ? deepMerge(pendingUpdateRef.current, updates)
        : updates;
      return;
    }

    updateInProgressRef.current = true;
    const previousState = onboardingState;

    try {
      // Deep merge pour préserver propriétés imbriquées
      const newState = deepMerge(onboardingState, updates);
      setOnboardingState(newState);

      // Persister en DB
      const res = await fetch('/api/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingState: newState }),
      });

      if (!res.ok) {
        onboardingLogger.error('[OnboardingProvider] Failed to persist onboardingState:', res.status);
        // Rollback sur échec
        setOnboardingState(previousState);
        throw new Error(`API returned ${res.status}`);
      }
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Error persisting onboardingState:', error);
      // Rollback sur erreur
      setOnboardingState(previousState);
    } finally {
      updateInProgressRef.current = false;

      // Si pending update existe, l'exécuter maintenant (récursif avec limite de retry)
      if (pendingUpdateRef.current) {
        const pending = pendingUpdateRef.current;
        pendingUpdateRef.current = null;

        retryAttemptsRef.current++;
        if (retryAttemptsRef.current <= MAX_RETRY_ATTEMPTS) {
          onboardingLogger.log(`[OnboardingProvider] Exécution pending update (attempt ${retryAttemptsRef.current}/${MAX_RETRY_ATTEMPTS}):`, pending);
          await updateOnboardingState(pending);
        } else {
          onboardingLogger.error('[OnboardingProvider] Max retry attempts reached, dropping update:', pending);
          retryAttemptsRef.current = 0; // Reset pour futures updates
        }
      } else {
        retryAttemptsRef.current = 0; // Reset sur succès
      }
    }
  }, [onboardingState, deepMerge]);

  /**
   * Marquer un modal comme complété (wrapper qui persiste en DB)
   * @param {string} stepKey - Clé du modal (welcome, step1, step2, step6, step8, completion)
   */
  const markModalCompleted = useCallback(async (stepKey) => {
    onboardingLogger.log(`[OnboardingProvider] markModalCompleted called for modal: ${stepKey}`);

    // Create partial updates (not full state) for proper deep merging
    const updates = {
      modals: {
        ...onboardingState.modals,
        [stepKey]: {
          completed: true,
          completedAt: new Date().toISOString()
        }
      },
      timestamps: {
        ...onboardingState.timestamps,
        lastStepChangeAt: new Date().toISOString()
      }
    };

    onboardingLogger.log(`[OnboardingProvider] Modal completion updates for ${stepKey}:`, JSON.stringify(updates.modals[stepKey]));

    try {
      await updateOnboardingState(updates);
      onboardingLogger.log(`[OnboardingProvider] Modal ${stepKey} marked as completed in DB`);
    } catch (error) {
      onboardingLogger.error(`[OnboardingProvider] Failed to mark modal ${stepKey} as completed:`, error);
      throw error; // Re-throw to let caller handle it
    }
  }, [onboardingState, updateOnboardingState]);

  /**
   * Marquer un tooltip comme fermé/ouvert manuellement (wrapper qui persiste en DB)
   * @param {number} stepNumber - Numéro du step (1-8)
   * @param {boolean} [closed=true] - True pour fermer, false pour ouvrir/reset (défaut: true)
   *
   * @example
   * // Fermer tooltip manuellement
   * await markTooltipClosed(1); // closed=true (default)
   *
   * // Reset tooltip après modal (réapparaître après refresh)
   * await markTooltipClosed(1, false);
   */
  const markTooltipClosed = useCallback(async (stepNumber, closed = true) => {
    // Create partial updates (not full state) for proper deep merging
    const updates = {
      tooltips: {
        ...onboardingState.tooltips,
        [String(stepNumber)]: { closedManually: closed }
      },
      timestamps: {
        ...onboardingState.timestamps,
        lastStepChangeAt: new Date().toISOString()
      }
    };
    await updateOnboardingState(updates);
  }, [onboardingState, updateOnboardingState]);

  /**
   * Helper: Transition from welcome modal to step 1
   * Shared logic for both "complete" (button) and "close" (X) actions
   * Uses optimistic update with rollback on API failure
   */
  const transitionToStep1 = useCallback(async () => {
    // Save previous state for rollback
    const previousStep = currentStep;
    const previousIsActive = isActive;

    try {
      // Optimistic update (UI first)
      setIsActive(true);
      setCurrentStep(1);
      setOnboardingStartTime(Date.now());
      setStepStartTime(Date.now());

      // Update API
      const res = await fetch('/api/user/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      });

      // Désync détectée (client en retard sur le serveur) → reload silencieux
      if (res.status === 409) {
        onboardingLogger.log('[OnboardingProvider] Désync détectée (409), reload page');
        window.location.reload();
        return;
      }

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      onboardingLogger.log('[OnboardingProvider] Successfully transitioned to step 1');
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Failed to transition to step 1:', error);

      // Rollback UI state
      setCurrentStep(previousStep);
      setIsActive(previousIsActive);
      setOnboardingStartTime(null);
      setStepStartTime(null);

      // Re-throw for caller to handle
      throw error;
    }
  }, [currentStep, isActive]);

  /**
   * Handlers pour le WelcomeModal
   */
  const handleWelcomeComplete = useCallback(async () => {
    setShowWelcomeModal(false);

    try {
      // Mark welcome modal as completed in DB
      await markModalCompleted('welcome');
      // Transition to step 1
      await transitionToStep1();
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Welcome complete failed:', error);
      // Note: transitionToStep1 already rolled back state on failure
    }
  }, [markModalCompleted, transitionToStep1]);

  const handleWelcomeSkip = useCallback(() => {
    setShowWelcomeModal(false);
    skipOnboarding();
  }, [skipOnboarding]);

  const handleWelcomeClose = useCallback(async () => {
    setShowWelcomeModal(false);
    // Note: Ne PAS marquer le modal comme completed (croix ≠ complétion)

    try {
      // Transition to step 1 without marking modal as completed
      await transitionToStep1();
    } catch (error) {
      onboardingLogger.error('[OnboardingProvider] Welcome close failed:', error);
      // Note: transitionToStep1 already rolled back state on failure
    }
  }, [transitionToStep1]);

  /**
   * Context value
   * Si authentifié : vraie logique avec tous les hooks
   * Sinon : defaultValue avec no-ops
   */
  const value = {
    // State
    currentStep,
    completedSteps,
    onboardingState,
    isActive,
    hasCompleted,
    hasSkipped,
    isLoading,
    checklistExpanded,

    // Timestamps
    onboardingStartTime,
    stepStartTime,

    // Navigation
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
    updateOnboardingState,
    markModalCompleted,
    markTooltipClosed,

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
          onClose={handleWelcomeClose}
        />
      )}
      {/* Checklist flottante (affichée si onboarding actif ou complété) - seulement si authentifié et pas sur /admin */}
      {isAuthenticated && !isAdminRoute && <ChecklistPanel />}
      {/* Orchestrateur gérant l'affichage des 8 étapes - seulement si authentifié et pas sur /admin */}
      {isAuthenticated && !isAdminRoute && !isLoading && <OnboardingOrchestrator />}
    </OnboardingContext.Provider>
  );
}
