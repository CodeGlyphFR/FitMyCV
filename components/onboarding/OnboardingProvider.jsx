'use client';

import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { ONBOARDING_STEPS, getStepById, isCompositeStep, getCompositeFeature, getTotalSteps } from '@/lib/onboarding/onboardingSteps';
import ChecklistPanel from './ChecklistPanel';
import OnboardingOrchestrator from './OnboardingOrchestrator';
import WelcomeModal from './WelcomeModal';

/**
 * Context pour l'onboarding
 */
export const OnboardingContext = createContext(null);

/**
 * Constantes pour les timers de transition entre étapes
 */
const STEP_TRANSITION_DELAY = 2000; // 2 secondes entre chaque étape

/**
 * Steps qui s'enchaînent immédiatement sans délai de transition
 * - Step 2 (ai_generate): Démonstration génération IA
 * - Step 3 (task_manager): Suivi des tâches
 * Ces steps forment un flux rapide qui ne nécessite pas de pause
 */
const STEPS_WITHOUT_TIMER = [2, 3]; // Steps 2→3 et 3→4 s'enchaînent sans délai

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
    startOnboarding: () => console.warn('[OnboardingProvider] Not authenticated'),
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

  // Bypass logique mais toujours render le Context
  if (status === 'loading' || !session) {
    return (
      <OnboardingContext.Provider value={defaultValue}>
        {children}
      </OnboardingContext.Provider>
    );
  }

  /**
   * Charger l'état d'onboarding depuis l'API
   */
  const fetchOnboardingState = useCallback(async () => {
    try {
      const res = await fetch('/api/user/onboarding');

      if (!res.ok) {
        console.error('[OnboardingProvider] Failed to fetch state:', res.status);
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
      console.error('[OnboardingProvider] Error fetching state:', error);
      setIsLoading(false);
    }
  }, []);

  /**
   * Charger l'état au montage
   */
  useEffect(() => {
    if (session?.user?.id) {
      fetchOnboardingState();
    }
  }, [session?.user?.id, fetchOnboardingState]);

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
      console.log(`[OnboardingProvider] Onboarding activé, démarrage dans ${STEP_TRANSITION_DELAY}ms`);

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
          console.error('[OnboardingProvider] Error updating step:', error);
        }
      }, STEP_TRANSITION_DELAY);
    } catch (error) {
      console.error('[OnboardingProvider] Error starting onboarding:', error);
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
      console.error('[OnboardingProvider] Error updating step:', error);
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
      console.error('[OnboardingProvider] Error updating step:', error);
    }
  }, [currentStep]);

  /**
   * Aller directement à une étape
   */
  const goToStep = useCallback(async (step) => {
    if (step < 0 || step > 9) {
      console.error('[OnboardingProvider] Invalid step:', step);
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
      console.error('[OnboardingProvider] Error updating step:', error);
    }
  }, []);

  /**
   * Compléter l'onboarding
   * IMPORTANT: Défini avant markStepComplete car utilisé dans ses dépendances
   */
  const completeOnboarding = useCallback(async () => {
    try {
      const res = await fetch('/api/user/onboarding?action=complete', {
        method: 'POST',
      });

      if (res.ok) {
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(9);

        // Ajouter toutes les étapes aux complétées
        setCompletedSteps([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
    } catch (error) {
      console.error('[OnboardingProvider] Error completing onboarding:', error);
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
      console.log('[OnboardingProvider] Step final complété, en attente fermeture modal');
      return; // Ne pas appeler goToNextStep() ni completeOnboarding()
    }

    // Déterminer si on applique un timer de transition
    // Steps 2→3 et 3→4 s'enchaînent sans délai
    const needsTimer = !STEPS_WITHOUT_TIMER.includes(step);

    if (needsTimer) {
      // Timer de 2 secondes avant de passer à l'étape suivante
      console.log(`[OnboardingProvider] Step ${step} complété, transition dans ${STEP_TRANSITION_DELAY}ms`);

      stepTimerRef.current = setTimeout(async () => {
        stepTimerRef.current = null;

        try {
          await goToNextStep();
        } catch (error) {
          console.error('[OnboardingProvider] Error during step transition:', error);
        }
      }, STEP_TRANSITION_DELAY);
    } else {
      // Transition immédiate (steps 2 et 3)
      console.log(`[OnboardingProvider] Step ${step} complété, transition immédiate`);

      try {
        await goToNextStep();
      } catch (error) {
        console.error('[OnboardingProvider] Error during immediate step transition:', error);
      }
    }
  }, [goToNextStep]);

  /**
   * Skip l'onboarding
   */
  const skipOnboarding = useCallback(async () => {
    try {
      const res = await fetch('/api/user/onboarding?action=skip', {
        method: 'POST',
      });

      if (res.ok) {
        setHasSkipped(true);
        setHasCompleted(true);
        setIsActive(false);
        setCurrentStep(0);
      }
    } catch (error) {
      console.error('[OnboardingProvider] Error skipping onboarding:', error);
    }
  }, []);

  /**
   * Reset l'onboarding (pour relancer depuis settings)
   */
  const resetOnboarding = useCallback(async () => {
    try {
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
      }
    } catch (error) {
      console.error('[OnboardingProvider] Error resetting onboarding:', error);
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
   */
  useEffect(() => {
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
  }, []);

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
        console.warn('[OnboardingProvider] Unknown condition type:', condition.type);
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
      console.error('[OnboardingProvider] Track error:', error);
    }
  }, [currentStep, stepStartTime]);

  /**
   * Auto-start onboarding pour nouveaux utilisateurs
   * Conditions :
   * - currentStep === 0 (jamais démarré)
   * - !hasCompleted et !hasSkipped
   * - Interface prête (TopBar monté, CV chargé, pas de loading)
   *
   * Affiche d'abord le WelcomeModal avant de lancer l'onboarding
   */
  useEffect(() => {
    if (isLoading) return; // Attendre chargement de l'état

    // Vérifier si c'est un nouvel utilisateur qui n'a jamais fait l'onboarding
    const shouldAutoStart =
      currentStep === 0 &&
      !hasCompleted &&
      !hasSkipped &&
      !isActive &&
      !showWelcomeModal;

    if (!shouldAutoStart) return;

    // Vérifier que l'interface est prête avant d'afficher le welcome modal
    let checkCount = 0;
    const maxChecks = 50; // 10 secondes max (200ms * 50)

    const checkReadiness = () => {
      checkCount++;

      // Vérifier les éléments clés
      const topbarReady = !!document.querySelector('[data-onboarding="edit-button"]') ||
                          !!document.querySelector('[data-onboarding="ai-generate"]');
      const noLoadingSpinners = !document.querySelector('.animate-pulse[class*="spinner"]') &&
                                 !document.querySelector('[data-loading="true"]');

      if (topbarReady && noLoadingSpinners) {
        // Interface prête → afficher le welcome modal
        console.log('[OnboardingProvider] Interface prête, affichage du welcome modal');
        setTimeout(() => setShowWelcomeModal(true), 500); // Petit délai final pour la stabilité
        return true;
      }

      if (checkCount >= maxChecks) {
        // Timeout : afficher quand même après 10s
        console.warn('[OnboardingProvider] Timeout, affichage du welcome modal sans vérification complète');
        setShowWelcomeModal(true);
        return true;
      }

      return false;
    };

    // Polling toutes les 200ms
    const interval = setInterval(() => {
      const ready = checkReadiness();
      if (ready) {
        clearInterval(interval);
      }
    }, 200);

    // Cleanup
    return () => clearInterval(interval);
  }, [currentStep, hasCompleted, hasSkipped, isActive, isLoading, showWelcomeModal]);

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

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {/* Modal de bienvenue (avant l'onboarding) */}
      <WelcomeModal
        open={showWelcomeModal}
        onComplete={handleWelcomeComplete}
        onSkip={handleWelcomeSkip}
      />
      {/* Checklist flottante (affichée si onboarding actif ou complété) */}
      <ChecklistPanel />
      {/* Orchestrateur gérant l'affichage des 9 étapes */}
      <OnboardingOrchestrator />
    </OnboardingContext.Provider>
  );
}
