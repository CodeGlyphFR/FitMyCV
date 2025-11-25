# Structure OnboardingState

**Dernière mise à jour**: 24 novembre 2025

## Vue d'ensemble

Le champ `onboardingState` (type `Json` dans Prisma) est la **source unique de vérité** pour tout l'état d'onboarding d'un utilisateur. Il remplace les anciens champs `completedSteps` et `viewedTooltips` qui ont été supprimés.

**Localisation en base de données**:
- Modèle: `User`
- Champ: `onboardingState` (type `Json`)
- Parsing: Automatique par Prisma (objet JavaScript natif)

---

## Structure complète

```javascript
{
  // Progression actuelle
  currentStep: 2,                    // Étape en cours (0-8)
  completedSteps: [1, 2],            // Array des steps complétés
  hasCompleted: false,               // Onboarding complété normalement (tous les steps)
  isSkipped: false,                  // Onboarding skippé par l'utilisateur

  // Modaux (6 modaux trackés)
  modals: {
    welcome: {                       // Modal d'accueil (avant onboarding)
      completed: true,
      completedAt: "2025-11-24T10:00:00.000Z"
    },
    step1: {                         // Modal step 1 (Mode édition - 5 écrans)
      completed: true,
      completedAt: "2025-11-24T10:05:00.000Z"
    },
    step2: {                         // Modal step 2 (Génération IA - 3 écrans)
      completed: false
    },
    step6: {                         // Modal step 6 (Optimisation - 3 écrans)
      completed: false
    },
    step8: {                         // Modal step 8 (Export PDF - 3 écrans)
      completed: false
    },
    completion: {                    // Modal de félicitations (fin onboarding - 3 écrans)
      completed: false
    }
  },

  // Tooltips (8 tooltips, 1 par step)
  tooltips: {
    "1": { closedManually: false },  // Step 1: Mode édition
    "2": { closedManually: true },   // Step 2: Génération IA (fermé manuellement)
    "3": { closedManually: false },  // Step 3: Task Manager
    "4": { closedManually: false },  // Step 4: Ouverture CV généré
    "5": { closedManually: false },  // Step 5: Score de match
    "6": { closedManually: false },  // Step 6: Optimisation
    "7": { closedManually: false },  // Step 7: Historique
    "8": { closedManually: false }   // Step 8: Export PDF
  },

  // Timestamps (télémétrie)
  timestamps: {
    startedAt: "2025-11-24T10:00:00.000Z",           // Première activation
    completedAt: null,                               // Date de complétion (null si en cours)
    skippedAt: null,                                 // Date de skip (null si pas skippé)
    lastStepChangeAt: "2025-11-24T10:10:00.000Z"    // Dernière mise à jour
  },

  // Préconditions step 4 (ouverture CV généré)
  step4: {
    cvGenerated: false,              // CV a été généré via step 2
    cvFilename: null                 // Nom du fichier CV généré
  }
}
```

---

## Détail des champs

### `currentStep` (number)
- **Type**: `number` (0-8)
- **Description**: Étape actuellement affichée dans l'onboarding
- **Valeur initiale**: `0` (pas encore démarré)
- **Valeur finale**: `8` (dernière étape)

### `completedSteps` (array)
- **Type**: `number[]`
- **Description**: Liste des numéros d'étapes complétées
- **Exemple**: `[1, 2, 3, 4]` signifie que les 4 premières étapes sont complétées
- **Note**: Utilisé pour afficher la checklist et déterminer la progression

### `hasCompleted` (boolean)
- **Type**: `boolean`
- **Description**: Indique si l'onboarding a été **complété normalement** (tous les steps terminés)
- **Valeur**: `false` par défaut, `true` après complétion du step 8
- **Note**: ⚠️ Différent de `isSkipped` - un onboarding skippé n'est PAS considéré comme complété

### `isSkipped` (boolean)
- **Type**: `boolean`
- **Description**: Indique si l'utilisateur a **skippé** l'onboarding
- **Valeur**: `false` par défaut, `true` après action "Skip"
- **Note**: ⚠️ Si `isSkipped = true`, alors `hasCompleted = false` (skip ≠ completed)

**Sémantique des états combinés** :

| hasCompleted | isSkipped | Signification | UI affichée |
|--------------|-----------|---------------|-------------|
| `false` | `false` | Onboarding en cours ou non démarré | Afficher onboarding actif |
| `true` | `false` | ✅ Onboarding complété normalement (tous les 8 steps) | Badge "Complété", checklist verte |
| `false` | `true` | ⏭️ Onboarding skippé (abandonné) | Pas de badge, option "Relancer" |
| `true` | `true` | ⚠️ **État invalide** (ne devrait jamais se produire) | - |

**Clarification** : Un skip est considéré comme un **abandon**, pas une complétion rapide. Les analytics doivent distinguer :
- Users qui ont complété : `hasCompleted = true`
- Users qui ont skippé : `isSkipped = true`
- Users en cours : `hasCompleted = false AND isSkipped = false`

### `modals` (object)

Contient l'état de chaque modal tutoriel :

| Clé | Description | Écrans | Trigger |
|-----|-------------|--------|---------|
| `welcome` | Modal d'accueil (pré-onboarding) | 3 | Au chargement (nouveaux users avec CV) |
| `step1` | Mode édition | 5 | Clic bouton "Mode édition" |
| `step2` | Génération IA | 3 | Clic bouton "Générer avec IA" |
| `step6` | Optimisation | 3 | Clic bouton "Optimiser" |
| `step8` | Export PDF | 3 | Clic bouton "Exporter PDF" |
| `completion` | Félicitations (fin) | 3 | Après complétion step 8 |

**Structure par modal**:
```javascript
{
  completed: boolean,           // Modal complété (tous les écrans vus)
  completedAt?: string          // ISO8601 timestamp (si complété)
}
```

### `tooltips` (object)

Track les tooltips fermés **manuellement** par l'utilisateur :

```javascript
{
  "1": { closedManually: boolean },  // true si user a cliqué "X"
  "2": { closedManually: boolean },
  // ... steps 3-8
}
```

**Comportement**:
- `closedManually: false` → Tooltip affiché automatiquement
- `closedManually: true` → Tooltip ne s'affiche plus (persisté)

**Note**: Si un modal est complété, le tooltip associé est automatiquement considéré comme fermé (logique dans `OnboardingOrchestrator`).

### `timestamps` (object)

Métadonnées temporelles pour télémétrie :

```javascript
{
  startedAt: string | null,        // ISO8601 - Date début onboarding
  completedAt: string | null,      // ISO8601 - Date complétion normale
  skippedAt: string | null,        // ISO8601 - Date de skip (null si pas skippé)
  lastStepChangeAt: string | null  // ISO8601 - Dernière modification
}
```

**Utilisation**:
- Analytics : durée totale onboarding
- Dashboard admin : users en cours vs complétés vs skippés
- Metrics : taux d'abandon par étape, taux de skip

### `step4` (object)

Préconditions pour step 4 (ouverture CV généré) :

```javascript
{
  cvGenerated: boolean,   // true si génération IA lancée (step 2)
  cvFilename: string      // Nom du CV généré (ex: "cv_generated_123.json")
}
```

**Logique**:
- Step 4 est **disabled** tant que `cvGenerated === false`
- Set par `OnboardingOrchestrator` quand événement `task:added` (génération IA) reçu

---

## Valeurs par défaut

**Constante**: `DEFAULT_ONBOARDING_STATE`
**Fichier**: `lib/onboarding/onboardingState.js`

```javascript
export const DEFAULT_ONBOARDING_STATE = {
  currentStep: 0,
  completedSteps: [],
  hasCompleted: false,
  isSkipped: false,

  modals: {
    welcome: { completed: false },
    step1: { completed: false },
    step2: { completed: false },
    step6: { completed: false },
    step8: { completed: false },
    completion: { completed: false }
  },

  tooltips: {
    "1": { closedManually: false },
    "2": { closedManually: false },
    "3": { closedManually: false },
    "4": { closedManually: false },
    "5": { closedManually: false },
    "6": { closedManually: false },
    "7": { closedManually: false },
    "8": { closedManually: false }
  },

  timestamps: {
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    lastStepChangeAt: null
  },

  step4: {
    cvGenerated: false,
    cvFilename: null
  }
};
```

**Utilisation**:
- Nouveaux utilisateurs
- Reset onboarding (`POST /api/user/onboarding?action=reset`)
- Normalisation d'états partiels

---

## Helpers disponibles

**Fichier**: `lib/onboarding/onboardingState.js`

### `markModalCompleted(state, stepKey)`

Marque un modal comme complété avec timestamp.

```javascript
import { markModalCompleted } from '@/lib/onboarding/onboardingState';

const newState = markModalCompleted(currentState, 'step1');
// newState.modals.step1 = { completed: true, completedAt: "2025-11-24..." }
```

**Paramètres**:
- `state` (object): État actuel
- `stepKey` (string): Clé du modal (`welcome`, `step1`, `step2`, `step6`, `step8`, `completion`)

**Retour**: Nouvel état mis à jour (immutable)

### `markTooltipClosed(state, stepNumber)`

Marque un tooltip comme fermé manuellement.

```javascript
import { markTooltipClosed } from '@/lib/onboarding/onboardingState';

const newState = markTooltipClosed(currentState, 2);
// newState.tooltips["2"] = { closedManually: true }
```

**Paramètres**:
- `state` (object): État actuel
- `stepNumber` (number): Numéro du step (1-8)

**Retour**: Nouvel état mis à jour (immutable)

### `markStepCompleted(state, stepNumber)`

Marque une étape comme complétée (ajoute à `completedSteps`).

```javascript
import { markStepCompleted } from '@/lib/onboarding/onboardingState';

const newState = markStepCompleted(currentState, 3);
// newState.completedSteps = [...currentState.completedSteps, 3]
```

**Paramètres**:
- `state` (object): État actuel
- `stepNumber` (number): Numéro du step (1-8)

**Retour**: Nouvel état mis à jour (immutable)

### `normalizeOnboardingState(state)`

Normalise un état partiel en ajoutant les champs manquants.

```javascript
import { normalizeOnboardingState } from '@/lib/onboarding/onboardingState';

const normalized = normalizeOnboardingState({ currentStep: 2 });
// Retourne état complet avec valeurs par défaut pour champs manquants
```

**Utilisation**:
- Migration d'anciennes données
- Réception état partiel depuis API
- Garantir structure complète avant utilisation

### `validateOnboardingState(state)`

Valide la structure d'un état.

```javascript
import { validateOnboardingState } from '@/lib/onboarding/onboardingState';

if (!validateOnboardingState(userState)) {
  console.error('État onboarding invalide');
}
```

**Retour**: `boolean` (`true` si valide)

---

## Utilisation dans les composants

### Lecture depuis le contexte

```jsx
import { useOnboarding } from '@/components/onboarding/OnboardingProvider';

function MyComponent() {
  const { onboardingState } = useOnboarding();

  // Lire état d'un modal
  const step1Completed = onboardingState?.modals?.step1?.completed || false;

  // Lire état d'un tooltip
  const tooltip2Closed = onboardingState?.tooltips?.["2"]?.closedManually || false;

  // Lire steps complétés
  const completedSteps = onboardingState?.completedSteps || [];
}
```

### Mise à jour (avec persistence DB)

```jsx
import { useOnboarding } from '@/components/onboarding/OnboardingProvider';

function MyComponent() {
  const { markModalCompleted, markTooltipClosed } = useOnboarding();

  // Marquer modal complété
  const handleModalComplete = async () => {
    await markModalCompleted('step1');
    // Persisté en DB + broadcast SSE automatiquement
  };

  // Marquer tooltip fermé
  const handleTooltipClose = async () => {
    await markTooltipClosed(2);
    // Persisté en DB + broadcast SSE automatiquement
  };
}
```

---

## Synchronisation SSE (temps réel)

**Endpoint**: `/api/user/onboarding/subscribe`
**Type**: Server-Sent Events (EventSource)

### Événements émis

#### `onboarding:updated`

Émis quand `onboardingState` change (step complété, modal vu, etc.).

```javascript
// Payload
{
  onboardingState: { ... },  // État complet mis à jour
  currentStep: 2
}
```

**Réception côté client** (OnboardingProvider):
```javascript
eventSource.addEventListener('onboarding:updated', (event) => {
  const data = JSON.parse(event.data);
  setOnboardingState(data.onboardingState);
  setCurrentStep(data.currentStep);
});
```

#### `onboarding:reset`

Émis quand utilisateur clique "Relancer le tutoriel".

```javascript
// Payload
{
  onboardingState: DEFAULT_ONBOARDING_STATE
}
```

**Réception côté client**:
```javascript
eventSource.addEventListener('onboarding:reset', (event) => {
  const data = JSON.parse(event.data);
  // Reset complet UI
  setOnboardingState(data.onboardingState);
  setCurrentStep(0);
  setHasCompleted(false);
  // ...
});
```

### Flow multi-device

1. User complète step 1 sur **PC**
   - `markStepComplete(1)` appelé
   - `PATCH /api/user/onboarding` envoyé
   - DB mise à jour
   - `sseManager.broadcast(userId, 'onboarding:updated', ...)` appelé

2. **Tablette** reçoit événement SSE
   - `onboarding:updated` reçu
   - State mis à jour automatiquement
   - UI re-render avec nouveau step

3. **Synchronisation instantanée** sans refresh

---

## Migration depuis ancien format

### Script de migration

**Fichier**: `scripts/migrate-onboarding-state.js`

**Commande**:
```bash
# Dry-run (preview)
node scripts/migrate-onboarding-state.js --dry-run --verbose

# Exécution
node scripts/migrate-onboarding-state.js
```

**Transformations effectuées**:
1. `completedSteps` (Json) → `onboardingState.completedSteps`
2. `viewedTooltips` (String) → `onboardingState.tooltips`
3. Ajout `onboardingStartedAt` si `onboardingStep > 0`
4. Normalisation avec `DEFAULT_ONBOARDING_STATE`

### Ancien format vs nouveau

| Ancien champ | Nouveau emplacement |
|--------------|---------------------|
| `completedSteps` | `onboardingState.completedSteps` |
| `viewedTooltips` | `onboardingState.tooltips` |
| `onboardingStep` | `onboardingStep` (inchangé) |
| N/A | `onboardingState.modals` (nouveau) |
| N/A | `onboardingState.timestamps` (nouveau) |
| N/A | `onboardingState.step4` (nouveau) |
| N/A | `onboardingStartedAt` (nouveau champ DB) |

---

## Télémétrie et analytics

### Métriques calculables

À partir de `onboardingState`, on peut calculer :

- **Taux de complétion**: `completedSteps.length / 8 * 100`
- **Durée totale**: `timestamps.completedAt - timestamps.startedAt`
- **Temps par step**: Différence entre deux `lastStepChangeAt`
- **Modaux vus**: Count `modals.*.completed === true`
- **Tooltips fermés**: Count `tooltips.*.closedManually === true`

### Dashboard admin

**Requêtes possibles** (PostgreSQL):

```sql
-- Users avec onboarding en cours
SELECT COUNT(*) FROM "User"
WHERE "onboardingStep" > 0
AND "hasCompletedOnboarding" = false;

-- Moyenne steps complétés
SELECT AVG(jsonb_array_length("onboardingState"->'completedSteps'))
FROM "User"
WHERE "onboardingStep" > 0;

-- Users ayant complété welcome modal
SELECT COUNT(*) FROM "User"
WHERE "onboardingState"->'modals'->'welcome'->>'completed' = 'true';
```

---

## Références

- **Helpers**: `lib/onboarding/onboardingState.js`
- **API Routes**: `app/api/user/onboarding/`
- **Context Provider**: `components/onboarding/OnboardingProvider.jsx`
- **SSE Manager**: `lib/sse/sseManager.js`
- **Schéma Prisma**: `prisma/schema.prisma`
