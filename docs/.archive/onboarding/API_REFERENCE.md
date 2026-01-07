# API Reference Onboarding

> **Documentation complète des endpoints REST et SSE**

---

## Endpoints REST

### GET /api/user/onboarding

**Description** : Récupérer l'état d'onboarding complet

**Auth** : Required (session)

**Response 200** :
```json
{
  "currentStep": 2,
  "hasCompleted": false,
  "isSkipped": false,
  "completedAt": null,
  "skippedAt": null,
  "startedAt": "2025-11-24T10:00:00Z",
  "onboardingState": {
    "currentStep": 2,
    "completedSteps": [1, 2],
    "hasCompleted": false,
    "isSkipped": false,
    "modals": { /* ... */ },
    "tooltips": { /* ... */ },
    "timestamps": { /* ... */ },
    "step4": { /* ... */ }
  }
}
```

**cURL** :
```bash
curl -X GET http://localhost:3001/api/user/onboarding \
  -H "Cookie: session=..."
```

---

### PUT /api/user/onboarding

**Description** : Mettre à jour l'étape en cours (currentStep)

**Auth** : Required

**Body** :
```json
{
  "step": 3
}
```

**Validation** : `step` doit être entre 0 et 8

**Response 200** :
```json
{
  "success": true,
  "currentStep": 3,
  "hasCompleted": false
}
```

**cURL** :
```bash
curl -X PUT http://localhost:3001/api/user/onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"step": 3}'
```

---

### PATCH /api/user/onboarding

**Description** : Mettre à jour onboardingState (merge complet)

**Auth** : Required

**Body** :
```json
{
  "onboardingState": {
    "currentStep": 2,
    "completedSteps": [1, 2],
    "modals": {
      "step1": { "completed": true }
    },
    "tooltips": {
      "2": { "closedManually": true }
    }
  }
}
```

**Cache** : TTL 1000ms (skip duplicates)

**Response 200** :
```json
{
  "success": true,
  "onboardingState": { /* merged state */ }
}
```

**cURL** :
```bash
curl -X PATCH http://localhost:3001/api/user/onboarding \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"onboardingState": {...}}'
```

---

### POST /api/user/onboarding?action=complete

**Description** : Marquer onboarding comme complété

**Auth** : Required

**Query** : `?action=complete`

**Response 200** :
```json
{
  "success": true,
  "completedAt": "2025-11-24T10:30:00Z"
}
```

**Broadcast SSE** : `onboarding:updated` avec hasCompleted=true

**cURL** :
```bash
curl -X POST "http://localhost:3001/api/user/onboarding?action=complete" \
  -H "Cookie: session=..."
```

---

### POST /api/user/onboarding?action=skip

**Description** : Marquer onboarding comme skippé

**Query** : `?action=skip`

**Response 200** :
```json
{
  "success": true,
  "skippedAt": "2025-11-24T10:05:00Z"
}
```

**Broadcast SSE** : `onboarding:updated` avec isSkipped=true, hasCompleted=false

---

### POST /api/user/onboarding?action=reset

**Description** : Reset onboarding à l'état initial

**Query** : `?action=reset`

**Response 200** :
```json
{
  "success": true,
  "message": "Onboarding réinitialisé",
  "onboardingState": { /* DEFAULT_ONBOARDING_STATE */ }
}
```

**Broadcast SSE** : `onboarding:reset`

---

## SSE Endpoint

### GET /api/user/onboarding/subscribe

**Description** : Connexion Server-Sent Events pour synchronisation temps réel

**Auth** : Required

**Headers** :
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

**Events émis** :

#### onboarding:updated
```javascript
{
  type: 'onboarding:updated',
  currentStep: 3,
  onboardingState: { /* full state */ },
  hasCompleted: false
}
```

#### onboarding:reset
```javascript
{
  type: 'onboarding:reset',
  onboardingState: { /* DEFAULT_ONBOARDING_STATE */ }
}
```

#### heartbeat (toutes les 30s)
```javascript
{
  type: 'heartbeat'
}
```

**Usage client** :
```javascript
const eventSource = new EventSource('/api/user/onboarding/subscribe');

eventSource.addEventListener('onboarding:updated', (event) => {
  const data = JSON.parse(event.data);
  console.log('Updated:', data);
});

eventSource.addEventListener('onboarding:reset', (event) => {
  const data = JSON.parse(event.data);
  console.log('Reset:', data);
});

// Cleanup
eventSource.close();
```

---

## Cache Strategy

**In-memory cache** (API route) :
- TTL: 1000ms (synchronisé avec debounce persistence)
- Key: userId
- Skip duplicate updates (same payload within TTL)
- Flag dbSuccess pour éviter skip si DB write échoue

**Debounce persistence** (client) :
- Délai: 1000ms
- Agrège updates multiples
- Évite requêtes multiples

---

**Voir aussi** :
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - Structure onboardingState
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Patterns architecturaux
