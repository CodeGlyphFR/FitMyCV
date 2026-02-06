/**
 * Configuration des étapes d'onboarding pour le dashboard admin
 *
 * Ce fichier utilise les constantes partagées et ajoute les métadonnées admin.
 */

import {
  ADMIN_STEP_DEFINITIONS,
  STEP_NAMES,
  STEP_DESCRIPTIONS,
  STEP_HAS_MODAL,
  getStepDefinition,
  getStepEmoji,
  getStepNameFr as getStepNameFrFromConstants,
} from '@/lib/onboarding/onboardingConstants';

// Re-export formatDuration from shared utility for backward compatibility
export { formatDuration } from '@/lib/utils/dateFormatters';

/**
 * Configuration pour les analytics d'onboarding
 */
export const ONBOARDING_ANALYTICS_CONFIG = {
  TIMELINE_DAYS: 14,
  STUCK_THRESHOLD_DAYS: 7,
  DEFAULT_PERIOD: '30d',
};

/**
 * Définition des étapes d'onboarding (enrichies avec métadonnées admin)
 */
export const ONBOARDING_STEPS = ADMIN_STEP_DEFINITIONS.map(step => ({
  id: step.id,
  name: STEP_NAMES[step.key]?.name || step.key,
  nameFr: STEP_NAMES[step.key]?.nameFr || step.key,
  icon: step.emoji,
  hasModal: STEP_HAS_MODAL[step.key] || false,
  description: STEP_DESCRIPTIONS[step.key] || '',
}));

/**
 * Définition des modales d'onboarding
 */
export const ONBOARDING_MODALS = [
  { key: 'welcome', name: 'Welcome', nameFr: 'Bienvenue', stepId: 0 },
  { key: 'step1', name: 'Edit Mode', nameFr: 'Mode édition', stepId: 1 },
  { key: 'step2', name: 'AI Generation', nameFr: 'Génération IA', stepId: 2 },
  { key: 'step5', name: 'AI Review', nameFr: 'Review IA', stepId: 5 },
  { key: 'step7', name: 'Optimization', nameFr: 'Optimisation', stepId: 7 },
  { key: 'step9', name: 'Export', nameFr: 'Export', stepId: 9 },
  { key: 'completion', name: 'Completion', nameFr: 'Félicitations', stepId: null },
];

/**
 * Statuts possibles pour le filtrage
 */
export const ONBOARDING_STATUSES = [
  { value: 'all', label: 'Tous', color: 'text-white', bgColor: 'bg-white/10' },
  { value: 'completed', label: 'Complété', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  { value: 'in_progress', label: 'En cours', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { value: 'skipped', label: 'Abandonné', color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
  { value: 'not_started', label: 'Non démarré', color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  { value: 'stuck', label: 'Bloqué', color: 'text-red-400', bgColor: 'bg-red-500/20' },
];

/**
 * Obtient les informations d'une étape par son ID
 */
export function getStepById(stepId) {
  return ONBOARDING_STEPS.find(step => step.id === stepId) || null;
}

/**
 * Obtient le nom français d'une étape
 */
export function getStepNameFr(stepId) {
  return getStepNameFrFromConstants(stepId);
}

/**
 * Obtient l'icône d'une étape
 */
export function getStepIcon(stepId) {
  return getStepEmoji(stepId);
}

/**
 * Obtient les informations d'un statut
 */
export function getStatusInfo(status) {
  return ONBOARDING_STATUSES.find(s => s.value === status) || ONBOARDING_STATUSES[0];
}

/**
 * Détermine le statut d'un utilisateur basé sur son onboardingState
 */
export function determineUserStatus(onboardingState, lastActivityDate = null) {
  if (!onboardingState) {
    return 'not_started';
  }

  if (onboardingState.hasCompleted) {
    return 'completed';
  }

  if (onboardingState.isSkipped) {
    return 'skipped';
  }

  if (!onboardingState.timestamps?.startedAt && onboardingState.currentStep === 0) {
    return 'not_started';
  }

  // Bloqué (plus de 7 jours sans activité)
  if (lastActivityDate) {
    const daysSinceActivity = (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 7 && !onboardingState.hasCompleted) {
      return 'stuck';
    }
  } else if (onboardingState.timestamps?.lastStepChangeAt) {
    const daysSinceActivity = (Date.now() - new Date(onboardingState.timestamps.lastStepChangeAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 7 && !onboardingState.hasCompleted) {
      return 'stuck';
    }
  }

  return 'in_progress';
}

/**
 * Calcule le pourcentage de progression
 */
export function calculateProgress(onboardingState) {
  if (!onboardingState) return 0;
  if (onboardingState.hasCompleted) return 100;

  const totalSteps = 9;
  const completedCount = onboardingState.completedSteps?.length || 0;

  return Math.round((completedCount / totalSteps) * 100);
}
