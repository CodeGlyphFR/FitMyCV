# Documentation Système Onboarding

> **Guide complet du système d'onboarding interactif de FitMyCV**
>
> Ce dossier contient toute la documentation technique pour comprendre, développer et maintenir le système d'onboarding.

---

## 📚 Documentation Complète

### Architecture & Système

| Document | Description | Contenu |
|----------|-------------|---------|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Architecture système complète | Diagrammes flow, hiérarchie composants, responsabilités, event system |
| **[WORKFLOW.md](./WORKFLOW.md)** | Workflow des 8 steps d'onboarding | Détail step par step : objectifs, actions, validation, modals, tooltips |
| **[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)** | Gestion d'état onboardingState | Structure JSON, helpers, persistence, SSE sync, migration |

### Références Techniques

| Document | Description | Contenu |
|----------|-------------|---------|
| **[COMPONENTS.md](./COMPONENTS.md)** | Référence complète des composants | Props, exports, usage, exemples pour 8 composants + 4 hooks |
| **[API_REFERENCE.md](./API_REFERENCE.md)** | API REST & SSE | 5 endpoints (GET/PUT/PATCH/POST), SSE subscribe, cache strategy |
| **[TIMINGS.md](./TIMINGS.md)** | Configuration des délais | ONBOARDING_TIMINGS, raisons UX, architecture timers |

### Guides Pratiques

| Document | Description | Contenu |
|----------|-------------|---------|
| **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** | Guide développeur | How to: add step, debug, test locally, best practices |
| **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** | Dépannage & FAQ | Bugs récemment fixés, FAQ, migration guide |

---

## 🚀 Quick Start

### Pour découvrir le système

1. **Architecture** → [ARCHITECTURE.md](./ARCHITECTURE.md) - Comprendre les composants
2. **Workflow** → [WORKFLOW.md](./WORKFLOW.md) - Comprendre les 8 steps
3. **État** → [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - Comprendre onboardingState

### Pour développer

1. **Composants** → [COMPONENTS.md](./COMPONENTS.md) - Référence complète
2. **Guide dev** → [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - How-to guides
3. **Timings** → [TIMINGS.md](./TIMINGS.md) - Configuration délais

### Pour déboguer

1. **Troubleshooting** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Bugs connus + FAQ
2. **API** → [API_REFERENCE.md](./API_REFERENCE.md) - Endpoints et réponses

---

## 📖 Quick Reference

### Vue d'ensemble du système

Le système d'onboarding guide les nouveaux utilisateurs à travers **8 étapes interactives** pour découvrir toutes les fonctionnalités de FitMyCV :

1. **Step 0** : Welcome Modal (pré-onboarding, 3 screens)
2. **Step 1** : Mode édition (modal 5 screens + validation sortie mode édition)
3. **Step 2** : Génération IA (modal 3 screens + lancement génération)
4. **Step 3** : Task Manager (tooltip persistent + ouverture task panel)
5. **Step 4** : Ouverture CV généré (highlight + clic CV)
6. **Step 5** : Score de match (calcul compatibilité avec offre)
7. **Step 6** : Optimisation IA (modal 3 screens + lancement optimisation)
8. **Step 7** : Historique (consultation modifications IA)
9. **Step 8** : Export PDF (modal 3 screens + export + confetti 🎉)

Après step 8 : **OnboardingCompletionModal** (3 screens) → completeOnboarding()

### Fichiers code principaux

```
components/onboarding/
├── OnboardingProvider.jsx          (1131 lignes) - Context, SSE, state
├── OnboardingOrchestrator.jsx      (1320 lignes) - Validation, events
├── WelcomeModal.jsx                (576 lignes)  - Modal accueil 3 screens
├── OnboardingModal.jsx             (400 lignes)  - Modal carousel générique
├── OnboardingCompletionModal.jsx   (377 lignes)  - Modal félicitations
├── OnboardingTooltip.jsx           (362 lignes)  - Tooltip emerald
├── OnboardingHighlight.jsx         (156 lignes)  - Highlight ring + blur
└── ChecklistPanel.jsx              (307 lignes)  - Checklist sidebar

hooks/
└── useOnboarding.js                (65 lignes)   - Hook context

lib/onboarding/
├── onboardingSteps.js              (439 lignes)  - Config 8 steps
├── onboardingState.js              (309 lignes)  - Helpers état
├── onboardingConfig.js             (49 lignes)   - Timings centralisés
├── onboardingEvents.js             (47 lignes)   - Événements
└── cvFilenameUtils.js              (36 lignes)   - Utils CV

lib/utils/
└── onboardingLogger.js             (48 lignes)   - Logger conditionnel

app/api/user/onboarding/
├── route.js                        (435 lignes)  - CRUD onboardingState
└── subscribe/route.js              (110 lignes)  - SSE endpoint

scripts/
├── reset-onboarding.js             (103 lignes)  - Reset DB
└── migrate-onboarding-state.js     (259 lignes)  - Migration format
```

**Total** : ~6464 lignes de code

### Constantes clés

```javascript
// Timings (lib/onboarding/onboardingConfig.js)
ONBOARDING_TIMINGS = {
  STEP_TRANSITION_DELAY: 1000,              // Délai entre steps
  MODAL_CLOSE_ANIMATION_DURATION: 300,      // Animation fermeture modal
  LOADING_TO_ONBOARDING_DELAY: 1000,        // Loading → welcome modal
  // ... voir TIMINGS.md pour liste complète
}

// Mapping steps → modals
STEP_TO_MODAL_KEY = {
  0: 'welcome',      // WelcomeModal (3 screens)
  1: 'step1',        // Mode édition (5 screens)
  2: 'step2',        // Génération IA (3 screens)
  6: 'step6',        // Optimisation (3 screens)
  8: 'step8',        // Export PDF (3 screens)
  fin: 'completion'  // Félicitations (3 screens)
}

// Cache API
ONBOARDING_API = {
  CACHE_TTL: 1000,                          // 1s (sync avec debounce)
  MAX_RETRY_ATTEMPTS: 3
}
```

### Logger conditionnel

```javascript
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

// Dev only (NODE_ENV === 'development')
onboardingLogger.log('[Component] Info message');

// Always shown (prod + dev)
onboardingLogger.error('[Component] Error:', error);
onboardingLogger.warn('[Component] Warning');
```

**Règle** : Utiliser `onboardingLogger` au lieu de `console.log/error` dans tous les composants onboarding.

### Scripts utiles

```bash
# Reset onboardingState pour tous les users (DB)
node scripts/reset-onboarding.js --dry-run   # Preview
node scripts/reset-onboarding.js             # Execute

# Migrer ancien format vers nouveau
node scripts/migrate-onboarding-state.js
```

### Structure onboardingState (résumé)

```javascript
{
  currentStep: 2,                    // Étape actuelle (0-8)
  completedSteps: [1, 2],            // Steps complétés
  hasCompleted: false,               // Onboarding terminé
  isSkipped: false,                  // Onboarding skippé

  modals: {                          // 6 modaux trackés
    welcome: { completed: true },
    step1: { completed: true },
    step2: { completed: false },
    step6: { completed: false },
    step8: { completed: false },
    completion: { completed: false }
  },

  tooltips: {                        // 8 tooltips (1 par step)
    "1": { closedManually: false },
    "2": { closedManually: true },   // Fermé avec X
    // ...
  },

  timestamps: {                      // Télémétrie
    startedAt: "2025-11-24T10:00:00Z",
    completedAt: null,
    skippedAt: null,
    lastStepChangeAt: "2025-11-24T10:10:00Z"
  },

  step4: {                           // Préconditions step 4
    cvGenerated: false,
    cvFilename: null
  }
}
```

Voir [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) pour la structure complète.

---

## 🔗 Liens externes

- **CLAUDE.md** : Section "Système d'onboarding" (Quick reference principal)
- **docs/README.md** : Index documentation projet
- **Code source** : `components/onboarding/`, `lib/onboarding/`

---

## 📝 Contribution

Pour modifier cette documentation :

1. **Ajouter un guide** : Créer nouveau fichier dans `docs/onboarding/`
2. **Mettre à jour index** : Modifier ce README.md (table des matières)
3. **Mettre à jour CLAUDE.md** : Ajouter liens vers nouveaux guides
4. **Commit** : `docs(onboarding): description de la modification`

---

## 📊 Statistiques

- **Composants React** : 8
- **Hooks** : 4
- **Bibliothèques** : 5
- **API routes** : 2
- **Scripts** : 2
- **Total lignes code** : ~6464
- **Documentation** : 9 fichiers (~2500 lignes)

---

**Dernière mise à jour** : 2025-11-25
