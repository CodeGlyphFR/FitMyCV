# Documentation FitMyCV.io

> Index maître de la documentation technique

---

## Informations Projet

| Propriété | Valeur |
|-----------|--------|
| **Nom** | FitMyCV.io |
| **Version** | 1.1.2.0 |
| **Type** | Application SaaS |
| **Framework** | Next.js 16.1.1 (App Router) |
| **Base de données** | PostgreSQL via Prisma 6 |
| **Langage** | JavaScript/JSX |

---

## Documents

### Architecture & Structure

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Architecture technique, patterns, flux de données |
| [source-tree.md](./source-tree.md) | Arborescence complète du projet avec annotations |

### Référence Technique

| Document | Description |
|----------|-------------|
| [api-reference.md](./api-reference.md) | 114 endpoints API (publics, authentifiés, admin) |
| [data-models.md](./data-models.md) | 34 modèles Prisma organisés par domaine |
| [components.md](./components.md) | 138 composants React en 20 domaines |

### Guide Développement

| Document | Description |
|----------|-------------|
| [development.md](./development.md) | Installation, commandes, workflow Git, patterns |

### Documentation HTML (Portfolio)

| Ressource | Description |
|-----------|-------------|
| [Documentation HTML](/api/admin/docs/index.html) | Documentation technique complète en HTML (accès admin uniquement) |

> **Note** : La documentation HTML est accessible uniquement aux administrateurs via l'API `/api/admin/docs/`.

---

## Statistiques Codebase

| Métrique | Valeur |
|----------|--------|
| API Routes | 114 endpoints |
| Composants React | 138 fichiers |
| Modules métier (lib/) | 31 modules |
| Modèles Prisma | 34 modèles |
| Langues supportées | 4 (fr, en, de, es) |

---

## Stack Technologique

### Frontend

| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 19.2.3 | UI Components |
| Next.js | 16.1.1 | Framework full-stack |
| Tailwind CSS | 4.1.18 | Styling |
| Framer Motion | 12.25.0 | Animations |
| Lucide React | 0.562.0 | Icônes |
| Recharts | 3.6.0 | Graphiques admin |

### Backend

| Technologie | Version | Usage |
|-------------|---------|-------|
| Prisma | 6.19.1 | ORM PostgreSQL |
| NextAuth.js | 4.24.13 | Authentification |
| OpenAI SDK | 6.16.0 | Intégration IA |
| Stripe | 20.1.2 | Paiements |
| Nodemailer | 7.0.12 | Emails SMTP |
| Resend | 6.7.0 | Emails (fallback) |
| Puppeteer | 24.34.0 | Export PDF, scraping |

---

## Domaines Fonctionnels

### Gestion CV

- Création, édition, suppression CV
- Import PDF avec extraction IA
- Versioning et restauration
- Export PDF/DOCX personnalisable

### Optimisation IA

- Extraction offres emploi (URL/PDF)
- Score de matching CV/offre
- Génération CV adaptés
- Suggestions d'amélioration

### Abonnements

- Plans Free/Basic/Pro
- Système de crédits
- Intégration Stripe complète
- Limites et compteurs par feature

### Administration

- Dashboard KPIs
- Gestion utilisateurs
- Configuration plans/crédits
- Monitoring OpenAI
- Gestion templates email

---

## Fichiers Clés

| Domaine | Fichier |
|---------|---------|
| Config Next.js | `next.config.js` |
| Config Tailwind | `tailwind.config.js` |
| Schéma DB | `prisma/schema.prisma` |
| Auth NextAuth | `lib/auth/options.js` |
| Gestion CV | `lib/cv-core/storage.js` |
| Client OpenAI | `lib/openai-core/client.js` |
| Abonnements | `lib/subscription/featureUsage.js` |
| Erreurs API | `lib/api/apiErrors.js` |
| Instructions IA | `CLAUDE.md` |

---

## Liens Rapides

- **Développement** : `npm run dev` (port 3001)
- **Build** : `npm run build`
- **Migrations** : `npx prisma migrate deploy`
- **Base de données** : Utiliser `psql` avec les identifiants du fichier `.env` (variable `DATABASE_URL`)

---

## Mise à Jour Documentation

Dernière mise à jour : Janvier 2026

Pour mettre à jour la documentation, éditer les fichiers Markdown dans `docs/`.
