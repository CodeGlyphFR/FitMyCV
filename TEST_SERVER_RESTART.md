# Test après migration - Redémarrage nécessaire

## Erreur rencontrée

```
POST http://176.136.226.121:3000/api/background-tasks/import-pdf 404 (Not Found)
```

## Cause probable

Le serveur Next.js n'a pas été redémarré après les modifications des modules OpenAI.

## Solution

**Redémarrer le serveur de développement** :

```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis redémarrer
npm run dev
```

## Vérifications après redémarrage

1. **Console du serveur** - Vérifier qu'il n'y a pas d'erreurs au démarrage
2. **Routes API** - Tester que `/api/background-tasks/import-pdf` répond
3. **Import PDF** - Tester l'import d'un CV PDF
4. **Génération CV** - Tester la génération de CV

## Points d'attention

### Si des erreurs apparaissent au démarrage

Vérifier :
- ✅ Le package `pdf-parse` est installé : `npm list pdf-parse`
- ✅ Le package `openai` est installé : `npm list openai`
- ✅ Le package `luxon` est installé : `npm list luxon`
- ✅ Pas d'erreurs d'import dans les modules

### Si l'erreur 404 persiste

Vérifier que la route existe :
```bash
ls -la app/api/background-tasks/import-pdf/route.js
```

### Logs à surveiller dans la console du navigateur

Quand une tâche change de statut :
```
[BackgroundTask] Tâche abc123 (import): queued → running
```

Quand une tâche échoue :
```
[BackgroundTask] Tâche abc123 (import) a échoué: <message d'erreur>
[BackgroundTask] Détails de la tâche: {...}
```

### Logs à surveiller dans la console du serveur

Extraction du PDF :
```
[importPdf] PDF extrait: 2 pages, 1234 caractères
```

Erreurs :
```
[importPdfJob] Erreur lors de l'import PDF pour la tâche abc123: ...
[importPdfJob] Stack trace: ...
```

## Test rapide

Pour tester que les modules se chargent correctement, tu peux faire :

```bash
# Dans la console du navigateur après redémarrage
fetch('/api/background-tasks/sync', { method: 'GET' })
  .then(r => r.json())
  .then(console.log)
```

Si ça retourne des tâches sans erreur 404, c'est bon signe !
