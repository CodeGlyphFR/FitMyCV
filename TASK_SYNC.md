# 🔄 Gestionnaire de tâches CV — Synchronisation multi-appareils

Le gestionnaire de tâches utilise désormais Prisma comme source de vérité. Toutes les opérations (création, mise à jour, annulation, historique) sont persistées côté serveur et synchronisées entre les appareils connectés au même compte.

## 🚀 Points clés
- **Persistance Prisma** : chaque tâche est stockée dans la table `BackgroundTask` (id stable, status, résultat, erreurs, deviceId, userId).
- **API Authentifiée** : la route `POST/GET/DELETE /api/background-tasks/sync` requiert une session valide et ne renvoie que les tâches de l'utilisateur courant.
- **Polling rapide** : le client interroge l'API toutes les 3 s + synchronisations forcées après actions sensibles (annulation, purge).
- **Nettoyage automatique** : l'historique est limité à 100 entrées par utilisateur (FIFO). Supprimer les tâches terminées depuis un appareil les retire partout.
- **Annulation fiable** : un registre global (`lib/backgroundTasks/processRegistry`) suit les processus Node/Python en cours. Une annulation ou suppression déclenche leur arrêt (`SIGTERM` puis `SIGKILL` si nécessaire) et met l'état Prisma à jour.
- **Statut serveur > client** : les routes d'import / génération marquent les tâches comme `running`, puis `completed`, `failed` ou `cancelled` directement côté serveur (résultat JSON inclus). Même si l'onglet déclencheur est fermé, l'historique reste cohérent.

## 🔧 Architecture
- `app/api/background-tasks/sync/route.js` : CRUD des tâches, limite d'historique, annulation/suppression avec kill process.
- `app/api/background-tasks/import-pdf|generate-cv/route.js` : exécution Python, suivi d'état Prisma et écoute des annulations.
- `hooks/useTaskSyncAPI.js` : polling, fusion état serveur/local, gestion des abort controllers, détection de tâches fantômes.
- `components/BackgroundTasksProvider.jsx` + UI : file d'attente, bouton annulation, purge d'historique, notifications.

## 🧪 Scénarios de test recommandés
1. **Sync multi-onglets** : lancer une importation sur A, suivre la progression et annuler depuis B → le script Python stoppe et A reflète `cancelled`.
2. **Fermeture onglet** : démarrer une génération, fermer l'onglet déclencheur → la tâche apparaît toujours sur un nouvel onglet et passe en `completed/failed` selon le résultat réel.
3. **Purge** : terminer plusieurs tâches (succès/échec), purger depuis mobile → l'historique disparaît partout.

## 💡 Notes d'implémentation
- Les timestamps (`createdAt`) restent en millisecondes (BigInt côté Prisma → nombre côté API).
- `deviceId` conserve le dernier émetteur mais n'est plus filtrant : l'API renvoie toujours l'historique complet de l'utilisateur.
- Le hook filtre les tâches purement locales (`queued|running` avec `execute`) pour préserver la fluidité le temps que l'API confirme.
