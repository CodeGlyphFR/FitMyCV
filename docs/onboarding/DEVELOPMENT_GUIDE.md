# Guide Développement Onboarding

> **How-to guides pour développer et maintenir le système onboarding**

---

## How to add a new step

### 1. Ajouter config dans onboardingSteps.js

```javascript
// lib/onboarding/onboardingSteps.js

export const ONBOARDING_STEPS = {
  // ... existing steps
  9: {
    id: 9,
    name: 'new_feature',
    title: 'Nouvelle fonctionnalité',
    description: 'Découvrez notre nouvelle feature',
    targetSelector: '[data-onboarding="new-feature"]',
    tooltipMessage: 'Cliquez ici pour...',
    tooltipPosition: 'bottom',
    hasModal: false,
    modalScreens: [],
    validation: {
      type: 'event',
      event: 'NEW_FEATURE_OPENED'
    }
  }
};
```

### 2. Implémenter validation dans OnboardingOrchestrator

```javascript
// components/onboarding/OnboardingOrchestrator.jsx

useEffect(() => {
  if (currentStep !== 9) return;

  const handleNewFeatureOpened = () => {
    markStepComplete(9);
  };

  window.addEventListener('NEW_FEATURE_OPENED', handleNewFeatureOpened);
  return () => window.removeEventListener('NEW_FEATURE_OPENED', handleNewFeatureOpened);
}, [currentStep, markStepComplete]);
```

### 3. Ajouter data-onboarding attribute

```javascript
// Dans le composant target

<button data-onboarding="new-feature">
  Nouvelle Feature
</button>
```

### 4. Tester le flow complet

```bash
# Reset onboarding
node scripts/reset-onboarding.js

# Lancer dev
npm run dev

# Tester step par step jusqu'au nouveau step 9
```

---

## How to debug onboarding

### 1. Activer logger (dev mode)

```javascript
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

// Dev only logs
onboardingLogger.log('[Component] Info message');

// Always shown (prod + dev)
onboardingLogger.error('[Component] Error:', error);
onboardingLogger.warn('[Component] Warning');
```

### 2. Browser DevTools

**Console filters** :
```
[Onboarding]          // Tous les logs onboarding
[OnboardingProvider]  // Logs Provider uniquement
[SSE]                 // Logs SSE
```

**Network tab** :
- Vérifier PATCH /api/user/onboarding (persistence)
- Vérifier SSE connection /api/user/onboarding/subscribe

**Application tab** :
- Session storage (stateRef cache)
- IndexedDB (si utilisé)

### 3. React DevTools

- Inspecter OnboardingContext value
- Vérifier currentStep, completedSteps
- Tracker re-renders (Profiler)

### 4. State inspection

```javascript
// Dans composant
const { onboardingState } = useOnboarding();

console.log('Current state:', JSON.stringify(onboardingState, null, 2));
```

---

## How to test locally

### 1. Reset script

```bash
# Preview (dry-run)
node scripts/reset-onboarding.js --dry-run

# Execute reset
node scripts/reset-onboarding.js

# Reset + set specific step
node scripts/reset-onboarding.js --step=5
```

### 2. Test account

Email: `tests@claude.com`  
Password: `qwertyuiOP93300`

### 3. Multi-device simulation

```bash
# Terminal 1 : Dev server
npm run dev

# Terminal 2 : Ngrok (expose local)
ngrok http 3001

# Browser 1 : localhost:3001
# Browser 2 : ngrok URL (teste SSE sync)
```

### 4. SSE testing

```javascript
// Dans console browser
const eventSource = new EventSource('/api/user/onboarding/subscribe');

eventSource.addEventListener('onboarding:updated', (event) => {
  console.log('SSE received:', JSON.parse(event.data));
});
```

---

## Best practices

### 1. Logger au lieu de console

❌ **Mauvais** :
```javascript
console.log('[Onboarding] Step completed');
```

✅ **Bon** :
```javascript
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

onboardingLogger.log('[Onboarding] Step completed');
```

### 2. Constantes centralisées

❌ **Mauvais** :
```javascript
setTimeout(() => setCurrentStep(2), 1000);
```

✅ **Bon** :
```javascript
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';

setTimeout(() => setCurrentStep(2), ONBOARDING_TIMINGS.STEP_TRANSITION_DELAY);
```

### 3. Event naming convention

✅ **Convention** :
- Uppercase snake_case : `TASK_MANAGER_OPENED`
- Préfixer onboarding si global : `ONBOARDING_EVENTS.TASK_MANAGER_OPENED`
- Utiliser constantes centralisées (onboardingEvents.js)

### 4. Cleanup timers

❌ **Mauvais** :
```javascript
setTimeout(() => markStepComplete(2), 1000);
```

✅ **Bon** :
```javascript
useEffect(() => {
  const timer = setTimeout(() => markStepComplete(2), 1000);
  return () => clearTimeout(timer);
}, [markStepComplete]);
```

### 5. Optimistic updates

✅ **Pattern** :
```javascript
const previousState = currentState;

try {
  // Optimistic update
  setState(newState);
  
  // Persist
  await api.patch('/onboarding', { state: newState });
} catch (error) {
  // Rollback
  setState(previousState);
  onboardingLogger.error('[Component] Rollback:', error);
}
```

---

## Troubleshooting commun

**Onboarding ne démarre pas** :
- Vérifier cvCount = 0
- Vérifier currentStep = 0
- Vérifier LOADING_SCREEN_CLOSED émis
- Logs : `[OnboardingProvider] Auto-start conditions`

**Step bloqué** :
- Vérifier préconditions (step 4, 5, 6, 7)
- Vérifier événements émis (DevTools console)
- Vérifier data-onboarding attribute présent

**SSE non synced** :
- Vérifier connexion SSE (Network tab)
- Vérifier heartbeat toutes les 30s
- Vérifier sseManager.broadcast appelé (backend logs)

---

**Voir aussi** :
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Bugs connus & FAQ
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture système
- [WORKFLOW.md](./WORKFLOW.md) - Workflow complet
