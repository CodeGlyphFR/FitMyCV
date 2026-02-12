# CLAUDE.md

Instructions pour Claude Code sur le repository FitMyCV.io.

## Vue d'Ensemble

**FitMyCV.io** - Application SaaS de génération de CV optimisés par IA.
- **Stack** : Next.js 16 (App Router) + React 19 + Tailwind CSS 4.
- **Database** : PostgreSQL via Prisma 6 (34 modèles).
- **Infrastructure** : Déploiement automatisé via Docker et GitHub Actions sur runner auto-hébergé.

## Commandes Essentielles

```bash
npm run dev                    # Lancer l'environnement de développement (Port 3001 en dev local)
npm run build                  # Build production (génère le mode standalone pour Docker)
npx prisma migrate deploy      # Appliquer les migrations de schéma Prisma
npm run db:migrate-data        # Appliquer les scripts de migration de données (.js)
npx prisma generate            # Régénérer le client Prisma
bash scripts/bump-version.sh "msg" # Incrémenter la version manuellement

```

## ⚠️ Gestion de la Version (CRITIQUE)

**Il est STRICTEMENT INTERDIT de modifier manuellement les numéros de version dans les fichiers.**

Le projet utilise un versioning automatique à 4 parties (`X.X.X.X`) basé sur les préfixes **Conventional Commits** des messages de commit. Le script `scripts/bump-version.sh` scanne tous les commits de la PR et applique le plus haut niveau détecté.

### Règles de préfixes de commit

| Préfixe | Partie | Quand l'utiliser |
|---|---|---|
| `feat!:` ou `BREAKING CHANGE:` | **1er** (Major) | Changement **cassant** pour les utilisateurs existants : suppression d'une fonctionnalité, changement d'API incompatible, migration obligatoire. **Très rare.** |
| `feat:` | **2ème** (Minor) | Fonctionnalité **réellement nouvelle** qui n'existait pas avant : nouveau module, nouvelle page, nouvelle capacité utilisateur. |
| `fix:` | **3ème** (Patch) | Correction de bug, optimisation, amélioration, modification ou refactoring d'une feature **existante**. |
| Autre (`chore:`, `docs:`, `style:`, ...) | **4ème** (Build) | Tout ce qui ne touche pas au comportement : config, documentation, CI/CD, dépendances. |

### ⚠️ Erreurs fréquentes à éviter

* **NE PAS utiliser `feat:` pour une amélioration d'une feature existante** → utiliser `fix:` à la place.
* **NE PAS utiliser `feat!:` pour une nouvelle feature** → utiliser `feat:` (sans `!`). Le `!` signifie BREAKING CHANGE uniquement.
* **Un commit `fix:` dans une PR suffit** à incrémenter le 3ème chiffre, même si d'autres commits n'ont pas de préfixe.

### Fonctionnement automatique

* Le bump est **entièrement automatisé** par GitHub Actions lors du merge sur `main`.
* Le script scanne **tous les commits** de la PR (pas le message de merge) et applique le niveau le plus élevé trouvé.
* La version est propagée dans tous les fichiers de la codebase (`package.json`, `docs/`, `README.md`, etc.).

## Migrations de Données (Post-Prisma)

Pour toute modification de données (naming, nettoyage, calculs) générée par Claude Code :

* **Emplacement** : `prisma/data-migrations/`.
* **Format Nom** : `YYYYMMDD_HHMM_description.js`.
* **Structure attendue** :
```javascript
module.exports = async (prisma) => {
  // Logique de migration ici (ex: prisma.user.updateMany...)
};

```


* **Exécution** : Ces scripts sont lancés automatiquement via `npm run db:migrate-data` après les migrations Prisma lors des déploiements.

## Workflow Git & CI/CD

* **Branches** : `main` (Production) ← `release` (Stable) ← `dev` (Travail).
* **Pull Request vers `main**` :
* Déclenche un déploiement Pre-prod sur `dev.fitmycv.io` (Port 3001).
* Clone automatiquement la DB `fitmycv_prod` vers `fitmycv_release` pour les tests.
* **Nettoyage** : La fermeture de la PR (merge ou close) arrête et supprime automatiquement le serveur de test.


* **Merge sur `main**` :
* Incrémente la version et la propage dynamiquement dans toute la codebase.
* Déploie en production sur `app.fitmycv.io` (Port 3000).
* Synchronise automatiquement `main` vers les branches `release` et `dev`.



## Base de Données

**⚠️ IMPORTANT : Utiliser UNIQUEMENT le skill `postgres-prisma` pour interroger la DB.**

```bash
bash ~/.claude/skills/postgres-prisma/scripts/query_db.sh "SELECT * FROM \"Table\" LIMIT 5"

```

## Structure Projet

* `app/api/` : 114 API Routes (auth, cv, admin...).
* `prisma/` : Schémas, migrations et `data-migrations/`.
* `scripts/` : Scripts d'automatisation (versioning, runner de données).
* `docs/` : Documentation technique (Markdown et HTML) à maintenir synchronisées.

```
