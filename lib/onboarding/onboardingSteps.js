/**
 * Configuration des 7 étapes d'onboarding (optimisé)
 *
 * Changements v2 :
 * - Fusion étapes 2-3 → Étape 2 unique "Génération IA"
 * - Fusion étapes 7-8 → Étape 6 unique "Optimisation"
 * - Étape 5 renommée : "CV généré" → "Ouverture du CV généré"
 * - Total : 7 étapes (au lieu de 9)
 */

export const ONBOARDING_STEPS = [
  // ========== ÉTAPE 1 : MODE ÉDITION ==========
  {
    id: 1,
    key: 'edit_mode',
    title: 'Mode édition',
    emoji: '✏️',
    description: 'Découvrez le mode édition pour modifier facilement votre CV',

    // Targeting
    targetSelector: '[data-onboarding="edit-mode-button"]',

    // Tooltip
    tooltip: {
      content: '👉 Cliquez ici pour découvrir le mode édition',
      position: 'left',
    },

    // Modal carousel (5 écrans)
    modal: {
      triggeredBy: 'edit_button_click', // ✅ Modal s'ouvre au clic bouton (AVANT activation)
      screens: [
        {
          title: 'Modifier votre CV facilement',
          description: 'Le mode édition vous permet de modifier toutes les sections de votre CV en un simple clic. Cliquez sur n\'importe quelle section (expérience, compétences, formation...) pour l\'éditer directement. Toutes vos modifications sont automatiquement sauvegardées.',
        },
        {
          title: 'Personnaliser vos compétences',
          description: 'Ajoutez de nouvelles compétences techniques ou soft skills, modifiez les niveaux de maîtrise, ou supprimez celles qui ne sont plus pertinentes. Organisez vos skills pour mettre en avant celles qui correspondent le mieux aux offres d\'emploi que vous visez.',
        },
        {
          title: 'Éditer votre expérience',
          description: 'Détaillez vos expériences professionnelles avec l\'éditeur de texte enrichi. Ajoutez des missions, des réalisations concrètes, des chiffres clés. Vous pouvez aussi réorganiser l\'ordre des expériences pour mettre en avant les plus pertinentes.',
        },
        {
          title: 'Gérer formation et langues',
          description: 'Complétez votre parcours académique : diplômes, certifications, formations continues. Ajoutez les langues que vous maîtrisez avec les niveaux correspondants (A1-C2, courant, bilingue...). Ces informations sont essentielles pour de nombreux recruteurs.',
        },
        {
          title: 'Ajouter vos projets',
          description: 'Mettez en avant vos projets personnels et professionnels : développements open-source, contributions techniques, projets entrepreneuriaux... Décrivez les technologies utilisées, votre rôle, et les résultats obtenus. C\'est un excellent moyen de vous démarquer.',
        },
      ],
    },

    // Validation : uniquement quand modal complété
    validation: {
      type: 'modal_completed',
    },

    // Pulsing dot : disparaît au clic bouton (avant ouverture modal)
    pulsingDot: {
      show: true,
      disappearsOn: 'edit_button_clicked',
    },
  },

  // ========== ÉTAPE 2 : GÉNÉRATION IA (FUSION 2+3) ==========
  {
    id: 2,
    key: 'ai_generation',
    title: 'Génération IA',
    emoji: '✨',
    description: 'Générer un CV adapté avec l\'IA',

    // Targeting
    targetSelector: '[data-onboarding="ai-generate"]',

    // Tooltip
    tooltip: {
      content: '✨ Adaptez votre CV aux offres grâce à l\'IA',
      position: 'bottom',
    },

    // Modal explicatif (ancien step 3)
    modal: {
      size: 'large',
      screens: [
        {
          title: 'Comment fonctionne l\'IA ?',
          description: 'Notre IA analyse l\'offre d\'emploi et adapte votre CV automatiquement. Elle identifie les compétences clés, les mots-clés recherchés, et restructure votre CV pour maximiser vos chances. Chaque section est optimisée pour correspondre parfaitement aux attentes du recruteur.',
        },
        {
          title: 'Personnalisez votre génération',
          description: 'Choisissez le niveau d\'analyse (rapide, moyen, approfondi) selon vos besoins. Le mode rapide ajuste les mots-clés essentiels, le mode moyen réorganise les sections, et le mode approfondi reformule entièrement votre CV pour un match parfait avec l\'offre.',
        },
        {
          title: 'Obtenez un CV optimisé en secondes',
          description: 'Recevez un CV parfaitement adapté aux mots-clés de l\'offre. L\'IA met en avant vos expériences les plus pertinentes, reformule vos missions pour matcher les compétences recherchées, et optimise le format pour passer les systèmes ATS (Applicant Tracking System).',
        },
      ],
    },

    // Validation : quand génération lancée
    validation: {
      type: 'state_check',
      key: 'generation_launched',
    },

    // Pulsing dot : reste jusqu'à génération lancée
    pulsingDot: {
      show: true,
      disappearsOn: 'generation_launched',
    },
  },

  // ========== ÉTAPE 3 : TASK MANAGER (ANCIEN 4) ==========
  {
    id: 3,
    key: 'task_manager',
    title: 'Task Manager',
    emoji: '📋',
    description: 'Suivre la progression de vos tâches en arrière-plan',

    // Déclenchement conditionnel : génération en cours
    precondition: {
      type: 'state_check',
      key: 'generationInProgress',
    },

    // Targeting
    targetSelector: '[data-onboarding="task-manager"]',

    // Tooltip
    tooltip: {
      content: '🔄 Votre CV est en cours de génération. Suivez l\'avancement ici.',
      position: 'bottom',
      persistent: true,
    },

    // Pas de modal
    modal: null,

    // Validation multiple
    validation: {
      type: 'multi',
      conditions: [
        { type: 'state_check', key: 'generationCompleted' },
        { type: 'action', action: 'task_manager_opened' },
        { type: 'action', action: 'tooltip_closed' },
      ],
    },

    // Pulsing dot
    pulsingDot: {
      show: true,
      disappearsOn: 'task_manager_opened',
    },
  },

  // ========== ÉTAPE 4 : OUVERTURE DU CV GÉNÉRÉ (ANCIEN 5, RENOMMÉ) ==========
  {
    id: 4,
    key: 'open_generated_cv',
    title: 'Ouverture du CV généré',
    emoji: '📄',
    description: 'Ouvrir et consulter votre CV généré',

    // Déclenchement conditionnel
    precondition: {
      type: 'state_check',
      key: 'cvGenerated',
    },

    // Targeting
    targetSelector: '[data-onboarding="cv-selector"]',

    // Tooltip
    tooltip: {
      content: '✅ Votre nouveau CV est prêt ! Cliquez ici pour l\'ouvrir',
      position: 'bottom',
    },

    // Highlight avec glow
    highlight: {
      type: 'glow',
      intensity: 'high',
    },

    // Pas de modal
    modal: null,

    // Validation
    validation: {
      type: 'state_check',
      key: 'generatedCvOpened',
    },

    // Pulsing dot
    pulsingDot: {
      show: true,
      disappearsOn: 'cv_selected',
    },
  },

  // ========== ÉTAPE 5 : SCORE DE MATCH (ANCIEN 6) ==========
  {
    id: 5,
    key: 'match_score',
    title: 'Score de match',
    emoji: '🎯',
    description: 'Calculer la compatibilité avec une offre d\'emploi',

    // Déclenchement conditionnel : CV avec job summary
    precondition: {
      type: 'data_check',
      check: 'currentCvHasJobSummary',
    },

    // Targeting
    targetSelector: '[data-onboarding="match-score"]',

    // Tooltip
    tooltip: {
      content: '🎯 Calculez la compatibilité de votre CV avec une offre d\'emploi',
      position: 'top',
    },

    // Pas de modal
    modal: null,

    // Validation
    validation: {
      type: 'action',
      action: 'match_score_calculated',
    },

    // Pulsing dot
    pulsingDot: {
      show: true,
      disappearsOn: 'match_score_launched',
    },

    // Fallback si condition non remplie
    fallback: {
      type: 'skip_after_timeout',
      timeout: 30000,
      message: 'Cette étape nécessite une offre d\'emploi associée. Voulez-vous la passer ?',
    },
  },

  // ========== ÉTAPE 6 : OPTIMISATION (FUSION 7+8) ==========
  {
    id: 6,
    key: 'optimization',
    title: 'Optimisation IA',
    emoji: '🚀',
    description: 'Optimiser le CV avec suggestions IA',

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
      content: '🚀 Optimisez votre CV pour augmenter votre score',
      position: 'top',
    },

    // Modal explicatif (ancien step 8)
    modal: {
      size: 'large',
      screens: [
        {
          title: 'Comment fonctionne l\'optimisation ?',
          description: 'L\'IA compare votre CV à l\'offre et propose des améliorations ciblées. Elle analyse chaque section pour détecter les opportunités d\'amélioration : mots-clés manquants, formulations faibles, compétences sous-valorisées. L\'optimisation se fait en une seule passe pour un résultat cohérent et professionnel.',
        },
        {
          title: 'L\'IA analyse et améliore votre CV',
          description: 'Ajout de mots-clés, reformulation, optimisation ATS automatique. L\'IA enrichit vos descriptions d\'expériences avec des verbes d\'action percutants, intègre le vocabulaire technique de l\'offre, et restructure vos compétences pour maximiser votre score de match. Chaque modification est pensée pour séduire à la fois les recruteurs humains et les logiciels de tri automatique.',
        },
        {
          title: 'Suivez les modifications en temps réel',
          description: 'Visualisez chaque amélioration avec l\'historique des changements. Toutes les modifications sont enregistrées et consultables dans l\'onglet Historique. Vous pouvez voir exactement ce qui a été modifié, pourquoi, et revenir en arrière si nécessaire. L\'IA justifie chaque changement pour que vous compreniez la logique d\'optimisation.',
        },
      ],
    },

    // Validation : quand modal d'optimisation est fermé
    validation: {
      type: 'state_check',
      key: 'optimization_modal_closed',
    },

    // Pulsing dot : reste jusqu'à modal fermé
    pulsingDot: {
      show: true,
      disappearsOn: 'optimization_modal_closed',
    },
  },

  // ========== ÉTAPE 7 : HISTORIQUE + EXPORT (ANCIEN 9, 2 PHASES) ==========
  {
    id: 7,
    key: 'history_export',
    title: 'Historique & Export',
    emoji: '📥',
    description: 'Consulter l\'historique et exporter votre CV optimisé',

    // Déclenchement conditionnel
    precondition: {
      type: 'multi',
      conditions: [
        { type: 'state_check', key: 'optimizationCompleted' },
        { type: 'element_visible', selector: '[data-onboarding="history"]' },
        { type: 'element_visible', selector: '[data-onboarding="export"]' },
      ],
    },

    // 2 phases séquentielles
    phases: [
      // PHASE 1 : Historique
      {
        phase: 1,
        key: 'history',

        // 2 pulsing dots simultanés
        pulsingDots: [
          { selector: '[data-onboarding="history"]', disappearsOn: 'history_opened' },
          { selector: '[data-onboarding="export"]', disappearsOn: 'never' },
        ],

        // 1 seul tooltip (historique)
        tooltip: {
          selector: '[data-onboarding="history"]',
          content: '📝 Découvrez toutes les modifications apportées par l\'optimisation',
          position: 'left',
        },

        // Validation phase 1
        validation: {
          type: 'action',
          action: 'history_tooltip_closed',
        },
      },

      // PHASE 2 : Export
      {
        phase: 2,
        key: 'export',

        // 1 pulsing dot (export)
        pulsingDots: [
          { selector: '[data-onboarding="export"]', disappearsOn: 'pdf_generated' },
        ],

        // Tooltip export
        tooltip: {
          selector: '[data-onboarding="export"]',
          content: '📄 Téléchargez votre CV optimisé, prêt à être envoyé aux recruteurs !',
          position: 'left',
        },

        // Validation phase 2 ET finale
        validation: {
          type: 'multi',
          conditions: [
            { type: 'action', action: 'export_tooltip_closed' },
            { type: 'state_check', key: 'pdfGenerated' },
          ],
          allRequired: true,
        },
      },
    ],

    // Validation globale étape 7
    validation: {
      type: 'phases_completed',
      phases: [1, 2],
    },

    // Animation finale (confettis)
    onComplete: {
      animation: 'confetti',
      message: '🎉 Félicitations ! Vous maîtrisez maintenant toutes les fonctionnalités !',
      badge: 'onboarding_completed',
    },
  },
];

/**
 * États/actions trackés pour validation
 */
export const ONBOARDING_ACTIONS = {
  // Étape 1
  EDIT_BUTTON_CLICKED: 'edit_button_clicked',
  EDIT_MODE_ACTIVATED: 'edit_mode_activated',

  // Étape 2 (fusion 2+3)
  AI_GENERATE_CLICKED: 'ai_generate_button_clicked',
  GENERATION_LAUNCHED: 'generation_launched',

  // Étape 3 (ancien 4)
  GENERATION_IN_PROGRESS: 'generationInProgress',
  GENERATION_COMPLETED: 'generationCompleted',
  TASK_MANAGER_OPENED: 'task_manager_opened',

  // Étape 4 (ancien 5)
  CV_GENERATED: 'cvGenerated',
  GENERATED_CV_OPENED: 'generatedCvOpened',

  // Étape 5 (ancien 6)
  MATCH_SCORE_CALCULATED: 'match_score_calculated',

  // Étape 6 (fusion 7+8)
  OPTIMIZE_CLICKED: 'optimize_button_clicked',
  OPTIMIZATION_MODAL_CLOSED: 'optimization_modal_closed',
  OPTIMIZATION_LAUNCHED: 'optimization_launched',

  // Étape 7 (ancien 9)
  OPTIMIZATION_COMPLETED: 'optimizationCompleted',
  HISTORY_OPENED: 'history_opened',
  HISTORY_TOOLTIP_CLOSED: 'history_tooltip_closed',
  EXPORT_TOOLTIP_CLOSED: 'export_tooltip_closed',
  PDF_GENERATED: 'pdfGenerated',
};

/**
 * Helper : Obtenir étape par ID
 */
export function getStepById(stepId) {
  return ONBOARDING_STEPS.find(step => step.id === stepId);
}

/**
 * Helper : Obtenir nombre total d'étapes
 */
export function getTotalSteps() {
  return ONBOARDING_STEPS.length; // 7
}

/**
 * Helper : Vérifier si étape a des phases
 */
export function hasPhases(stepId) {
  const step = getStepById(stepId);
  return step?.phases && step.phases.length > 0;
}

/**
 * Helper : Obtenir phase d'une étape
 */
export function getPhase(stepId, phaseNumber) {
  const step = getStepById(stepId);
  if (!step?.phases) return null;

  return step.phases.find(p => p.phase === phaseNumber);
}
