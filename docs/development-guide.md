# Guide de Développement - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet

## Prérequis

### Environnement
- **Node.js** : v18+ (LTS recommandé)
- **PostgreSQL** : v14+ (développement et production)
- **npm** : v9+

### Services externes requis
| Service | Usage | Variables d'environnement |
|---------|-------|---------------------------|
| PostgreSQL | Base de données | `DATABASE_URL` |
| OpenAI | Génération CV IA | `OPENAI_API_KEY` |
| Stripe | Paiements | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| Google OAuth | Authentification | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub OAuth | Authentification | `GITHUB_ID`, `GITHUB_SECRET` |
| Apple OAuth | Authentification | `APPLE_ID`, `APPLE_SECRET` |
| reCAPTCHA v3 | Protection bots | `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` |
| SMTP (OVH) | Email primaire | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| Resend | Email fallback | `RESEND_API_KEY` |

---

## Installation

### 1. Cloner le dépôt
```bash
git clone <repository-url>
cd FitMyCV-DEV
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer les variables d'environnement
```bash
cp .env.example .env
# Éditer .env avec vos valeurs
```

**Variables minimales pour le développement :**
```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/fitmycv_dev"

# NextAuth
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="votre-secret-32-caracteres-minimum"

# OpenAI
OPENAI_API_KEY="sk-..."

# Optionnel pour dev
SKIP_RECAPTCHA=true
```

### 4. Initialiser la base de données
```bash
# Appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Seed des données initiales (plans, triggers email)
npx prisma db seed
```

### 5. Lancer le serveur de développement
```bash
npm run dev
```
L'application sera disponible sur **http://localhost:3001**

---

## Commandes Disponibles

### Développement
```bash
npm run dev                    # Démarre le serveur dev (port 3001)
npm run build                  # Build de production
npm start                      # Démarre le serveur prod (port 3000)
npm run rebuild                # Script rebuild production complet
```

### Base de données
```bash
npx prisma migrate dev --name <name>  # Crée une nouvelle migration
npx prisma migrate deploy             # Applique les migrations
npx prisma generate                   # Régénère le client Prisma
npx prisma studio                     # Interface visuelle DB
npx prisma db seed                    # Exécute le seed
npm run db:reset                      # Reset complet (dev uniquement)
```

### Prisma Studio
```bash
npx prisma studio
```
Ouvre une interface web sur http://localhost:5555 pour visualiser/éditer les données.

---

## Configuration Base de Données

### Schema Prisma
Le schema est défini dans `prisma/schema.prisma` avec 29 modèles :

**Modèles principaux :**
- `User` - Utilisateurs (auth, profile)
- `Account` - Comptes OAuth liés
- `CvFile` - Fichiers CV (contenu JSON en JSONB)
- `CvVersion` - Historique versions CV
- `JobOffer` - Offres d'emploi parsées
- `Subscription` - Abonnements utilisateurs
- `SubscriptionPlan` - Plans disponibles
- `CreditBalance` - Solde crédits
- `CreditTransaction` - Transactions crédits
- `BackgroundTask` - Tâches en arrière-plan
- `EmailTemplate` - Templates email Maily.to
- `TelemetryEvent` - Événements analytics

### Migrations
Les migrations se trouvent dans `prisma/migrations/`. Pour créer une nouvelle migration :
```bash
npx prisma migrate dev --name description_de_la_migration
```

---

## Patterns de Code

### Pattern API Route
```javascript
// app/api/exemple/route.js
import { getSession } from '@/lib/auth/session';
import prisma from '@/lib/prisma';

export async function GET(request) {
  // Vérification authentification
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Logique métier
  const data = await prisma.user.findUnique({
    where: { id: session.user.id }
  });

  return Response.json({ data });
}

export async function POST(request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // Validation et traitement...

  return Response.json({ success: true });
}
```

### Pattern Opérations CV
```javascript
import { readUserCvFile, writeUserCvFile } from '@/lib/cv/storage';
import { validateCvData } from '@/lib/cv/validation';

// Lecture
const cvContent = await readUserCvFile(userId, filename);
const cvData = JSON.parse(cvContent);

// Validation
const { valid, errors } = validateCvData(cvData);
if (!valid) {
  throw new Error(`CV invalide: ${errors.join(', ')}`);
}

// Modification et sauvegarde
cvData.header.current_title = 'Nouveau titre';
await writeUserCvFile(userId, filename, cvData);
```

### Pattern Tâche Background
```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import prisma from '@/lib/prisma';

// Créer l'entrée en base
const task = await prisma.backgroundTask.create({
  data: {
    userId,
    type: 'generation',
    title: 'Génération CV',
    status: 'queued',
    payload: { url, baseFile }
  }
});

// Ajouter à la queue
enqueueJob(() => runGenerationJob(task.id));
```

### Pattern Vérification Feature
```javascript
import { checkFeatureLimit, incrementFeatureUsage } from '@/lib/subscription/featureUsage';

// Avant l'action
const { allowed, needsCredit } = await checkFeatureLimit(userId, 'gpt_cv_generation');
if (!allowed) {
  return Response.json({ error: 'Limite atteinte' }, { status: 403 });
}

// Après l'action réussie
await incrementFeatureUsage(userId, 'gpt_cv_generation');
```

---

## Structure des Providers React

L'application utilise une hiérarchie de 7 providers imbriqués :

```jsx
// components/RootProviders.jsx
<SessionProvider>           {/* NextAuth session */}
  <RecaptchaProvider>       {/* Google reCAPTCHA v3 */}
    <SettingsProvider>      {/* Paramètres système */}
      <LanguageProvider>    {/* i18n (4 langues) */}
        <NotificationProvider>  {/* Notifications toast */}
          <AdminProvider>   {/* Mode édition + CV courant */}
            <OnboardingProvider>  {/* État onboarding */}
              {/* Contenu conditionnel */}
              <RealtimeRefreshProvider>  {/* SSE sync */}
                <BackgroundTasksProvider>  {/* Queue tâches */}
                  {children}
                </BackgroundTasksProvider>
              </RealtimeRefreshProvider>
            </OnboardingProvider>
          </AdminProvider>
        </NotificationProvider>
      </LanguageProvider>
    </SettingsProvider>
  </RecaptchaProvider>
</SessionProvider>
```

---

## Tests

### Structure
Les tests se trouvent dans `lib/utils/__tests__/`.

### Exécution
```bash
# À implémenter - pas de framework de test configuré actuellement
```

---

## Déploiement

### Build de production
```bash
npm run build
```

### Variables d'environnement de production
Assurez-vous que toutes les variables sont configurées :
- `DATABASE_URL` : URL PostgreSQL de production
- `NEXTAUTH_URL` : URL publique de l'application
- `NEXTAUTH_SECRET` : Secret sécurisé (32+ caractères)
- Toutes les clés API services externes

### Démarrage
```bash
npm start  # Port 3000 par défaut
```

---

## Git Workflow

### Branches
- `main` : Production stable
- `release` : Pré-production
- `dev` : Développement actif

### Conventions de branches
- `feature/` : Nouvelles fonctionnalités (depuis `dev`)
- `improvement/` : Améliorations (depuis `dev`)
- `bug/` : Corrections de bugs (depuis `dev`)
- `hotfix/` : Corrections urgentes (depuis `main`)

### Conventions de commits
Format : `type: description`

Types :
- `feat:` : Nouvelle fonctionnalité
- `fix:` : Correction de bug
- `refactor:` : Refactoring sans changement fonctionnel
- `docs:` : Documentation
- `chore:` : Maintenance, dépendances

---

## Debugging

### Logs
Les logs sont écrits dans `logs/` pour certaines opérations.

### Prisma Studio
```bash
npx prisma studio
```

### Vérification OpenAI
Les appels OpenAI sont tracés dans la table `TelemetryEvent` avec le type approprié.

### SSE Debug
Ouvrir les DevTools → Network → Filter: `EventStream` pour voir les événements SSE.

---

## Ressources

### Documentation interne
- `CLAUDE.md` : Instructions pour Claude Code
- `docs/` : Documentation générée

### APIs externes
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Stripe API Documentation](https://stripe.com/docs/api)
