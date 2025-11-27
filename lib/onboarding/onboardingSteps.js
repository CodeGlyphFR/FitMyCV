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

    // Modal carousel (3 écrans)
    modal: {
      triggeredBy: 'edit_button_click', // ✅ Modal s'ouvre au clic bouton (AVANT activation)
      screens: [
        {
          type: 'master_cv',
          title: 'Créez votre CV "maître"',
          description: "L'idée est simple : créez un CV le plus complet possible avec toutes vos expériences, compétences et formations. Plus votre CV sera détaillé, plus l'IA pourra le filtrer intelligemment pour chaque offre d'emploi.",
          checklist: [
            'Un seul CV complet à maintenir',
            "L'IA extrait le meilleur pour chaque offre",
            'Un gain de temps énorme',
          ],
          tip: 'Pensez "Mega CV" : listez tout, l\'IA s\'occupe de trier pour vous. Faites-le une seule fois, la magie opère ensuite.',
        },
        {
          type: 'control',
          title: 'Vous avez le contrôle total !',
          description: 'Votre CV vous appartient. Modifiez-le à votre guise, section par section.',
          subtitle: '3 actions à votre disposition :',
          actions: [
            { icon: '/icons/edit.png', title: 'Modifier', description: 'Éditez le contenu de n\'importe quelle section en un clic' },
            { icon: '/icons/delete.png', title: 'Supprimer', description: 'Retirez ce qui n\'est plus pertinent' },
            { icon: '/icons/add.png', title: 'Ajouter', description: 'Complétez votre CV avec de nouvelles expériences, formations, langues, projets ou extras' },
          ],
          tip: "Plus votre CV est riche, plus l'IA a de matière pour l'adapter.",
        },
        {
          type: 'sections',
          title: 'Deux sections à ne pas négliger',
          blocks: [
            { emoji: '📁', title: 'Projets', description: 'Listez vos projets professionnels ET personnels. Un side-project, une contribution open source, un projet étudiant... tout compte pour l\'IA.' },
            { emoji: '📋', title: 'Extra', description: 'Renseignez vos informations complémentaires : hobbies et centres d\'intérêt, disponibilité, préférence télétravail, mobilité et déplacements, permis de conduire...' },
          ],
          tip: "Ces infos aident l'IA à mieux cibler les offres qui vous correspondent.",
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

    // Modal explicatif (3 écrans)
    modal: {
      size: 'large',
      screens: [
        // ÉCRAN 1/3
        {
          type: 'step2_intro',
          title: 'Générez des CV sur-mesure en quelques clics',
          description: "Le cœur de FitMyCV : vos offres d'emploi. Ajoutez-les, l'IA s'occupe du reste. Elle analyse chaque offre, extrait les informations clés et adapte votre CV automatiquement.",
          subtitle: '2 façons de commencer :',
          blocks: [
            {
              emoji: '📄',
              title: 'Partir d\'un CV existant',
              description: "Sélectionnez votre CV le plus complet. Plus il est détaillé, plus l'IA pourra l'adapter précisément à chaque offre d'emploi.",
            },
            {
              emoji: '✨',
              title: 'Créer un template depuis l\'offre',
              description: "Générez un modèle de CV basé sur l'offre d'emploi pour vous inspirer et composer le vôtre.",
            },
          ],
          tip: "Pas besoin de copier-coller le contenu des offres. Collez les liens ou importez les PDF, l'IA extrait tout automatiquement.",
        },
        // ÉCRAN 2/3
        {
          type: 'step2_methods',
          title: 'Une offre d\'emploi = Un CV adapté',
          description: "Ajoutez autant d'offres que vous voulez. Pour chacune, l'IA génère un CV parfaitement adapté.",
          blocks: [
            {
              emoji: '🔗',
              title: 'Par URL',
              description: "Collez les liens de vos offres d'emploi. L'IA ouvre chaque page et extrait les informations automatiquement.",
            },
            {
              emoji: '📎',
              title: 'Par PDF',
              description: "Importez les offres qu'on vous a envoyées ou que vous avez sauvegardées.",
            },
          ],
          historyBlock: {
            emoji: '🕘',
            title: 'Historique',
            description: "Retrouvez toutes les offres déjà utilisées. Réutilisez-les pour générer de nouveaux CV sans les rechercher à nouveau.",
          },
          subtitle2: '3 niveaux d\'analyse :',
          analysisLevels: [
            { emoji: '⚡', title: 'Rapide', description: 'Adaptation essentielle' },
            { emoji: '⚙️', title: 'Normal', description: 'Analyse complète' },
            { emoji: '🔍', title: 'Approfondi', description: 'Optimisation maximale' },
          ],
        },
        // ÉCRAN 3/3
        {
          type: 'step2_ai_behavior',
          title: 'L\'IA adapte, elle n\'invente rien',
          description: "L'IA ne fabrique pas de fausses expériences. Elle filtre votre CV générique pour ne garder que ce qui compte pour l'offre d'emploi.",
          subtitle: 'Concrètement, l\'IA va :',
          checklist: [
            "Filtrer les expériences et compétences pertinentes pour l'offre",
            "Retirer ce qui est inutile pour ne pas surcharger le CV",
            "Reformuler avec le vocabulaire de l'offre d'emploi (ATS-friendly)",
            "Détecter les compétences manquantes justifiables par votre parcours",
            "Déterminer votre niveau pour chaque compétence ajoutée",
          ],
          tip: "Résultat : un CV ciblé, allégé et parfaitement aligné avec ce que recherche le recruteur.",
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
