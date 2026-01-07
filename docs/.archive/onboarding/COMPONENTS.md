# Référence Composants Onboarding

> **Documentation complète de tous les composants React du système onboarding**

---

## Vue d'ensemble

8 composants + 4 hooks pour gérer l'onboarding interactif.

| Composant | Lignes | Rôle principal |
|-----------|--------|----------------|
| OnboardingProvider | 1131 | Context global, SSE, state management |
| OnboardingOrchestrator | 1320 | Validation steps, event listeners |
| WelcomeModal | 576 | Modal accueil 3 screens + morphing |
| OnboardingModal | 400 | Modal carousel générique réutilisable |
| OnboardingCompletionModal | 377 | Modal félicitations 3 screens |
| OnboardingTooltip | 362 | Tooltip emerald avec positioning |
| OnboardingHighlight | 156 | Ring vert pulsant + backdrop blur |
| ChecklistPanel | 307 | Sidebar progression 8 steps |

---

## OnboardingProvider

**Fichier** : `components/onboarding/OnboardingProvider.jsx` (1131 lignes)

**Rôle** : Context global, orchestration haut niveau

**Context value exporté** :
```javascript
{
  // State
  currentStep: number,              // 0-8
  completedSteps: number[],         // [1, 2, 3]
  onboardingState: object,          // Json DB
  isActive: boolean,
  hasCompleted: boolean,
  hasSkipped: boolean,
  isLoading: boolean,
  
  // Actions
  markStepComplete: (step) => void,
  skipOnboarding: () => void,
  completeOnboarding: () => void,
  markModalCompleted: (key) => void,
  markTooltipClosed: (step, manual) => void,
  updateOnboardingState: (updates) => void,
  
  // Config
  steps: ONBOARDING_STEPS
}
```

**Usage** :
```javascript
import { useOnboarding } from '@/hooks/useOnboarding';

function MyComponent() {
  const { currentStep, markStepComplete } = useOnboarding();
  // ...
}
```

---

## OnboardingOrchestrator

**Fichier** : `components/onboarding/OnboardingOrchestrator.jsx` (1320 lignes)

**Props** : Aucune (utilise useOnboarding hook)

**Responsabilités** :
- Validation event-driven des 8 steps
- Gestion modals (steps 1, 2, 6, 8)
- Gestion tooltips/highlights
- Event listeners (task:added, task:completed, etc.)
- Confetti animation (step 8)

**Usage** :
```javascript
// Dans App.jsx ou layout
<OnboardingProvider>
  {children}
  <OnboardingOrchestrator />
</OnboardingProvider>
```

---

## WelcomeModal

**Fichier** : `components/onboarding/WelcomeModal.jsx` (576 lignes)

**Props** :
```typescript
{
  open: boolean;
  onComplete: () => void;     // Clic "Compris"
  onSkip: () => void;         // Clic "Passer"
  onClose: () => void;        // Clic X
}
```

**Exemple** :
```javascript
<WelcomeModal
  open={showWelcomeModal}
  onComplete={handleWelcomeComplete}
  onSkip={handleWelcomeSkip}
  onClose={handleWelcomeClose}
/>
```

---

## OnboardingModal

**Fichier** : `components/onboarding/OnboardingModal.jsx` (400 lignes)

**Props** :
```typescript
{
  open: boolean;
  screens: Array<{title, description, icon}>;
  currentScreen: number;
  title?: string;             // Défaut: "Guide du mode édition"
  icon?: string;              // Défaut: "✏️"
  onNext: () => void;
  onPrev: () => void;
  onJumpTo: (idx) => void;
  onComplete: () => void;
  onSkip: () => void;
  onClose: () => void;
  showSkipButton?: boolean;
  size?: 'default' | 'large';
}
```

**Exemple** :
```javascript
<OnboardingModal
  open={modalOpen}
  screens={screens}
  currentScreen={currentScreen}
  title="Guide du mode édition"
  icon="✏️"
  onNext={() => setCurrentScreen(s => s + 1)}
  onPrev={() => setCurrentScreen(s => s - 1)}
  onComplete={handleModalComplete}
  onSkip={handleModalSkip}
  onClose={handleCloseModal}
/>
```

---

## OnboardingTooltip

**Fichier** : `components/onboarding/OnboardingTooltip.jsx` (362 lignes)

**Props** :
```typescript
{
  message: string;
  targetSelector: string;     // CSS selector
  position: 'left' | 'right' | 'top' | 'bottom';
  visible: boolean;
  onClose: () => void;
}
```

**Exemple** :
```javascript
<OnboardingTooltip
  message="Cliquez ici pour découvrir..."
  targetSelector="[data-onboarding='edit-mode-button']"
  position="left"
  visible={currentStep === 1 && !tooltipClosed}
  onClose={handleTooltipClose}
/>
```

---

## OnboardingHighlight

**Fichier** : `components/onboarding/OnboardingHighlight.jsx` (156 lignes)

**Props** :
```typescript
{
  show: boolean;
  targetSelector: string;
  blurEnabled?: boolean;      // Défaut: true
}
```

**Exemple** :
```javascript
<OnboardingHighlight
  show={currentStep === 1}
  targetSelector="[data-onboarding='edit-mode-button']"
  blurEnabled={!tooltipClosed}
/>
```

---

## ChecklistPanel

**Fichier** : `components/onboarding/ChecklistPanel.jsx` (307 lignes)

**Props** : Aucune (utilise useOnboarding hook)

**Usage** :
```javascript
// Rendu automatique par OnboardingProvider
<ChecklistPanel />
```

---

## Hooks

### useOnboarding

**Fichier** : `hooks/useOnboarding.js`

```javascript
import { useOnboarding } from '@/hooks/useOnboarding';

const {
  currentStep,
  completedSteps,
  onboardingState,
  isActive,
  markStepComplete,
  skipOnboarding
} = useOnboarding();
```

### useIsStepCompleted

```javascript
import { useIsStepCompleted } from '@/hooks/useOnboarding';

const isStep1Completed = useIsStepCompleted(1);
```

### useIsCurrentStep

```javascript
import { useIsCurrentStep } from '@/hooks/useOnboarding';

const isCurrentlyOnStep1 = useIsCurrentStep(1);
```

### useOnboardingProgress

```javascript
import { useOnboardingProgress } from '@/hooks/useOnboarding';

const { progress, completedCount, totalSteps } = useOnboardingProgress();
// progress: 0.375 (37.5%)
// completedCount: 3
// totalSteps: 8
```

---

## Intégrations externes

### TopBar (Step 4)

**Fichier** : `components/TopBar/TopBar.jsx`

**Intégration onboarding** :
- Utilise `useOnboarding()` pour accéder à `currentStep` et `onboardingState`
- Ajoute attribut `data-cv-filename={it.file}` sur chaque bouton CV
- Détecte le CV de l'onboarding : `isOnboardingStep4Cv = currentStep === 4 && it.file === onboardingState?.step4?.cvFilename`
- Applique fond vert léger (`bg-emerald-500/20`) sur le CV concerné
- Émet `ONBOARDING_EVENTS.GENERATED_CV_OPENED` pour validation step 4

**Code** :
```javascript
import { useOnboarding } from "@/hooks/useOnboarding";

const { currentStep, onboardingState } = useOnboarding();

// Dans le map des CVs
const isOnboardingStep4Cv = currentStep === 4 && it.file === onboardingState?.step4?.cvFilename;

<button
  data-cv-filename={it.file}
  onClick={async () => {
    if (isRecentlyGenerated || isOnboardingStep4Cv) {
      emitOnboardingEvent(ONBOARDING_EVENTS.GENERATED_CV_OPENED, {
        cvFilename: it.file
      });
    }
    // ...
  }}
  className={`... ${
    isOnboardingStep4Cv ? "bg-emerald-500/20" : ""
  }`}
>
```

**Persistance** :
- `onboardingState.step4.cvFilename` stocke le nom du fichier généré
- Après refresh, `isOnboardingStep4Cv` détecte automatiquement le bon CV
- Cliquer sur le CV valide le step même après refresh

---

**Voir aussi** :
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Hiérarchie composants
- [WORKFLOW.md](./WORKFLOW.md) - Workflow complet
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - État onboardingState
