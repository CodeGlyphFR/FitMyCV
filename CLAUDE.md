# CLAUDE.md

Instructions pour Claude Code sur le repository FitMyCV.io.

## Vue d'Ensemble

**FitMyCV.io** - Application SaaS de génération de CV optimisés par IA.
- Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- PostgreSQL via Prisma 6 (34 modèles)
- OpenAI API (modèles configurables en DB) + Stripe + NextAuth.js

## Commandes Essentielles

```bash
npm run dev                    # Dev (port 3001)
npm run build                  # Build production
npx prisma migrate deploy      # Migrations
npx prisma generate            # Régénérer client
```

## Base de Données

Pour interroger la base PostgreSQL, utiliser `psql` avec les identifiants du fichier `.env` :

```bash
psql "$DATABASE_URL"
```

La variable `DATABASE_URL` dans `.env` indique l'environnement (dev/prod) et contient les identifiants de connexion.

## Structure Projet

```
app/api/           # 113 API Routes (auth, cv, admin, subscription...)
components/        # 138 composants React
lib/               # 31 modules métier (auth, cv-core, openai-core, subscription...)
prisma/            # 34 modèles de données
locales/           # i18n (fr, en, de, es)
```

**Documentation complète** : `docs/index.md`

## Patterns Critiques

### API Route
```javascript
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { apiError, CommonErrors } from '@/lib/api/apiErrors';

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(CommonErrors.notAuthenticated());
  }
  const data = await prisma.example.findMany({
    where: { userId: session.user.id }
  });
  return Response.json({ data });
}
```

### CV Operations
```javascript
import { readUserCvFile, writeUserCvFile } from '@/lib/cv-core/storage';
import { validateCv } from '@/lib/cv-core/validation';

const cvData = await readUserCvFile(userId, filename);
const { valid, errors } = validateCv(cvData);
await writeUserCvFile(userId, filename, modifiedData);
```

### Background Jobs
```javascript
import { enqueueJob } from '@/lib/background-jobs/jobQueue';
import { startSingleOfferGeneration } from '@/lib/cv-generation';

// Max 3 concurrent, tracked in BackgroundTask model
const task = await prisma.cvGenerationTask.create({
  data: { userId, sourceCvFileId, mode: 'adapt', status: 'pending', totalOffers: 1 }
});
enqueueJob(() => startSingleOfferGeneration(task.id, offer.id));
```

### Feature Limits & Credits
```javascript
import { canUseFeature, incrementFeatureCounter } from '@/lib/subscription/featureUsage';
import { debitCredit } from '@/lib/subscription/credits';

const { allowed, needsCredit } = await canUseFeature(userId, 'gpt_cv_generation');
if (!allowed) return apiError({ error: 'Limit reached', status: 403 });
if (needsCredit) await debitCredit(userId, 1, 'gpt_cv_generation');
// ... action
await incrementFeatureCounter(userId, 'gpt_cv_generation');
```

## Modèles de Données Clés

| Modèle | Purpose |
|--------|---------|
| `User` | Utilisateur (auth, profile, relations) |
| `CvFile` | CV stocké en JSON (`content` field) |
| `CvVersion` | Historique versions (rollback) |
| `JobOffer` | Offre emploi extraite |
| `BackgroundTask` | Tâches async (generation, import) |
| `Subscription` | Abonnement Stripe actif |
| `CreditBalance` | Solde crédits |
| `FeatureUsageCounter` | Compteurs mensuels |

## Fichiers Clés

| Domaine | Fichiers |
|---------|----------|
| Auth | `lib/auth/options.js`, `lib/auth/session.js` |
| CV | `lib/cv-core/storage.js`, `lib/cv-core/validation.js` |
| OpenAI | `lib/openai-core/client.js`, `lib/openai-core/schemaLoader.js` |
| CV Pipeline | `lib/cv-generation/orchestrator.js` |
| Jobs | `lib/background-jobs/jobQueue.js` |
| Subscription | `lib/subscription/featureUsage.js`, `lib/subscription/credits.js` |
| Errors | `lib/api/apiErrors.js` |

## Git Workflow

- **Branches** : `main` ← `release` ← `dev`
- **Préfixes** : `feature/`, `improvement/`, `refactor/`, `bug/`, `hotfix/`
- **Commits** : `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Incrémentation de Version

Lors de l'incrémentation de la version du projet, mettre à jour **tous** les fichiers suivants :

| Fichier | Champ à modifier |
|---------|------------------|
| `package.json` | `"version": "x.x.x.x"` |
| `package-lock.json` | `"version": "x.x.x.x"` (2 occurrences) |
| `README.md` | `**Version:** x.x.x.x` |
| `docs/index.md` | `| **Version** | x.x.x.x |` |

## Documentation

Consultez `docs/` pour la documentation technique complète :
- `docs/index.md` - Index maître (point d'entrée)
- `docs/architecture.md` - Architecture technique
- `docs/api-reference.md` - 113 endpoints
- `docs/data-models.md` - 34 modèles Prisma
- `docs/components.md` - 138 composants
- `docs/development.md` - Guide développement
