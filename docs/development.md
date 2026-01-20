# Guide de Développement - FitMyCV.io

> Généré le 2026-01-07

---

## Prérequis

| Outil | Version | Notes |
|-------|---------|-------|
| Node.js | 18+ | LTS recommandé |
| npm | 9+ | Inclus avec Node |
| PostgreSQL | 14+ | Production |
| Git | 2.x | Contrôle version |

---

## Installation

### 1. Cloner le repository

```bash
git clone <repository-url>
cd FitMyCV-DEV
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configuration environnement

```bash
cp .env.example .env
```

**Variables requises** :

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fitmycv"

# NextAuth
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key"

# OpenAI
OPENAI_API_KEY="sk-..."

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email (SMTP primaire)
SMTP_HOST="ssl0.ovh.net"
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASS="..."

# Email (Resend fallback)
RESEND_API_KEY="re_..."

# OAuth (optionnel)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# reCAPTCHA
RECAPTCHA_SITE_KEY="..."
RECAPTCHA_SECRET_KEY="..."
```

### 4. Base de données

```bash
# Appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Seed initial (optionnel)
npx prisma db seed
```

### 5. Lancer le serveur

```bash
npm run dev
# → http://localhost:3001
```

---

## Commandes Disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur dev (port 3001) |
| `npm run build` | Build production |
| `npm start` | Serveur production (port 3000) |
| `npm run rebuild` | Rebuild complet prod |

### Base de données

| Commande | Description |
|----------|-------------|
| `npx prisma migrate dev --name <name>` | Créer migration |
| `npx prisma migrate deploy` | Appliquer migrations |
| `npx prisma generate` | Régénérer client |
| `npx prisma studio` | GUI base de données |
| `npx prisma db seed` | Seed données |
| `npm run db:reset` | Reset complet DB (dev only) |

---

## Structure du Projet

```
FitMyCV-DEV/
├── app/                    # Next.js App Router
│   ├── page.jsx           # Page principale (CV Editor)
│   ├── layout.jsx         # Layout racine
│   ├── api/               # 127 API Routes
│   │   ├── auth/         # Authentification
│   │   ├── cv/           # Opérations CV
│   │   ├── cvs/          # CRUD CVs
│   │   ├── admin/        # Administration
│   │   ├── subscription/ # Abonnements
│   │   └── ...
│   ├── auth/             # Pages auth
│   ├── admin/            # Dashboard admin
│   └── account/          # Paramètres compte
│
├── components/            # ~150 Composants React
│   ├── TopBar/           # Navigation + modals
│   ├── ui/               # Composants réutilisables
│   ├── admin/            # Dashboard admin
│   ├── subscription/     # Abonnements
│   ├── onboarding/       # Onboarding
│   └── ...
│
├── lib/                   # Logique métier (25 modules)
│   ├── auth/             # NextAuth config
│   ├── cv/               # Gestion CVs
│   ├── openai/           # Intégration IA
│   ├── subscription/     # Plans & crédits
│   ├── email/            # Service email
│   ├── backgroundTasks/  # Queue de jobs
│   └── ...
│
├── prisma/
│   ├── schema.prisma     # 33 modèles
│   └── migrations/       # Historique migrations
│
├── locales/              # Traductions
│   ├── en/
│   ├── fr/
│   ├── de/
│   └── es/
│
├── data/                 # Données statiques
│   └── schema.json       # JSON Schema CV
│
├── public/               # Assets statiques
└── docs/                 # Documentation
```

---

## Patterns de Code

### API Route Pattern

```javascript
// app/api/example/route.js
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { apiError, CommonErrors } from '@/lib/api/apiErrors';

export async function GET(request) {
  // 1. Authentification
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(CommonErrors.notAuthenticated());
  }

  // 2. Logique métier
  try {
    const data = await prisma.example.findMany({
      where: { userId: session.user.id }
    });

    return Response.json({ data });
  } catch (error) {
    console.error('Error:', error);
    return apiError(CommonErrors.serverError());
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError(CommonErrors.notAuthenticated());
  }

  const body = await request.json();

  // Validation
  if (!body.requiredField) {
    return apiError(CommonErrors.invalidPayload('requiredField is required'));
  }

  // Création
  const created = await prisma.example.create({
    data: {
      userId: session.user.id,
      ...body
    }
  });

  return Response.json({ data: created }, { status: 201 });
}
```

### CV Operations Pattern

```javascript
import { readUserCvFile, writeUserCvFile } from '@/lib/cv/storage';
import { validateCv } from '@/lib/cv/validation';

// Lecture
const cvData = await readUserCvFile(userId, filename);

// Validation
const { valid, errors } = validateCv(cvData);
if (!valid) {
  throw new Error(`Invalid CV: ${errors.join(', ')}`);
}

// Modification
cvData.header.name = 'New Name';

// Écriture
await writeUserCvFile(userId, filename, cvData);
```

### Background Job Pattern

```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { startSingleOfferGeneration } from '@/lib/cv-pipeline-v2';

// Créer la tâche en DB (CvGenerationTask + CvGenerationOffer + BackgroundTask)
const task = await prisma.cvGenerationTask.create({
  data: {
    userId,
    sourceCvFileId: cvFile.id,
    mode: 'adapt',
    status: 'pending',
    totalOffers: 1,
  }
});

const offer = await prisma.cvGenerationOffer.create({
  data: {
    taskId: task.id,
    sourceUrl: url,
    status: 'pending',
  }
});

await prisma.backgroundTask.create({
  data: {
    id: task.id,
    userId,
    type: 'cv_generation_v2',
    title: 'Generating CV...',
    status: 'queued',
    createdAt: BigInt(Date.now()),
    deviceId,
  }
});

// Enqueue le job (Pipeline V2)
enqueueJob(() => startSingleOfferGeneration(task.id, offer.id));

return Response.json({ taskId: task.id });
```

### Feature Usage Pattern

```javascript
import { canUseFeature, incrementFeatureCounter } from '@/lib/subscription/featureUsage';
import { debitCredit } from '@/lib/subscription/credits';

// Vérifier les limites
const { allowed, needsCredit, reason } = await canUseFeature(userId, 'gpt_cv_generation');

if (!allowed) {
  return apiError({ error: reason, status: 403 });
}

// Si crédit requis, débiter
if (needsCredit) {
  const debited = await debitCredit(userId, 1, 'gpt_cv_generation');
  if (!debited) {
    return apiError({ error: 'Insufficient credits', status: 402 });
  }
}

// Exécuter l'action...

// Incrémenter le compteur
await incrementFeatureCounter(userId, 'gpt_cv_generation');
```

### Provider Pattern (React)

```jsx
// components/MyProvider.jsx
'use client';
import { createContext, useContext, useState } from 'react';

const MyContext = createContext();

export function MyProvider({ children }) {
  const [state, setState] = useState(initialState);

  const actions = {
    doSomething: () => setState(/*...*/),
  };

  return (
    <MyContext.Provider value={{ ...state, ...actions }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
}
```

---

## Conventions

### Commits

Format : `<type>(<scope>): <description>`

| Type | Usage |
|------|-------|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction bug |
| `refactor` | Refactoring (pas de changement fonctionnel) |
| `docs` | Documentation |
| `chore` | Maintenance |
| `style` | Formatting |
| `test` | Tests |

**Exemples** :
```
feat(cv): add translation to German
fix(auth): handle expired JWT tokens
refactor(subscription): extract credit logic
docs: update API reference
```

### Branches

| Pattern | Usage |
|---------|-------|
| `main` | Production |
| `release` | Pre-production |
| `dev` | Development |
| `feature/*` | Nouvelles features |
| `improvement/*` | Améliorations |
| `bug/*` | Corrections bugs |
| `hotfix/*` | Fixes urgents (depuis main) |

### Nommage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Composants | PascalCase | `CvGeneratorModal.jsx` |
| Hooks | camelCase + use | `useCvList.js` |
| API Routes | route.js | `app/api/cv/route.js` |
| Lib modules | camelCase | `lib/cv/storage.js` |
| Variables | camelCase | `const userId` |
| Constantes | UPPER_SNAKE | `const MAX_CONCURRENT_JOBS` |
| Types DB | PascalCase | `CvFile`, `User` |

---

## Tests Manuels

### Tester l'authentification

1. Créer un compte via `/auth?mode=register`
2. Vérifier l'email (ou bypass via Prisma Studio)
3. Se connecter via `/auth`
4. Vérifier la session dans `session.user`

### Tester la génération CV

1. Aller sur la page principale
2. Cliquer "Générer depuis offre"
3. Entrer une URL d'offre d'emploi
4. Observer la tâche dans la queue
5. Vérifier le CV généré

### Tester les webhooks Stripe

```bash
# Terminal 1: Stripe CLI
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Terminal 2: Trigger event
stripe trigger checkout.session.completed
```

---

## Debugging

### Logs serveur

```javascript
// Logs structurés
console.log('[CV] Generating:', { userId, filename });
console.error('[OpenAI] Error:', { error, model });
```

### Prisma Studio

```bash
npx prisma studio
# → http://localhost:5555
```

### Network (Browser)

1. DevTools → Network
2. Filtrer par `api/`
3. Vérifier status codes et payloads

### Environnement

```bash
# Vérifier les variables
node -e "console.log(process.env.DATABASE_URL)"
```

---

## Performance Tips

### Prisma

```javascript
// Utiliser select pour limiter les champs
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, name: true, email: true }
});

// Utiliser include avec parcimonie
const cv = await prisma.cvFile.findUnique({
  where: { id: cvId },
  include: { versions: { take: 5 } }  // Limiter
});
```

### React

```jsx
// Mémoisation
const MemoizedComponent = React.memo(ExpensiveComponent);

// useMemo pour calculs coûteux
const sorted = useMemo(() =>
  data.sort((a, b) => b.date - a.date),
  [data]
);

// useCallback pour fonctions passées en props
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### Next.js

```javascript
// Métadonnées statiques
export const metadata = {
  title: 'FitMyCV.io',
};

// Revalidation pour pages dynamiques
export const revalidate = 3600; // 1 heure
```

---

## Sécurité Checklist

- [ ] Valider toutes les entrées utilisateur
- [ ] Utiliser `auth()` dans chaque API route protégée
- [ ] Sanitizer le HTML (XSS prevention)
- [ ] Ne pas exposer d'erreurs détaillées en production
- [ ] Vérifier les permissions (admin vs user)
- [ ] Rate limiting sur les endpoints sensibles
- [ ] CSRF protection via NextAuth
- [ ] Secrets dans `.env` (pas dans le code)

---

## Troubleshooting

### "ECONNREFUSED" PostgreSQL

```bash
# Vérifier que PostgreSQL tourne
sudo systemctl status postgresql

# Ou avec Docker
docker ps | grep postgres
```

### "Module not found"

```bash
# Regénérer node_modules
rm -rf node_modules package-lock.json
npm install

# Regénérer Prisma client
npx prisma generate
```

### "JWT expired"

Session expirée - se reconnecter. Vérifier `NEXTAUTH_SECRET` est constant.

### "OpenAI rate limit"

Attendre ou utiliser un autre API key. Vérifier les quotas sur platform.openai.com.

### Migrations Prisma échouent

```bash
# Reset en dev (perte de données!)
npm run db:reset

# Ou corriger manuellement
npx prisma migrate resolve --applied <migration_name>
```

---

## Ressources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth Docs](https://next-auth.js.org)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [Stripe Docs](https://stripe.com/docs)
