/**
 * Onboarding State Management
 *
 * Ce module centralise la structure et les helpers pour manipuler
 * l'état de l'onboarding stocké en base de données (champ onboardingState de type Json).
 *
 * Structure onboardingState:
 * - currentStep: numéro de l'étape actuelle (0-10, où 10 = "en attente du modal de completion")
 * - completedSteps: array des étapes complétées [1, 2, 3, ...]
 * - hasCompleted: boolean - onboarding complété normalement (tous les steps)
 * - isSkipped: boolean - onboarding skippé par l'utilisateur
 * - modals: tracking des modaux vus/complétés (welcome, step1, step2, step5, step7, step9, completion)
 * - tooltips: tracking des tooltips fermés manuellement par step
 * - timestamps: dates de début, fin, skip, dernière modification
 * - step4: préconditions pour step 4 (cvGenerated, cvFilename)
 */

/**
 * Structure par défaut de l'onboardingState
 * Utilisée pour :
 * - Initialisation nouveaux users
 * - Reset de l'onboarding ("Relancer le tutoriel")
 * - Validation de la structure
 */
export const DEFAULT_ONBOARDING_STATE = {
  currentStep: 0,
  completedSteps: [],
  hasCompleted: false,
  isSkipped: false,

  modals: {
    welcome: { completed: false },
    step1: { completed: false },
    step2: { completed: false },
    step5: { completed: false },
    step7: { completed: false },
    step9: { completed: false },
    completion: { completed: false }
  },

  tooltips: {
    "1": { closedManually: false },
    "2": { closedManually: false },
    "3": { closedManually: false },
    "4": { closedManually: false },
    "5": { closedManually: false },
    "6": { closedManually: false },
    "7": { closedManually: false },
    "8": { closedManually: false },
    "9": { closedManually: false }
  },

  timestamps: {
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    lastStepChangeAt: null
  },

  step4: {
    cvGenerated: false,
    cvFilename: null
  }
};

/**
 * Marque un modal comme complété avec timestamp
 * @param {Object} state - État actuel de l'onboarding
 * @param {string} stepKey - Clé du modal (welcome, step1, step2, step5, step7, step9, completion)
 * @returns {Object} Nouvel état mis à jour
 */
export const markModalCompleted = (state, stepKey) => {
  return {
    ...state,
    modals: {
      ...state.modals,
      [stepKey]: {
        completed: true,
        completedAt: new Date().toISOString()
      }
    },
    timestamps: {
      ...state.timestamps,
      lastStepChangeAt: new Date().toISOString()
    }
  };
};

/**
 * Marque un tooltip comme fermé/ouvert manuellement
 * @param {Object} state - État actuel de l'onboarding
 * @param {number|string} stepNumber - Numéro du step (1-8)
 * @param {boolean} [closed=true] - True pour fermer, false pour ouvrir/reset
 * @returns {Object} Nouvel état mis à jour
 *
 * @example
 * // Fermer tooltip (comportement par défaut)
 * markTooltipClosed(state, 1); // closed=true (default)
 * markTooltipClosed(state, 1, true); // explicit
 *
 * // Reset tooltip (réapparaître après refresh)
 * markTooltipClosed(state, 1, false);
 */
export const markTooltipClosed = (state, stepNumber, closed = true) => {
  return {
    ...state,
    tooltips: {
      ...state.tooltips,
      [String(stepNumber)]: { closedManually: closed }
    },
    timestamps: {
      ...state.timestamps,
      lastStepChangeAt: new Date().toISOString()
    }
  };
};

/**
 * Marque une étape comme complétée
 * @param {Object} state - État actuel de l'onboarding
 * @param {number} stepNumber - Numéro du step complété (1-9)
 * @returns {Object} Nouvel état mis à jour
 */
export const markStepCompleted = (state, stepNumber) => {
  // Utiliser Set pour éviter doublons
  const completedSteps = [...new Set([...state.completedSteps, stepNumber])];

  // Toujours incrémenter currentStep
  // Note: step 9 = état virtuel "en attente du modal de completion"
  const nextStep = stepNumber + 1;

  const updates = {
    ...state,
    completedSteps,
    currentStep: nextStep,
    timestamps: {
      ...state.timestamps,
      lastStepChangeAt: new Date().toISOString()
    }
  };

  // Si premier step, set startedAt
  if (stepNumber === 1 && !state.timestamps.startedAt) {
    updates.timestamps.startedAt = new Date().toISOString();
  }

  return updates;
};

/**
 * Met à jour le step actuel
 * @param {Object} state - État actuel de l'onboarding
 * @param {number} stepNumber - Nouveau step actuel (0-10)
 * @returns {Object} Nouvel état mis à jour
 */
export const updateCurrentStep = (state, stepNumber) => {
  const updates = {
    ...state,
    currentStep: stepNumber,
    timestamps: {
      ...state.timestamps,
      lastStepChangeAt: new Date().toISOString()
    }
  };

  // Si premier step, set startedAt
  if (stepNumber === 1 && !state.timestamps.startedAt) {
    updates.timestamps.startedAt = new Date().toISOString();
  }

  return updates;
};

/**
 * Marque l'onboarding comme complété
 * @param {Object} state - État actuel de l'onboarding
 * @returns {Object} Nouvel état mis à jour
 */
export const markOnboardingCompleted = (state) => {
  return {
    ...state,
    timestamps: {
      ...state.timestamps,
      completedAt: new Date().toISOString(),
      lastStepChangeAt: new Date().toISOString()
    }
  };
};

/**
 * Met à jour les préconditions du step 4 (CV généré)
 * @param {Object} state - État actuel de l'onboarding
 * @param {boolean} cvGenerated - CV généré ou non
 * @param {string|null} cvFilename - Nom du fichier CV généré
 * @returns {Object} Nouvel état mis à jour
 */
export const updateStep4Preconditions = (state, cvGenerated, cvFilename = null) => {
  return {
    ...state,
    step4: {
      cvGenerated,
      cvFilename
    },
    timestamps: {
      ...state.timestamps,
      lastStepChangeAt: new Date().toISOString()
    }
  };
};

/**
 * Valide la structure de l'onboardingState
 * @param {Object} state - État à valider
 * @returns {boolean} True si valide, false sinon
 */
export const validateOnboardingState = (state) => {
  if (!state || typeof state !== 'object') return false;

  // Vérifier champs obligatoires
  const requiredFields = ['currentStep', 'completedSteps', 'hasCompleted', 'isSkipped', 'modals', 'tooltips', 'timestamps', 'step4'];
  for (const field of requiredFields) {
    if (!(field in state)) return false;
  }

  // Vérifier types
  if (typeof state.currentStep !== 'number') return false;
  if (!Array.isArray(state.completedSteps)) return false;
  if (typeof state.hasCompleted !== 'boolean') return false;
  if (typeof state.isSkipped !== 'boolean') return false;
  if (typeof state.modals !== 'object') return false;
  if (typeof state.tooltips !== 'object') return false;
  if (typeof state.timestamps !== 'object') return false;
  if (typeof state.step4 !== 'object') return false;

  return true;
};

/**
 * Normalise un état d'onboarding (ajoute champs manquants avec valeurs par défaut)
 * Utile pour migration ou états partiels
 * @param {Object} state - État partiel à normaliser
 * @returns {Object} État complet normalisé
 */
export const normalizeOnboardingState = (state) => {
  if (!state || typeof state !== 'object') {
    return { ...DEFAULT_ONBOARDING_STATE };
  }

  // Récupérer tous les champs avec fallback sur DEFAULT
  const currentStep = state.currentStep ?? DEFAULT_ONBOARDING_STATE.currentStep;
  const completedSteps = Array.isArray(state.completedSteps) ? state.completedSteps : DEFAULT_ONBOARDING_STATE.completedSteps;
  const hasCompleted = state.hasCompleted ?? DEFAULT_ONBOARDING_STATE.hasCompleted;
  const isSkipped = state.isSkipped ?? DEFAULT_ONBOARDING_STATE.isSkipped;

  // Migration : renommer les anciennes clés de modals (step6→step7, step8→step9)
  const rawModals = state.modals || {};
  const migratedModals = { ...rawModals };
  if (rawModals.step6 && !rawModals.step7) {
    migratedModals.step7 = rawModals.step6;
    delete migratedModals.step6;
  }
  if (rawModals.step8 && !rawModals.step9) {
    migratedModals.step9 = rawModals.step8;
    delete migratedModals.step8;
  }

  return {
    currentStep,
    completedSteps,
    hasCompleted,
    isSkipped,

    modals: {
      ...DEFAULT_ONBOARDING_STATE.modals,
      ...migratedModals
    },

    tooltips: {
      ...DEFAULT_ONBOARDING_STATE.tooltips,
      ...(state.tooltips || {})
    },

    timestamps: {
      ...DEFAULT_ONBOARDING_STATE.timestamps,
      ...(state.timestamps || {})
    },

    step4: {
      ...DEFAULT_ONBOARDING_STATE.step4,
      ...(state.step4 || {})
    }
  };
};

/**
 * Vérifie si un modal a été complété
 * @param {Object} state - État actuel de l'onboarding
 * @param {string} stepKey - Clé du modal (welcome, step1, etc.)
 * @returns {boolean} True si complété
 */
export const isModalCompleted = (state, stepKey) => {
  return state?.modals?.[stepKey]?.completed === true;
};

/**
 * Vérifie si un tooltip a été fermé manuellement
 * @param {Object} state - État actuel de l'onboarding
 * @param {number|string} stepNumber - Numéro du step
 * @returns {boolean} True si fermé manuellement
 */
export const isTooltipClosedManually = (state, stepNumber) => {
  return state?.tooltips?.[String(stepNumber)]?.closedManually === true;
};

/**
 * Vérifie si une étape a été complétée
 * @param {Object} state - État actuel de l'onboarding
 * @param {number} stepNumber - Numéro du step
 * @returns {boolean} True si complété
 */
export const isStepCompleted = (state, stepNumber) => {
  return state?.completedSteps?.includes(stepNumber) === true;
};

/**
 * Vérifie si onboardingState est chargé et prêt à être utilisé
 * Utilisé pour éviter race conditions lors du chargement initial
 *
 * @param {Object} state - État onboarding à vérifier
 * @returns {boolean} True si l'état est chargé, false sinon
 *
 * @example
 * // Dans un useEffect qui lit onboardingState
 * if (!isOnboardingStateLoaded(onboardingState)) {
 *   onboardingLogger.log('[Component] Waiting for onboardingState...');
 *   return;
 * }
 *
 * @description
 * Pendant le chargement initial, onboardingState peut être:
 * - undefined
 * - null
 * - {} (objet vide avant fetch API)
 *
 * Cette fonction détecte ces cas pour éviter de lire des propriétés
 * nested (ex: onboardingState.tooltips[step]) sur un objet vide.
 *
 * Pattern recommandé pour tous les useEffect qui dépendent de onboardingState:
 * 1. Guard clause avec cette fonction
 * 2. Early return si pas chargé
 * 3. Log explicite pour traçabilité
 */
export const isOnboardingStateLoaded = (state) => {
  return state && typeof state === 'object' && Object.keys(state).length > 0;
};
