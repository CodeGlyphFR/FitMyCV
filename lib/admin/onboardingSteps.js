/**
 * Configuration des étapes d'onboarding pour le dashboard admin
 *
 * Ce fichier centralise les métadonnées des 9 étapes (0-8) de l'onboarding
 * pour l'affichage dans le dashboard admin (funnel, table, etc.)
 */

// Re-export formatDuration from shared utility for backward compatibility
export { formatDuration } from '@/lib/utils/dateFormatters';

/**
 * Configuration pour les analytics d'onboarding
 */
export const ONBOARDING_ANALYTICS_CONFIG = {
  TIMELINE_DAYS: 14,           // Nombre de jours dans la timeline
  STUCK_THRESHOLD_DAYS: 7,     // Jours sans activité = utilisateur bloqué
  DEFAULT_PERIOD: '30d',       // Période par défaut pour les analytics
};

/**
 * Définition des étapes d'onboarding
 * @type {Array<{id: number, name: string, nameFr: string, icon: string, hasModal: boolean, description: string}>}
 */
export const ONBOARDING_STEPS = [
  {
    id: 0,
    name: 'Welcome',
    nameFr: 'Bienvenue',
    icon: '👋',
    hasModal: true,
    description: 'Écrans d\'accueil (3 slides)'
  },
  {
    id: 1,
    name: 'Edit Mode',
    nameFr: 'Mode édition',
    icon: '✏️',
    hasModal: true,
    description: 'Explication du mode édition'
  },
  {
    id: 2,
    name: 'AI Generation',
    nameFr: 'Génération IA',
    icon: '🤖',
    hasModal: true,
    description: 'Génération de CV avec l\'IA'
  },
  {
    id: 3,
    name: 'Task Manager',
    nameFr: 'Gestionnaire tâches',
    icon: '📋',
    hasModal: false,
    description: 'Ouverture du gestionnaire de tâches'
  },
  {
    id: 4,
    name: 'CV View',
    nameFr: 'Vue CV généré',
    icon: '📄',
    hasModal: false,
    description: 'Visualisation du CV généré'
  },
  {
    id: 5,
    name: 'Match Score',
    nameFr: 'Score de match',
    icon: '🎯',
    hasModal: false,
    description: 'Calcul du score de correspondance'
  },
  {
    id: 6,
    name: 'Optimization',
    nameFr: 'Optimisation',
    icon: '⚡',
    hasModal: true,
    description: 'Optimisation ATS du CV'
  },
  {
    id: 7,
    name: 'History',
    nameFr: 'Historique',
    icon: '📚',
    hasModal: false,
    description: 'Consultation de l\'historique'
  },
  {
    id: 8,
    name: 'Export PDF',
    nameFr: 'Export PDF',
    icon: '📤',
    hasModal: true,
    description: 'Export du CV en PDF'
  },
];

/**
 * Définition des modales d'onboarding
 * @type {Array<{key: string, name: string, nameFr: string, stepId: number|null}>}
 */
export const ONBOARDING_MODALS = [
  { key: 'welcome', name: 'Welcome', nameFr: 'Bienvenue', stepId: 0 },
  { key: 'step1', name: 'Edit Mode', nameFr: 'Mode édition', stepId: 1 },
  { key: 'step2', name: 'AI Generation', nameFr: 'Génération IA', stepId: 2 },
  { key: 'step6', name: 'Optimization', nameFr: 'Optimisation', stepId: 6 },
  { key: 'step8', name: 'Export', nameFr: 'Export', stepId: 8 },
  { key: 'completion', name: 'Completion', nameFr: 'Félicitations', stepId: null },
];

/**
 * Statuts possibles pour le filtrage
 * @type {Array<{value: string, label: string, color: string, bgColor: string}>}
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
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {Object|null} Informations de l'étape ou null si non trouvée
 */
export function getStepById(stepId) {
  return ONBOARDING_STEPS.find(step => step.id === stepId) || null;
}

/**
 * Obtient le nom français d'une étape
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {string} Nom français ou 'Inconnu'
 */
export function getStepNameFr(stepId) {
  const step = getStepById(stepId);
  return step?.nameFr || 'Inconnu';
}

/**
 * Obtient l'icône d'une étape
 * @param {number} stepId - ID de l'étape (0-8)
 * @returns {string} Icône ou '❓'
 */
export function getStepIcon(stepId) {
  const step = getStepById(stepId);
  return step?.icon || '❓';
}

/**
 * Obtient les informations d'un statut
 * @param {string} status - Valeur du statut
 * @returns {Object} Informations du statut
 */
export function getStatusInfo(status) {
  return ONBOARDING_STATUSES.find(s => s.value === status) || ONBOARDING_STATUSES[0];
}

/**
 * Détermine le statut d'un utilisateur basé sur son onboardingState
 * @param {Object} onboardingState - État de l'onboarding
 * @param {Date} [lastActivityDate] - Date de dernière activité
 * @returns {string} Statut: 'completed', 'skipped', 'stuck', 'in_progress', 'not_started'
 */
export function determineUserStatus(onboardingState, lastActivityDate = null) {
  if (!onboardingState) {
    return 'not_started';
  }

  // Complété
  if (onboardingState.hasCompleted) {
    return 'completed';
  }

  // Abandonné
  if (onboardingState.isSkipped) {
    return 'skipped';
  }

  // Non démarré (step 0 sans startedAt)
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

  // En cours
  return 'in_progress';
}

/**
 * Calcule le pourcentage de progression
 * @param {Object} onboardingState - État de l'onboarding
 * @returns {number} Pourcentage (0-100)
 */
export function calculateProgress(onboardingState) {
  if (!onboardingState) return 0;
  if (onboardingState.hasCompleted) return 100;

  const totalSteps = 8;
  const completedCount = onboardingState.completedSteps?.length || 0;

  return Math.round((completedCount / totalSteps) * 100);
}

