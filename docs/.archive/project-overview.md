# Vue d'Ensemble du Projet - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet

## Informations Générales

| Attribut | Valeur |
|----------|--------|
| **Nom du projet** | FitMyCV.io |
| **Version** | 1.0.9.2 |
| **Type** | Application Web SaaS |
| **Architecture** | Monolithe |
| **Framework** | Next.js 14 (App Router) |
| **Langage** | JavaScript (React 18) |

---

## Description

FitMyCV.io est une plateforme SaaS qui permet aux chercheurs d'emploi de créer des CV optimisés par intelligence artificielle. L'application analyse une offre d'emploi (URL ou PDF) et adapte automatiquement le CV de l'utilisateur pour maximiser la correspondance avec les exigences du poste.

### Fonctionnalités Principales

1. **Génération CV IA** - Analyse d'une offre d'emploi et adaptation automatique du CV
2. **Import PDF** - Extraction et conversion de CV existants en format éditable
3. **Optimisation IA** - Suggestions d'amélioration basées sur le score de correspondance
4. **Traduction** - Traduction automatique des CVs en 4 langues (FR, EN, DE, ES)
5. **Export PDF** - Génération de CVs professionnels au format PDF
6. **Versioning** - Historique des modifications avec possibilité de restauration
7. **Score de Correspondance** - Analyse détaillée de l'adéquation CV/offre

---

## Stack Technologique

### Frontend
| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 18.2.0 | UI Framework |
| Next.js | 14.2.35 | Framework Full-stack |
| Tailwind CSS | 3.4.4 | Styling |
| Framer Motion | 12.23.24 | Animations |
| Lucide React | 0.544.0 | Icônes |
| Recharts | 3.3.0 | Graphiques |

### Backend
| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js API Routes | 14.2.35 | API REST (110 endpoints) |
| Prisma | 6.16.2 | ORM |
| PostgreSQL | 14+ | Base de données |
| NextAuth.js | 4.24.11 | Authentification |

### Services Externes
| Service | Usage |
|---------|-------|
| OpenAI | Génération et analyse IA (GPT-4o, GPT-5) |
| Stripe | Paiements (abonnements + crédits) |
| SMTP (OVH) + Resend | Email avec fallback |
| Google reCAPTCHA v3 | Protection anti-bots |

### Outils
| Outil | Usage |
|-------|-------|
| Puppeteer | Scraping web + génération PDF |
| pdf2json / pdf2pic | Extraction PDF |
| Maily.to | Templates email |

---

## Architecture Résumée

```
┌───────────────────────────────────────────┐
│           Client (Browser)                 │
│  React Components + 7 Context Providers   │
└─────────────────┬─────────────────────────┘
                  │ HTTP / SSE
                  ▼
┌───────────────────────────────────────────┐
│           Next.js Server                   │
│  ┌─────────┐  ┌──────────────────────┐    │
│  │  Pages  │  │  110 API Routes      │    │
│  │ (App    │  │  /auth /cvs /admin   │    │
│  │ Router) │  │  /subscription ...   │    │
│  └────┬────┘  └──────────┬───────────┘    │
│       │                  │                 │
│  ┌────▼──────────────────▼────────────┐   │
│  │         Core Libraries (lib/)       │   │
│  │  auth, cv, openai, subscription,   │   │
│  │  email, backgroundTasks, telemetry │   │
│  └─────────────────┬──────────────────┘   │
└────────────────────│──────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   PostgreSQL     OpenAI      Stripe
   (Prisma)       API         API
```

---

## Statistiques du Code

| Catégorie | Quantité |
|-----------|----------|
| **Routes API** | 110 endpoints |
| **Composants React** | 149 composants |
| **Modèles Prisma** | 29 tables |
| **Modules Core (lib/)** | 8 modules principaux |
| **Migrations DB** | 14 migrations |
| **Langues supportées** | 4 (FR, EN, DE, ES) |
| **Fichiers traduction/langue** | 9 fichiers |

---

## Monétisation

### Modèle Dual

L'application supporte deux modes de monétisation :

1. **Mode Abonnement** (par défaut)
   - Plans avec limites mensuelles par feature
   - Free, Basic, Pro, Enterprise
   - Possibilité d'acheter des crédits supplémentaires

2. **Mode Crédits Only**
   - Pas d'abonnement, tout à la carte
   - Bonus de bienvenue en crédits
   - Chaque action a un coût fixe en crédits

### Features Monétisées

| Feature | Description |
|---------|-------------|
| `gpt_cv_generation` | Génération CV depuis offre |
| `import_pdf` | Import de CV PDF |
| `translate_cv` | Traduction de CV |
| `optimize_cv` | Optimisation IA |
| `export_cv` | Export PDF |
| `create_cv_manual` | Création manuelle |

---

## Sécurité

- **Authentification** : NextAuth.js avec JWT (7 jours) + OAuth (Google, GitHub, Apple)
- **Protection** : reCAPTCHA v3, rate limiting, sanitization XSS
- **Données** : Chiffrement TLS, tokens one-time, validation stricte

---

## Documentation Disponible

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | Architecture technique détaillée |
| [Guide Développement](./development-guide.md) | Setup et patterns de code |
| [Arborescence Source](./source-tree-analysis.md) | Structure des fichiers annotée |
| [Référence API](./api-reference.md) | 110 endpoints documentés |
| [Modèles Données](./data-models.md) | Schema Prisma complet |
| [Inventaire Composants](./component-inventory.md) | 149 composants React |

---

## Démarrage Rapide

### Prérequis
- Node.js 18+
- PostgreSQL 14+
- Comptes : OpenAI, Stripe, OAuth providers

### Installation
```bash
git clone <repository>
cd FitMyCV-DEV
npm install
cp .env.example .env  # Configurer les variables
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Application disponible sur **http://localhost:3001**

---

## Liens Utiles

- **CLAUDE.md** : Instructions pour Claude Code (IA assistante)
- **prisma/schema.prisma** : Définition complète de la base de données
- **lib/openai/prompts/** : Templates de prompts IA
