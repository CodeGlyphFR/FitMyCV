# CLAUDE.md

> **This file provides guidance to Claude Code AI assistant when working with this repository.**
>
> **For human developers:** Start with [README.md](./README.md) for project overview, then consult [docs/](./docs/) for detailed documentation.

---

## 📚 Documentation Complète

Toute la documentation technique est disponible dans le dossier **`docs/`**. Ce fichier est un **quick reference** pour Claude Code avec des liens vers la documentation détaillée.

### Installation & Configuration
- **[Installation complète](./docs/INSTALLATION.md)** - Setup initial, prérequis, premiers pas
- **[Variables d'environnement](./docs/ENVIRONMENT_VARIABLES.md)** - Configuration .env détaillée
- **[Déploiement](./docs/DEPLOYMENT.md)** - Production deployment guide
- **[Configuration CRON](./docs/CRON_SETUP.md)** - Tâches planifiées

### Architecture & Développement
- **[Architecture complète](./docs/ARCHITECTURE.md)** - Vue d'ensemble système, background tasks, télémétrie
- **[Guide développement](./docs/DEVELOPMENT.md)** - Workflow développeur, best practices
- **[Base de données](./docs/DATABASE.md)** - Schéma Prisma, migrations, models
- **[Référence API](./docs/API_REFERENCE.md)** - Tous les endpoints avec exemples
- **[Composants](./docs/COMPONENTS.md)** - Structure composants React
- **[Features](./docs/FEATURES.md)** - Fonctionnalités détaillées

### Systèmes Spécialisés
- **[Intégration IA](./docs/AI_INTEGRATION.md)** - OpenAI, prompts, modèles, analyse levels
- **[Système d'abonnements](./docs/SUBSCRIPTION.md)** - Plans, crédits, Stripe, limites features
- **[Dashboard Admin](./docs/ADMIN_GUIDE.md)** - Interface admin, analytics, monitoring
- **[Télémétrie & Analytics](./docs/TELEMETRY.md)** - Système télémétrie, sessions, dashboard analytics
- **[Sécurité](./docs/SECURITY.md)** - Best practices, chiffrement CV, sanitization

### Configuration Externe
- **[Setup Stripe](./docs/STRIPE_SETUP.md)** - Configuration Stripe complète (webhooks, test mode)
- **[MCP Puppeteer](./docs/MCP_PUPPETEER.md)** - Browser automation pour tests et analyse UX

### Développement & Patterns
- **[Référence commandes](./docs/COMMANDS_REFERENCE.md)** - Toutes les commandes (Next.js, Prisma, Stripe, scripts)
- **[Patterns de code](./docs/CODE_PATTERNS.md)** - Exemples réutilisables (CV, job queue, Stripe, limites)
- **[Design System](./docs/DESIGN_SYSTEM.md)** - UI/UX guidelines complets (glassmorphism, composants, animations)

### Guides Pratiques
- **[Usage](./docs/USAGE.md)** - Guide utilisateur
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Résolution problèmes communs
- **[Tests MVP](./docs/MVP_TESTING.md)** - Tests et validation

### Documentation Projet
- **[README](./docs/README.md)** - Index documentation
- **[Refactoring Stripe](./docs/STRIPE_REFACTORING.md)** - Notes refactoring système paiements

---

## 🔧 Environnements de Développement

**Ce projet utilise un workflow Git 3-branches :**

### Structure des Branches

| Branche | Rôle | Tag | Merge vers |
|---------|------|-----|------------|
| `main` | Production stable | v1.2.3 | - |
| `release` | Testing/Staging | v1.2.3-rc | `main` (via PR) |
| `dev` | Développement actif | - | `release` (via PR) |

### Dossier DÉVELOPPEMENT (`~/Documents/FitMyCV-DEV/`)
- **Branche** : `dev` (branche de développement actif)
- **Base de données** : SQLite `dev.db`
- **Port** : `3001` (développement)
- **Usage** : Développement quotidien, features, bugs, improvements

### Dossier PRODUCTION (optionnel : `~/Documents/cv-site/`)
- **Branche** : `main` uniquement (lecture seule, pull only)
- **Base de données** : PostgreSQL `fitmycv_prod`
- **Port** : `3000` (production)
- **Usage** : Production uniquement, jamais de développement

### Workflow Git

```bash
# 1. Développement d'une feature (dans FitMyCV-DEV/)
cd ~/Documents/FitMyCV-DEV
git checkout dev
git pull origin dev
git checkout -b feature/nom-feature
# ... développement, commits ...
git push origin feature/nom-feature

# 2. PR feature → dev
gh pr create --base dev --head feature/nom-feature --title "feat: Description"
# Après merge, supprimer la branche feature

# 3. Quand prêt pour release : PR dev → release (tag -rc)
gh pr create --base release --head dev --title "Release v1.x.x-rc"
# Après merge:
git checkout release
git pull origin release
git tag -a v1.x.x-rc -m "Release Candidate v1.x.x for testing"
git push origin v1.x.x-rc

# 4. Tests sur release (validation fonctionnelle)
npm run dev  # Tester sur branche release
npm run build && npm start  # Tester en mode production

# 5. Après validation : PR release → main (tag final)
gh pr create --base main --head release --title "Production Release v1.x.x"
# Après merge:
git checkout main
git pull origin main
git tag -a v1.x.x -m "Production release v1.x.x"
git push origin v1.x.x

# 6. Déploiement production (dans cv-site/ si utilisé)
cd ~/Documents/cv-site
git checkout main
git pull origin main
npm run build
npm start
```

### Workflow Hotfix (urgence production)

```bash
# 1. Créer hotfix depuis main
git checkout main
git pull origin main
git checkout -b hotfix/nom-critique

# 2. Fix + test rapide
# ... corrections ...
git commit -m "hotfix: Description critique"
git push origin hotfix/nom-critique

# 3. Merger dans main (production)
git checkout main
git merge hotfix/nom-critique --no-ff
git tag -a v1.x.y -m "Hotfix v1.x.y"
git push origin main --tags

# 4. Backport dans release (éviter régression)
git checkout release
git merge hotfix/nom-critique --no-ff
git push origin release

# 5. Backport dans dev (éviter régression)
git checkout dev
git merge hotfix/nom-critique --no-ff
git push origin dev

# 6. Supprimer branche hotfix
git branch -d hotfix/nom-critique
git push origin --delete hotfix/nom-critique
```

---

## ⚡ Quick Start

### Ports de développement
- **Dev** (`cv-site-dev/`): `3001` (npm run dev) - SQLite
- **Prod** (`cv-site/`): `3000` (npm start) - PostgreSQL

### Commandes essentielles

```bash
# Développement
npm run dev                      # Serveur développement (port 3001)
npm run build                    # Build production
npm start                        # Serveur production (port 3000)

# Database
npx prisma migrate deploy        # Appliquer migrations
npx prisma generate              # Générer client Prisma
npx prisma studio                # Interface DB graphique

# Stripe (terminal séparé)
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

→ **[Toutes les commandes](./docs/COMMANDS_REFERENCE.md)**

### Variables d'environnement critiques

**Pour DÉVELOPPEMENT** (`cv-site-dev/.env`) :
```bash
DATABASE_URL="file:./dev.db"                    # SQLite (relatif à prisma/)
NODE_ENV=development
PORT=3001
CV_ENCRYPTION_KEY="..."                         # openssl rand -base64 32
CV_BASE_DIR="data/users"                        # Chemin vers dossier users (relatif ou absolu)
NEXTAUTH_SECRET="..."                           # openssl rand -base64 32
OPENAI_API_KEY="sk-..."                         # OpenAI API
STRIPE_SECRET_KEY="sk_test_..."                 # Stripe API (test mode)
NEXT_PUBLIC_SITE_URL="http://localhost:3001"   # URL publique
```

**Important DATABASE_URL** :
- **Dev (SQLite)** : Le chemin est TOUJOURS `file:./dev.db` (relatif au dossier `prisma/`)
  - ❌ **Incorrect** : `file:./prisma/dev.db`
  - ✅ **Correct** : `file:./dev.db`
- **Prod (PostgreSQL)** : Format PostgreSQL standard avec credentials
  - ✅ `postgresql://user:password@host:port/database?schema=public`

→ **[Toutes les variables](./docs/ENVIRONMENT_VARIABLES.md)**

---

## 🏗️ Architecture (Quick Reference)

### Stack
- **Frontend**: React 18 + Tailwind CSS (glassmorphism design)
- **Backend**: Next.js 14 (App Router) + API Routes
- **Database**:
  - **Dev** (`cv-site-dev/`) : Prisma + SQLite `dev.db`
  - **Prod** (`cv-site/`) : Prisma + PostgreSQL `fitmycv_prod`
- **IA**: OpenAI API (génération, match score, optimisation ATS)
- **Paiements**: Stripe (abonnements + packs crédits)
- **Sécurité**: CV chiffrés AES-256-GCM côté serveur

**⚠️ Important Prisma Schema :**
- Le fichier `prisma/schema.prisma` dans `cv-site/` (prod) utilise `provider = "postgresql"`
- Le fichier `prisma/schema.prisma` dans `cv-site-dev/` (dev) peut utiliser `provider = "postgresql"` **car Prisma utilise automatiquement la DATABASE_URL** du `.env`
- Pas besoin de modifier le provider entre dev et prod, seule la `DATABASE_URL` change

### Systèmes clés

| Système | Description | Documentation |
|---------|-------------|---------------|
| **CV chiffrés** | AES-256-GCM avec IV de 12 bytes | [SECURITY.md](./docs/SECURITY.md) |
| **Job queue** | 3 jobs concurrents max (génération, import, traduction) | [ARCHITECTURE.md](./docs/ARCHITECTURE.md#background-tasks) |
| **Abonnements** | Hybride : plans mensuels + micro-transactions (crédits) | [SUBSCRIPTION.md](./docs/SUBSCRIPTION.md) |
| **Dashboard admin** | Analytics, monitoring, gestion users/plans | [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) |
| **IA OpenAI** | Génération CV, match score, optimisation ATS | [AI_INTEGRATION.md](./docs/AI_INTEGRATION.md) |

### Structure de données

- **Database schema** : [DATABASE.md](./docs/DATABASE.md)
- **CV JSON structure** : [ARCHITECTURE.md - Structure CV](./docs/ARCHITECTURE.md#structure-des-données-cv)
- **API Routes** : [API_REFERENCE.md](./docs/API_REFERENCE.md)
- **Composants React** : [COMPONENTS.md](./docs/COMPONENTS.md)

---

## 🎨 Design System (Quick Reference)

**Approche** : Glassmorphism + Deep dark blue background (`rgb(2, 6, 23)`) + Emerald primary color

### Couleurs principales
```css
/* Primary */
emerald-500: #10B981    /* Boutons primaires, focus states */
emerald-400: #34D399    /* Éléments interactifs */

/* Secondary */
sky-500: #0EA5E9        /* Actions secondaires */

/* Background */
--bg-base: rgb(2, 6, 23)  /* Deep dark blue */
```

### Patterns de base

```jsx
/* Glass card standard */
<div className="bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30" />

/* Glass input */
<input className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg" />

/* Button primary */
<button className="bg-emerald-500 hover:bg-emerald-600 rounded-lg px-4 py-2 text-white" />
```

### Responsive & iOS

- **Breakpoint** : `md:` = `991px` (mobile-first approach)
- **Safe areas** : `env(safe-area-inset-top)` pour notch iOS
- **Touch targets** : Minimum 32px hauteur/largeur
- **iOS blur optimization** : `.ios-blur-medium` pour performance

### Background System

- **Composant** : `GlobalBackground.jsx` (appliqué globalement)
- **Couleur base** : `rgb(2, 6, 23)` → Utiliser classe Tailwind `bg-app-bg`
- **Blobs animés** : 3 blobs Framer Motion (sky-500 dominance + emerald-500)
- **Position** : `fixed inset-0 z-0` (couvre tout le viewport)
- **Unified** : Même background pour `/auth` et toutes les pages
- **Animation** : Framer Motion avec trajectoires mathématiques (sin/cos)
  - Mouvements amples : ±200px horizontal, ±180px vertical
  - Tailles responsives : 40-60% de `window.innerHeight`
  - Durées : 25-31s (non synchronisées)
  - 6 keyframes pour fluidité maximale
  - GPU-accelerated (`willChange`)

```jsx
// Background unifié (préféré)
<div className="bg-app-bg">...</div>

// Ou valeur directe si nécessaire
<div className="bg-[rgb(2,6,23)]">...</div>
```

### Z-Index Layering

```css
z-0:       Background (GlobalBackground)
z-10:      Main content
z-[10001]: TopBar, Notification backdrop
z-[10002]: Dropdown menus, User menu
z-[10003]: Notifications, Custom selects
z-[10004]: Tooltips
```

→ **[Design System complet](./docs/DESIGN_SYSTEM.md)**

---

## 💻 Patterns de Code Courants

### 1. Résolution de chemins utilisateurs

```javascript
import { resolveCvBaseDir, getUserCvPath, getUserRootPath } from '@/lib/utils/paths';

// Résoudre CV_BASE_DIR (supporte chemins absolus et relatifs)
const baseDir = resolveCvBaseDir();
// -> /mnt/DATA/PROD/users (si absolu) ou /home/.../cv-site/data/users (si relatif)

// Chemin vers dossier CVs d'un utilisateur
const cvPath = getUserCvPath(userId);
// -> /mnt/DATA/PROD/users/{userId}/cvs

// Chemin vers dossier racine d'un utilisateur
const rootPath = getUserRootPath(userId);
// -> /mnt/DATA/PROD/users/{userId}
```

### 2. Accès CV chiffrés

```javascript
import { readCv, writeCv } from '@/lib/cv/storage';

// Déchiffre automatiquement
const cvData = await readCv(userId, filename);

// Chiffre automatiquement
await writeCv(userId, filename, cvData);
```

### 3. Enqueuer un job

```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runGenerateCvJob } from '@/lib/backgroundTasks/generateCvJob';

enqueueJob(() => runGenerateCvJob(task));
```

### 3. Vérifier limites features

```javascript
import { checkFeatureLimit } from '@/lib/subscription/featureUsage';

const { allowed, needsCredit } = await checkFeatureLimit(
  userId,
  'gpt_cv_generation',
  { analysisLevel: 'medium' }
);

if (!allowed) {
  // Proposer upgrade ou utilisation crédit
}
```

### 4. Session utilisateur

```javascript
import { getSession } from '@/lib/auth/session';

const session = await getSession();
const userId = session?.user?.id;
```

### 5. Vérification reCAPTCHA

```javascript
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';

// Vérifier token reCAPTCHA
const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
  callerName: 'import-pdf',
  scoreThreshold: 0.5,
});

if (!recaptchaResult.success) {
  return NextResponse.json({ error: recaptchaResult.error }, { status: 403 });
}

// Bypass en développement : ajouter BYPASS_RECAPTCHA=true dans .env
```

**Routes protégées par reCAPTCHA** (10 au total) :
- `app/api/auth/register` - Création compte
- `app/api/auth/request-reset` - Demande reset password
- `app/api/auth/resend-verification` - Renvoi email vérification
- `app/api/background-tasks/import-pdf` - Import CV PDF
- `app/api/background-tasks/generate-cv` - Génération CV avec IA
- `app/api/background-tasks/create-template-cv` - Création CV template
- `app/api/background-tasks/translate-cv` - Traduction CV
- `app/api/background-tasks/calculate-match-score` - Score match
- `app/api/background-tasks/generate-cv-from-job-title` - Génération depuis job title
- `app/api/cvs/create` - Création CV manuelle

### 6. Prévention scroll chaining (dropdowns)

```javascript
useEffect(() => {
  if (!isOpen) return;
  const scrollY = window.scrollY;

  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';

  return () => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  };
}, [isOpen]);
```

### 7. Système d'onboarding (Constantes & Logger)

```javascript
// Utiliser les constantes centralisées (9 timings disponibles)
import { ONBOARDING_TIMINGS } from '@/lib/onboarding/onboardingConfig';

const delay = ONBOARDING_TIMINGS.STEP_TRANSITION_DELAY; // 2000ms
const polling = ONBOARDING_TIMINGS.BUTTON_POLLING_INTERVAL; // 200ms
const timeout = ONBOARDING_TIMINGS.BUTTON_POLLING_TIMEOUT; // 10000ms

// Utiliser le logger conditionnel (dev only pour logs, always pour errors/warnings)
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

onboardingLogger.log('[Component] Info message');     // Dev only
onboardingLogger.error('[Component] Error:', error);  // Always shown
onboardingLogger.warn('[Component] Warning');         // Always shown
```

**Fichiers de référence** :
- Configuration : `lib/onboarding/onboardingConfig.js`
- Logger : `lib/utils/onboardingLogger.js`
- Documentation : [docs/ONBOARDING_TIMINGS.md](./docs/ONBOARDING_TIMINGS.md)

**Règles** :
- ❌ **Ne pas utiliser** : `console.log`, `console.error` directement dans les composants d'onboarding
- ✅ **Toujours utiliser** : `onboardingLogger.*` pour une console propre en production

→ **[Tous les patterns](./docs/CODE_PATTERNS.md)**

---

## 🧪 Tests & Debug

### Compte de test

Pour les tests automatisés (MCP Puppeteer, scripts) :

```
Email: tests@claude.com
Password: qwertyuiOP93300
```

**Note** : Environnement de développement privé. En production, utiliser des variables d'environnement sécurisées.

### Troubleshooting

- **Erreur Prisma** : `npx prisma generate && npx prisma migrate deploy`
- **Port occupé** : `lsof -i :3001` puis `kill -9 <PID>`
- **Stripe webhooks** : Vérifier `stripe listen` en cours
- **Build échoue** : Vérifier imports, types TypeScript, variables env

→ **[Guide dépannage complet](./docs/TROUBLESHOOTING.md)**

---

## 📜 Project Rules (IMPORTANT pour Claude Code)

### Workflow Git

**Règles générales :**
- ❌ **Ne merge JAMAIS sans demande explicite** (utiliser `--no-ff`)
- ❌ **Ne commit JAMAIS sans demande explicite**
- ❌ **Ne commit JAMAIS sans code review préalable** - Toujours utiliser l'agent code-review-expert AVANT de créer un commit
- ❌ **Ne push JAMAIS sans demande explicite**
- ✅ **Toujours créer des PRs** pour dev→release et release→main
- ✅ **Taguer les versions** : -rc sur release, final sur main

**Structure 3-branches :**

| Branche | Base | Merge vers | Tag | PR requis |
|---------|------|------------|-----|-----------|
| `main` | - | - | v1.2.3 | - |
| `release` | main | main | v1.2.3-rc | ✅ Oui |
| `dev` | release | release | - | ✅ Oui |
| `feature/*` | dev | dev | - | ✅ Oui |
| `improvement/*` | dev | dev | - | ✅ Oui |
| `bug/*` | dev | dev | - | ✅ Oui |
| `hotfix/*` | main | main+release+dev | v1.2.y | ❌ Non (urgence) |

**Nomenclature branches :**
- ✅ **Feature** : `feature/name_of_the_feature` (part de dev)
- ✅ **Amélioration** : `improvement/name_of_the_feature` (part de dev)
- ✅ **Bug** : `bug/name_of_the_feature` (part de dev)
- ✅ **Hotfix** : `hotfix/name_of_the_feature` (part de main, merge dans 3 branches)

**Workflow visuel :**
```
Feature  ───┐ ┌───┐ ┌───     (branches de dev)
         ╲ ╱ ╲ ╱ ╱
Dev      ──○───○───○───     (PR vers release)
          ╱         ╲
Release  ─────────────○──    (tag -rc, PR vers main)
        ╱              ╲
Main   ○────────────────○    (tag final)

Hotfix: main → merge dans (main + release + dev)
```

### Commits

- ❌ **Jamais de "🤖 Generated with"** ou mention de Claude Code
- ✅ **Vérifier et mettre à jour docs/** avant commit
- ✅ **Exécuter `npm run build`** après changement code

### Développement

- ✅ **npm run dev utilise port 3001**
- ✅ **DATABASE_URL toujours `file:./dev.db`** (relatif à prisma/)
- ✅ **Mettre à jour la documentation dans le dossier `docs/` et `CLAUDE.md`** Apres chaque modification de la codebase, vérifier la documentation et documenter la modification. Puis tenir à jour le fichier CLAUDE.md

### Documentation

Pour toute question sur :

| Sujet | Documentation |
|-------|---------------|
| Installation | [INSTALLATION.md](./docs/INSTALLATION.md) |
| Architecture | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| API | [API_REFERENCE.md](./docs/API_REFERENCE.md) |
| Stripe | [STRIPE_SETUP.md](./docs/STRIPE_SETUP.md) |
| Admin | [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) |
| Télémétrie | [TELEMETRY.md](./docs/TELEMETRY.md) |
| Variables env | [ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) |
| Commandes | [COMMANDS_REFERENCE.md](./docs/COMMANDS_REFERENCE.md) |
| Patterns code | [CODE_PATTERNS.md](./docs/CODE_PATTERNS.md) |
| Design System | [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) |
| Troubleshooting | [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) |

---

## 🔗 Index Documentation

### Core Documentation (Must Read)
1. [README](./docs/README.md) - Index général
2. [ARCHITECTURE](./docs/ARCHITECTURE.md) - Architecture système
3. [DEVELOPMENT](./docs/DEVELOPMENT.md) - Guide développement
4. [API_REFERENCE](./docs/API_REFERENCE.md) - Référence API

### Setup & Configuration
5. [INSTALLATION](./docs/INSTALLATION.md) - Installation initiale
6. [ENVIRONMENT_VARIABLES](./docs/ENVIRONMENT_VARIABLES.md) - Variables env
7. [STRIPE_SETUP](./docs/STRIPE_SETUP.md) - Configuration Stripe
8. [DEPLOYMENT](./docs/DEPLOYMENT.md) - Déploiement production
9. [CRON_SETUP](./docs/CRON_SETUP.md) - Tâches planifiées

### Technical Deep Dives
10. [DATABASE](./docs/DATABASE.md) - Schéma, migrations
11. [AI_INTEGRATION](./docs/AI_INTEGRATION.md) - OpenAI intégration
12. [SUBSCRIPTION](./docs/SUBSCRIPTION.md) - Système abonnements
13. [SECURITY](./docs/SECURITY.md) - Sécurité, chiffrement
14. [COMPONENTS](./docs/COMPONENTS.md) - Structure composants
15. [FEATURES](./docs/FEATURES.md) - Fonctionnalités détaillées

### Guides & References
16. [COMMANDS_REFERENCE](./docs/COMMANDS_REFERENCE.md) - Toutes les commandes
17. [CODE_PATTERNS](./docs/CODE_PATTERNS.md) - Patterns réutilisables
18. [DESIGN_SYSTEM](./docs/DESIGN_SYSTEM.md) - UI/UX guidelines
19. [ADMIN_GUIDE](./docs/ADMIN_GUIDE.md) - Dashboard admin
20. [TELEMETRY](./docs/TELEMETRY.md) - Système télémétrie
21. [MCP_PUPPETEER](./docs/MCP_PUPPETEER.md) - Browser automation

### Practical Guides
22. [USAGE](./docs/USAGE.md) - Guide utilisateur
23. [TROUBLESHOOTING](./docs/TROUBLESHOOTING.md) - Résolution problèmes
24. [MVP_TESTING](./docs/MVP_TESTING.md) - Tests et validation
25. [STRIPE_REFACTORING](./docs/STRIPE_REFACTORING.md) - Notes refactoring

---

**📝 Note** : Ce fichier est un **quick reference**. Pour toute information détaillée, consulter la **[documentation complète dans docs/](./docs/README.md)**.
- Ne pas lire le fichier .env, chercher un fichier env.txt à la place (copie accéssible) ou demander à l'utilisateur de copier coller le contenu du .env sinon.
- A chaque demande de commit, de PR, de merge etc... ne pas lancer les stop hooks
