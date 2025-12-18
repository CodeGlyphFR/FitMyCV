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

### Développement & Patterns
- **[Référence commandes](./docs/COMMANDS_REFERENCE.md)** - Toutes les commandes (Next.js, Prisma, Stripe, scripts)
- **[Patterns de code](./docs/CODE_PATTERNS.md)** - Exemples réutilisables (CV, job queue, Stripe, limites, Email, OAuth)
- **[Design System](./docs/DESIGN_SYSTEM.md)** - UI/UX guidelines complets (glassmorphism, composants, animations)

### Guides Pratiques
- **[Usage](./docs/USAGE.md)** - Guide utilisateur
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Résolution problèmes communs
- **[Tests MVP](./docs/MVP_TESTING.md)** - Tests et validation
- **[Ajouter une langue](./docs/ADDING_LANGUAGE.md)** - Guide pour intégrer une nouvelle langue

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
- **Base de données** : PostgreSQL `fitmycv_dev`
- **user** : `erickdesmet`
- **Port** : `3001` (développement)
- **Usage** : Développement quotidien, features, bugs, improvements

### Dossier PRODUCTION (optionnel : `~/FitMyCV/`)
- **Base de données** : PostgreSQL `fitmycv_prod`
- **user** : `erickdesmet`
- **Port** : `3000` (production)
- **Usage** : Production uniquement, jamais de développement

## ⚡ Quick Start

### Ports de développement
- **Dev**: `3001` (npm run dev) - PostgreSQL `fitmycv_dev`

### Commandes essentielles
→ **[Toutes les commandes](./docs/COMMANDS_REFERENCE.md)**

---

## 🏗️ Architecture (Quick Reference)

### Stack
- **Frontend**: React 18 + Tailwind CSS (glassmorphism design)
- **Backend**: Next.js 14 (App Router) + API Routes
- **Database**:
  - **Dev** : Prisma + PostgreSQL `fitmycv_dev`
  - **Prod** : Prisma + PostgreSQL `fitmycv_prod`
- **i18n**: 4 langues (FR, EN, ES, DE), 9 catégories de traductions
- **IA**: OpenAI API (génération, match score, optimisation ATS)
- **Paiements**: Stripe (abonnements + packs crédits)
- **Stockage CV**: PostgreSQL natif (JSON) avec versioning

### Systèmes clés

| Système | Description | Documentation |
|---------|-------------|---------------|
| **Stockage CV** | PostgreSQL natif (CvFile.content) + versioning (CvVersion) | [DATABASE.md](./docs/DATABASE.md#4-cvfile) |
| **JobOffer** | Extraction structurée des offres (JSON) + réutilisation | [DATABASE.md](./docs/DATABASE.md#3-joboffer) |
| **Job queue** | 3 jobs concurrents max (génération, import, traduction) | [ARCHITECTURE.md](./docs/ARCHITECTURE.md#background-tasks) |
| **Abonnements** | Hybride : plans mensuels + micro-transactions (crédits) | [SUBSCRIPTION.md](./docs/SUBSCRIPTION.md) |
| **Dashboard admin** | Analytics, monitoring, gestion users/plans | [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) |
| **IA OpenAI** | Génération CV, match score, optimisation ATS | [AI_INTEGRATION.md](./docs/AI_INTEGRATION.md) |
| **i18n** | 4 langues (FR, EN, ES, DE), 9 catégories par langue | [ADDING_LANGUAGE.md](./docs/ADDING_LANGUAGE.md) |

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

## 📜 Project Rules (IMPORTANT pour Claude Code)

### Workflow Git

**Règles générales :**
- ❌ **Ne merge JAMAIS sans demande explicite** (utiliser `--no-ff`)
- ❌ **Ne commit JAMAIS sans demande explicite**
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

### Développement

- ✅ **npm run dev utilise port 3001**
- ✅ **PostgreSQL** : `fitmycv_dev` (dev) et `fitmycv_prod` (prod) sur même serveur
- ✅ **Mettre à jour la documentation dans le dossier `docs/` et `CLAUDE.md`** Apres chaque modification de la codebase, vérifier la documentation et documenter la modification. Puis tenir à jour le fichier CLAUDE.md

---

**📝 Note** : Ce fichier est un **quick reference**. Pour toute information détaillée, consulter la **[documentation complète dans docs/](./docs/README.md)**.
- Ne pas lire le fichier .env, demander à l'utilisateur de copier coller le contenu du .env
- Ne JAMAIS faire de db push ! UNIQUEMENT DES MIGRATIONS !!! Si une migration échoue, demande moi quoi faire !
