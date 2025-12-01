# Documentation FitMyCV.io

> **Application Next.js 14 pour la création de CV personnalisés optimisés par IA**

Version: **1.0.9.2**

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Documentation complète](#documentation-complète)
- [Démarrage rapide](#démarrage-rapide)
- [Architecture](#architecture)
- [Technologies](#technologies)
- [Contribuer](#contribuer)
- [Support](#support)

---

## Vue d'ensemble

FitMyCV.io est une application web moderne qui permet aux utilisateurs de créer des CV personnalisés et optimisés pour des offres d'emploi spécifiques grâce à l'intelligence artificielle.

### Fonctionnalités principales

- **Génération de CV par IA** : Création automatique de CV personnalisés à partir d'offres d'emploi (URL ou PDF)
- **Import PDF** : Conversion de CV PDF existants en format JSON structuré
- **Traduction automatique** : Traduction de CV dans différentes langues
- **Match Score** : Calcul du score de correspondance entre un CV et une offre d'emploi (0-100)
- **Optimisation CV** : Amélioration automatique basée sur les suggestions de l'IA
- **Export PDF** : Export professionnel des CV avec options personnalisables
- **Multi-utilisateurs** : Authentification complète avec NextAuth (credentials, Google, GitHub, Apple)
- **Dashboard Admin** : Gestion complète des utilisateurs, analytics, et monitoring OpenAI
- **RGPD compliant** : Gestion des cookies et consentements
- **Sécurité renforcée** : Chiffrement AES-256-GCM, rate limiting, CSP

---

## Documentation complète

La documentation est organisée en plusieurs fichiers thématiques :

### 📦 Installation & Configuration
- **[INSTALLATION.md](./INSTALLATION.md)** - Guide d'installation complet
  - Prérequis système
  - Installation pas à pas
  - Configuration environnement
  - Premiers pas

### 🏗️ Architecture & Développement
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture de l'application
  - Structure Next.js 14 (App Router)
  - Organisation des dossiers
  - Patterns et conventions
  - Diagrammes de flux

- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Guide de développement
  - Workflow de développement
  - Standards de code
  - Git branching strategy
  - Tests et debugging

### 🔌 API & Base de données
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Référence API complète
  - 60+ routes API documentées
  - Paramètres et réponses
  - Exemples de requêtes
  - Codes d'erreur

- **[DATABASE.md](./DATABASE.md)** - Documentation base de données
  - Schéma Prisma complet (23 modèles)
  - Relations entre tables
  - Migrations
  - Index et optimisations

### ⚛️ Composants & Fonctionnalités
- **[COMPONENTS.md](./COMPONENTS.md)** - Catalogue des composants
  - 89 composants React documentés
  - Props et usage
  - Composants réutilisables

- **[FEATURES.md](./FEATURES.md)** - Guide des fonctionnalités
  - Génération CV par IA
  - Import/Export PDF
  - Traduction
  - Match Score & Optimisation
  - Système de tâches background

### 🎓 Système d'onboarding
- **[onboarding/](./onboarding/)** - Documentation complète du système d'onboarding interactif
  - **[README.md](./onboarding/README.md)** - Index + navigation + quick reference
  - **[ARCHITECTURE.md](./onboarding/ARCHITECTURE.md)** - Architecture système, composants, flow
  - **[WORKFLOW.md](./onboarding/WORKFLOW.md)** - Détail des 8 steps (objectifs, validation)
  - **[STATE_MANAGEMENT.md](./onboarding/STATE_MANAGEMENT.md)** - Structure onboardingState, helpers, SSE
  - **[COMPONENTS.md](./onboarding/COMPONENTS.md)** - Référence 8 composants + 4 hooks
  - **[API_REFERENCE.md](./onboarding/API_REFERENCE.md)** - Endpoints REST + SSE
  - **[TIMINGS.md](./onboarding/TIMINGS.md)** - Configuration délais
  - **[DEVELOPMENT_GUIDE.md](./onboarding/DEVELOPMENT_GUIDE.md)** - How-to: add step, debug, test
  - **[TROUBLESHOOTING.md](./onboarding/TROUBLESHOOTING.md)** - Bugs fixés, FAQ

### 💻 Références Développement
- **[COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md)** - Référence commandes complète
  - Commandes Next.js, Prisma, Stripe
  - Scripts de maintenance
  - Tâches CRON
  - Workflow quotidien

- **[CODE_PATTERNS.md](./CODE_PATTERNS.md)** - Patterns de code réutilisables
  - Accès CV chiffrés
  - Gestion job queue
  - Patterns Stripe & abonnements
  - Vérification limites features

- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** - Variables d'environnement
  - Configuration complète .env.local
  - Variables OpenAI, Stripe, NextAuth
  - Génération des secrets
  - Best practices sécurité

- **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** - Système de design complet
  - Philosophie glassmorphism
  - Palette de couleurs & gradients
  - Composants UI (buttons, cards, inputs, modals)
  - Animations & transitions
  - Responsive design & optimisations iOS
  - Accessibilité (WCAG, ARIA)

### 🤖 IA & Sécurité
- **[AI_INTEGRATION.md](./AI_INTEGRATION.md)** - Intégration OpenAI
  - Configuration des modèles
  - Stratégies de prompts
  - Gestion des coûts
  - Télémétrie OpenAI

- **[SECURITY.md](./SECURITY.md)** - Guide de sécurité
  - Chiffrement AES-256-GCM
  - Authentification & autorisation
  - Rate limiting
  - RGPD & cookies
  - Headers de sécurité

### 🔧 Administration & Déploiement
- **[ADMIN_GUIDE.md](./ADMIN_GUIDE.md)** - Dashboard admin
  - Gestion des utilisateurs
  - Analytics et télémétrie
  - Configuration settings
  - Monitoring OpenAI
  - Plans d'abonnement

- **[TELEMETRY.md](./TELEMETRY.md)** - Système de télémétrie
  - Session lifecycle (ACTIVE/PAUSED/ENDED)
  - Dashboard admin usage
  - API endpoints télémétrie
  - Testing procedures
  - Troubleshooting

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Guide de déploiement
  - Déploiement production
  - Variables d'environnement
  - Configuration serveur
  - Monitoring

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Résolution de problèmes
  - Problèmes courants
  - Erreurs Prisma
  - Debug OpenAI
  - Performance

---

## Démarrage rapide

```bash
# 1. Cloner le projet
git clone <repository-url>
cd fitmycv

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés API

# 4. Configurer la base de données
echo 'DATABASE_URL="file:./dev.db"' > prisma/.env
npx prisma migrate deploy
npx prisma generate

# 5. Générer la clé de chiffrement
openssl rand -base64 32
# Ajouter dans .env.local: CV_ENCRYPTION_KEY="..."

# 6. Lancer le serveur de développement
npm run dev
```

Application disponible sur : **http://localhost:3001**

Pour plus de détails, consultez [INSTALLATION.md](./INSTALLATION.md)

---

## Architecture

### Stack technique

- **Frontend**: React 18 + Next.js 14 (App Router)
- **Styling**: Tailwind CSS 3.4
- **Backend**: Next.js API Routes
- **Database**: Prisma 6 + SQLite (PostgreSQL/MySQL en production)
- **Authentication**: NextAuth.js 4
- **AI**: OpenAI API (GPT-5 models)
- **PDF**: Puppeteer + pdf2json
- **Security**: AES-256-GCM encryption, CSP, Rate limiting

### Structure des dossiers

```
fitmycv/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (60+ endpoints)
│   ├── auth/              # Pages authentification
│   ├── admin/             # Dashboard admin
│   └── account/           # Paramètres compte
├── components/            # Composants React (89 fichiers)
│   ├── ui/               # Composants UI réutilisables
│   ├── admin/            # Composants admin/analytics
│   ├── auth/             # Composants authentification
│   └── feedback/         # Système de feedback
├── lib/                  # Bibliothèques & utilitaires
│   ├── auth/            # NextAuth configuration
│   ├── cv/              # Gestion CV (crypto, storage, validation)
│   ├── openai/          # Intégration OpenAI + prompts
│   ├── backgroundTasks/ # Job queue & tâches async
│   ├── security/        # Sécurité & validation
│   └── analytics/       # Analytics & télémétrie
├── prisma/              # Schema & migrations Prisma
├── data/                # Données (schémas JSON, CVs chiffrés)
├── public/              # Assets statiques
└── docs/                # Documentation complète
```

Pour plus de détails, consultez [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Technologies

### Core
- **[Next.js 14](https://nextjs.org/)** - Framework React avec App Router
- **[React 18](https://react.dev/)** - Bibliothèque UI
- **[Prisma 6](https://www.prisma.io/)** - ORM moderne pour Node.js
- **[NextAuth.js 4](https://next-auth.js.org/)** - Authentification complète

### IA & Processing
- **[OpenAI API](https://platform.openai.com/)** - GPT-5 models pour génération de CV
- **[Puppeteer](https://pptr.dev/)** - Web scraping et export PDF
- **[pdf2json](https://www.npmjs.com/package/pdf2json)** - Parsing PDF

### UI & Styling
- **[Tailwind CSS](https://tailwindcss.com/)** - Framework CSS utility-first
- **[Recharts](https://recharts.org/)** - Graphiques React pour analytics
- **[Lucide React](https://lucide.dev/)** - Icônes modernes

### Security & Validation
- **[bcryptjs](https://www.npmjs.com/package/bcryptjs)** - Hashing mots de passe
- **[AJV](https://ajv.js.org/)** - Validation JSON Schema
- **[react-google-recaptcha-v3](https://www.npmjs.com/package/react-google-recaptcha-v3)** - Protection anti-spam

### Email
- **[Resend](https://resend.com/)** - Service d'envoi d'emails

---

## Contribuer

### Git Branching Strategy

Ce projet suit une **architecture 3-branches** avec PRs obligatoires :

| Branche | Rôle | Base | Tag |
|---------|------|------|-----|
| **`main`** | Production stable | - | v1.2.3 |
| **`release`** | Testing/Staging | `main` | v1.2.3-rc |
| **`dev`** | Développement actif | `release` | - |
| **`feature/*`** | Nouvelles fonctionnalités | `dev` | - |
| **`improvement/*`** | Améliorations existantes | `dev` | - |
| **`bug/*`** | Corrections bugs | `dev` | - |
| **`hotfix/*`** | Urgences production | `main` | v1.2.y |

**Exemples** :
- `feature/business-plan-management` (part de `dev`)
- `improvement/export-pdf-modal` (part de `dev`)
- `bug/match-score-calculation` (part de `dev`)
- `hotfix/security-xss` (part de `main`, merge dans les 3 branches)

### Workflow de Contribution

**Pour features/improvements/bugs** :

```bash
# 1. Créer une branche depuis dev
git checkout dev
git pull origin dev
git checkout -b feature/nom-feature

# 2. Développer et committer
git add .
git commit -m "feat: Description de la feature"
git push origin feature/nom-feature

# 3. Créer PR vers dev
gh pr create --base dev --head feature/nom-feature --title "feat: Description"
# Attendre review et merge via GitHub UI

# 4. Quand prêt pour release : PR dev → release (tag -rc)
gh pr create --base release --head dev --title "Release v1.x.x-rc"
# Après merge:
git checkout release && git pull origin release
git tag -a v1.x.x-rc -m "Release Candidate for testing"
git push origin v1.x.x-rc

# 5. Après validation : PR release → main (tag final)
gh pr create --base main --head release --title "Production Release v1.x.x"
# Après merge:
git checkout main && git pull origin main
git tag -a v1.x.x -m "Production release v1.x.x"
git push origin v1.x.x
```

**Workflow visuel** :
```
Feature  ───┐ ┌───┐ ┌───     (PR → dev)
         ╲ ╱ ╲ ╱ ╱
Dev      ──○───○───○───     (PR → release, tag -rc)
          ╱         ╲
Release  ─────────────○──    (PR → main, tag final)
        ╱              ╲
Main   ○────────────────○
```

**Notes importantes** :
- Les commits ne mentionnent **jamais** Claude Code ni génération automatique
- Toujours utiliser `--no-ff` pour préserver l'historique
- PRs obligatoires pour `dev→release` et `release→main`
- Tags : `-rc` sur release (testing), version finale sur main (production)

Pour plus de détails, consultez [DEVELOPMENT.md](./DEVELOPMENT.md)

---

## Support

### Documentation
- **Principale** : [docs/](./docs/)
- **API** : [API_REFERENCE.md](./API_REFERENCE.md)
- **Troubleshooting** : [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Ressources externes
- **Next.js Docs** : https://nextjs.org/docs
- **Prisma Docs** : https://www.prisma.io/docs
- **NextAuth Docs** : https://next-auth.js.org/getting-started/introduction
- **OpenAI API** : https://platform.openai.com/docs

### Commandes utiles

```bash
# Développement
npm run dev              # Serveur dev (port 3001)
npm run build            # Build production
npm start                # Serveur production (port 3000)

# Base de données
npx prisma migrate dev   # Créer migration dev
npx prisma migrate deploy # Appliquer migrations
npx prisma studio        # Interface graphique DB
npx prisma generate      # Générer client Prisma

# Utilitaires
npm run backfill:telemetry # Backfill données télémétrie
```

---

## Licence

Propriétaire - Tous droits réservés

---

**Développé avec Next.js 14 et OpenAI** | Version 1.0.9.2
