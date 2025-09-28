# Agents – Règles d'intervention

Ce document centralise les consignes destinées aux agents (humains ou IA) qui opèrent sur ce dépôt. Il sert de garde-fou pour garantir la cohérence fonctionnelle, la qualité du code et le respect du versioning semver.

## Principes généraux
- Toujours vérifier l'état du dépôt (`git status -sb`) avant et après toute intervention.
- Préserver les modifications existantes : ne jamais réinitialiser ou supprimer un travail non lié sans demande explicite.
- Favoriser des commits autoportants avec un message explicite (français admis, anglais recommandé si contribution publique).
- Ajouter des commentaires uniquement lorsqu'ils apportent de la clarté sur une logique complexe.
- Préférer `rg` pour les recherches et respecter la configuration du projet (Node 18+, Next.js 14, Prisma, etc.).
- A chaque commit, ne pas mentionner que ça été fait par une IA.
- A chaque demande de merge appliquer l'option --no-ff.
- Le projet tourne dans un service, il ne faut pas relancer le serveur npm, le site est dejà accéssible à l'adresse http://localhost:3000.

## Stratégie de versioning
Le projet suit Semantic Versioning (`MAJEUR.MINEUR.CORRECTIF`). L'environnement client (UI) lit directement la version de `package.json` via `next.config.js`.

| Type de branche       | Exemple                 | Incrément attendu | Notes |
|-----------------------|-------------------------|-------------------|-------|
| `fix/...`             | `fix/versioning`        | PATCH             | Corrections de bugs, ajustements mineurs, refonte CSS sans impact API. |
| `feature/...`         | `feature/export-pdf`    | MINOR             | Nouveaux modules, API additionnelle, améliorations UX significatives. |
| `release/...` / `main`| `release/1.1.0`         | MAJOR/MINOR/PATCH | Selon le contenu. Synchroniser avec le plan de déploiement. |
| `hotfix/...`          | `hotfix/login-crash`    | PATCH (ou MINOR)  | Interventions urgentes sur production. |

### Procédure lorsque la version doit bouger
1. Calculer l'incrément approprié (patch/minor/major) selon le tableau ci-dessus.
2. Utiliser npm pour modifier la version sans tag automatique :
   ```bash
   npm version <patch|minor|major> --no-git-tag-version
   ```
3. Vérifier que `package.json` et `package-lock.json` reflètent la nouvelle version.
4. Mettre à jour toutes les occurrences visibles dans la documentation, notamment :
   - Titre et section Licence de `README.md`.
   - Tout document marketing ou d'onboarding exposant la version (ex. `docs/`, pages publiques).
5. Si la version est affichée dans l'interface, s'assurer que `NEXT_PUBLIC_APP_VERSION` (injectée automatiquement) procure la valeur attendue.
6. Mentionner le bump de version et les surfaces mises à jour dans le message de commit.

## Checklist intervention
- [ ] Analyse de la demande utilisateur et clarification si nécessaire.
- [ ] Inspection des fichiers impactés avec `rg`, `sed`, `nl`, etc.
- [ ] Modifications conformes aux règles précédentes (SemVer, README, documentation).
- [ ] Formatage respectant les conventions du projet (lint/format si disponible).
- [ ] Tests/commandes pertinents exécutés ou expliqués s'ils sont impossibles.
- [ ] Résumé clair des changements fourni à la fin de l'intervention, avec chemins + lignes.

## Communication avec l'utilisateur
- Répondre de manière concise et factuelle.
- Signaler immédiatement toute anomalie (ex. conflit ou fichier inattendu).
- Proposer des prochaines étapes logiques (tests, build, déploiement) sans imposer.

## Outils utiles

Bonnes interventions !
