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

### Bug 3 : Step 4 highlight disparaissait après refresh

**Symptôme** :
1. Highlight sur CV selector disparaissait après refresh page
2. Cliquer sur le CV après refresh ne validait pas le step 4
3. Aucun indicateur visuel pour identifier quel CV ouvrir

**Cause** :
1. Pas d'attribut `data-cv-filename` sur les boutons CV → impossible de cibler un CV spécifique
2. Événement `GENERATED_CV_OPENED` émis uniquement pour `isRecentlyGenerated` → pas après refresh
3. Highlight adaptatif complexe avec MutationObserver → trop fragile

**Fix** :
1. **Ajouté `data-cv-filename` attribute** sur chaque bouton CV (TopBar.jsx ligne 590)
2. **Fond vert léger** sur le CV concerné dans la liste (`bg-emerald-500/20`)
3. **Highlight fixe** sur bouton principal (pas de déplacement adaptatif)
4. **Événement émis** pour `isRecentlyGenerated || isOnboardingStep4Cv`

**Code fix** :

```javascript
// TopBar.jsx - Ajout data-cv-filename
<button
  type="button"
  data-cv-filename={it.file}  // ← Pour cibler le CV
  onClick={async () => { /* ... */ }}
>

// TopBar.jsx - Détection CV onboarding
const isOnboardingStep4Cv = currentStep === 4 && it.file === onboardingState?.step4?.cvFilename;

// TopBar.jsx - Fond vert léger
className={`... ${
  isRecentlyGenerated
    ? "bg-emerald-500/30 border border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)] animate-pulse"
    : isOnboardingStep4Cv
    ? "bg-emerald-500/20"  // ← Fond vert discret
    : ""
}`}

// TopBar.jsx - Événement émis aussi après refresh
if (isRecentlyGenerated || isOnboardingStep4Cv) {
  emitOnboardingEvent(ONBOARDING_EVENTS.GENERATED_CV_OPENED, {
    cvFilename: it.file
  });
}

// OnboardingOrchestrator.jsx - Highlight fixe
<OnboardingHighlight
  show={currentStep === 4}
  blurEnabled={!tooltipClosed}
  targetSelector={step.targetSelector}  // ← Toujours bouton principal
/>
```

**Comportement final** :
- Highlight pulsant toujours visible sur bouton principal (même dropdown ouvert)
- CV concerné a fond vert léger dans la liste
- Cliquer sur le CV valide le step (même après refresh)
- `onboardingState.step4.cvFilename` persiste le filename en DB

**Commit** : À venir

---

## FAQ

### Q: L'onboarding ne démarre pas automatiquement ?

**A** : Vérifier conditions auto-start :
1. User authentifié
2. cvCount >= 1 (au moins 1 CV créé)
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
