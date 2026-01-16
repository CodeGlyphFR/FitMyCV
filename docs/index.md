# Documentation Projet - FitMyCV.io

> Index maître généré le 2026-01-07 | Scan exhaustif BMAD v1.2.0
> **Point d'entrée principal pour le développement assisté par IA**

---

## Informations Projet

| Attribut | Valeur |
|----------|--------|
| **Nom** | FitMyCV.io |
| **Version** | 1.0.9.4 |
| **Type** | Application Web SaaS (Monolithe) |
| **Framework** | Next.js 14 (App Router) |
| **Langage** | JavaScript (React 18) |
| **Base de données** | PostgreSQL via Prisma 6 |

---

## Référence Rapide

### Stack Technologique

| Couche | Technologies |
|--------|--------------|
| **Frontend** | React 18, Tailwind CSS, Framer Motion |
| **Backend** | Next.js API Routes (127 endpoints) |
| **Database** | PostgreSQL (33 modèles Prisma) |
| **Auth** | NextAuth.js JWT + OAuth (Google, GitHub, Apple) |
| **AI** | OpenAI GPT-4o (Structured Outputs) |
| **Payments** | Stripe (abonnements + crédits) |
| **Email** | SMTP OVH + Resend (fallback) |
| **PDF** | Puppeteer + pdf2json |

### Points d'Entrée

| Fichier | Purpose |
|---------|---------|
| `app/page.jsx` | Page principale (CV Editor) |
| `app/layout.jsx` | Layout racine avec providers |
| `app/api/*` | 127 API Routes |
| `lib/prisma.js` | Client DB singleton |
| `middleware.js` | Auth, i18n, redirects |

### Commandes Essentielles

```bash
npm run dev              # Dev server (port 3001)
npm run build            # Build production
npm start                # Prod server (port 3000)
npx prisma migrate deploy  # Appliquer migrations
npx prisma studio        # DB GUI
npx prisma generate      # Régénérer client
```

---

## Documentation Générée

### Architecture & Vue d'Ensemble

| Document | Description |
|----------|-------------|
| [Architecture Technique](./architecture.md) | Patterns, flux de données, sécurité, scalabilité |
| [Référence API](./api-reference.md) | 127 endpoints documentés par domaine |
| [Modèles de Données](./data-models.md) | 33 modèles Prisma, relations, schéma |
| [Inventaire Composants](./components.md) | ~150 composants React catégorisés |
| [Guide de Développement](./development.md) | Setup, patterns, conventions, debugging |

---

## Statistiques du Code

| Catégorie | Quantité |
|-----------|----------|
| Routes API | 127 |
| Composants React | ~150 |
| Modèles Prisma | 33 |
| Modules lib/ | 25 |
| Migrations DB | 14+ |
| Langues i18n | 4 (FR, EN, DE, ES) |

---

## Structure Clé

```
FitMyCV-DEV/
├── app/                    # Next.js App Router
│   ├── api/               # 127 API Routes
│   │   ├── auth/         # Authentification (13 routes)
│   │   ├── cv/           # Opérations CV (8 routes)
│   │   ├── cvs/          # CRUD CVs (9 routes)
│   │   ├── admin/        # Administration (28 routes)
│   │   ├── subscription/ # Abonnements (10 routes)
│   │   └── ...
│   ├── auth/             # Pages auth
│   ├── admin/            # Dashboard admin
│   └── account/          # Paramètres compte
│
├── components/            # ~150 Composants React
│   ├── TopBar/           # Navigation (7 composants)
│   ├── ui/               # Design system (15 composants)
│   ├── admin/            # Dashboard (40+ composants)
│   ├── subscription/     # Abonnements (10 composants)
│   └── onboarding/       # Onboarding (8 composants)
│
├── lib/                   # Logique métier
│   ├── auth/             # NextAuth config
│   ├── cv/               # Gestion CVs (stockage DB)
│   ├── openai/           # Intégration IA
│   ├── subscription/     # Plans & crédits
│   ├── email/            # Service email
│   └── backgroundTasks/  # Queue de jobs (max 3)
│
├── prisma/               # Schema (33 modèles)
│   ├── schema.prisma
│   └── migrations/
│
└── locales/              # 4 langues × 9 fichiers
    ├── fr/
    ├── en/
    ├── de/
    └── es/
```

---

## Domaines Fonctionnels

### 1. Gestion des CVs

**Fichiers clés** : `lib/cv/`, `app/api/cv*/`, `components/` (sections CV)

- Stockage JSON en PostgreSQL (`CvFile.content`)
- Versioning avec historique (rollback)
- Validation JSON-Schema
- Détection automatique de langue

### 2. Génération IA

**Fichiers clés** : `lib/openai/`, `lib/backgroundTasks/`

- Génération CV depuis offre emploi (URL/PDF)
- Amélioration CV existant
- Traduction multi-langue
- Import PDF intelligent

### 3. Abonnements & Crédits

**Fichiers clés** : `lib/subscription/`, `app/api/subscription/`

- Plans : Free, Starter, Pro, Enterprise
- Compteurs mensuels par feature
- Système de crédits (achat/usage)
- Intégration Stripe

### 4. Administration

**Fichiers clés** : `app/admin/`, `components/admin/`, `app/api/admin/`

- Dashboard avec KPIs
- Gestion utilisateurs
- Configuration plans/crédits
- Templates email
- Monitoring OpenAI

### 5. Authentification

**Fichiers clés** : `lib/auth/`, `app/api/auth/`

- JWT avec refresh automatique
- OAuth : Google, GitHub, Apple
- Vérification email
- Reset password

---

## Utilisation avec IA

Cette documentation est optimisée pour le développement assisté par IA :

| Objectif | Document à consulter |
|----------|---------------------|
| Comprendre le projet | [Architecture](./architecture.md) |
| Modifier l'API | [Référence API](./api-reference.md) |
| Ajouter un composant | [Inventaire Composants](./components.md) |
| Modifier la DB | [Modèles de Données](./data-models.md) |
| Setup/Debug | [Guide Développement](./development.md) |

### Fichier Claude Code

Voir également `CLAUDE.md` à la racine pour les instructions spécifiques à Claude Code.

---

## Informations de Génération

| Attribut | Valeur |
|----------|--------|
| **Mode** | initial_scan |
| **Niveau de scan** | exhaustive |
| **Date** | 2026-01-07 |
| **Workflow** | BMAD document-project v1.2.0 |
| **Fichier d'état** | [project-scan-report.json](./project-scan-report.json) |

---

## Ancienne Documentation

Les fichiers de documentation précédents ont été archivés dans `.archive/` :
- 37 fichiers déplacés (obsolètes ou redondants)
- Consultables si besoin de référence historique

---

## Prochaines Étapes

1. **Développement** : Utiliser cette doc comme référence
2. **PRD Brownfield** : Pointer vers cet index pour le contexte
3. **Mise à jour** : Relancer le scan après changements majeurs

```bash
# Pour mettre à jour la documentation
/bmad:bmm:workflows:document-project
```
