# Troubleshooting Onboarding

> **Bugs récemment fixés, FAQ, et guide dépannage**

---

## Bugs récemment fixés

### Bug 1 : currentStep bloqué à 0

**Symptôme** : Après fermeture welcome modal, currentStep reste à 0 au lieu de passer à 1.

**Cause** : Welcome modal appelait seulement `markModalCompleted('welcome')` mais ne transitionnait PAS vers step 1.

**Fix** :
- Créé helper `transitionToStep1()` dans OnboardingProvider
- Appel de `transitionToStep1()` dans `handleWelcomeComplete` ET `handleWelcomeClose`
- Optimistic update + rollback si API échoue

**Code fix** :
```javascript
const transitionToStep1 = useCallback(async () => {
  const previousStep = currentStep;
  
  try {
    setCurrentStep(1);
    await fetch('/api/user/onboarding', {
      method: 'PUT',
      body: JSON.stringify({ step: 1 }),
    });
  } catch (error) {
    setCurrentStep(previousStep); // Rollback
    throw error;
  }
}, [currentStep]);
```

**Commit** : b775658 "fix(onboarding): corriger démarrage automatique"

---

### Bug 2 : Step 1 validation échouait

**Symptôme** : Step 1 ne se validait pas quand user quittait le mode édition.

**Cause** : Race condition avec `prevEditingRef` :
1. Tooltip effect réinitialisait `prevEditingRef.current = false`
2. Validation effect s'exécutait après
3. Pas de transition détectée (prevEditingRef déjà = false)

**Fix** :
- Retiré reset de prevEditingRef du tooltip effect (ligne 218-238)
- prevEditingRef UNIQUEMENT géré par validation effect (ligne 352)
- Ajouté skip validation si modalOpen

**Code fix** :
```javascript
// ❌ AVANT (tooltip effect)
useEffect(() => {
  // ...
  prevEditingRef.current = editing; // ← Reset trop tôt
}, [currentStep, tooltips, completedSteps, editing]);

// ✅ APRÈS (tooltip effect)
useEffect(() => {
  // ... gestion tooltip uniquement
  // PAS de reset prevEditingRef
}, [currentStep, tooltips, completedSteps]);

// ✅ Validation effect (seul endroit)
useEffect(() => {
  if (modalOpen) return; // Skip si modal ouvert
  
  if (prevEditingRef.current === true && editing === false) {
    markStepComplete(1);
  }
  
  prevEditingRef.current = editing; // ← Update seulement ici
}, [currentStep, editing, modalOpen, markStepComplete]);
```

**Commit** : 92bccd5 "fix(onboarding): corriger surbrillance"

---

## FAQ

### Q: L'onboarding ne démarre pas automatiquement ?

**A** : Vérifier conditions auto-start :
1. User authentifié
2. cvCount = 0 (aucun CV)
3. currentStep = 0
4. !hasCompleted && !hasSkipped
5. Événement LOADING_SCREEN_CLOSED émis

**Debug** :
```javascript
// Dans OnboardingProvider
console.log('[AutoStart] Conditions:', {
  cvCount: state.cvCount,
  currentStep: state.currentStep,
  hasCompleted: state.hasCompleted,
  hasSkipped: state.hasSkipped
});
```

---

### Q: Step bloqué, ne se valide pas ?

**A** : Vérifier :

1. **Préconditions remplies** (steps 4, 5, 6, 7)
```javascript
// Step 4
onboardingState.step4.cvGenerated === true

// Step 5
currentCvHasJobSummary === true

// Step 6
matchScoreCalculated === true

// Step 7
optimizationCompleted === true
```

2. **Événements émis** (DevTools console)
```javascript
// Step 2
window.dispatchEvent(new CustomEvent('task:added', { 
  detail: { task: { type: 'generation_ia' } } 
}));

// Step 3
window.dispatchEvent(new CustomEvent('TASK_MANAGER_OPENED'));
```

3. **data-onboarding attribute présent**
```html
<button data-onboarding="edit-mode-button">Mode édition</button>
```

---

### Q: SSE ne synchronise pas entre devices ?

**A** : Vérifier :

1. **Connexion SSE active**
```javascript
// Network tab DevTools
GET /api/user/onboarding/subscribe (status: pending, EventStream)
```

2. **Heartbeat reçu** (toutes les 30s)
```javascript
// Console browser
const eventSource = new EventSource('/api/user/onboarding/subscribe');
eventSource.addEventListener('message', (event) => {
  console.log('Heartbeat:', event.data);
});
```

3. **sseManager.broadcast appelé** (backend)
```javascript
// API route logs
[SSE] Broadcasting to user 123: onboarding:updated
```

---

### Q: Tooltip ne se ferme pas ?

**A** : Vérifier :

1. **closedManually persisted**
```javascript
onboardingState.tooltips['2'].closedManually === true
```

2. **Step complété**
```javascript
completedSteps.includes(2) === true
```

3. **Consolidated effect** (ligne 218-238)
```javascript
const shouldCloseTooltip = manuallyClosedByUser || stepCompleted;
setTooltipClosed(shouldCloseTooltip);
```

---

### Q: Comment reset onboarding pour test ?

**A** : 3 méthodes :

**1. Script Node.js** (recommandé) :
```bash
node scripts/reset-onboarding.js
```

**2. API directe** :
```bash
curl -X POST "http://localhost:3001/api/user/onboarding?action=reset" \
  -H "Cookie: session=..."
```

**3. DB directe** (PostgreSQL/SQLite) :
```sql
UPDATE "User" SET "onboardingState" = NULL WHERE id = 123;
```

---

## Migration guide

### Migrer ancien format vers nouveau

**Script automatique** :
```bash
node scripts/migrate-onboarding-state.js
```

**Migration manuelle** :

Ancien format (array `viewedTooltips`) :
```json
{
  "viewedTooltips": [1, 2],
  "completedSteps": [1]
}
```

Nouveau format (object `tooltips`) :
```json
{
  "tooltips": {
    "1": { "closedManually": true },
    "2": { "closedManually": true }
  },
  "completedSteps": [1]
}
```

---

## Debug checklist

Avant de rapporter un bug :

- [ ] Logger activé (NODE_ENV=development)
- [ ] Vérifier événements émis (DevTools console)
- [ ] Vérifier préconditions remplies
- [ ] Vérifier onboardingState persisted (API GET)
- [ ] Vérifier SSE connexion active (Network tab)
- [ ] Vérifier data-onboarding attributes présents
- [ ] Tester après reset (scripts/reset-onboarding.js)
- [ ] Reproduire sur compte test (tests@claude.com)

---

**Voir aussi** :
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - How-to guides
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture système
- [WORKFLOW.md](./WORKFLOW.md) - Workflow complet
