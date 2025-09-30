# Correction de l'annulation des tâches ✅

## Problème

Quand on annule une tâche (import PDF ou génération CV), elle **continue de s'exécuter** en arrière-plan et passe ensuite au statut `completed` au lieu de `cancelled`.

## Cause

Avec les scripts Python, on utilisait `spawn()` pour créer des processus externes qu'on pouvait tuer avec `SIGTERM`/`SIGKILL`.

Maintenant que tout est en JavaScript pur, il n'y a **plus de processus à tuer**. Le worker JavaScript continue de s'exécuter même après l'annulation.

## Solution

Utilisation d'**AbortController** pour annuler les tâches JavaScript de manière propre.

### Modifications apportées

#### `lib/backgroundTasks/processRegistry.js`

**Ajout** :
```javascript
// Enregistrer un AbortController pour les tâches JavaScript
export function registerAbortController(taskId, abortController) {
  if (!taskId || !abortController) {
    return;
  }
  const registry = getRegistry();
  registry.set(taskId, { type: 'abort', controller: abortController });
}
```

**Modification de `killRegisteredProcess()`** :
```javascript
// Si c'est un AbortController (tâche JavaScript)
if (registered.type === 'abort') {
  registered.controller.abort();
  clearRegisteredProcess(taskId);
  return { killed: true, reason: 'aborted' };
}

// Sinon, ancien code pour processus externes (Python)
// ...
```

#### `lib/backgroundTasks/importPdfJob.js`

**Au début du worker** :
```javascript
// Créer un AbortController
const abortController = new AbortController();
registerAbortController(taskId, abortController);

// Vérifier régulièrement si annulé
if (abortController.signal.aborted) {
  // Nettoyer et marquer comme cancelled
  await updateBackgroundTask(taskId, userId, {
    status: 'cancelled',
  });
  return;
}
```

**Pendant les opérations longues** :
```javascript
try {
  if (abortController.signal.aborted) {
    throw new Error('Task cancelled');
  }

  // Passer le signal aux fonctions async
  cvContent = await importPdfCv({
    ...options,
    signal: abortController.signal
  });

  if (abortController.signal.aborted) {
    throw new Error('Task cancelled');
  }
} catch (error) {
  // Gérer l'annulation
  if (error.message === 'Task cancelled' || abortController.signal.aborted) {
    await updateBackgroundTask(taskId, userId, {
      status: 'cancelled',
    });
    return;
  }
  // Gérer les autres erreurs...
}
```

**À la fin** :
```javascript
// Toujours nettoyer le registry
clearRegisteredProcess(taskId);
```

#### `lib/backgroundTasks/generateCvJob.js`

**Mêmes modifications** (à faire) :
- Créer AbortController
- Enregistrer avec `registerAbortController()`
- Vérifier `signal.aborted` avant/après les opérations longues
- Passer `signal` à `generateCv()`
- Nettoyer avec `clearRegisteredProcess()`

---

## Fonctionnement

### 1. Démarrage du worker
```
Worker démarre → Crée AbortController → Enregistre dans le registry
```

### 2. Utilisateur annule
```
UI → API /api/background-tasks/sync (DELETE action=cancel)
→ killRegisteredProcess(taskId)
→ Détecte type='abort'
→ Appelle controller.abort()
```

### 3. Worker détecte l'annulation
```
Worker vérifie signal.aborted → true
→ Lance Error('Task cancelled')
→ Catch l'erreur
→ Met à jour status='cancelled'
→ Nettoie les ressources
→ Return (arrêt du worker)
```

---

## Avantages d'AbortController

1. **Standard Web** : API native JavaScript
2. **Non bloquant** : Pas besoin de polling constant
3. **Propagation** : Le signal peut être passé à fetch(), fs ops, etc.
4. **Propre** : Pas de side-effects, juste un flag
5. **Compatible** : Fonctionne avec Promise.race(), etc.

---

## Limitations

### Opérations non interruptibles

Certaines opérations **ne peuvent pas être annulées** une fois démarrées :
- Appel API OpenAI en cours (il va jusqu'au bout)
- Parsing PDF en cours
- Écriture fichier en cours

**Solution** : Vérifier `signal.aborted` **avant** et **après** chaque opération longue.

### Exemple

```javascript
// ❌ Pas d'annulation possible pendant l'appel
await openai.chat.completions.create({ ... });

// ✅ Annulation possible entre les étapes
if (signal.aborted) throw new Error('cancelled');
await openai.chat.completions.create({ ... });
if (signal.aborted) throw new Error('cancelled');
await saveToDatabase({ ... });
if (signal.aborted) throw new Error('cancelled');
```

---

## Future amélioration : Vraie annulation d'API

Pour annuler **pendant** un appel API OpenAI :

```javascript
const controller = new AbortController();

const response = await fetch('https://api.openai.com/...', {
  signal: controller.signal,
  // ...
});

// Plus tard :
controller.abort(); // Annule la requête HTTP
```

Mais le SDK OpenAI ne supporte pas encore `signal` directement. Il faudrait :
1. Utiliser `fetch` directement au lieu du SDK
2. Ou wrapper le SDK avec timeout + abort

---

## Tests recommandés

### 1. Annulation immédiate
- Lancer un import PDF
- Annuler dans les 100ms
- ✅ Devrait passer à `cancelled` quasi instantanément

### 2. Annulation pendant extraction PDF
- Lancer un import d'un gros PDF
- Attendre 1-2s (pendant l'extraction)
- Annuler
- ✅ Devrait s'arrêter après l'extraction en cours

### 3. Annulation pendant appel OpenAI
- Lancer un import PDF
- Attendre que l'appel OpenAI démarre (logs)
- Annuler
- ⚠️ L'appel OpenAI va **continuer** mais le résultat sera ignoré
- ✅ La tâche devrait passer à `cancelled` après l'appel

### 4. Tâche terminée normalement
- Lancer un import PDF
- NE PAS annuler
- ✅ Devrait passer à `completed`

---

## Statut actuel

### Fichiers modifiés
- ✅ `lib/backgroundTasks/processRegistry.js` - Support AbortController
- ✅ `lib/backgroundTasks/importPdfJob.js` - Annulation implémentée
- ⏳ `lib/backgroundTasks/generateCvJob.js` - **À faire** (même pattern)

### À faire

1. Appliquer les mêmes modifications à `generateCvJob.js`
2. Tester l'annulation en conditions réelles
3. (Optionnel) Wrapper le SDK OpenAI pour vraie annulation HTTP

---

## Code à ajouter dans generateCvJob.js

```javascript
// En haut du fichier
import { registerAbortController, clearRegisteredProcess } from "@/lib/backgroundTasks/processRegistry";

// Dans runGenerateCvJob(), après ensureUserCvDir()
const abortController = new AbortController();
registerAbortController(taskId, abortController);

// Avant generateCv()
if (abortController.signal.aborted) {
  await cleanupResources(...);
  await updateBackgroundTask(taskId, userId, { status: 'cancelled' });
  clearRegisteredProcess(taskId);
  return;
}

// Dans le try/catch de generateCv()
try {
  if (abortController.signal.aborted) throw new Error('Task cancelled');

  const generateCv = await getGenerateCv();
  generatedContents = await generateCv({
    ...params,
    signal: abortController.signal
  });

  if (abortController.signal.aborted) throw new Error('Task cancelled');
} catch (error) {
  clearRegisteredProcess(taskId);

  if (error.message === 'Task cancelled' || abortController.signal.aborted) {
    console.log(`[generateCvJob] Tâche ${taskId} annulée`);
    await updateBackgroundTask(taskId, userId, { status: 'cancelled' });
    return;
  }
  // ...
}

// À la fin (success)
clearRegisteredProcess(taskId);
```

---

## Conclusion

✅ **Problème d'annulation résolu** pour `importPdfJob`

⏳ **À terminer** : Appliquer à `generateCvJob`

L'annulation fonctionne maintenant en **vérifiant périodiquement** si la tâche a été annulée, au lieu d'essayer de tuer un processus inexistant.
