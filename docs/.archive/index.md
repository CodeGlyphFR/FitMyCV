# Documentation Projet - FitMyCV.io

> Index maître généré le 2026-01-07 par scan exhaustif BMAD
> **Point d'entrée principal pour le développement assisté par IA**

---

## Informations Projet

| Attribut | Valeur |
|----------|--------|
| **Nom** | FitMyCV.io |
| **Version** | 1.0.9.2 |
| **Type** | Application Web SaaS (Monolithe) |
| **Framework** | Next.js 14 (App Router) |
| **Langage** | JavaScript (React 18) |
| **Base de données** | PostgreSQL via Prisma 6 |

---

## Référence Rapide

### Stack Technologique
- **Frontend** : React 18, Tailwind CSS, Framer Motion
- **Backend** : Next.js API Routes (110 endpoints)
- **Database** : PostgreSQL (29 modèles Prisma)
- **Auth** : NextAuth.js JWT + OAuth (Google, GitHub, Apple)
- **AI** : OpenAI (GPT-4o, GPT-5 support)
- **Payments** : Stripe (abonnements + crédits)
- **Email** : SMTP OVH + Resend (fallback)

### Points d'Entrée
- **Page principale** : `app/page.jsx`
- **Layout racine** : `app/layout.jsx`
- **API** : `app/api/*/route.js`
- **DB Client** : `lib/prisma.js`

### Commandes Essentielles
```bash
npm run dev              # Dev server (port 3001)
npm run build            # Build production
npx prisma migrate deploy  # Migrations
npx prisma studio        # DB GUI
```

---

## Documentation Générée

### Architecture & Vue d'Ensemble
- [Vue d'Ensemble du Projet](./project-overview.md) - Description, stack, statistiques
- [Architecture Technique](./architecture.md) - Patterns, flux de données, sécurité
- [Arborescence Source](./source-tree-analysis.md) - Structure fichiers annotée

### Référence Technique
- [Référence API](./api-reference.md) - 110 endpoints documentés
- [Modèles de Données](./data-models.md) - 29 modèles Prisma, relations
- [Inventaire Composants](./component-inventory.md) - 149 composants React

### Guides
- [Guide de Développement](./development-guide.md) - Setup, patterns, workflow

---

## Documentation Existante

> Note : Ces documents peuvent contenir des informations obsolètes. Préférer la documentation générée ci-dessus.

### Guides Techniques
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture système (ancienne version)
- [API_REFERENCE.md](./API_REFERENCE.md) - Référence API (ancienne version)
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Patterns de code réutilisables
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Workflow Git, standards

### Guides Fonctionnels
- [SUBSCRIPTION.md](./SUBSCRIPTION.md) - Plans, crédits, limites features
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - UI/UX guidelines, Tailwind

### Onboarding
- [docs/onboarding/](./onboarding/) - Documentation système onboarding

### Prompts IA
- `lib/openai/prompts/` - Templates prompts OpenAI

---

## Démarrage Rapide

### 1. Installation
```bash
git clone <repository>
cd FitMyCV-DEV
npm install
```

### 2. Configuration
```bash
cp .env.example .env
# Configurer : DATABASE_URL, OPENAI_API_KEY, NEXTAUTH_SECRET, etc.
```

### 3. Base de données
```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

### 4. Lancement
```bash
npm run dev
# → http://localhost:3001
```

---

## Statistiques du Code

| Catégorie | Quantité |
|-----------|----------|
| Routes API | 110 |
| Composants React | 149 |
| Modèles Prisma | 29 |
| Modules lib/ | 8 principaux |
| Migrations DB | 14 |
| Langues i18n | 4 (FR, EN, DE, ES) |

---

## Structure Clé

```
FitMyCV-DEV/
├── app/                    # Next.js App Router
│   ├── api/               # 110 API Routes
│   ├── auth/              # Pages authentification
│   ├── admin/             # Dashboard admin
│   └── account/           # Paramètres utilisateur
├── components/            # 149 Composants React
│   ├── TopBar/           # Navigation (9 hooks, 6 modals)
│   ├── onboarding/       # 8 composants onboarding
│   └── subscription/     # 12 composants abonnement
├── lib/                   # Logique métier
│   ├── auth/             # NextAuth config
│   ├── cv/               # Stockage CV (PostgreSQL)
│   ├── openai/           # Intégration IA
│   └── subscription/     # Monétisation
├── prisma/               # Schema (29 modèles)
└── locales/              # 4 langues × 9 fichiers
```

---

## Informations de Génération

| Attribut | Valeur |
|----------|--------|
| **Mode** | initial_scan |
| **Niveau de scan** | exhaustive |
| **Date** | 2026-01-07 |
| **Fichier d'état** | [project-scan-report.json](./project-scan-report.json) |

---

## Utilisation avec IA

Ce document et la documentation générée sont optimisés pour le développement assisté par IA :

1. **Pour comprendre le projet** → Commencer par [Vue d'Ensemble](./project-overview.md)
2. **Pour modifier l'API** → Consulter [Référence API](./api-reference.md)
3. **Pour ajouter un composant** → Voir [Inventaire Composants](./component-inventory.md)
4. **Pour modifier la DB** → Consulter [Modèles de Données](./data-models.md)
5. **Pour comprendre l'architecture** → Lire [Architecture](./architecture.md)

### Fichier Claude Code
Voir également `CLAUDE.md` à la racine pour les instructions spécifiques à Claude Code.
