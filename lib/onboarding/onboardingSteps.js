/**
 * Configuration des 8 étapes d'onboarding (optimisé v3)
 *
 * Changements v3 :
 * - Étape 7 "Historique & Export" séparée en 2 étapes distinctes
 * - Étape 7 : Historique uniquement (validée à la fermeture du modal)
 * - Étape 8 : Export avec modal tutoriel 3 écrans (validée au clic sur export)
 * - Total : 8 étapes
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
      content: '👉 Cliquez ici pour éditer votre CV !',
      position: 'top',
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

    // Validation simplifiée : seulement le clic sur le task manager
    validation: {
      type: 'action',
      action: 'onboarding:task-manager-opened',
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

    // Note: Highlight retiré - le PulsingDot et Tooltip suffisent
    // L'ancien OnboardingHighlight avec backdrop-blur bloquait toute la page

    // Pas de modal
    modal: null,

    // Validation
    validation: {
      type: 'state_check',
      key: 'generatedCvOpened',
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
      position: 'left',
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
      position: 'left',
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
  },

  // ========== ÉTAPE 7 : HISTORIQUE ==========
  {
    id: 7,
    key: 'history',
    title: 'Historique',
    emoji: '📝',
    description: 'Consulter l\'historique des modifications IA',

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
      content: '📝 Découvrez toutes les modifications apportées par l\'IA',
      position: 'left',
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
    title: 'Export PDF',
    emoji: '📥',
    description: 'Exporter votre CV optimisé au format PDF',

    // Déclenchement conditionnel
    precondition: {
      type: 'element_visible',
      selector: '[data-onboarding="export"]',
    },

    // Targeting
    targetSelector: '[data-onboarding="export"]',

    // Tooltip
    tooltip: {
      content: '📄 Exportez votre CV optimisé au format PDF',
      position: 'bottom',
    },

    // Modal tutoriel (3 écrans)
    modal: {
      size: 'large',
      screens: [
        {
          title: 'Exportez votre CV en PDF',
          description: 'Votre CV est prêt à être téléchargé ! L\'export PDF vous permet de créer un document professionnel parfaitement formaté, prêt à être envoyé aux recruteurs ou uploadé sur les plateformes d\'emploi. Le format PDF garantit que votre mise en page sera préservée sur tous les appareils.',
        },
        {
          title: 'Choisissez vos sections',
          description: 'Personnalisez le contenu de votre CV exporté ! Vous pouvez sélectionner précisément les sections à inclure : expériences, compétences, formation, langues, projets... Vous pouvez même choisir quels éléments individuels afficher dans chaque section pour un CV parfaitement adapté à chaque candidature.',
        },
        {
          title: 'Personnalisez et téléchargez',
          description: 'Donnez un nom à votre fichier pour l\'identifier facilement. Une fois vos choix effectués, cliquez sur "Exporter en PDF" pour télécharger votre CV. Vous pouvez créer autant de versions différentes que nécessaire, chacune adaptée à une offre d\'emploi spécifique !',
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
 */
export function getStepById(stepId) {
  return ONBOARDING_STEPS.find(step => step.id === stepId);
}

/**
 * Helper : Obtenir nombre total d'étapes
 */
export function getTotalSteps() {
  return ONBOARDING_STEPS.length; // 8
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
