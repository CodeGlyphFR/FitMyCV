# Guide de Développement - FitMyCV.io

> Instructions pour le développement, configuration et déploiement

---

## Prérequis

| Outil | Version | Notes |
|-------|---------|-------|
| Node.js | 20+ | LTS recommandé |
| PostgreSQL | 14+ | Base de données principale |
| npm | 10+ | Gestionnaire de paquets |
| Git | 2.40+ | Contrôle de version |

### Optionnels

| Outil | Usage |
|-------|-------|
| Puppeteer | Export PDF, scraping |
| GraphicsMagick | Conversion PDF → images |
| Stripe CLI | Tests webhooks locaux |

---

## Installation

### 1. Cloner le repository

```bash
git clone git@github.com:your-org/FitMyCV.git
cd FitMyCV
```

### 2. Installer les dépendances

```bash
npm install
```

Le script `postinstall` exécute automatiquement `prisma generate`.

### 3. Configurer l'environnement

```bash
cp .env.example .env
```

Éditer `.env` avec vos valeurs (voir section Variables d'environnement).

### 4. Initialiser la base de données

```bash
# Appliquer les migrations et seeder
npm run db:setup

# Ou séparément :
npx prisma migrate deploy
npx prisma db seed
```

### 5. Lancer le serveur de développement

```bash
npm run dev
```

Application disponible sur `http://localhost:3001`

---

## Commandes NPM

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur dev (port 3001, Turbopack) |
| `npm run build` | Build production |
| `npm run start` | Serveur production (port 3000) |
| `npm run db:setup` | Migrations + seed |
| `npm run db:reset` | Reset complet DB |
| `npm run db:seed` | Seed uniquement |
| `npm run db:generate` | Régénérer Prisma Client |

---

## Commandes Prisma

| Commande | Description |
|----------|-------------|
| `npx prisma migrate dev` | Créer migration (dev) |
| `npx prisma migrate deploy` | Appliquer migrations (prod) |
| `npx prisma migrate reset` | Reset DB + migrations |
| `npx prisma db push` | Push schema sans migration |
| `npx prisma db pull` | Pull schema depuis DB |
| `npx prisma generate` | Régénérer client |
| `npx prisma studio` | GUI base de données |
| `npx prisma format` | Formatter schema.prisma |

---

## Variables d'Environnement

### Obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://user:pass@localhost:5432/fitmycv` |
| `OPENAI_API_KEY` | Clé API OpenAI | `sk-...` |
| `NEXTAUTH_SECRET` | Secret NextAuth (32+ chars) | Générer avec `openssl rand -base64 32` |
| `NEXTAUTH_URL` | URL application | `https://app.fitmycv.io` |

### Email

| Variable | Description | Défaut |
|----------|-------------|--------|
| `EMAIL_PROVIDER` | Provider email | `"auto"` |
| `EMAIL_FROM` | Expéditeur | `"FitMyCV <noreply@fitmycv.io>"` |
| `SMTP_HOST` | Serveur SMTP | `ssl0.ovh.net` |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | - |
| `SMTP_PASSWORD` | Mot de passe SMTP | - |
| `RESEND_API_KEY` | Clé Resend (fallback) | - |

### OAuth (optionnels)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |
| `GITHUB_ID` | GitHub OAuth Client ID |
| `GITHUB_SECRET` | GitHub OAuth Secret |
| `APPLE_CLIENT_ID` | Apple Sign In Client ID |
| `APPLE_CLIENT_SECRET` | Apple Sign In Secret |

### Stripe

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe |

### Sécurité

| Variable | Description |
|----------|-------------|
| `CV_ENCRYPTION_KEY` | Clé chiffrement CV (base64, 32 octets) |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Clé site reCAPTCHA v3 |
| `RECAPTCHA_SECRET_KEY` | Clé secrète reCAPTCHA |
| `BYPASS_RECAPTCHA` | Désactiver reCAPTCHA (dev) |

---

## Structure des Dossiers

```
FitMyCV/
├── app/                    # Routes Next.js (App Router)
│   ├── api/                # API Routes (113 endpoints)
│   ├── auth/               # Pages authentification
│   ├── account/            # Page compte utilisateur
│   ├── admin/              # Dashboard admin
│   ├── cookies/            # Paramètres cookies
│   ├── privacy/            # Politique confidentialité
│   ├── terms/              # Conditions utilisation
│   └── about/              # Page à propos
│
├── components/             # Composants React (138 fichiers)
│   ├── layout/             # Structure page
│   ├── ui/                 # Design System
│   ├── TopBar/             # Barre navigation
│   ├── cv-sections/        # Sections CV
│   ├── cv-improvement/     # Panel optimisation IA
│   ├── cv-review/          # Surlignage modifications
│   ├── admin/              # Dashboard admin
│   ├── subscription/       # Abonnements
│   ├── onboarding/         # Système guidage
│   ├── providers/          # Contextes globaux
│   ├── auth/               # Authentification
│   ├── account/            # Paramètres compte
│   ├── notifications/      # Notifications
│   ├── feedback/           # Feedback
│   ├── cookies/            # Consentement
│   ├── task-queue/         # Queue tâches
│   ├── header/             # Header CV
│   ├── pages/              # Contenu pages
│   └── empty-state/        # État vide
│
├── lib/                    # Modules métier (31 modules)
│   ├── auth/               # Authentification NextAuth
│   ├── cv-core/            # Gestion CV
│   ├── openai-core/        # Client OpenAI
│   ├── subscription/       # Abonnements Stripe
│   ├── background-jobs/    # Queue tâches async
│   ├── email/              # Service email
│   ├── job-offer/          # Extraction offres emploi
│   ├── scoring/            # Match score CV/offre
│   ├── pdf/                # Export PDF
│   ├── export/             # Export données
│   ├── telemetry/          # Tracking événements
│   ├── analytics/          # Analytics admin
│   ├── admin/              # Config admin
│   ├── settings/           # Settings dynamiques
│   ├── api/                # Erreurs API
│   ├── security/           # Sécurité
│   ├── i18n/               # Internationalisation
│   ├── translation/        # Service traduction
│   ├── onboarding/         # Parcours onboarding
│   ├── cookies/            # Consentement RGPD
│   ├── recaptcha/          # Vérification reCAPTCHA
│   ├── events/             # Event emitter
│   ├── utils/              # Utilitaires
│   ├── constants/          # Constantes globales
│   ├── animations/         # Variants Framer Motion
│   ├── loading/            # Events loading
│   ├── creditCosts/        # Mapping coûts
│   └── prompts-shared/     # Prompts réutilisables
│
├── prisma/                 # Base de données
├── locales/                # Traductions i18n (fr, en, de, es)
├── hooks/                  # React hooks globaux
├── public/                 # Assets statiques
├── scripts/                # Scripts maintenance
├── data/                   # Données statiques
└── docs/                   # Documentation
```

---

## Workflow Git

### Branches

```
main          # Production stable
  └── release # Pré-production
        └── dev    # Développement actif
              ├── feature/xxx     # Nouvelles fonctionnalités
              ├── improvement/xxx # Améliorations fonctionnalités existantes
              ├── refactor/xxx    # Refactoring code
              ├── bug/xxx         # Corrections bugs
              └── hotfix/xxx      # Corrections urgentes
```

### Conventions de Commits

Format : `<type>: <description>`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction bug |
| `refactor` | Refactoring sans changement fonctionnel |
| `docs` | Documentation |
| `chore` | Maintenance, dépendances |
| `style` | Formatage, style code |
| `perf` | Optimisation performance |
| `test` | Ajout/modification tests |

**Exemples :**

```bash
git commit -m "feat: add PDF export with custom templates"
git commit -m "fix: resolve score calculation on empty skills"
git commit -m "refactor: extract TopBar hooks into separate files"
```

### Workflow Feature

```bash
# 1. Créer branche depuis dev
git checkout dev
git pull origin dev
git checkout -b feature/my-feature

# 2. Développer et committer
git add .
git commit -m "feat: implement feature"

# 3. Push et PR
git push -u origin feature/my-feature
# Créer PR vers dev sur GitHub
```

---

## Patterns de Code

### API Route Standard

```javascript
// app/api/example/route.js
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { apiError, CommonErrors } from '@/lib/api/apiErrors';

export async function GET(request) {
  try {
    // 1. Vérifier authentification
    const session = await auth();
    if (!session?.user?.id) {
      return apiError(CommonErrors.notAuthenticated());
    }

    // 2. Récupérer données
    const data = await prisma.example.findMany({
      where: { userId: session.user.id }
    });

    // 3. Retourner réponse
    return Response.json({ data });

  } catch (error) {
    console.error('GET /api/example error:', error);
    return apiError(CommonErrors.serverError());
  }
}
```

### Opérations CV

```javascript
import { readUserCvFile, writeUserCvFile } from '@/lib/cv-core/storage';
import { validateCv } from '@/lib/cv-core/validation';

// Lecture
const cvData = await readUserCvFile(userId, filename);

// Validation
const { valid, errors } = validateCv(cvData);
if (!valid) throw new Error(errors.join(', '));

// Écriture
await writeUserCvFile(userId, filename, modifiedData);
```

### Vérification Crédits/Limites

```javascript
import { canUseFeature, incrementFeatureCounter } from '@/lib/subscription/featureUsage';
import { debitCredit } from '@/lib/subscription/credits';

// Vérifier accès
const { allowed, needsCredit, reason } = await canUseFeature(userId, 'gpt_cv_generation');

if (!allowed) {
  return apiError({ error: reason, status: 403 });
}

// Débiter si nécessaire
if (needsCredit) {
  await debitCredit(userId, 1, 'gpt_cv_generation');
}

// Exécuter action...

// Incrémenter compteur
await incrementFeatureCounter(userId, 'gpt_cv_generation');
```

### Background Job

```javascript
import { enqueueJob } from '@/lib/background-jobs/jobQueue';

// Créer tâche en DB
const task = await prisma.cvGenerationTask.create({
  data: {
    userId,
    sourceCvFileId,
    mode: 'adapt',
    status: 'pending',
    totalOffers: 1
  }
});

// Enqueuer exécution (max 3 concurrent)
enqueueJob(() => startSingleOfferGeneration(task.id, offer.id));
```

### Composant React avec Hooks

```javascript
// components/Example.jsx
'use client';

import { useState, useEffect } from 'react';
import { useNotifications } from '@/components/providers/NotificationProvider';

export default function Example({ cvId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useNotifications();

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/cv/${cvId}`);
        if (!res.ok) throw new Error('Fetch failed');
        setData(await res.json());
      } catch (error) {
        addNotification({ type: 'error', message: error.message });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [cvId]);

  if (loading) return <SkeletonLoader />;
  if (!data) return <EmptyState />;

  return <div>{/* ... */}</div>;
}
```

---

## Tests

### Structure

```
test/
├── unit/           # Tests unitaires
├── integration/    # Tests intégration API
└── e2e/            # Tests end-to-end
```

### Exécution

```bash
# Tests unitaires (à implémenter)
npm test

# Tests E2E avec Playwright (à implémenter)
npm run test:e2e
```

---

## Déploiement

### Production

1. **Build**
   ```bash
   npm run build
   ```

2. **Migrations**
   ```bash
   npx prisma migrate deploy
   ```

3. **Démarrer**
   ```bash
   npm run start
   ```

### Variables Production

```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://app.fitmycv.io"
# ... autres variables
```

### Checklist Pré-déploiement

- [ ] Variables d'environnement configurées
- [ ] Migrations appliquées
- [ ] Seed exécuté (si première installation)
- [ ] Webhooks Stripe configurés
- [ ] DNS et certificats SSL
- [ ] Backup base de données

---

## Incrémentation de Version

Lors d'une nouvelle version, mettre à jour **tous** les fichiers :

| Fichier | Champ |
|---------|-------|
| `package.json` | `"version": "x.x.x.x"` |
| `package-lock.json` | `"version": "x.x.x.x"` (2 occurrences) |
| `README.md` | `**Version:** x.x.x.x` |
| `docs/index.md` | `\| **Version** \| x.x.x.x \|` |

---

## Debugging

### Logs

```javascript
// Côté serveur
console.log('[API] /api/example:', data);
console.error('[ERROR] /api/example:', error);

// Avec contexte
console.log(`[CV] User ${userId} - Operation: ${operation}`);
```

### PostgreSQL (psql)

```bash
# Connexion avec DATABASE_URL du .env
psql "$DATABASE_URL"

# Ou extraire les infos du .env
# Format: postgresql://user:password@host:port/database
```

Utiliser `psql` pour interroger directement la base PostgreSQL. Les identifiants et l'environnement (dev/prod) sont définis dans le fichier `.env` via la variable `DATABASE_URL`.

### Stripe CLI

```bash
# Écouter webhooks en local
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Trigger événement test
stripe trigger payment_intent.succeeded
```

---

## Ressources

### Documentation Interne

- `docs/index.md` - Index documentation
- `docs/architecture.md` - Architecture technique
- `docs/api-reference.md` - Référence API
- `docs/data-models.md` - Modèles de données
- `docs/components.md` - Composants React
- `docs/html-docs/` - Documentation HTML complète (accès admin via `/api/admin/docs/`)

### Documentation Externe

- [Next.js 16 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org)
- [Stripe API](https://stripe.com/docs/api)
- [OpenAI API](https://platform.openai.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
