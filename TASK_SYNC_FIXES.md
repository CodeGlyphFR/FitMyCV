# Correctifs apportés au gestionnaire de tâches

## ✅ Résumé des corrections majeures
- **Prisma comme source de vérité** : abandon du fichier `data/background-tasks.json`. Toutes les tâches sont stockées dans la table `BackgroundTask` avec filtrage par utilisateur.
- **API sécurisée** : `GET/POST/DELETE /api/background-tasks/sync` vérifie la session, sérialise correctement les champs (`createdAt` BigInt, `result` JSON) et limite l'historique à 100 entrées.
- **Annulation robuste** : nouvelle registry (`lib/backgroundTasks/processRegistry`) pour suivre les `ChildProcess`. Les annulations/suppressions déclenchent un `SIGTERM` puis `SIGKILL` en fallback.
- **Statuts côté serveur** : les routes `import-pdf` et `generate-cv` mettent à jour Prisma (`running` → `completed/failed/cancelled`) même si le client abandonne – résultat JSON stocké pour affichage multi-device.
- **Polling fiable** : `hooks/useTaskSyncAPI` traite désormais les réponses vides (purge correcte des tâches côté client) et fusionne l'état serveur/local sans dépendre de "markers".

## 🐞 Problèmes résolus
- Tâches invisibles après rafraîchissement (filtre `deviceId` erroné, absence de persistance partagée).
- Annulations inefficaces (processus Python non retrouvés, fichier JSON pas à jour).
- Historique divergent entre appareils (écriture concurrente dans le fichier, absence de source unique).

## 🔍 À surveiller
- Lancer `prisma db push` si la table `BackgroundTask` n'existe pas encore dans l'environnement local.
- Scripts Python doivent continuer à écrire l'ID de tâche dans les logs si une analyse plus fine est souhaitée (non bloquant).
