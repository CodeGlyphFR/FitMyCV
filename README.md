# FitMyCV.io

> Application SaaS de génération de CV optimisés par IA

**Version:** 1.0.13.0

---

## À propos

FitMyCV.io permet de créer des CV personnalisés et optimisés pour des offres d'emploi spécifiques grâce à l'intelligence artificielle.

### Fonctionnalités

- **Génération CV par IA** - Adapte un CV existant à une offre d'emploi (URL ou PDF)
- **Import PDF** - Conversion de CV existants en format structuré
- **Export PDF/DOCX** - Export professionnel avec personnalisation
- **Match Score** - Analyse de correspondance CV/offre avec suggestions
- **Optimisation IA** - Amélioration automatique du CV
- **Multi-langues** - Français, Anglais, Allemand, Espagnol
- **Abonnements** - Plans avec crédits via Stripe

---

## Quick Start

```bash
# Installation
npm install
cp .env.example .env
# Éditer .env avec vos clés

# Base de données
npm run db:setup

# Lancer
npm run dev  # http://localhost:3001
```

---

## Stack Technique

| Catégorie | Technologies |
|-----------|--------------|
| Frontend | React 19, Next.js 16, Tailwind CSS 4 |
| Backend | Next.js API Routes, Prisma 6 |
| Database | PostgreSQL |
| IA | OpenAI API |
| Paiements | Stripe |
| Auth | NextAuth.js |

---

## Documentation

Toute la documentation est dans [`docs/`](./docs/) :

| Document | Description |
|----------|-------------|
| [index.md](./docs/index.md) | Index maître |
| [architecture.md](./docs/architecture.md) | Architecture technique |
| [api-reference.md](./docs/api-reference.md) | 113 endpoints API |
| [data-models.md](./docs/data-models.md) | 34 modèles Prisma |
| [components.md](./docs/components.md) | 138 composants React |
| [development.md](./docs/development.md) | Guide développement |

---

## Développement avec IA

Le fichier [`CLAUDE.md`](./CLAUDE.md) contient les instructions pour le développement assisté par IA (patterns, conventions, références).

---

## Licence

Propriétaire - Tous droits réservés
