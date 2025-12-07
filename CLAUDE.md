# CLAUDE.md

> **This file provides guidance to Claude Code AI assistant when working with this repository.**
>
> **For human developers:** Start with [README.md](./README.md) for project overview, then consult [docs/](./docs/) for detailed documentation.

---

## 📚 Documentation Complète

Toute la documentation technique est disponible dans le dossier **`docs/`**. Ce fichier est un **quick reference** pour Claude Code avec des liens vers la documentation détaillée.

### Installation & Configuration
- **[Installation complète](./docs/INSTALLATION.md)** - Setup initial, prérequis, premiers pas
- **[Variables d'environnement](./docs/ENVIRONMENT_VARIABLES.md)** - Configuration .env détaillée
- **[Déploiement](./docs/DEPLOYMENT.md)** - Production deployment guide
- **[Configuration CRON](./docs/CRON_SETUP.md)** - Tâches planifiées

### Architecture & Développement
- **[Architecture complète](./docs/ARCHITECTURE.md)** - Vue d'ensemble système, background tasks, télémétrie
- **[Guide développement](./docs/DEVELOPMENT.md)** - Workflow développeur, best practices
- **[Base de données](./docs/DATABASE.md)** - Schéma Prisma, migrations, models
- **[Référence API](./docs/API_REFERENCE.md)** - Tous les endpoints avec exemples
- **[Composants](./docs/COMPONENTS.md)** - Structure composants React
- **[Features](./docs/FEATURES.md)** - Fonctionnalités détaillées

### Systèmes Spécialisés
- **[Intégration IA](./docs/AI_INTEGRATION.md)** - OpenAI, prompts, modèles, analyse levels
- **[Système d'abonnements](./docs/SUBSCRIPTION.md)** - Plans, crédits, Stripe, limites features
- **[Dashboard Admin](./docs/ADMIN_GUIDE.md)** - Interface admin, analytics, monitoring
- **[Télémétrie & Analytics](./docs/TELEMETRY.md)** - Système télémétrie, sessions, dashboard analytics
- **[Sécurité](./docs/SECURITY.md)** - Best practices, chiffrement CV, sanitization

### Configuration Externe
- **[Setup Stripe](./docs/STRIPE_SETUP.md)** - Configuration Stripe complète (webhooks, test mode)

### Développement & Patterns
- **[Référence commandes](./docs/COMMANDS_REFERENCE.md)** - Toutes les commandes (Next.js, Prisma, Stripe, scripts)
- **[Patterns de code](./docs/CODE_PATTERNS.md)** - Exemples réutilisables (CV, job queue, Stripe, limites, Email, OAuth)
- **[Design System](./docs/DESIGN_SYSTEM.md)** - UI/UX guidelines complets (glassmorphism, composants, animations)

### Guides Pratiques
- **[Usage](./docs/USAGE.md)** - Guide utilisateur
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Résolution problèmes communs
- **[Tests MVP](./docs/MVP_TESTING.md)** - Tests et validation
- **[Ajouter une langue](./docs/ADDING_LANGUAGE.md)** - Guide pour intégrer une nouvelle langue

### Documentation Projet
- **[README](./docs/README.md)** - Index documentation
- **[Refactoring Stripe](./docs/STRIPE_REFACTORING.md)** - Notes refactoring système paiements

---

## 🔧 Environnements de Développement

**Ce projet utilise un workflow Git 3-branches :**

### Structure des Branches

| Branche | Rôle | Tag | Merge vers |
|---------|------|-----|------------|
| `main` | Production stable | v1.2.3 | - |
| `release` | Testing/Staging | v1.2.3-rc | `main` (via PR) |
| `dev` | Développement actif | - | `release` (via PR) |

### Dossier DÉVELOPPEMENT (`~/Documents/FitMyCV-DEV/`)
- **Base de données** : PostgreSQL `fitmycv_dev`
- **user** : `erickdesmet`
- **Port** : `3001` (développement)
- **Usage** : Développement quotidien, features, bugs, improvements

### Dossier PRODUCTION (optionnel : `~/FitMyCV/`)
- **Base de données** : PostgreSQL `fitmycv_prod`
- **user** : `erickdesmet`
- **Port** : `3000` (production)
- **Usage** : Production uniquement, jamais de développement

## ⚡ Quick Start

### Ports de développement
- **Dev**: `3001` (npm run dev) - PostgreSQL `fitmycv_dev`

### Commandes essentielles
→ **[Toutes les commandes](./docs/COMMANDS_REFERENCE.md)**

### Variables d'environnement critiques

**Pour DÉVELOPPEMENT** (`.env`) :
```bash
DATABASE_URL="postgresql://fitmycv:password@localhost:5432/fitmycv_prod" # DB PRODUCTION
DATABASE_URL="postgresql://fitmycv:password@localhost:5432/fitmycv_dev" # DB DEVELOPEMENT
NODE_ENV=development
USER=erickdesmet
PORT=3001
CV_ENCRYPTION_KEY="..."                        
CV_BASE_DIR="data/users"                        # Chemin vers dossier users (relatif ou absolu)
NEXTAUTH_SECRET="..."                           # openssl rand -base64 32
OPENAI_API_KEY="sk-..."                         # OpenAI API
STRIPE_SECRET_KEY="sk_test_..."                 # Stripe API (test mode)
NEXT_PUBLIC_SITE_URL="http://localhost:3001"   # URL publique
```

**Important DATABASE_URL** :
- `DATABASE_URL` : Base principale (prod)
- `DATABASE_URL_DEV` : Base dev (pour sync)

→ **[Toutes les variables](./docs/ENVIRONMENT_VARIABLES.md)**

---

## 🏗️ Architecture (Quick Reference)

### Stack
- **Frontend**: React 18 + Tailwind CSS (glassmorphism design)
- **Backend**: Next.js 14 (App Router) + API Routes
- **Database**:
  - **Dev** : Prisma + PostgreSQL `fitmycv_dev`
  - **Prod** : Prisma + PostgreSQL `fitmycv_prod`
- **i18n**: 4 langues (FR, EN, ES, DE), 9 catégories de traductions
- **IA**: OpenAI API (génération, match score, optimisation ATS)
- **Paiements**: Stripe (abonnements + packs crédits)
- **Stockage CV**: PostgreSQL natif (JSON) avec versioning

**Setup dev** : `npm run db:setup` ou `npm run db:sync-from-prod`

### Systèmes clés

| Système | Description | Documentation |
|---------|-------------|---------------|
| **Stockage CV** | PostgreSQL natif (CvFile.content) + versioning (CvVersion) | [DATABASE.md](./docs/DATABASE.md#4-cvfile) |
| **JobOffer** | Extraction structurée des offres (JSON) + réutilisation | [DATABASE.md](./docs/DATABASE.md#3-joboffer) |
| **Job queue** | 3 jobs concurrents max (génération, import, traduction) | [ARCHITECTURE.md](./docs/ARCHITECTURE.md#background-tasks) |
| **Abonnements** | Hybride : plans mensuels + micro-transactions (crédits) | [SUBSCRIPTION.md](./docs/SUBSCRIPTION.md) |
| **Dashboard admin** | Analytics, monitoring, gestion users/plans | [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) |
| **IA OpenAI** | Génération CV, match score, optimisation ATS | [AI_INTEGRATION.md](./docs/AI_INTEGRATION.md) |
| **i18n** | 4 langues (FR, EN, ES, DE), 9 catégories par langue | [ADDING_LANGUAGE.md](./docs/ADDING_LANGUAGE.md) |

### Structure de données

- **Database schema** : [DATABASE.md](./docs/DATABASE.md)
- **CV JSON structure** : [ARCHITECTURE.md - Structure CV](./docs/ARCHITECTURE.md#structure-des-données-cv)
- **API Routes** : [API_REFERENCE.md](./docs/API_REFERENCE.md)
- **Composants React** : [COMPONENTS.md](./docs/COMPONENTS.md)

---

## 🎨 Design System (Quick Reference)

**Approche** : Glassmorphism + Deep dark blue background (`rgb(2, 6, 23)`) + Emerald primary color

### Couleurs principales
```css
/* Primary */
emerald-500: #10B981    /* Boutons primaires, focus states */
emerald-400: #34D399    /* Éléments interactifs */

/* Secondary */
sky-500: #0EA5E9        /* Actions secondaires */

/* Background */
--bg-base: rgb(2, 6, 23)  /* Deep dark blue */
```

### Patterns de base

```jsx
/* Glass card standard */
<div className="bg-white/15 backdrop-blur-md rounded-2xl border-2 border-white/30" />

/* Glass input */
<input className="bg-white/20 backdrop-blur-sm border border-white/40 rounded-lg" />

/* Button primary */
<button className="bg-emerald-500 hover:bg-emerald-600 rounded-lg px-4 py-2 text-white" />
```

### Responsive & iOS

- **Breakpoint** : `md:` = `991px` (mobile-first approach)
- **Safe areas** : `env(safe-area-inset-top)` pour notch iOS
- **Touch targets** : Minimum 32px hauteur/largeur
- **iOS blur optimization** : `.ios-blur-medium` pour performance

### Background System

- **Composant** : `GlobalBackground.jsx` (appliqué globalement)
- **Couleur base** : `rgb(2, 6, 23)` → Utiliser classe Tailwind `bg-app-bg`
- **Blobs animés** : 3 blobs Framer Motion (sky-500 dominance + emerald-500)
- **Position** : `fixed inset-0 z-0` (couvre tout le viewport)
- **Unified** : Même background pour `/auth` et toutes les pages
- **Animation** : Framer Motion avec trajectoires mathématiques (sin/cos)
  - Mouvements amples : ±200px horizontal, ±180px vertical
  - Tailles responsives : 40-60% de `window.innerHeight`
  - Durées : 25-31s (non synchronisées)
  - 6 keyframes pour fluidité maximale
  - GPU-accelerated (`willChange`)

```jsx
// Background unifié (préféré)
<div className="bg-app-bg">...</div>

// Ou valeur directe si nécessaire
<div className="bg-[rgb(2,6,23)]">...</div>
```

### Z-Index Layering

```css
z-0:       Background (GlobalBackground)
z-10:      Main content
z-[10001]: TopBar, Notification backdrop
z-[10002]: Dropdown menus, User menu
z-[10003]: Notifications, Custom selects
z-[10004]: Tooltips
```

→ **[Design System complet](./docs/DESIGN_SYSTEM.md)**

---

## 💻 Patterns de Code Courants

### 1. Résolution de chemins utilisateurs

```javascript
import { resolveCvBaseDir, getUserCvPath, getUserRootPath } from '@/lib/utils/paths';

// Résoudre CV_BASE_DIR (supporte chemins absolus et relatifs)
const baseDir = resolveCvBaseDir();
// -> /mnt/DATA/PROD/users (si absolu) ou /home/.../cv-site/data/users (si relatif)

// Chemin vers dossier CVs d'un utilisateur
const cvPath = getUserCvPath(userId);
// -> /mnt/DATA/PROD/users/{userId}/cvs

// Chemin vers dossier racine d'un utilisateur
const rootPath = getUserRootPath(userId);
// -> /mnt/DATA/PROD/users/{userId}
```

### 2. Accès CV (Database Storage)

```javascript
import { readUserCvFile, writeUserCvFile, listUserCvFiles } from '@/lib/cv/storage';

// Lire un CV (retourne JSON stringifié)
const cvData = await readUserCvFile(userId, filename);
const cv = JSON.parse(cvData);

// Écrire un CV (accepte string ou objet)
await writeUserCvFile(userId, filename, cvData);

// Lister les CVs d'un utilisateur
const filenames = await listUserCvFiles(userId);
```

### 2b. JobOffer (Extraction structurée)

```javascript
// Extraction et stockage d'une offre d'emploi
import { extractJobOfferFromUrl, extractJobOfferFromPdf, storeJobOffer } from '@/lib/openai/generateCv';

// Extraire depuis une URL
const extraction = await extractJobOfferFromUrl(url, userId);
// extraction = { content: {...}, tokensUsed: 500, model: 'gpt-5-mini' }

// Stocker dans la table JobOffer (upsert par userId + sourceValue)
const jobOfferId = await storeJobOffer(userId, 'url', url, extraction.content, extraction.model, extraction.tokensUsed);

// Accéder à l'offre via relation Prisma
const cvFile = await prisma.cvFile.findUnique({
  where: { userId_filename: { userId, filename } },
  include: { jobOffer: true }
});

// cvFile.jobOffer.content = { title, company, skills, ... }
```

**Structure de `jobOffer.content`** :

```javascript
{
  title: "Software Engineer",
  company: "TechCorp",
  contract: "CDI",  // CDI, CDD, Freelance, Stage, Alternance
  experience: { min_years: 3, max_years: 5, level: "mid" },
  location: { city: "Paris", country: "France", remote: "hybrid" },
  skills: { required: ["React", "Node.js"], nice_to_have: ["GraphQL"] },
  // ... voir AI_INTEGRATION.md pour le schéma complet
}
```

### 2c. Versioning CV (Optimisation IA)

```javascript
import { createCvVersion, getCvVersions, restoreCvVersion } from '@/lib/cv/versioning';

// Créer une version AVANT modification IA
await createCvVersion(userId, filename, 'Avant optimisation IA');

// Lister les versions d'un CV
const versions = await getCvVersions(userId, filename);
// → [{ version: 3, changelog: '...', createdAt }, { version: 2, ... }]

// Restaurer une version antérieure
const restoredContent = await restoreCvVersion(userId, filename, 2);
```

**Note** : Le versioning est uniquement utilisé par `improveCvJob` (optimisation IA). Les éditions manuelles écrasent directement sans créer de version.

### 2d. HTML to Markdown (Pipeline)

```javascript
import { htmlToMarkdown } from '@/lib/utils/htmlToMarkdown';

const { title, content, textLength } = await htmlToMarkdown(rawHtml, url);
// content: Markdown propre (~5k chars vs ~60k HTML)
// textLength: Longueur du texte extrait
```

### 3. Enqueuer un job

```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runGenerateCvJob } from '@/lib/backgroundTasks/generateCvJob';

enqueueJob(() => runGenerateCvJob(task));
```

### 3. Vérifier limites features et consommer crédits

```javascript
import { incrementFeatureCounter } from '@/lib/subscription/featureUsage';

// Vérifie les limites ET consomme les crédits si nécessaire
const result = await incrementFeatureCounter(userId, 'gpt_cv_generation');

if (!result.success) {
  // result.error contient le message (ex: "2 crédits requis, vous en avez 1")
  // result.actionRequired = true si redirection nécessaire
  // result.redirectUrl = '/account/subscriptions'
}

// Si succès: result.usedCredit = true/false, result.creditCost = nombre débité
```

**Coûts en crédits par feature** (configurables via Admin → Settings) :

| Feature | Crédits | Setting |
|---------|---------|---------|
| create_cv_manual | 1 | credits_create_cv_manual |
| edit_cv | 1 | credits_edit_cv |
| export_cv | 1 | credits_export_cv |
| match_score | 1 | credits_match_score |
| translate_cv | 1 | credits_translate_cv |
| gpt_cv_generation | 2 | credits_gpt_cv_generation |
| optimize_cv | 2 | credits_optimize_cv |
| generate_from_job_title | 3 | credits_generate_from_job_title |
| import_pdf | 5 | credits_import_pdf |

```javascript
// Pour récupérer le coût d'une feature
import { getCreditCostForFeature } from '@/lib/subscription/creditCost';

const { cost } = await getCreditCostForFeature('import_pdf');
// cost = 5

const { cost } = await getCreditCostForFeature('gpt_cv_generation');
// cost = 2
```

### 4. Session utilisateur

```javascript
import { getSession } from '@/lib/auth/session';

const session = await getSession();
const userId = session?.user?.id;
```

### 5. Vérification reCAPTCHA

```javascript
import { verifyRecaptcha } from '@/lib/recaptcha/verifyRecaptcha';

// Vérifier token reCAPTCHA
const recaptchaResult = await verifyRecaptcha(recaptchaToken, {
  callerName: 'import-pdf',
  scoreThreshold: 0.5,
});

if (!recaptchaResult.success) {
  return NextResponse.json({ error: recaptchaResult.error }, { status: 403 });
}

// Bypass en développement : ajouter BYPASS_RECAPTCHA=true dans .env
```

**Routes protégées par reCAPTCHA** (11 au total) :
- `app/api/auth/register` - Création compte
- `app/api/auth/request-reset` - Demande reset password
- `app/api/auth/resend-verification` - Renvoi email vérification
- `app/api/background-tasks/import-pdf` - Import CV PDF
- `app/api/background-tasks/generate-cv` - Génération CV avec IA
- `app/api/background-tasks/create-template-cv` - Création CV template
- `app/api/background-tasks/translate-cv` - Traduction CV
- `app/api/background-tasks/calculate-match-score` - Score match
- `app/api/background-tasks/generate-cv-from-job-title` - Génération depuis job title
- `app/api/cvs/create` - Création CV manuelle
- `app/api/account/link-oauth` - Liaison compte OAuth

### 6. Prévention scroll chaining (dropdowns)

```javascript
useEffect(() => {
  if (!isOpen) return;
  const scrollY = window.scrollY;

  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';

  return () => {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  };
}, [isOpen]);
```

### 7. Service Email (Resend)

```javascript
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendEmailChangeConfirmation,
  createVerificationToken,
  verifyToken
} from '@/lib/email/emailService';

// Envoi email vérification
await sendVerificationEmail(email, userId);

// Envoi email reset password
await sendPasswordResetEmail(email, userId);

// Templates configurables dans Admin → Email Templates
// Variables : {{userName}}, {{verificationUrl}}, {{resetUrl}}, {{newEmail}}
```

→ **[Pattern complet](./docs/CODE_PATTERNS.md#11-service-email-resend)**

### 8. OAuth Account Linking (Multi-Provider)

```javascript
// Lier un compte OAuth existant
POST /api/account/link-oauth
Body: { provider: 'google' | 'github' | 'apple', recaptchaToken }
Response: { authorizationUrl }

// Callback après autorisation OAuth
GET /api/auth/callback/link/[provider]?code=...&state=...

// Délier un compte OAuth
DELETE /api/account/unlink-oauth?provider=google

// Lister les comptes liés
GET /api/account/linked-accounts
```

→ **[Pattern complet](./docs/CODE_PATTERNS.md#12-oauth-multi-provider-account-linking)**

### 9. Système d'onboarding (Constantes & Logger)

```javascript
// Utiliser les constantes centralisées (9 timings + mappings + API config)
import { ONBOARDING_TIMINGS, STEP_TO_MODAL_KEY, ONBOARDING_API } from '@/lib/onboarding/onboardingConfig';

const delay = ONBOARDING_TIMINGS.STEP_TRANSITION_DELAY; // 1000ms
const modalKey = STEP_TO_MODAL_KEY[currentStep]; // 'step1', 'step2', 'step6', 'step8'
const cacheTimeout = ONBOARDING_API.CACHE_TTL; // 1000ms (synchronisé avec debounce)

// Utiliser le logger conditionnel (dev only pour logs, always pour errors/warnings)
import { onboardingLogger } from '@/lib/utils/onboardingLogger';

onboardingLogger.log('[Component] Info message');     // Dev only
onboardingLogger.error('[Component] Error:', error);  // Always shown
onboardingLogger.warn('[Component] Warning');         // Always shown
```

**Documentation complète** : **[docs/onboarding/](./docs/onboarding/)**
- **[README.md](./docs/onboarding/README.md)** - Index + quick reference + navigation
- **[ARCHITECTURE.md](./docs/onboarding/ARCHITECTURE.md)** - Architecture système, composants, flow
- **[WORKFLOW.md](./docs/onboarding/WORKFLOW.md)** - Détail 8 steps (objectifs, validation)
- **[STATE_MANAGEMENT.md](./docs/onboarding/STATE_MANAGEMENT.md)** - Structure onboardingState, helpers, SSE
- **[COMPONENTS.md](./docs/onboarding/COMPONENTS.md)** - Référence 8 composants + 4 hooks
- **[API_REFERENCE.md](./docs/onboarding/API_REFERENCE.md)** - Endpoints REST + SSE
- **[TIMINGS.md](./docs/onboarding/TIMINGS.md)** - Configuration délais
- **[DEVELOPMENT_GUIDE.md](./docs/onboarding/DEVELOPMENT_GUIDE.md)** - How-to: add step, debug, test
- **[TROUBLESHOOTING.md](./docs/onboarding/TROUBLESHOOTING.md)** - Bugs fixés, FAQ

**Fichiers code** :
- Configuration : `lib/onboarding/onboardingConfig.js`
- State helpers : `lib/onboarding/onboardingState.js`
- Logger : `lib/utils/onboardingLogger.js`
- Script reset DB : `scripts/reset-onboarding.js`

**Règles** :
- ❌ **Ne pas utiliser** : `console.log`, `console.error` directement dans les composants d'onboarding
- ✅ **Toujours utiliser** : `onboardingLogger.*` pour une console propre en production
- ✅ **Reset DB** : `node scripts/reset-onboarding.js --dry-run` (preview avant reset)

### 10. Système i18n (9 catégories)

```javascript
// Structure: locales/{lang}/*.json (fr, en, es, de)
// 9 fichiers: ui, errors, auth, cv, enums, subscription, tasks, onboarding, account

import { useLanguage } from '@/lib/i18n/LanguageContext';

const { t, language, changeLanguage } = useLanguage();
const message = t('auth.login.title');                     // Traduction simple
const error = t('errors.api.auth.emailRequired');          // Erreur API traduite
const withVar = t('common.welcome', { name: 'John' });     // Avec variable {name}

// Pour CV: langue CV séparée de langue UI
import { getTranslatorForCvLanguage } from '@/lib/i18n/cvLanguageHelper';

const tCv = getTranslatorForCvLanguage(cv.language);       // 'fr', 'en', 'es', 'de'
const sectionTitle = tCv('cvSections.experience');         // Titre dans la langue du CV
```

**Catégories de traductions** :

| Fichier | Contenu |
|---------|---------|
| `ui.json` | Interface (topbar, header, footer, modals, admin) |
| `errors.json` | Erreurs API (`errors.api.*`) |
| `auth.json` | Authentification (login, register, OAuth) |
| `cv.json` | CV (sections, generator, optimization, export) |
| `enums.json` | Niveaux (skillLevels, languageLevels) |
| `subscription.json` | Abonnements, crédits, factures |
| `tasks.json` | File d'attente des tâches |
| `onboarding.json` | Tutoriel complet |
| `account.json` | Compte utilisateur, feedback |

→ **[Guide ajouter une langue](./docs/ADDING_LANGUAGE.md)**

### 11. Erreurs API centralisées

```javascript
// Côté serveur - Utiliser les erreurs pré-définies
import { CommonErrors, AuthErrors, CvErrors, SubscriptionErrors } from '@/lib/api/apiErrors';

// Erreurs communes
return CommonErrors.notAuthenticated();  // 401
return CommonErrors.serverError();       // 500
return CommonErrors.notFound('user');    // 404 avec paramètre

// Erreurs spécifiques
return AuthErrors.emailRequired();
return CvErrors.notFound();
return SubscriptionErrors.limitReached('gpt_cv_generation');

// Erreur personnalisée
import { apiError } from '@/lib/api/apiErrors';
return apiError('errors.api.custom.myError', { status: 400, params: { field: 'email' } });
```

```javascript
// Côté client - Parser et traduire les erreurs
import { parseApiError, getErrorFromResponse } from '@/lib/api/parseApiError';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const { t } = useLanguage();
const response = await fetch('/api/some-route', { method: 'POST' });

if (!response.ok) {
  const data = await response.json();
  const { message, actionRequired, redirectUrl } = parseApiError(data, t);
  // message = "L'email est requis" (traduit dans la langue de l'utilisateur)
}
```

**Catégories d'erreurs** : `CommonErrors`, `AuthErrors`, `CvErrors`, `BackgroundErrors`, `AccountErrors`, `SubscriptionErrors`, `OtherErrors`

→ **[Pattern complet](./docs/CODE_PATTERNS.md#10-api-error-internationalization)**

### 12. Système de Feedback

```javascript
// API endpoint: POST /api/feedback
// Composants: FeedbackButton.jsx, FeedbackModal.jsx
// Admin: FeedbackTab.jsx

// Corps de la requête
{
  rating: 1-5,           // Note (optionnel pour bug reports)
  comment: "...",        // Max 500 chars, XSS sanitized
  isBugReport: boolean,  // true = bug report, false = feedback
  currentCvFile: "...",  // Fichier CV en cours (optionnel)
  pageUrl: "...",        // URL de la page
  userAgent: "..."       // User agent navigateur
}

// Rate limiting: 10 feedbacks/jour/utilisateur
// Feature flag: settings.feature_feedback (admin)
```

→ **[API Reference](./docs/API_REFERENCE.md#post-apifeedback)**

### 13. Utilitaires Site

```javascript
// Version et titre du site
import { SITE_VERSION, SITE_TITLE } from '@/lib/site';

console.log(SITE_VERSION);  // "1.2.3" (de NEXT_PUBLIC_APP_VERSION)
console.log(SITE_TITLE);    // "FitMyCV.io 1.2" (version formatée)

// Formatage intelligent des skills
import { capitalizeSkillName } from '@/lib/utils/textFormatting';

capitalizeSkillName("python");      // "Python" (lowercase -> capitalize)
capitalizeSkillName("SQL");         // "SQL" (all uppercase preserved)
capitalizeSkillName("JavaScript");  // "JavaScript" (mixed case preserved)
capitalizeSkillName("iOS");         // "iOS" (mixed case preserved)
```

→ **[Tous les patterns](./docs/CODE_PATTERNS.md)**

### 14. FeatureMapping (Table de référence nomenclature)

**Rôle** : Table centrale qui fait le lien entre les différents noms de features utilisés dans l'application (Setting, OpenAICall, SubscriptionPlanFeatureLimit).

**⚠️ RÈGLE OBLIGATOIRE** : À chaque ajout, modification ou suppression de feature IA, cette table **DOIT** être mise à jour pour maintenir la cohérence.

**Champs** :

| Champ | Type | Description |
|-------|------|-------------|
| `featureKey` | String | Clé unique standardisée (ex: `match_score`, `gpt_cv_generation`) |
| `displayName` | String | Nom affiché à l'utilisateur (ex: "Score de matching") |
| `settingNames` | Json | Nom(s) dans Setting (category = 'ai_models') |
| `openAICallNames` | Json | Nom(s) utilisés dans OpenAICall.featureName |
| `planFeatureNames` | Json | Nom(s) utilisés dans SubscriptionPlanFeatureLimit.featureName |

**Cas d'utilisation** :

```javascript
// 1. Nouvelle feature IA complète
{
  featureKey: 'match_score',
  settingNames: ['model_match_score'],           // Setting pour le modèle IA
  openAICallNames: ['match_score'],              // Tracking OpenAI
  planFeatureNames: ['match_score'],             // Limite d'abonnement
}

// 2. Feature helper (utilisée par d'autres features)
{
  featureKey: 'detect_language',
  settingNames: ['model_detect_language'],
  openAICallNames: ['detect_cv_language'],
  planFeatureNames: ['match_score', 'gpt_cv_generation', 'import_pdf'],  // Features parentes
}

// 3. Feature complexe (plusieurs modèles/appels)
{
  featureKey: 'gpt_cv_generation',
  settingNames: ['model_analysis_rapid', 'model_analysis_medium', 'model_analysis_deep', 'model_extract_job_offer'],
  openAICallNames: ['generate_cv_url', 'generate_cv_pdf', 'extract_job_offer_url', 'extract_job_offer_pdf', 'create_template_cv_url', 'create_template_cv_pdf'],
  planFeatureNames: ['gpt_cv_generation'],
}
```

**Helper** : `lib/features/featureMapping.js`

```javascript
import { getFeatureMapping, getSettingNamesForFeature } from '@/lib/features/featureMapping';

const mapping = await getFeatureMapping('gpt_cv_generation');
// → { featureKey, displayName, settingNames: [...], openAICallNames: [...], planFeatureNames: [...] }
```

---

## 🧪 Tests & Debug

### Compte de test

Pour les tests automatisés (MCP Puppeteer, scripts) :

```
Email: tests@claude.com
Password: qwertyuiOP93300
```

**Note** : Environnement de développement privé. En production, utiliser des variables d'environnement sécurisées.

### Troubleshooting

- **Erreur Prisma** : `npx prisma generate && npx prisma migrate deploy`
- **Port occupé** : `lsof -i :3001` puis `kill -9 <PID>`
- **Stripe webhooks** : Vérifier `stripe listen` en cours
- **Build échoue** : Vérifier imports, types TypeScript, variables env

→ **[Guide dépannage complet](./docs/TROUBLESHOOTING.md)**

---

## 📜 Project Rules (IMPORTANT pour Claude Code)

### Workflow Git

**Règles générales :**
- ❌ **Ne merge JAMAIS sans demande explicite** (utiliser `--no-ff`)
- ❌ **Ne commit JAMAIS sans demande explicite**
- ❌ **Ne commit JAMAIS sans code review préalable** - Toujours utiliser l'agent code-review-expert AVANT de créer un commit
- ❌ **Ne push JAMAIS sans demande explicite**
- ✅ **Toujours créer des PRs** pour dev→release et release→main
- ✅ **Taguer les versions** : -rc sur release, final sur main

**Structure 3-branches :**

| Branche | Base | Merge vers | Tag | PR requis |
|---------|------|------------|-----|-----------|
| `main` | - | - | v1.2.3 | - |
| `release` | main | main | v1.2.3-rc | ✅ Oui |
| `dev` | release | release | - | ✅ Oui |
| `feature/*` | dev | dev | - | ✅ Oui |
| `improvement/*` | dev | dev | - | ✅ Oui |
| `bug/*` | dev | dev | - | ✅ Oui |
| `hotfix/*` | main | main+release+dev | v1.2.y | ❌ Non (urgence) |

**Nomenclature branches :**
- ✅ **Feature** : `feature/name_of_the_feature` (part de dev)
- ✅ **Amélioration** : `improvement/name_of_the_feature` (part de dev)
- ✅ **Bug** : `bug/name_of_the_feature` (part de dev)
- ✅ **Hotfix** : `hotfix/name_of_the_feature` (part de main, merge dans 3 branches)

**Workflow visuel :**
```
Feature  ───┐ ┌───┐ ┌───     (branches de dev)
         ╲ ╱ ╲ ╱ ╱
Dev      ──○───○───○───     (PR vers release)
          ╱         ╲
Release  ─────────────○──    (tag -rc, PR vers main)
        ╱              ╲
Main   ○────────────────○    (tag final)

Hotfix: main → merge dans (main + release + dev)
```

### Commits

- ❌ **Jamais de "🤖 Generated with"** ou mention de Claude Code
- ✅ **Vérifier et mettre à jour docs/** avant commit

### Développement

- ✅ **npm run dev utilise port 3001**
- ✅ **PostgreSQL** : `fitmycv_dev` (dev) et `fitmycv_prod` (prod) sur même serveur
- ✅ **Mettre à jour la documentation dans le dossier `docs/` et `CLAUDE.md`** Apres chaque modification de la codebase, vérifier la documentation et documenter la modification. Puis tenir à jour le fichier CLAUDE.md

### Documentation

Pour toute question sur :

| Sujet | Documentation |
|-------|---------------|
| Installation | [INSTALLATION.md](./docs/INSTALLATION.md) |
| Architecture | [ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| API | [API_REFERENCE.md](./docs/API_REFERENCE.md) |
| Stripe | [STRIPE_SETUP.md](./docs/STRIPE_SETUP.md) |
| Admin | [ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md) |
| Télémétrie | [TELEMETRY.md](./docs/TELEMETRY.md) |
| Variables env | [ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md) |
| Commandes | [COMMANDS_REFERENCE.md](./docs/COMMANDS_REFERENCE.md) |
| Patterns code | [CODE_PATTERNS.md](./docs/CODE_PATTERNS.md) |
| Design System | [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) |
| Troubleshooting | [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) |

---

## 🔗 Index Documentation

### Core Documentation (Must Read)
1. [README](./docs/README.md) - Index général
2. [ARCHITECTURE](./docs/ARCHITECTURE.md) - Architecture système
3. [DEVELOPMENT](./docs/DEVELOPMENT.md) - Guide développement
4. [API_REFERENCE](./docs/API_REFERENCE.md) - Référence API

### Setup & Configuration
5. [INSTALLATION](./docs/INSTALLATION.md) - Installation initiale
6. [ENVIRONMENT_VARIABLES](./docs/ENVIRONMENT_VARIABLES.md) - Variables env
7. [STRIPE_SETUP](./docs/STRIPE_SETUP.md) - Configuration Stripe
8. [DEPLOYMENT](./docs/DEPLOYMENT.md) - Déploiement production
9. [CRON_SETUP](./docs/CRON_SETUP.md) - Tâches planifiées

### Technical Deep Dives
10. [DATABASE](./docs/DATABASE.md) - Schéma, migrations
11. [AI_INTEGRATION](./docs/AI_INTEGRATION.md) - OpenAI intégration
12. [SUBSCRIPTION](./docs/SUBSCRIPTION.md) - Système abonnements
13. [SECURITY](./docs/SECURITY.md) - Sécurité, chiffrement
14. [COMPONENTS](./docs/COMPONENTS.md) - Structure composants
15. [FEATURES](./docs/FEATURES.md) - Fonctionnalités détaillées

### Guides & References
16. [COMMANDS_REFERENCE](./docs/COMMANDS_REFERENCE.md) - Toutes les commandes
17. [CODE_PATTERNS](./docs/CODE_PATTERNS.md) - Patterns réutilisables
18. [DESIGN_SYSTEM](./docs/DESIGN_SYSTEM.md) - UI/UX guidelines
19. [ADMIN_GUIDE](./docs/ADMIN_GUIDE.md) - Dashboard admin
20. [TELEMETRY](./docs/TELEMETRY.md) - Système télémétrie
21. [MCP_PUPPETEER](./docs/MCP_PUPPETEER.md) - Browser automation

### Practical Guides
22. [USAGE](./docs/USAGE.md) - Guide utilisateur
23. [TROUBLESHOOTING](./docs/TROUBLESHOOTING.md) - Résolution problèmes
24. [MVP_TESTING](./docs/MVP_TESTING.md) - Tests et validation
25. [STRIPE_REFACTORING](./docs/STRIPE_REFACTORING.md) - Notes refactoring

---

**📝 Note** : Ce fichier est un **quick reference**. Pour toute information détaillée, consulter la **[documentation complète dans docs/](./docs/README.md)**.
- Ne pas lire le fichier .env, demander à l'utilisateur de copier coller le contenu du .env
- A chaque demande de commit, de PR, de merge etc... ne pas lancer les stop hooks
- Ne JAMAIS faire de db push ! UNIQUEMENT DES MIGRATIONS !!! Si une migration échoue, demande moi quoi faire !