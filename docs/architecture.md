# Architecture - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet

## Résumé Exécutif

FitMyCV.io est une application web SaaS permettant aux utilisateurs de créer des CV optimisés par IA pour des offres d'emploi spécifiques. L'application analyse une offre d'emploi et adapte automatiquement le CV de l'utilisateur pour maximiser la correspondance.

**Points clés :**
- Application monolithe Next.js 14 avec App Router
- Base de données PostgreSQL via Prisma 6
- Intégration OpenAI pour génération et optimisation IA
- Monétisation dual : Abonnements Stripe + Système de crédits
- 4 langues supportées (FR, EN, DE, ES)

---

## Stack Technologique

| Catégorie | Technologie | Version | Justification |
|-----------|-------------|---------|---------------|
| **Framework** | Next.js | 14.2.35 | App Router, Server Components, API Routes intégrées |
| **Frontend** | React | 18.2.0 | Écosystème riche, hooks, Server Components |
| **Styling** | Tailwind CSS | 3.4.4 | Utility-first, design system rapide |
| **Animation** | Framer Motion | 12.23.24 | Animations fluides React |
| **ORM** | Prisma | 6.16.2 | Type-safe, migrations, PostgreSQL |
| **Database** | PostgreSQL | 14+ | JSONB pour stockage CV, fiabilité |
| **Auth** | NextAuth.js | 4.24.11 | OAuth multi-provider, JWT |
| **AI** | OpenAI SDK | 6.0.0 | GPT-4o, Structured Outputs |
| **Payments** | Stripe | 19.1.0 | Subscriptions, webhooks |
| **Email** | Nodemailer + Resend | 7.0.12 / 6.1.2 | SMTP primaire + API fallback |
| **PDF** | Puppeteer | 24.23.0 | Génération PDF, scraping |
| **Icons** | Lucide React | 0.544.0 | Icônes cohérentes |
| **Charts** | Recharts | 3.3.0 | Analytics admin |

---

## Pattern Architectural

### Type : Application Web Monolithe avec API Routes

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    React Components                      ││
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐ ││
│  │  │ TopBar  │ │ Header  │ │ Skills  │ │ Experience... │ ││
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └───────┬───────┘ ││
│  │       │           │           │               │         ││
│  │  ┌────▼───────────▼───────────▼───────────────▼───────┐ ││
│  │  │              7 Context Providers                    │ ││
│  │  │  Session → Settings → Language → Notifications →    │ ││
│  │  │  Admin → Onboarding → BackgroundTasks              │ ││
│  │  └────────────────────────┬───────────────────────────┘ ││
│  └───────────────────────────│─────────────────────────────┘│
└──────────────────────────────│──────────────────────────────┘
                               │ HTTP/SSE
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   App Router (app/)                      ││
│  │  ┌─────────────┐  ┌──────────────────────────────────┐  ││
│  │  │   Pages     │  │         API Routes (110)          │  ││
│  │  │  (Server    │  │  /auth  /cvs  /subscription      │  ││
│  │  │ Components) │  │  /admin /checkout /analytics     │  ││
│  │  └──────┬──────┘  └──────────────┬───────────────────┘  ││
│  │         │                        │                       ││
│  │  ┌──────▼────────────────────────▼───────────────────┐  ││
│  │  │               Core Libraries (lib/)                │  ││
│  │  │  ┌──────┐ ┌────┐ ┌────────┐ ┌────────────────┐    │  ││
│  │  │  │ auth │ │ cv │ │ openai │ │ subscription   │    │  ││
│  │  │  └──────┘ └────┘ └────────┘ └────────────────┘    │  ││
│  │  │  ┌───────┐ ┌─────────────────┐ ┌───────────┐      │  ││
│  │  │  │ email │ │ backgroundTasks │ │ telemetry │      │  ││
│  │  │  └───────┘ └─────────────────┘ └───────────┘      │  ││
│  │  └───────────────────────┬───────────────────────────┘  ││
│  └──────────────────────────│──────────────────────────────┘│
└─────────────────────────────│───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    External Services                         │
│  ┌──────────┐  ┌────────┐  ┌────────┐  ┌─────────────────┐ │
│  │PostgreSQL│  │ OpenAI │  │ Stripe │  │ SMTP/Resend    │ │
│  │ (Prisma) │  │  API   │  │  API   │  │    Email       │ │
│  └──────────┘  └────────┘  └────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture des Données

### Modèles Prisma (29 tables)

#### Authentification & Utilisateurs
```prisma
User {
  id, email, name, password, role, emailVerified,
  accounts[], cvFiles[], subscription, creditBalance,
  backgroundTasks[], feedbacks[], telemetryEvents[]
}

Account {
  provider, providerAccountId, access_token, refresh_token
}

Session {
  sessionToken, expires, userId
}
```

#### CVs & Versions
```prisma
CvFile {
  id, userId, filename, content (JSONB),
  sourceType, sourceValue, createdBy, language,
  matchScore, matchScoreBreakdown, scoreBefore,
  suggestions, missingSkills, matchingSkills,
  contentVersion, deletedAt,
  versions[], jobOffer
}

CvVersion {
  id, cvFileId, version, content (JSONB),
  changelog, changeType, matchScore, createdAt
}

JobOffer {
  id, contentHash, rawContent, parsedData,
  sourceUrl, sourceFilename, cvFiles[]
}
```

#### Monétisation
```prisma
Subscription {
  id, userId, planId, status, billingPeriod,
  stripeCustomerId, stripeSubscriptionId,
  currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd
}

SubscriptionPlan {
  id, name, tier, priceMonthly, priceYearly,
  stripePriceIdMonthly, stripePriceIdYearly,
  featureLimits[]
}

CreditBalance {
  id, userId, balance, totalPurchased, totalUsed,
  totalRefunded, totalGifted
}

CreditTransaction {
  id, userId, amount, type, featureName,
  metadata, refundedAt, refundReason
}

FeatureCounter {
  id, userId, featureName, count, periodStart, periodEnd
}
```

#### Système
```prisma
BackgroundTask {
  id, userId, title, type, status,
  payload, result, error, deviceId
}

EmailTemplate {
  id, name, subject, htmlContent, designJson,
  variables, triggerId, isDefault, isActive
}

TelemetryEvent {
  id, userId, type, status, metadata, duration
}

Setting {
  id, name, value
}
```

### Stockage CV

Les CVs sont stockés en **JSONB** dans PostgreSQL (colonne `CvFile.content`), pas en fichiers.

**Structure JSON CV :**
```json
{
  "header": {
    "full_name": "string",
    "current_title": "string",
    "email": "string",
    "phone": "string",
    "city": "string",
    "region": "string",
    "country_code": "string",
    "links": [{"type": "string", "url": "string"}]
  },
  "summary": {
    "headline": "string",
    "description": "string",
    "domains": ["string"],
    "key_strengths": ["string"]
  },
  "skills": {
    "hard_skills": ["string"],
    "soft_skills": ["string"],
    "tools": ["string"],
    "methodologies": ["string"]
  },
  "experience": [{
    "title": "string",
    "company": "string",
    "start_date": "string",
    "end_date": "string|null",
    "location": "string",
    "description": "string",
    "responsibilities": ["string"],
    "deliverables": ["string"],
    "skills_used": ["string"]
  }],
  "education": [{...}],
  "languages": [{...}],
  "extras": [{...}],
  "projects": [{...}],
  "section_titles": {...}
}
```

---

## Architecture API

### Organisation (110 endpoints)

| Domaine | Endpoints | Description |
|---------|-----------|-------------|
| `/api/auth/` | 9 | Authentification, OAuth, vérification email |
| `/api/account/` | 6 | Gestion profil, mot de passe, comptes liés |
| `/api/cvs/` | 13 | CRUD CVs, versions, restauration |
| `/api/cv/` | - | Opérations CV (improve, match-score) |
| `/api/background-tasks/` | 8 | Queue tâches, sync, annulation |
| `/api/subscription/` | 11 | Plans, abonnements, annulation |
| `/api/credits/` | 3 | Solde, transactions, coûts |
| `/api/checkout/` | 3 | Sessions Stripe |
| `/api/admin/` | 33 | Administration complète |
| `/api/analytics/` | 8 | KPIs, événements, usage |
| `/api/webhooks/stripe/` | 1 | Webhooks Stripe |

### Pattern de Réponse

**Succès :**
```json
{
  "success": true,
  "data": {...},
  "message": "string (optionnel)"
}
```

**Erreur :**
```json
{
  "error": "string",
  "details": "string (optionnel)",
  "actionRequired": "string (optionnel)",
  "redirectUrl": "string (optionnel)"
}
```

**Tâche en queue (202) :**
```json
{
  "success": true,
  "queued": true,
  "taskId": "string"
}
```

---

## Architecture Composants React

### Hiérarchie des Providers

```
SessionProvider (NextAuth)
└─ RecaptchaProvider (reCAPTCHA v3)
   └─ SettingsProvider (paramètres système)
      └─ LanguageProvider (i18n)
         └─ NotificationProvider (toasts)
            └─ AdminProvider (mode édition)
               └─ OnboardingProvider (état onboarding)
                  └─ RealtimeRefreshProvider (SSE)
                     └─ BackgroundTasksProvider (queue)
```

### Catégories de Composants

| Catégorie | Composants | Fonction |
|-----------|------------|----------|
| **Providers** | 7 | État global, contextes |
| **Sections CV** | 8 | Header, Summary, Skills, Experience, Education, Languages, Projects, Extras |
| **TopBar** | 15+ | Navigation, modals, hooks |
| **Onboarding** | 8 | Flow guidé utilisateur |
| **Subscription** | 12 | Gestion abonnements |
| **Admin** | 15+ | Dashboard admin |
| **UI** | 20+ | Composants réutilisables |

---

## Système de Tâches Background

### Queue In-Memory

```javascript
// lib/backgroundTasks/jobQueue.js
const MAX_CONCURRENT_JOBS = 3;
const queue = [];
let activeCount = 0;

function enqueueJob(jobRunner) {
  queue.push(jobRunner);
  processQueue();
}
```

### Types de Tâches

| Type | Fonction | Feature Counter |
|------|----------|-----------------|
| `generation` | Génération CV depuis offre | `gpt_cv_generation` |
| `import-pdf` | Import PDF vers CV | `import_pdf` |
| `improve-cv` | Optimisation IA | `optimize_cv` |
| `translate` | Traduction CV | `translate_cv` |
| `match-score` | Calcul score | (gratuit) |

### Cycle de Vie

```
queued → running → completed | failed | cancelled
```

---

## Système de Monétisation

### Mode Abonnement

```
Plans disponibles:
├── Free (tier 0) : Limites basiques
├── Basic (tier 1) : Limites étendues
├── Pro (tier 2) : Limites généreuses
└── Enterprise (tier 3) : Illimité
```

### Mode Crédits Only

Activé via setting `subscription_mode_enabled = false` :
- Pas d'abonnement créé
- Bonus de bienvenue en crédits
- Chaque feature a un coût en crédits

### Contrôle d'Accès Features

```javascript
// Flux de vérification
canUseFeature(userId, featureName)
  ├── Check balance négatif → BLOQUER
  ├── Check feature activée → BLOQUER si désactivée
  ├── Check limite atteinte → PROPOSER crédit
  └── OK → AUTORISER
```

---

## Flux de Données Principaux

### 1. Génération CV depuis Offre d'Emploi

```
1. Utilisateur soumet URL/PDF
2. API crée BackgroundTask (status: queued)
3. jobQueue.enqueueJob() → processQueue()
4. Job runner:
   a. Fetch URL ou parse PDF
   b. Extract job offer → JSON (Structured Output)
   c. Store JobOffer en DB
   d. Generate CV modifications (DIFF)
   e. Apply modifications au CV source
   f. Store nouveau CvFile
5. Task → completed, emit SSE
6. Client reçoit notification
```

### 2. Authentification OAuth

```
1. Utilisateur clique "Sign in with Google"
2. NextAuth redirige vers Google
3. Google callback → /api/auth/callback/google
4. NextAuth:
   a. Crée/update User
   b. Crée Account lié
   c. Assigne plan par défaut
   d. Crée session JWT
5. Redirect vers app avec cookies session
```

### 3. Paiement Stripe

```
1. Utilisateur choisit plan/crédits
2. API crée Checkout Session
3. Redirect vers Stripe Checkout
4. Paiement réussi → Stripe webhook
5. Webhook handler:
   a. Vérifie signature
   b. Update subscription OU
   c. Grant credits
   d. Log transaction
6. Client poll ou SSE → UI update
```

---

## Sécurité

### Authentification
- **JWT** : Sessions 7 jours, refresh 24h
- **OAuth** : Google, GitHub, Apple
- **Credentials** : bcrypt hashing, validation forte

### Protection
- **reCAPTCHA v3** : Login, registration, actions sensibles
- **Rate limiting** : Feedback (10/jour), email change (1/min)
- **Sanitization** : XSS protection sur inputs
- **CSRF** : NextAuth built-in

### Données
- **CV encryption** : En transit (TLS)
- **Null bytes** : Sanitisés avant stockage JSONB
- **Tokens** : One-time use, expiration stricte

---

## Performances

### Optimisations
- **Server Components** : Rendu serveur pour pages statiques
- **Memoization** : useMemo, useCallback dans providers
- **Debouncing** : SSE events (500ms)
- **Lazy loading** : Modals via portals
- **Caching** : Content hash pour PDFs duplicates

### Points d'Attention
- **OnboardingProvider** : 42KB, état complexe
- **TopBar** : 9 hooks, nombreux re-renders potentiels
- **CVImprovementPanel** : 45KB modal

---

## Monitoring & Analytics

### Telemetry Events

| Catégorie | Types |
|-----------|-------|
| CV | GENERATED, IMPORTED, EXPORTED, DELETED, TRANSLATED |
| Jobs | QUEUED, STARTED, COMPLETED, FAILED, CANCELLED |
| Auth | REGISTERED, LOGIN, LOGOUT, EMAIL_VERIFIED |
| UI | PAGE_VIEW, BUTTON_CLICK, MODAL_OPENED |

### Métriques Admin
- KPIs utilisateurs (total, actifs, vérifiés)
- Usage features par période
- Revenus et conversions
- Erreurs et taux de succès jobs

---

## Déploiement

### Environnement
- **Dev** : PostgreSQL local, port 3001
- **Prod** : PostgreSQL managé, port 3000

### Build
```bash
npm run build  # Génère .next/
npm start      # Démarre serveur production
```

### Migrations
```bash
npx prisma migrate deploy  # Applique migrations en prod
```

---

## Points d'Extension

### Ajouter une Feature
1. Définir dans `SubscriptionPlanFeatureLimit`
2. Ajouter coût dans `creditCost.js`
3. Implémenter vérification `canUseFeature()`
4. Incrémenter `featureUsage` après action

### Ajouter un Provider OAuth
1. Configurer dans `lib/auth/options.js`
2. Ajouter credentials dans `.env`
3. Ajouter bouton dans UI auth
4. Gérer callback dans `/api/auth/callback/[provider]`

### Ajouter une Langue
1. Créer dossier `locales/{code}/`
2. Copier fichiers JSON depuis `locales/en/`
3. Traduire les fichiers
4. Ajouter code dans `lib/i18n/languages.js`
