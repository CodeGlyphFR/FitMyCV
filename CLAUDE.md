# CLAUDE.md

Instructions pour Claude Code sur le repository FitMyCV.io.

## Vue d'Ensemble

**FitMyCV.io** - Application SaaS de génération de CV optimisés par IA.
- Next.js 14 (App Router) + React 18 + Tailwind CSS
- PostgreSQL via Prisma 6 (33 modèles)
- OpenAI GPT-4o + Stripe + NextAuth.js

## Commandes Essentielles

```bash
npm run dev                    # Dev (port 3001)
npm run build                  # Build production
npx prisma migrate deploy      # Migrations
npx prisma generate            # Régénérer client
npx prisma studio              # GUI DB
```

## Structure Projet

```
app/api/           # 127 API Routes (auth, cv, admin, subscription...)
components/        # ~150 composants React
lib/               # 25 modules métier (auth, cv, openai, subscription...)
prisma/            # 33 modèles de données
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
import { readUserCvFile, writeUserCvFile } from '@/lib/cv/storage';
import { validateCv } from '@/lib/cv/validation';

const cvData = await readUserCvFile(userId, filename);
const { valid, errors } = validateCv(cvData);
await writeUserCvFile(userId, filename, modifiedData);
```

### Background Jobs
```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';

// Max 3 concurrent, tracked in BackgroundTask model
const task = await prisma.backgroundTask.create({
  data: { id: crypto.randomUUID(), type: 'generate_cv', status: 'queued', ... }
});
enqueueJob(() => generateCvJob(task.id, userId, payload));
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
| CV | `lib/cv/storage.js`, `lib/cv/validation.js` |
| OpenAI | `lib/openai/generateCv.js`, `lib/openai/improveCv.js` |
| Jobs | `lib/backgroundTasks/jobQueue.js` |
| Subscription | `lib/subscription/featureUsage.js`, `lib/subscription/credits.js` |
| Errors | `lib/api/apiErrors.js` |

## Git Workflow

- **Branches** : `main` ← `release` ← `dev`
- **Préfixes** : `feature/`, `improvement/`, `bug/`, `hotfix/`
- **Commits** : `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Documentation

Consultez `docs/` pour la documentation technique complète :
- `docs/index.md` - Index maître (point d'entrée)
- `docs/architecture.md` - Architecture technique
- `docs/api-reference.md` - 127 endpoints
- `docs/data-models.md` - 33 modèles Prisma
- `docs/components.md` - ~150 composants
- `docs/development.md` - Guide développement
