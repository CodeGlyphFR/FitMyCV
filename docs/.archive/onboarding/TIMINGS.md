# Système d'Onboarding - Timings & Transitions

Ce document détaille tous les délais et timings utilisés dans le système d'onboarding de FitMyCV.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Délais de transition entre étapes](#délais-de-transition-entre-étapes)
- [Animations et modals](#animations-et-modals)
- [Polling et retry](#polling-et-retry)
- [Configuration](#configuration)

---

## Vue d'ensemble

Le système d'onboarding utilise différents délais pour créer une expérience utilisateur fluide et pédagogique :

- **Transitions entre étapes** : Permettent à l'utilisateur de voir les changements
- **Animations** : Assurent une transition visuelle smooth
- **Polling** : Recherche d'éléments DOM de manière robuste
- **Auto-validation** : Délais avant validation automatique

Tous les timings sont centralisés dans **`lib/onboarding/onboardingConfig.js`** pour faciliter les ajustements.

---

## Délais de transition entre étapes

### Timer standard : 2 secondes

**Valeur** : `STEP_TRANSITION_DELAY = 2000ms`

**Étapes concernées** :
- Welcome modal → Step 1 (Mode édition)
- Step 1 → 2 (Génération IA)
- Step 4 → 5 (Score de match)
- Step 5 → 6 (Optimisation)
- Step 6 → 7 (Historique)
- Step 7 → 8 (Export PDF)

**Raison** :
Le délai de 2 secondes permet à l'utilisateur de :
- Voir les changements qu'il vient d'effectuer
- Comprendre le résultat de son action
- Se préparer mentalement à la prochaine étape

**Comportement** :
1. L'utilisateur valide une étape (ex: lance une génération IA)
2. Le highlight vert disparaît immédiatement
3. Attente de 2 secondes (pas de highlight visible)
4. La prochaine étape démarre

### Transitions immédiates : Steps 2→3→4

**Valeur** : `STEPS_WITHOUT_TIMER = [2, 3]`

**Étapes concernées** :
- Step 2 → 3 : Génération IA → Task Manager
- Step 3 → 4 : Task Manager → CV généré

**Raison** :
Ces 3 étapes forment un **flux rapide et continu** :
1. L'utilisateur lance une génération IA
2. Le task manager s'ouvre automatiquement pour montrer la progression
3. Le CV généré s'affiche dès qu'il est prêt

Ajouter des délais entre ces étapes briserait le flux naturel de l'action.

**Code** :
```javascript
// lib/onboarding/onboardingConfig.js
export const ONBOARDING_TIMINGS = {
  STEP_TRANSITION_DELAY: 2000, // 2s entre la plupart des étapes
  STEPS_WITHOUT_TIMER: [2, 3],  // Steps qui s'enchaînent sans délai
};
```

---

## Animations et modals

### Fermeture de modal : 300ms

**Valeur** : `MODAL_CLOSE_ANIMATION_DURATION = 300ms`

**Usage** :
- Délai d'attente après fermeture d'un modal avant d'effectuer l'action suivante
- Permet à l'animation CSS du modal de se terminer proprement

**Exemple** :
```javascript
// Step 1 : Activer le mode édition APRÈS la fermeture du modal
setTimeout(async () => {
  await setEditing(true);
}, MODAL_CLOSE_ANIMATION_DURATION);
```

### Validation automatique : 500ms

**Valeur** : `STEP_VALIDATION_DELAY = 500ms`

**Usage** :
- Délai avant validation automatique d'un step
- Permet aux requêtes async et animations de se terminer

**Exemple** :
```javascript
// Step 2 : Valider APRÈS que la tâche soit bien créée
setTimeout(() => {
  markStepComplete(2);
}, STEP_VALIDATION_DELAY);
```

### Animation morphing (Welcome Modal) : 700ms

**Valeur** : `WELCOME_MORPH_DURATION = 700ms`

**Usage** :
- Durée de l'animation de morphing du welcome modal vers la checklist
- Transition Framer Motion smooth et fluide

---

## Polling et retry

### Intervalle de polling : 200ms

**Valeur** : `BUTTON_POLLING_INTERVAL = 200ms`

**Usage** :
- Intervalle de recherche des boutons dans le DOM
- Utilisé pour attacher les event listeners aux boutons

**Exemple** :
```javascript
const interval = setInterval(() => {
  const button = document.querySelector('[data-onboarding="edit-button"]');
  if (button) {
    // Bouton trouvé, attacher listener
    clearInterval(interval);
  }
}, BUTTON_POLLING_INTERVAL);
```

### Timeout max polling : 10 secondes

**Valeur** : `BUTTON_POLLING_TIMEOUT = 10000ms`

**Usage** :
- Timeout maximum avant d'abandonner la recherche d'un bouton
- Évite les boucles infinies

**Exemple** :
```javascript
let attempts = 0;
const maxAttempts = BUTTON_POLLING_TIMEOUT / BUTTON_POLLING_INTERVAL;

const interval = setInterval(() => {
  attempts++;

  if (attempts >= maxAttempts) {
    onboardingLogger.error('Bouton non trouvé après 10s');
    clearInterval(interval);
  }
}, BUTTON_POLLING_INTERVAL);
```

---

## Délai entre fermeture loading screen et onboarding

### Délai initial : 3 secondes

**Valeur** : `LOADING_TO_ONBOARDING_DELAY = 3000ms`

**Usage** :
- Délai entre la fermeture du loading screen initial et l'affichage du welcome modal
- Permet à l'utilisateur de voir brièvement l'interface avant le démarrage du tutoriel
- Évite une expérience trop "précipitée" au premier lancement

**Workflow** :
1. L'application démarre, LoadingOverlay affiché
2. TopBar/EmptyState détecté comme prêt
3. LoadingOverlay se ferme, émet l'événement `ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED`
4. OnboardingProvider écoute cet événement
5. **Délai de 3 secondes**
6. WelcomeModal s'affiche pour démarrer l'onboarding

**Code** :
```javascript
// LoadingOverlay.jsx - Émission de l'événement
import { emitOnboardingEvent, ONBOARDING_EVENTS } from '@/lib/onboarding/onboardingEvents';

emitOnboardingEvent(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, {
  trigger: 'topBarReady', // ou 'emptyState'
  timestamp: Date.now(),
});
setIsLoading(false);

// OnboardingProvider.jsx - Écoute de l'événement avec timer ref pour cleanup
const loadingToOnboardingTimerRef = useRef(null);

useEffect(() => {
  const handleLoadingClosed = (event) => {
    // Clear any existing timer first
    if (loadingToOnboardingTimerRef.current) {
      clearTimeout(loadingToOnboardingTimerRef.current);
      loadingToOnboardingTimerRef.current = null;
    }

    // Start 3-second delay
    loadingToOnboardingTimerRef.current = setTimeout(() => {
      loadingToOnboardingTimerRef.current = null;
      setShowWelcomeModal(true);
    }, ONBOARDING_TIMINGS.LOADING_TO_ONBOARDING_DELAY);
  };

  window.addEventListener(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, handleLoadingClosed);

  return () => {
    // Cleanup timer on unmount
    if (loadingToOnboardingTimerRef.current) {
      clearTimeout(loadingToOnboardingTimerRef.current);
      loadingToOnboardingTimerRef.current = null;
    }
    window.removeEventListener(ONBOARDING_EVENTS.LOADING_SCREEN_CLOSED, handleLoadingClosed);
  };
}, [...]);
```

**Raisons du délai** :
- **UX** : L'utilisateur a le temps de voir et comprendre l'interface avant que l'onboarding ne démarre
- **Évite le rush** : Sans délai, l'interface apparaît et le modal se superpose immédiatement (sensation "trop rapide")
- **Respiration visuelle** : Les 3 secondes créent une pause naturelle dans le flow

**Cas d'utilisation** :
- **Nouveau compte** : Premier lancement de l'application après inscription
- **Relaunch depuis Account** : User clique "Relancer le tutoriel" dans les paramètres
- **Reset développeur** : Réinitialisation manuelle de l'onboarding en dev

---

## Configuration

### Fichier de configuration centralisé

**Emplacement** : `lib/onboarding/onboardingConfig.js`

Toutes les constantes de timing sont centralisées dans ce fichier pour :
- ✅ Faciliter les ajustements (un seul endroit à modifier)
- ✅ Éviter la duplication de code
- ✅ Documenter clairement chaque valeur
- ✅ Permettre des tests A/B faciles

**Structure** :
```javascript
/**
 * Configuration centralisée pour le système d'onboarding
 */
export const ONBOARDING_TIMINGS = {
  // Transitions entre steps
  STEP_TRANSITION_DELAY: 2000, // 2s
  STEPS_WITHOUT_TIMER: [2, 3],

  // Welcome modal
  WELCOME_MORPH_DURATION: 700, // 0.7s

  // Modals et animations
  MODAL_CLOSE_ANIMATION_DURATION: 300, // 0.3s
  STEP_VALIDATION_DELAY: 500, // 0.5s

  // Polling et retry
  BUTTON_POLLING_INTERVAL: 200, // 0.2s
  BUTTON_POLLING_TIMEOUT: 10000, // 10s

  // Délai entre fermeture loading screen et onboarding
  LOADING_TO_ONBOARDING_DELAY: 3000, // 3s
};
```

### Utilisation dans les composants

**OnboardingProvider.jsx** :
```javascript
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';

const STEP_TRANSITION_DELAY = ONBOARDING_TIMINGS.STEP_TRANSITION_DELAY;
const STEPS_WITHOUT_TIMER = ONBOARDING_TIMINGS.STEPS_WITHOUT_TIMER;
```

**OnboardingOrchestrator.jsx** :
```javascript
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';

const MODAL_CLOSE_ANIMATION_DURATION = ONBOARDING_TIMINGS.MODAL_CLOSE_ANIMATION_DURATION;
const BUTTON_POLLING_INTERVAL = ONBOARDING_TIMINGS.BUTTON_POLLING_INTERVAL;
const BUTTON_POLLING_TIMEOUT = ONBOARDING_TIMINGS.BUTTON_POLLING_TIMEOUT;
const STEP_VALIDATION_DELAY = ONBOARDING_TIMINGS.STEP_VALIDATION_DELAY;
```

---

## Tableau récapitulatif

| Timing | Valeur | Usage | Composant |
|--------|--------|-------|-----------|
| `STEP_TRANSITION_DELAY` | 2000ms (2s) | Délai standard entre étapes | OnboardingProvider |
| `STEPS_WITHOUT_TIMER` | [2, 3] | Steps sans délai | OnboardingProvider |
| `WELCOME_MORPH_DURATION` | 700ms (0.7s) | Animation morphing modal | WelcomeModal |
| `MODAL_CLOSE_ANIMATION_DURATION` | 300ms (0.3s) | Fermeture modals | OnboardingOrchestrator |
| `STEP_VALIDATION_DELAY` | 500ms (0.5s) | Validation automatique | OnboardingOrchestrator |
| `BUTTON_POLLING_INTERVAL` | 200ms (0.2s) | Recherche boutons DOM | OnboardingOrchestrator |
| `BUTTON_POLLING_TIMEOUT` | 10000ms (10s) | Timeout recherche | OnboardingOrchestrator |
| `LOADING_TO_ONBOARDING_DELAY` | 3000ms (3s) | Délai loading → onboarding | OnboardingProvider |

---

## Bonnes pratiques

### 1. Modifier un timing

Pour changer un délai, modifier **uniquement** le fichier `onboardingConfig.js` :

```javascript
// ❌ INCORRECT : Modifier dans le composant
const STEP_TRANSITION_DELAY = 3000;

// ✅ CORRECT : Modifier dans onboardingConfig.js
export const ONBOARDING_TIMINGS = {
  STEP_TRANSITION_DELAY: 3000, // Augmenté à 3s
  // ...
};
```

### 2. Ajouter un nouveau timing

1. Ajouter la constante dans `onboardingConfig.js`
2. Importer dans le composant qui l'utilise
3. Documenter dans ce fichier

```javascript
// 1. Dans onboardingConfig.js
export const ONBOARDING_TIMINGS = {
  // ...
  NEW_ANIMATION_DURATION: 400, // 0.4s - description
};

// 2. Dans le composant
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';
const NEW_ANIMATION_DURATION = ONBOARDING_TIMINGS.NEW_ANIMATION_DURATION;

// 3. Documenter ici (ONBOARDING_TIMINGS.md)
```

### 3. Tests A/B

Pour tester différentes valeurs :

```javascript
// onboardingConfig.js
const isDev = process.env.NODE_ENV === 'development';

export const ONBOARDING_TIMINGS = {
  // Test 2s vs 1.5s en dev
  STEP_TRANSITION_DELAY: isDev ? 1500 : 2000,
  // ...
};
```

---

## Logs et debugging

Le système utilise **`onboardingLogger`** qui affiche les logs uniquement en développement :

```javascript
// En développement : affiche dans la console
onboardingLogger.log('Step complété, transition dans 2000ms');

// En production : rien n'est affiché (optimisation)
```

Pour voir tous les logs de timing :
1. Ouvrir la console Chrome DevTools
2. Filtrer par `[OnboardingProvider]` ou `[Onboarding]`
3. Observer les transitions en temps réel

---

## Architecture des timers

### Gestion des timers (éviter memory leaks)

Tous les timers utilisent **`useRef`** + **cleanup effect** :

```javascript
const stepTimerRef = useRef(null);

// Créer un timer
stepTimerRef.current = setTimeout(async () => {
  stepTimerRef.current = null;
  await goToNextStep();
}, STEP_TRANSITION_DELAY);

// Cleanup au unmount
useEffect(() => {
  return () => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  };
}, []);
```

**Bénéfices** :
- ✅ Pas de memory leaks
- ✅ Annulation automatique si composant unmount
- ✅ Pattern cohérent dans tout le codebase

---

## Voir aussi

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture du système d'onboarding
- [FEATURES.md](./FEATURES.md) - Liste des fonctionnalités
- [COMPONENTS.md](./COMPONENTS.md) - Documentation des composants
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Patterns de code réutilisables
