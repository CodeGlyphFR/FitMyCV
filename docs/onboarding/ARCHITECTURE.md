# Architecture Système Onboarding

> **Documentation complète de l'architecture du système d'onboarding interactif**

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Flow chart global](#flow-chart-global)
3. [Hiérarchie des composants](#hiérarchie-des-composants)
4. [Responsabilités par composant](#responsabilités-par-composant)
5. [Lifecycle onboarding](#lifecycle-onboarding)
6. [Event system](#event-system)
7. [Data flow](#data-flow)
8. [Patterns architecturaux](#patterns-architecturaux)

---

## Vue d'ensemble

Le système d'onboarding est une **architecture event-driven** utilisant :
- **React Context** (`OnboardingProvider`) pour l'état global
- **Server-Sent Events (SSE)** pour la synchronisation multi-device
- **Window events** pour la communication inter-composants
- **Optimistic updates** avec rollback pour la persistence

### Stack technique

- **Frontend** : React 18 + Hooks (useState, useEffect, useCallback, useRef)
- **Backend** : Next.js 14 API Routes (REST + SSE)
- **Database** : PostgreSQL (prod) / SQLite (dev) via Prisma
- **State** : Context API + local state
- **Animations** : Framer Motion + CSS transitions
- **Télémétrie** : Custom tracking (onboardingStartTime, stepStartTime)

---

## Flow chart global

```
┌──────────────────────────────────────────────────────────────────────┐
│                            USER SESSION                               │
│  Nouveau utilisateur (cvCount = 0) charge l'application              │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        LoadingOverlay                                 │
│  - Charge user data (onboardingState, cvCount)                       │
│  - Émet LOADING_SCREEN_CLOSED event                                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       │ (3s delay)
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     OnboardingProvider                                │
│  - Écoute LOADING_SCREEN_CLOSED                                      │
│  - Conditions : cvCount = 0, currentStep = 0                         │
│  - Affiche WelcomeModal                                              │
│  - Connexion SSE (/api/user/onboarding/subscribe)                   │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      WelcomeModal (Step 0)                            │
│  - 3 screens carousel avec morphing animation                        │
│  - "Compris" → transitionToStep1()                                   │
│  - "Passer" → skipOnboarding()                                       │
│  - X → transitionToStep1() (sans marquer completed)                  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  OnboardingOrchestrator                               │
│  Gère les 8 steps avec validation event-driven                       │
└───────────────┬──────────────────────────────────────────────────────┘
                │
                ├─► Step 1 : Mode édition
                │   ├─► OnboardingHighlight (ring vert pulsant)
                │   ├─► OnboardingTooltip (emerald, "Cliquez ici...")
                │   ├─► OnboardingModal (5 screens explicatifs)
                │   └─► Validation : Sortie du mode édition (editing: true → false)
                │
                ├─► Step 2 : Génération IA
                │   ├─► OnboardingHighlight
                │   ├─► OnboardingTooltip ("Adaptez avec l'IA")
                │   ├─► OnboardingModal (3 screens IA)
                │   ├─► Emit OPEN_GENERATOR event → AIGeneratorPanel s'ouvre
                │   └─► Validation : Événement task:added (type generation_ia)
                │
                ├─► Step 3 : Task Manager
                │   ├─► OnboardingHighlight
                │   ├─► OnboardingTooltip (persistent, "Suivi génération...")
                │   └─► Validation : Événement TASK_MANAGER_OPENED
                │
                ├─► Step 4 : Ouverture CV généré
                │   ├─► OnboardingHighlight
                │   ├─► OnboardingTooltip ("Votre CV est prêt")
                │   ├─► Précondition : onboardingState.step4.cvGenerated = true
                │   └─► Validation : Événement GENERATED_CV_OPENED
                │
                ├─► Step 5 : Score de match
                │   ├─► OnboardingHighlight
                │   ├─► OnboardingTooltip ("Calculez compatibilité")
                │   ├─► Précondition : Offre emploi associée au CV
                │   └─► Validation : task:completed (type match_score)
                │
                ├─► Step 6 : Optimisation IA
                │   ├─► OnboardingHighlight
                │   ├─► OnboardingTooltip ("Optimisez votre CV")
                │   ├─► OnboardingModal (3 screens optimisation)
                │   ├─► Emit OPEN_OPTIMIZER event → OptimizerPanel s'ouvre
                │   └─► Validation : task:completed (type improvement)
                │
                ├─► Step 7 : Historique
                │   ├─► OnboardingHighlight
                │   ├─► OnboardingTooltip ("Consultez modifications IA")
                │   └─► Validation : Événement HISTORY_CLOSED
                │
                └─► Step 8 : Export PDF
                    ├─► OnboardingHighlight
                    ├─► OnboardingTooltip ("Exportez en PDF")
                    ├─► OnboardingModal (3 screens export)
                    ├─► Emit OPEN_EXPORT event → ExportModal s'ouvre
                    ├─► Validation : Événement EXPORT_CLICKED
                    └─► Confetti animation (3 salves) 🎉

                         ↓

┌──────────────────────────────────────────────────────────────────────┐
│              OnboardingCompletionModal                                │
│  - 3 screens : Créer CV, Importer PDF, Job search                    │
│  - "Compris" → completeOnboarding()                                  │
│  - hasCompleted = true, currentStep = 8                              │
└──────────────────────────────────────────────────────────────────────┘

                         ↓

                ✅ ONBOARDING TERMINÉ
```

---

## Hiérarchie des composants

```
App.jsx
│
├─► OnboardingProvider (Context global)
│   │
│   ├─► State management
│   │   ├─ currentStep, completedSteps
│   │   ├─ onboardingState (Json DB)
│   │   ├─ isActive, hasCompleted, hasSkipped
│   │   └─ SSE connection (/api/user/onboarding/subscribe)
│   │
│   ├─► Actions
│   │   ├─ markStepComplete(step)
│   │   ├─ skipOnboarding()
│   │   ├─ completeOnboarding()
│   │   ├─ markModalCompleted(key)
│   │   └─ markTooltipClosed(step, manual)
│   │
│   ├─► Auto-start logic
│   │   └─ Listener LOADING_SCREEN_CLOSED
│   │
│   └─► Children (rendered)
│       │
│       ├─► WelcomeModal
│       │   ├─ open={showWelcomeModal}
│       │   ├─ onComplete={handleWelcomeComplete}
│       │   ├─ onSkip={handleWelcomeSkip}
│       │   └─ onClose={handleWelcomeClose}
│       │
│       ├─► ChecklistPanel
│       │   ├─ visible si isActive
│       │   └─ Affiche progression 8 steps
│       │
│       └─► OnboardingOrchestrator
│           ├─ visible si isActive
│           └─ Gère steps 1-8
│
└─► OnboardingOrchestrator (si isActive)
    │
    ├─► State local
    │   ├─ modalOpen, currentScreen
    │   ├─ tooltipClosed
    │   ├─ step refs (step1ModalShownRef, etc.)
    │   └─ prevEditingRef (step 1)
    │
    ├─► Event listeners
    │   ├─ task:added (step 2)
    │   ├─ task:completed (steps 5, 6)
    │   ├─ TASK_MANAGER_OPENED (step 3)
    │   ├─ GENERATED_CV_OPENED (step 4)
    │   ├─ HISTORY_CLOSED (step 7)
    │   └─ EXPORT_CLICKED (step 8)
    │
    ├─► Persistence (debounce 1s)
    │   └─ updateOnboardingState via PATCH
    │
    └─► UI Components (conditionnels par step)
        │
        ├─► OnboardingModal
        │   ├─ screens={screens}
        │   ├─ currentScreen={currentScreen}
        │   ├─ onNext, onPrev, onJumpTo
        │   ├─ onComplete={handleModalComplete}
        │   ├─ onSkip={handleModalSkip}
        │   └─ onClose={handleCloseModal}
        │
        ├─► OnboardingTooltip
        │   ├─ visible={currentStep === X && !tooltipClosed}
        │   ├─ targetSelector={step.targetSelector}
        │   ├─ message={step.tooltipMessage}
        │   ├─ onClose={handleTooltipClose}
        │   └─ position="left|right|top|bottom"
        │
        ├─► OnboardingHighlight
        │   ├─ show={currentStep === X}
        │   ├─ targetSelector={step.targetSelector}
        │   ├─ blurEnabled={!tooltipClosed}
        │   └─ Ring vert pulsant + backdrop blur
        │
        └─► OnboardingCompletionModal
            ├─ open={showCompletionModal}
            ├─ onComplete={handleCompletionComplete}
            └─ 3 screens félicitations
```

---

## Responsabilités par composant

### OnboardingProvider (`components/onboarding/OnboardingProvider.jsx`)

**Rôle** : Context global, orchestration haut niveau, SSE, auto-start

**Responsabilités** :
- ✅ Fournir état global (`currentStep`, `completedSteps`, `onboardingState`)
- ✅ Charger état depuis API (`GET /api/user/onboarding`)
- ✅ Connexion SSE (`/api/user/onboarding/subscribe`) pour sync multi-device
- ✅ Auto-start onboarding (écoute `LOADING_SCREEN_CLOSED` event)
- ✅ Actions globales : `markStepComplete`, `skipOnboarding`, `completeOnboarding`
- ✅ Gestion welcome modal (affichage, complétion, skip, close)
- ✅ Helper `transitionToStep1()` (optimistic update + rollback)
- ✅ Persistence helpers : `updateOnboardingState`, `markModalCompleted`, `markTooltipClosed`
- ✅ Télémétrie : `trackEvent(eventName, metadata)`

**State géré** :
```javascript
{
  currentStep,              // 0-8
  completedSteps,           // [1, 2, 3]
  onboardingState,          // Json DB structure
  isActive,                 // Onboarding en cours
  hasCompleted,             // Terminé normalement
  hasSkipped,               // Skippé/abandonné
  isLoading,                // Chargement initial
  showWelcomeModal,         // Affichage welcome
  onboardingStartTime,      // Timestamp début
  stepStartTime             // Timestamp step actuel
}
```

**Hooks externes** :
- `useSession()` - Auth user
- `useState`, `useEffect`, `useCallback`, `useRef`

**Fichier** : 1131 lignes

---

### OnboardingOrchestrator (`components/onboarding/OnboardingOrchestrator.jsx`)

**Rôle** : Logique de validation par step, event listeners, modals management

**Responsabilités** :
- ✅ Validation event-driven pour les 8 steps
- ✅ Gestion affichage/fermeture modals (steps 1, 2, 6, 8)
- ✅ Gestion tooltips (closedManually, auto-close)
- ✅ Gestion highlights (ring vert + backdrop blur)
- ✅ Event listeners : `task:added`, `task:completed`, `TASK_MANAGER_OPENED`, etc.
- ✅ Polling DOM pour buttons (step 2, 5, 6, 8) avec retry/timeout
- ✅ Emission événements : `OPEN_GENERATOR`, `OPEN_OPTIMIZER`, `OPEN_EXPORT`, `CV_GENERATED`
- ✅ Préconditions step 4 (cvGenerated, cvFilename)
- ✅ Confetti animation (step 8, 3 salves)
- ✅ Persistence debounced (1s) via `updateOnboardingState`
- ✅ Fallback timers (step 5 : skip après 30s si précondition non remplie)

**State local** :
```javascript
{
  modalOpen,                // Modal onboarding ouvert
  currentScreen,            // Screen actuel du carousel
  tooltipClosed,            // Tooltip fermé manuellement
  showCompletionModal,      // Modal félicitations
  step1ModalShownRef,       // Ref : modal step 1 déjà affiché
  step2ModalShownRef,       // Ref : modal step 2 déjà affiché
  step6ModalShownRef,       // Ref : modal step 6 déjà affiché
  step8ModalShownRef,       // Ref : modal step 8 déjà affiché
  prevEditingRef            // Ref : état précédent editing (step 1)
}
```

**Event listeners** :
| Event | Step | Action |
|-------|------|--------|
| `task:added` | 2 | Vérifier type generation_ia → valider step 2 |
| `task:completed` | 5, 6 | Vérifier type match_score/improvement → valider |
| `TASK_MANAGER_OPENED` | 3 | Valider step 3 immédiatement |
| `GENERATED_CV_OPENED` | 4 | Valider step 4 immédiatement |
| `HISTORY_CLOSED` | 7 | Valider step 7 immédiatement |
| `EXPORT_CLICKED` | 8 | Valider step 8 + confetti |

**Fichier** : 1320 lignes

---

### WelcomeModal (`components/onboarding/WelcomeModal.jsx`)

**Rôle** : Modal d'accueil pré-onboarding (step 0)

**Responsabilités** :
- ✅ Afficher 3 screens carousel (Bienvenue, Fonctionnalités, Prêt ?)
- ✅ Animation morphing vers ChecklistPanel (700ms)
- ✅ Gestion boutons : "Compris" (onComplete), "Passer" (onSkip), X (onClose)
- ✅ Navigation : chevrons desktop, swipe mobile, clavier (arrows)
- ✅ Pagination bullets cliquables

**Props** :
```javascript
{
  open: boolean,              // Affichage modal
  onComplete: () => void,     // Clic "Compris" (dernier screen)
  onSkip: () => void,         // Clic "Passer le tutoriel"
  onClose: () => void         // Clic X (fermeture sans complétion)
}
```

**Fichier** : 576 lignes

---

### OnboardingModal (`components/onboarding/OnboardingModal.jsx`)

**Rôle** : Modal carousel générique réutilisable (steps 1, 2, 6, 8)

**Responsabilités** :
- ✅ Afficher N screens avec carousel animé (Framer Motion)
- ✅ Navigation : chevrons desktop, swipe mobile, clavier, bullets
- ✅ Gestion boutons : "Compris" (onComplete), "Passer cette étape" (onSkip), X (onClose)
- ✅ Responsive : barres progression mobile, bullets desktop
- ✅ Prévention scroll body (fixed position + touch-action: none)

**Props** :
```javascript
{
  open: boolean,              // Affichage modal
  screens: array,             // Liste screens [{title, description, icon}]
  currentScreen: number,      // Index screen actuel (0-based)
  title: string,              // Titre du modal (défaut: "Guide du mode édition")
  icon: string,               // Emoji icône (défaut: "✏️")
  onNext: () => void,         // Screen suivant
  onPrev: () => void,         // Screen précédent
  onJumpTo: (idx) => void,    // Jump direct à un screen (bullets)
  onComplete: () => void,     // Clic "Compris" (dernier screen)
  onSkip: () => void,         // Clic "Passer cette étape"
  onClose: () => void,        // Clic X
  showSkipButton: boolean,    // Afficher bouton "Passer"
  disableEscapeKey: boolean,  // Désactiver Escape
  disableBackdropClick: boolean, // Désactiver clic backdrop
  size: string                // 'default' | 'large'
}
```

**Fichier** : 400 lignes

---

### OnboardingCompletionModal (`components/onboarding/OnboardingCompletionModal.jsx`)

**Rôle** : Modal de félicitations après step 8

**Responsabilités** :
- ✅ Afficher 3 screens : Créer CV, Importer PDF, Job search
- ✅ Navigation carousel (comme OnboardingModal)
- ✅ Bouton "Compris" → onComplete → `completeOnboarding()`
- ✅ Pas de bouton "Passer" (pas de skip possible)

**Props** :
```javascript
{
  open: boolean,              // Affichage modal
  onComplete: () => void      // Clic "Compris"
}
```

**Fichier** : 377 lignes

---

### OnboardingTooltip (`components/onboarding/OnboardingTooltip.jsx`)

**Rôle** : Tooltip emerald avec positionnement intelligent

**Responsabilités** :
- ✅ Afficher tooltip emerald (background emerald-500)
- ✅ Positionnement par rapport au target (left, right, top, bottom)
- ✅ Clamping viewport (ne sort jamais de l'écran)
- ✅ Bouton X pour fermeture manuelle
- ✅ Auto-close au clic sur target
- ✅ Z-index : 10003

**Props** :
```javascript
{
  message: string,            // Texte du tooltip
  targetSelector: string,     // Sélecteur CSS target (ex: "[data-onboarding='edit-mode-button']")
  position: string,           // 'left' | 'right' | 'top' | 'bottom'
  visible: boolean,           // Affichage tooltip
  onClose: () => void         // Callback fermeture (X ou clic target)
}
```

**Fichier** : 362 lignes

---

### OnboardingHighlight (`components/onboarding/OnboardingHighlight.jsx`)

**Rôle** : Surbrillance avec ring vert pulsant + backdrop blur

**Responsabilités** :
- ✅ Ring vert pulsant (box-shadow emerald-500, animation CSS)
- ✅ Backdrop blur semi-transparent (bloque clics sauf target)
- ✅ Clip-path cutout pour découper le target
- ✅ Z-index : 10001 (au-dessus du contenu, en-dessous des tooltips)
- ✅ Pas de backdrop blur si `blurEnabled = false`

**Props** :
```javascript
{
  show: boolean,              // Affichage highlight
  targetSelector: string,     // Sélecteur CSS target
  blurEnabled: boolean        // Activer backdrop blur (défaut: true)
}
```

**Animation CSS** :
```css
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
  50% { box-shadow: 0 0 0 16px rgba(16, 185, 129, 0); }
}
```

**Fichier** : 156 lignes

---

### ChecklistPanel (`components/onboarding/ChecklistPanel.jsx`)

**Rôle** : Sidebar progression onboarding

**Responsabilités** :
- ✅ Afficher progression 8 steps (checkmarks verts)
- ✅ Collapse/expand (bouton toggle)
- ✅ Donut progress bar mobile (pourcentage completion)
- ✅ Indicateur step actuel (emerald-500)
- ✅ Steps complétés (check vert)
- ✅ Steps à venir (gris)

**State** :
- Utilise `useOnboarding()` hook pour lire `currentStep`, `completedSteps`, `checklistExpanded`
- Actions : `toggleChecklist()`

**Visibilité** :
- Automatiquement masqué sur les routes `/admin` via `OnboardingProvider`
- Condition : `!isAdminRoute` (utilise `usePathname()` de Next.js)

**Fichier** : 307 lignes

---

## Lifecycle onboarding

### Phase 1 : Initialisation

```
1. User charge l'application (nouveau compte, cvCount = 0)
2. LoadingOverlay s'affiche
3. OnboardingProvider se monte
   ├─ Charge onboardingState depuis API (GET /api/user/onboarding)
   ├─ Connecte SSE (/api/user/onboarding/subscribe)
   └─ Attache listener LOADING_SCREEN_CLOSED
4. LoadingOverlay ferme → émet LOADING_SCREEN_CLOSED
5. OnboardingProvider détecte event
   ├─ Vérifie conditions : currentStep === 0, cvCount === 0, !hasCompleted, !hasSkipped
   └─ Affiche WelcomeModal après 1s delay
```

### Phase 2 : Welcome Modal (Step 0)

```
6. User navigue les 3 screens du WelcomeModal
7. User clique "Compris" (dernier screen)
   ├─ handleWelcomeComplete()
   ├─ markModalCompleted('welcome')
   └─ transitionToStep1() (optimistic update + API PUT step:1)
8. WelcomeModal se ferme, OnboardingOrchestrator s'affiche
```

### Phase 3 : Steps 1-8

```
9. Pour chaque step (1-8) :
   ├─ OnboardingOrchestrator affiche highlight + tooltip
   ├─ User effectue l'action requise
   ├─ Événement détecté (task:added, TASK_MANAGER_OPENED, etc.)
   ├─ Validation déclenche markStepComplete(step)
   │   ├─ Optimistic update (UI)
   │   ├─ Persistence API (PATCH /api/user/onboarding)
   │   └─ Broadcast SSE (onboarding:updated)
   ├─ Transition vers step suivant (délai 1s ou immédiat)
   └─ Répéter pour step suivant
```

### Phase 4 : Completion

```
10. Step 8 validé → Confetti animation (3 salves)
11. OnboardingCompletionModal s'affiche (3 screens)
12. User clique "Compris"
    ├─ completeOnboarding()
    ├─ API POST /api/user/onboarding?action=complete
    │   └─ hasCompleted = true, currentStep = 8
    └─ Broadcast SSE (onboarding:updated)
13. OnboardingOrchestrator se démonte
14. ChecklistPanel se cache
15. ✅ Onboarding terminé
```

### Phase 5 : Skip

```
À tout moment (welcome modal ou pendant steps) :
1. User clique "Passer le tutoriel" ou "Passer cette étape"
2. skipOnboarding()
   ├─ API POST /api/user/onboarding?action=skip
   │   └─ isSkipped = true, hasCompleted = false
   └─ Broadcast SSE (onboarding:updated)
3. Tous les modals se ferment
4. OnboardingOrchestrator se démonte
5. ❌ Onboarding abandonné
```

---

## Event system

### Window events (communication inter-composants)

| Event | Émetteur | Récepteur | Payload | Usage |
|-------|----------|-----------|---------|-------|
| `LOADING_SCREEN_CLOSED` | LoadingOverlay | OnboardingProvider | `{ trigger: 'topBarReady'/'emptyState' }` | Déclenche auto-start onboarding |
| `TASK_MANAGER_OPENED` | TaskManager | OnboardingOrchestrator (step 3) | `{}` | Valide step 3 |
| `CV_GENERATED` | OnboardingOrchestrator (step 2) | OnboardingOrchestrator (step 4) | `{ cvFilename }` | Update précondition step 4 |
| `GENERATED_CV_OPENED` | CVSelector | OnboardingOrchestrator (step 4) | `{ cvFilename }` | Valide step 4 |
| `MATCH_SCORE_CALCULATED` | OnboardingOrchestrator (step 5) | OnboardingOrchestrator (step 6) | `{}` | Update précondition step 6 |
| `OPEN_GENERATOR` | OnboardingOrchestrator (step 2) | AIGeneratorPanel | `{}` | Ouvre panel génération IA |
| `OPEN_OPTIMIZER` | OnboardingOrchestrator (step 6) | OptimizerPanel | `{}` | Ouvre panel optimisation |
| `HISTORY_CLOSED` | HistoryModal | OnboardingOrchestrator (step 7) | `{}` | Valide step 7 |
| `OPEN_EXPORT` | OnboardingOrchestrator (step 8) | ExportModal | `{}` | Ouvre modal export PDF |
| `EXPORT_CLICKED` | ExportModal | OnboardingOrchestrator (step 8) | `{}` | Valide step 8 |

**Émission** :
```javascript
import { emitOnboardingEvent, ONBOARDING_EVENTS } from '@/lib/onboarding/onboardingEvents';

emitOnboardingEvent(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, {});
```

**Écoute** :
```javascript
useEffect(() => {
  const handleTaskManagerOpened = () => {
    markStepComplete(3);
  };

  window.addEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, handleTaskManagerOpened);
  return () => window.removeEventListener(ONBOARDING_EVENTS.TASK_MANAGER_OPENED, handleTaskManagerOpened);
}, []);
```

### Custom events (task lifecycle)

| Event | Émetteur | Payload | Usage |
|-------|----------|---------|-------|
| `task:added` | TaskManager | `{ task: {...} }` | Step 2 : détecter génération IA lancée |
| `task:completed` | TaskManager | `{ task: {...} }` | Steps 5, 6 : détecter match_score/improvement terminé |

**Écoute** :
```javascript
useEffect(() => {
  const handleTaskAdded = (event) => {
    const task = event.detail?.task;
    if (isAiGenerationTask(task)) {
      markStepComplete(2);
    }
  };

  window.addEventListener('task:added', handleTaskAdded);
  return () => window.removeEventListener('task:added', handleTaskAdded);
}, []);
```

### SSE Events (synchronisation multi-device)

| Event | Émetteur | Récepteur | Payload | Usage |
|-------|----------|-----------|---------|-------|
| `onboarding:updated` | API Route | OnboardingProvider (tous devices) | `{ currentStep, onboardingState, hasCompleted }` | Sync état après update |
| `onboarding:reset` | API Route | OnboardingProvider (tous devices) | `{ onboardingState }` | Sync après reset |

**Backend** (`app/api/user/onboarding/route.js`) :
```javascript
import { sseManager } from '@/lib/sse/sseManager';

sseManager.broadcast(userId, 'onboarding:updated', {
  currentStep: 2,
  onboardingState: updatedUser.onboardingState,
});
```

**Frontend** (`OnboardingProvider.jsx`) :
```javascript
useEffect(() => {
  if (!session?.user?.id) return;

  const eventSource = new EventSource('/api/user/onboarding/subscribe');

  eventSource.addEventListener('onboarding:updated', (event) => {
    const data = JSON.parse(event.data);
    // Merge avec état local (évite override optimistic updates)
    setOnboardingState(prevState => deepMerge(prevState, data.onboardingState));
  });

  return () => eventSource.close();
}, [session?.user?.id]);
```

---

## Data flow

### Persistence flow (optimistic update)

```
1. User action (ex: clique bouton, quitte mode édition)
   ↓
2. Event détecté par OnboardingOrchestrator
   ↓
3. Validation logic déclenche markStepComplete(step)
   ↓
4. OnboardingProvider : markStepComplete
   ├─ Sauvegarder état précédent (previousStep, previousOnboardingState)
   ├─ Optimistic update (UI)
   │   ├─ setCurrentStep(nextStep)
   │   ├─ setCompletedSteps([...completedSteps, step])
   │   └─ setOnboardingState(newState)
   ↓
5. Persistence API
   ├─ Debounce 1s (évite requêtes multiples)
   └─ PATCH /api/user/onboarding
       ├─ Body: { onboardingState: newState }
       └─ Cache TTL 1s (skip duplicates)
   ↓
6. API Response
   ├─ Success (200)
   │   └─ Broadcast SSE (onboarding:updated) → autres devices synced
   │
   └─ Error (500, network)
       ├─ Rollback UI state (previousStep, previousOnboardingState)
       └─ onboardingLogger.error('[OnboardingProvider] Rollback:', error)
```

### SSE Sync flow (multi-device)

```
Device A                                Device B
   │                                       │
   │ (User action: step 2 → 3)            │
   │                                       │
   ├─ markStepComplete(2)                 │
   ├─ Optimistic UI update                │
   ├─ PATCH /api/user/onboarding          │
   │                                       │
   └─────────► Backend                    │
               ├─ Update DB               │
               ├─ Broadcast SSE           │
               │  (onboarding:updated)    │
               │                          │
               └──────────────────────────┤
                                          │
                     ◄────────────────────┤
                                          │
                     SSE event received   │
                     ├─ Parse data        │
                     ├─ Deep merge state  │
                     └─ UI update         │
                         (currentStep = 3)│
```

---

## Patterns architecturaux

### 1. Context + Hooks pattern

**Provider** : Fournit état global
```javascript
const OnboardingContext = createContext(defaultValue);

export function OnboardingProvider({ children }) {
  const [currentStep, setCurrentStep] = useState(0);
  // ...

  const value = {
    currentStep,
    markStepComplete,
    // ...
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
```

**Consumer** : Hook custom pour accès facile
```javascript
export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
```

**Usage** :
```javascript
function MyComponent() {
  const { currentStep, markStepComplete } = useOnboarding();
  // ...
}
```

### 2. Event-driven validation

**Principe** : Validation basée sur événements externes plutôt que polling

```javascript
useEffect(() => {
  if (currentStep !== 2) return;

  const handleTaskAdded = (event) => {
    const task = event.detail?.task;
    if (isAiGenerationTask(task)) {
      onboardingLogger.log('[Onboarding] Step 2: AI generation started');
      markStepComplete(2);
    }
  };

  window.addEventListener('task:added', handleTaskAdded);
  return () => window.removeEventListener('task:added', handleTaskAdded);
}, [currentStep, markStepComplete]);
```

**Avantages** :
- ✅ Pas de polling (performance)
- ✅ Réactivité immédiate
- ✅ Découplage composants

### 3. Optimistic updates avec rollback

**Principe** : Update UI immédiatement, rollback si API échoue

```javascript
const markStepComplete = useCallback(async (step) => {
  // Sauvegarder état précédent
  const previousStep = currentStep;
  const previousCompletedSteps = completedSteps;
  const previousOnboardingState = onboardingState;

  try {
    // Optimistic update (UI first)
    const newOnboardingState = markStepCompletedHelper(onboardingState, step);
    setOnboardingState(newOnboardingState);
    setCompletedSteps(newOnboardingState.completedSteps);
    setCurrentStep(newOnboardingState.currentStep);

    // Persist to API
    const res = await fetch('/api/user/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ onboardingState: newOnboardingState }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);

  } catch (error) {
    onboardingLogger.error('[OnboardingProvider] Failed, rolling back:', error);

    // Rollback UI state
    setOnboardingState(previousOnboardingState);
    setCompletedSteps(previousCompletedSteps);
    setCurrentStep(previousStep);
  }
}, [currentStep, completedSteps, onboardingState]);
```

**Avantages** :
- ✅ UI réactive (pas d'attente API)
- ✅ Gestion erreurs élégante
- ✅ Pas de désync UI/DB

### 4. SSE Synchronization

**Principe** : Server-Sent Events pour sync temps réel multi-device

**Backend** (`app/api/user/onboarding/subscribe/route.js`) :
```javascript
export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Register client avec sseManager
      const clientId = sseManager.addClient(session.user.id, controller);

      // Heartbeat toutes les 30s
      const heartbeat = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        sseManager.removeClient(session.user.id, clientId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Frontend** (`OnboardingProvider.jsx`) :
```javascript
useEffect(() => {
  if (!session?.user?.id) return;

  const eventSource = new EventSource('/api/user/onboarding/subscribe');

  eventSource.addEventListener('onboarding:updated', (event) => {
    const data = JSON.parse(event.data);

    // Deep merge (évite override optimistic updates)
    setOnboardingState(prevState => deepMerge(prevState, data.onboardingState));
    setCurrentStep(data.currentStep);
  });

  eventSource.addEventListener('onboarding:reset', (event) => {
    const data = JSON.parse(event.data);

    // Full reset
    setOnboardingState(data.onboardingState);
    setCurrentStep(0);
    setCompletedSteps([]);
  });

  eventSource.onerror = () => {
    onboardingLogger.error('[SSE] Connection error, reconnecting...');
    eventSource.close();
  };

  return () => eventSource.close();
}, [session?.user?.id]);
```

**Avantages** :
- ✅ Sync temps réel (push notifications)
- ✅ Multi-device support
- ✅ Pas de polling (économie ressources)

---

## Résumé

**Architecture** : Event-driven avec Context API + SSE
**Flow** : Loading → Welcome → 8 Steps → Completion
**Composants** : 8 composants React + 4 hooks
**Events** : 10 window events + 2 custom + 2 SSE
**Patterns** : Optimistic updates, Event validation, SSE sync, Debounced persistence

**Prochaines sections** :
- [WORKFLOW.md](./WORKFLOW.md) - Détail des 8 steps
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - onboardingState structure
- [COMPONENTS.md](./COMPONENTS.md) - Référence complète composants
