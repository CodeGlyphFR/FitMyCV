# FitMyCV.io

> Application Next.js 14 pour la création de CV personnalisés optimisés par IA

**Version:** 1.0.9.2

---

## À propos

FitMyCV.io est une application web moderne qui permet aux utilisateurs de créer des CV personnalisés et optimisés pour des offres d'emploi spécifiques grâce à l'intelligence artificielle.

### Fonctionnalités principales

- **Génération de CV par IA** : Adapte un CV existant à une ou plusieurs offres d'emploi (URL ou PDF) - l'IA n'invente pas de compétences
- **CV Modèle** : Génération de CV fictifs pour inspiration (depuis offre ou titre de poste)
- **Import PDF** : Conversion de CV existants en format ATS unifié (DOCX prévu)
- **Export PDF** : Export professionnel avec customisation fine (sections, livrables clés au choix)
- **Traduction** : Français et Anglais
- **Match Score & Optimisation** : Analyse de correspondance avec suggestions et optimisation automatique
- **Historique de modifications** : Suivi des changements appliqués par l'optimisation IA
- **Multi-utilisateurs** : Authentification complète (credentials, Google, GitHub, Apple)
- **Dashboard Admin** : Analytics, monitoring, gestion utilisateurs

---

## Quick Start

```bash
# Installation
npm install
cp .env.example .env.local
# Éditer .env.local avec vos clés API

# Base de données
npx prisma migrate deploy && npx prisma generate

# Lancer le serveur
npm run dev  # http://localhost:3001
```

**Installation complète** : Voir [INSTALLATION.md](./docs/INSTALLATION.md) pour la configuration détaillée (clés de chiffrement, variables d'environnement, etc.)

---

## Stack Technique

- **Frontend**: React 18, Next.js 14 (App Router), Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **IA**: OpenAI API (génération, match score, optimisation ATS)
- **Paiements**: Stripe (abonnements + packs crédits)
- **Sécurité**: CV chiffrés AES-256-GCM, NextAuth.js, Rate limiting

---

## Documentation

**Toute la documentation technique est disponible dans le dossier [`docs/`](./docs/)**

### Guides essentiels

- **[Guide Installation](./docs/INSTALLATION.md)** - Setup complet avec prérequis
- **[Architecture](./docs/ARCHITECTURE.md)** - Vue d'ensemble système, background tasks
- **[Référence API](./docs/API_REFERENCE.md)** - 60+ endpoints documentés
- **[Guide Développement](./docs/DEVELOPMENT.md)** - Workflow développeur, best practices
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Résolution problèmes communs

### Documentation complète

- **[Index documentation](./docs/README.md)** - Point d'entrée complet (25+ guides)
- **[Référence commandes](./docs/COMMANDS_REFERENCE.md)** - Toutes les commandes (Next.js, Prisma, Stripe, scripts)

---

## Développement avec IA

Ce projet inclut une documentation complète pour le développement assisté par Claude Code AI.

**[CLAUDE.md](./CLAUDE.md)** contient :
- Patterns de code et exemples réutilisables
- Règles et conventions du projet
- Référence complète du design system
- Index détaillé de toute la documentation technique

---

## Support

- **Documentation**: [docs/](./docs/)
- **Troubleshooting**: [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- **Installation**: [INSTALLATION.md](./docs/INSTALLATION.md)

---

## Licence

Propriétaire - Tous droits réservés

---

**Développé avec Next.js 14 et OpenAI** | Version 1.0.9.2
