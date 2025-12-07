/**
 * Configuration des 8 étapes d'onboarding (optimisé v4 - i18n)
 *
 * Changements v4 :
 * - Internationalisation complète avec factory function
 * - Toutes les chaînes de texte passent par le système i18n
 * - createOnboardingSteps(t) accepte la fonction de traduction
 *
 * Changements v3 :
 * - Étape 7 "Historique & Export" séparée en 2 étapes distinctes
 * - Total : 8 étapes
 */

/**
 * Nombre total d'étapes (constant, utile pour les composants qui n'ont pas besoin du contenu traduit)
 */
export const ONBOARDING_STEPS_COUNT = 8;

/**
 * Factory function pour créer les étapes d'onboarding avec traduction
 * @param {function} t - Fonction de traduction du contexte i18n
 * @returns {Array} - Liste des étapes d'onboarding traduites
 */
export function createOnboardingSteps(t) {
  return [
    // ========== ÉTAPE 1 : MODE ÉDITION ==========
    {
      id: 1,
      key: 'edit_mode',
      title: t('onboarding.steps.step1.title'),
      emoji: '✏️',
      description: t('onboarding.steps.step1.description'),

      // Targeting
      targetSelector: '[data-onboarding="edit-mode-button"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step1.tooltip'),
        position: 'top',
      },

      // Modal carousel (3 écrans)
      modal: {
        triggeredBy: 'edit_button_click',
        screens: [
          {
            type: 'master_cv',
            title: t('onboarding.steps.step1.modal.screen1.title'),
            description: t('onboarding.steps.step1.modal.screen1.description'),
            checklist: t('onboarding.steps.step1.modal.screen1.checklist'),
            tip: t('onboarding.steps.step1.modal.screen1.tip'),
          },
          {
            type: 'control',
            title: t('onboarding.steps.step1.modal.screen2.title'),
            description: t('onboarding.steps.step1.modal.screen2.description'),
            subtitle: t('onboarding.steps.step1.modal.screen2.subtitle'),
            actions: [
              {
                icon: '/icons/edit.png',
                title: t('onboarding.steps.step1.modal.screen2.actions.edit.title'),
                description: t('onboarding.steps.step1.modal.screen2.actions.edit.description'),
              },
              {
                icon: '/icons/delete.png',
                title: t('onboarding.steps.step1.modal.screen2.actions.delete.title'),
                description: t('onboarding.steps.step1.modal.screen2.actions.delete.description'),
              },
              {
                icon: '/icons/add.png',
                title: t('onboarding.steps.step1.modal.screen2.actions.add.title'),
                description: t('onboarding.steps.step1.modal.screen2.actions.add.description'),
              },
            ],
            tip: t('onboarding.steps.step1.modal.screen2.tip'),
          },
          {
            type: 'sections',
            title: t('onboarding.steps.step1.modal.screen3.title'),
            blocks: [
              {
                emoji: '📁',
                title: t('onboarding.steps.step1.modal.screen3.blocks.projects.title'),
                description: t('onboarding.steps.step1.modal.screen3.blocks.projects.description'),
              },
              {
                emoji: '📋',
                title: t('onboarding.steps.step1.modal.screen3.blocks.extra.title'),
                description: t('onboarding.steps.step1.modal.screen3.blocks.extra.description'),
              },
            ],
            tip: t('onboarding.steps.step1.modal.screen3.tip'),
          },
        ],
      },

      // Validation : uniquement quand modal complété
      validation: {
        type: 'modal_completed',
      },
    },

    // ========== ÉTAPE 2 : GÉNÉRATION IA ==========
    {
      id: 2,
      key: 'ai_generation',
      title: t('onboarding.steps.step2.title'),
      emoji: '✨',
      description: t('onboarding.steps.step2.description'),

      // Targeting
      targetSelector: '[data-onboarding="ai-generate"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step2.tooltip'),
        position: 'bottom',
      },

      // Modal explicatif (3 écrans)
      modal: {
        size: 'large',
        screens: [
          // ÉCRAN 1/3
          {
            type: 'step2_intro',
            title: t('onboarding.steps.step2.modal.screen1.title'),
            description: t('onboarding.steps.step2.modal.screen1.description'),
            subtitle: t('onboarding.steps.step2.modal.screen1.subtitle'),
            blocks: [
              {
                emoji: '📄',
                title: t('onboarding.steps.step2.modal.screen1.blocks.existing.title'),
                description: t('onboarding.steps.step2.modal.screen1.blocks.existing.description'),
              },
              {
                emoji: '✨',
                title: t('onboarding.steps.step2.modal.screen1.blocks.template.title'),
                description: t('onboarding.steps.step2.modal.screen1.blocks.template.description'),
              },
            ],
            tip: t('onboarding.steps.step2.modal.screen1.tip'),
          },
          // ÉCRAN 2/3
          {
            type: 'step2_methods',
            title: t('onboarding.steps.step2.modal.screen2.title'),
            description: t('onboarding.steps.step2.modal.screen2.description'),
            blocks: [
              {
                emoji: '🔗',
                title: t('onboarding.steps.step2.modal.screen2.blocks.url.title'),
                description: t('onboarding.steps.step2.modal.screen2.blocks.url.description'),
              },
              {
                emoji: '📎',
                title: t('onboarding.steps.step2.modal.screen2.blocks.pdf.title'),
                description: t('onboarding.steps.step2.modal.screen2.blocks.pdf.description'),
              },
            ],
            historyBlock: {
              emoji: '🕘',
              title: t('onboarding.steps.step2.modal.screen2.historyBlock.title'),
              description: t('onboarding.steps.step2.modal.screen2.historyBlock.description'),
            },
          },
          // ÉCRAN 3/3
          {
            type: 'step2_ai_behavior',
            title: t('onboarding.steps.step2.modal.screen3.title'),
            description: t('onboarding.steps.step2.modal.screen3.description'),
            subtitle: t('onboarding.steps.step2.modal.screen3.subtitle'),
            checklist: t('onboarding.steps.step2.modal.screen3.checklist'),
            tip: t('onboarding.steps.step2.modal.screen3.tip'),
          },
        ],
      },

      // Validation : quand génération lancée
      validation: {
        type: 'state_check',
        key: 'generation_launched',
      },
    },

    // ========== ÉTAPE 3 : TASK MANAGER ==========
    {
      id: 3,
      key: 'task_manager',
      title: t('onboarding.steps.step3.title'),
      emoji: '📋',
      description: t('onboarding.steps.step3.description'),

      // Déclenchement conditionnel : génération en cours
      precondition: {
        type: 'state_check',
        key: 'generationInProgress',
      },

      // Targeting
      targetSelector: '[data-onboarding="task-manager"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step3.tooltip'),
        position: 'bottom',
        persistent: true,
      },

      // Pas de modal
      modal: null,

      // Validation simplifiée : seulement le clic sur le task manager
      validation: {
        type: 'action',
        action: 'onboarding:task-manager-opened',
      },
    },

    // ========== ÉTAPE 4 : OUVERTURE DU CV GÉNÉRÉ ==========
    {
      id: 4,
      key: 'open_generated_cv',
      title: t('onboarding.steps.step4.title'),
      emoji: '📄',
      description: t('onboarding.steps.step4.description'),

      // Déclenchement conditionnel
      precondition: {
        type: 'state_check',
        key: 'cvGenerated',
      },

      // Targeting
      targetSelector: '[data-onboarding="cv-selector"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step4.tooltip'),
        position: 'bottom',
      },

      // Pas de modal
      modal: null,

      // Validation
      validation: {
        type: 'state_check',
        key: 'generatedCvOpened',
      },
    },

    // ========== ÉTAPE 5 : SCORE DE MATCH ==========
    {
      id: 5,
      key: 'match_score',
      title: t('onboarding.steps.step5.title'),
      emoji: '🎯',
      description: t('onboarding.steps.step5.description'),

      // Déclenchement conditionnel : CV avec job summary
      precondition: {
        type: 'data_check',
        check: 'currentCvHasJobSummary',
      },

      // Targeting
      targetSelector: '[data-onboarding="match-score"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step5.tooltip'),
        position: 'bottom',
      },

      // Pas de modal
      modal: null,

      // Validation
      validation: {
        type: 'action',
        action: 'onboarding:match-score-calculated',
      },

      // Fallback si condition non remplie
      fallback: {
        type: 'skip_after_timeout',
        timeout: 30000,
        message: t('onboarding.steps.step5.fallbackMessage'),
      },
    },

    // ========== ÉTAPE 6 : OPTIMISATION ==========
    {
      id: 6,
      key: 'optimization',
      title: t('onboarding.steps.step6.title'),
      emoji: '🚀',
      description: t('onboarding.steps.step6.description'),

      // Déclenchement conditionnel : score calculé ET bouton optimiser visible
      precondition: {
        type: 'multi',
        conditions: [
          { type: 'state_check', key: 'matchScoreCalculated' },
          { type: 'element_visible', selector: '[data-onboarding="optimize"]' },
        ],
      },

      // Targeting
      targetSelector: '[data-onboarding="optimize"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step6.tooltip'),
        position: 'left',
      },

      // Modal explicatif (2 écrans)
      modal: {
        size: 'large',
        screens: [
          {
            type: 'step6_score_analysis',
            title: t('onboarding.steps.step6.modal.screen1.title'),
            description: t('onboarding.steps.step6.modal.screen1.description'),
            subtitle: t('onboarding.steps.step6.modal.screen1.subtitle'),
            blocks: [
              {
                emoji: '📊',
                title: t('onboarding.steps.step6.modal.screen1.blocks.breakdown.title'),
                description: t('onboarding.steps.step6.modal.screen1.blocks.breakdown.description'),
              },
              {
                emoji: '✅',
                title: t('onboarding.steps.step6.modal.screen1.blocks.validated.title'),
                description: t('onboarding.steps.step6.modal.screen1.blocks.validated.description'),
              },
              {
                emoji: '⚠️',
                title: t('onboarding.steps.step6.modal.screen1.blocks.missing.title'),
                description: t('onboarding.steps.step6.modal.screen1.blocks.missing.description'),
              },
              {
                emoji: '📝',
                title: t('onboarding.steps.step6.modal.screen1.blocks.improvements.title'),
                description: t('onboarding.steps.step6.modal.screen1.blocks.improvements.description'),
              },
            ],
            tip: t('onboarding.steps.step6.modal.screen1.tip'),
          },
          {
            type: 'step6_apply_improvements',
            title: t('onboarding.steps.step6.modal.screen2.title'),
            description: t('onboarding.steps.step6.modal.screen2.description'),
            checklist: t('onboarding.steps.step6.modal.screen2.checklist'),
            subtitle: t('onboarding.steps.step6.modal.screen2.subtitle'),
            transparencyText: t('onboarding.steps.step6.modal.screen2.transparencyText'),
            tip: t('onboarding.steps.step6.modal.screen2.tip'),
          },
        ],
      },

      // Validation : quand modal d'optimisation est fermé
      validation: {
        type: 'state_check',
        key: 'optimization_modal_closed',
      },
    },

    // ========== ÉTAPE 7 : HISTORIQUE ==========
    {
      id: 7,
      key: 'history',
      title: t('onboarding.steps.step7.title'),
      emoji: '📝',
      description: t('onboarding.steps.step7.description'),

      // Déclenchement conditionnel
      precondition: {
        type: 'multi',
        conditions: [
          { type: 'state_check', key: 'optimizationCompleted' },
          { type: 'element_visible', selector: '[data-onboarding="history"]' },
        ],
      },

      // Targeting
      targetSelector: '[data-onboarding="history"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step7.tooltip'),
        position: 'bottom',
      },

      // Pas de modal
      modal: null,

      // Validation : quand le modal historique est fermé
      validation: {
        type: 'action',
        action: 'onboarding:history-closed',
      },

      // Highlight avec ring vert pulsant
      highlight: {
        show: true,
      },
    },

    // ========== ÉTAPE 8 : EXPORT ==========
    {
      id: 8,
      key: 'export',
      title: t('onboarding.steps.step8.title'),
      emoji: '📥',
      description: t('onboarding.steps.step8.description'),

      // Déclenchement conditionnel
      precondition: {
        type: 'element_visible',
        selector: '[data-onboarding="export"]',
      },

      // Targeting
      targetSelector: '[data-onboarding="export"]',

      // Tooltip
      tooltip: {
        content: t('onboarding.steps.step8.tooltip'),
        position: 'bottom',
      },

      // Modal tutoriel (2 écrans)
      modal: {
        size: 'large',
        screens: [
          {
            type: 'step8_export_ready',
            title: t('onboarding.steps.step8.modal.screen1.title'),
            description: t('onboarding.steps.step8.modal.screen1.description'),
            checklist: t('onboarding.steps.step8.modal.screen1.checklist'),
          },
          {
            type: 'step8_export_custom',
            title: t('onboarding.steps.step8.modal.screen2.title'),
            description: t('onboarding.steps.step8.modal.screen2.description'),
            checklist: t('onboarding.steps.step8.modal.screen2.checklist'),
            tip: t('onboarding.steps.step8.modal.screen2.tip'),
          },
        ],
      },

      // Validation : quand l'utilisateur clique sur le bouton d'export
      validation: {
        type: 'action',
        action: 'onboarding:export-clicked',
      },

      // Highlight avec ring vert pulsant
      highlight: {
        show: true,
      },

      // Animation finale (confettis)
      onComplete: {
        animation: 'confetti',
        message: t('onboarding.steps.step8.onComplete.message'),
        badge: 'onboarding_completed',
      },
    },
  ];
}

/**
 * États/actions trackés pour validation
 */
export const ONBOARDING_ACTIONS = {
  // Étape 1
  EDIT_BUTTON_CLICKED: 'edit_button_clicked',
  EDIT_MODE_ACTIVATED: 'edit_mode_activated',

  // Étape 2
  AI_GENERATE_CLICKED: 'ai_generate_button_clicked',
  GENERATION_LAUNCHED: 'generation_launched',

  // Étape 3
  GENERATION_IN_PROGRESS: 'generationInProgress',
  GENERATION_COMPLETED: 'generationCompleted',
  TASK_MANAGER_OPENED: 'task_manager_opened',

  // Étape 4
  CV_GENERATED: 'cvGenerated',
  GENERATED_CV_OPENED: 'generatedCvOpened',

  // Étape 5
  MATCH_SCORE_CALCULATED: 'match_score_calculated',

  // Étape 6
  OPTIMIZE_CLICKED: 'optimize_button_clicked',
  OPTIMIZATION_MODAL_CLOSED: 'optimization_modal_closed',
  OPTIMIZATION_LAUNCHED: 'optimization_launched',

  // Étape 7 (Historique)
  OPTIMIZATION_COMPLETED: 'optimizationCompleted',
  HISTORY_OPENED: 'history_opened',
  HISTORY_CLOSED: 'history_closed',

  // Étape 8 (Export)
  EXPORT_CLICKED: 'export_clicked',
  PDF_GENERATED: 'pdfGenerated',
};

/**
 * Helper : Obtenir étape par ID
 * @param {Array} steps - Liste des étapes (générée par createOnboardingSteps)
 * @param {number} stepId - ID de l'étape
 */
export function getStepById(steps, stepId) {
  return steps.find((step) => step.id === stepId);
}

/**
 * Helper : Obtenir nombre total d'étapes
 */
export function getTotalSteps() {
  return ONBOARDING_STEPS_COUNT;
}

/**
 * Helper : Vérifier si étape a des phases
 * @param {Array} steps - Liste des étapes
 * @param {number} stepId - ID de l'étape
 */
export function hasPhases(steps, stepId) {
  const step = getStepById(steps, stepId);
  return step?.phases && step.phases.length > 0;
}

/**
 * Helper : Obtenir phase d'une étape
 * @param {Array} steps - Liste des étapes
 * @param {number} stepId - ID de l'étape
 * @param {number} phaseNumber - Numéro de phase
 */
export function getPhase(steps, stepId, phaseNumber) {
  const step = getStepById(steps, stepId);
  if (!step?.phases) return null;

  return step.phases.find((p) => p.phase === phaseNumber);
}
