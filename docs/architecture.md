# Architecture Technique - FitMyCV.io

> Documentation générée le 2026-01-07 | Scan exhaustif BMAD v1.2.0

---

## Vue d'Ensemble

**FitMyCV.io** est une application SaaS de génération de CV optimisés par IA, construite en architecture monolithique moderne avec Next.js 14.

### Stack Technologique

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Framework** | Next.js (App Router) | 14.2.35 |
| **Frontend** | React | 18.2.0 |
| **Styling** | Tailwind CSS | 3.4.4 |
| **Animations** | Framer Motion | 12.23.24 |
| **Database** | PostgreSQL | - |
| **ORM** | Prisma | 6.16.2 |
| **Auth** | NextAuth.js | 4.24.11 |
| **AI** | OpenAI SDK | 6.0.0 |
| **Payments** | Stripe | 19.1.0 |
| **Email** | Nodemailer + Resend | 7.0.12 / 6.1.2 |
| **PDF** | Puppeteer + pdf2json | 24.23.0 / 3.2.2 |

---

## Architecture Applicative

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React     │  │  Tailwind   │  │   Framer Motion         │  │
│  │   18.2.0    │  │   CSS       │  │   (animations)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS 14 (App Router)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    127 API Routes                        │    │
│  │  /api/auth/*  /api/cv/*  /api/admin/*  /api/subscription│    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Middleware Layer                      │    │
│  │  • Auth (NextAuth JWT)  • i18n  • Rate Limiting         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   PostgreSQL  │    │    OpenAI     │    │    Stripe     │
│   (Prisma 6)  │    │   GPT-4o      │    │  Payments     │
│   33 models   │    │   API         │    │  Webhooks     │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## Patterns Architecturaux

### 1. App Router (Next.js 14)

Structure basée sur le système de fichiers :

```
app/
├── page.jsx              # Page principale (CV Editor)
├── layout.jsx            # Layout racine avec providers
├── api/                  # 127 API Routes
│   ├── auth/            # Authentification
│   ├── cv/              # Opérations CV
│   ├── cvs/             # CRUD CVs
│   ├── admin/           # Administration
│   └── subscription/    # Abonnements
├── auth/                # Pages auth (signin, register)
├── admin/               # Dashboard admin
└── account/             # Paramètres compte
```

### 2. Layered Architecture

```
┌────────────────────────────────────────┐
│           Presentation Layer           │
│  components/ (150 React components)    │
├────────────────────────────────────────┤
│            API Layer                   │
│  app/api/* (127 routes)               │
├────────────────────────────────────────┤
│           Business Logic               │
│  lib/* (25 modules)                   │
├────────────────────────────────────────┤
│            Data Layer                  │
│  prisma/schema.prisma (33 models)     │
└────────────────────────────────────────┘
```

### 3. Provider Pattern (React Context)

```jsx
// components/RootProviders.jsx
<SessionProvider>
  <NotificationProvider>
    <BackgroundTasksProvider>
      <SettingsProvider>
        <OnboardingProvider>
          <HighlightProvider>
            {children}
          </HighlightProvider>
        </OnboardingProvider>
      </SettingsProvider>
    </BackgroundTasksProvider>
  </NotificationProvider>
</SessionProvider>
```

---

## Modules Core (lib/)

### Authentication (`lib/auth/`)

| Fichier | Purpose |
|---------|---------|
| `options.js` | Configuration NextAuth (JWT, OAuth providers) |
| `session.js` | Wrapper getServerSession |
| `autoSignIn.js` | Auto-signin post vérification email |

**Stratégie** : JWT avec refresh 24h, max 7 jours
**Providers** : Credentials, Google, GitHub, Apple

### CV Management (`lib/cv/`)

| Fichier | Purpose |
|---------|---------|
| `storage.js` | CRUD CVs en PostgreSQL (migration depuis FS) |
| `validation.js` | Validation JSON-Schema |
| `versioning.js` | Historique versions (rollback) |
| `changeTracking.js` | Tracking modifications IA |
| `detectLanguage.js` | Détection automatique langue |

**Pattern** : CVs stockés en JSON dans `CvFile.content`

### OpenAI Integration (`lib/openai/`)

| Fichier | Purpose |
|---------|---------|
| `client.js` | Client OpenAI avec cache déduplication |
| `extraction/` | Extraction offres d'emploi (URL/PDF) |
| `improveCv.js` | Amélioration CV existant |
| `translateCv.js` | Traduction multi-langue |
| `importPdf.js` | Extraction CV depuis PDF |
| `promptLoader.js` | Chargement prompts dynamiques |

**Models** : GPT-4o (configurable via admin)
**Features** : Structured Outputs, Cache 5min, Telemetry

### Subscription System (`lib/subscription/`)

| Fichier | Purpose |
|---------|---------|
| `subscriptions.js` | Gestion plans Stripe |
| `credits.js` | Balance et transactions crédits |
| `featureUsage.js` | Compteurs mensuels par feature |
| `cvLimits.js` | Limites CV par plan |

**Pattern** : Compteurs reset mensuel (date anniversaire)

### Background Tasks (`lib/backgroundTasks/`)

```javascript
// Pattern: Queue FIFO avec max 3 concurrent
enqueueJob(() => startSingleOfferGeneration(taskId, offerId));
```

| Job | Durée typique |
|-----|---------------|
| `startSingleOfferGeneration` | 30-60s |
| `importPdfJob` | 10-30s |
| `translateCvJob` | 20-40s |
| `improveCvJob` | 20-40s |

---

## Flux de Données

### 1. Génération CV (Flow Principal)

```
User Input (Job URL/PDF)
        │
        ▼
┌───────────────────┐
│  Background Task  │
│  (enqueueJob)     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────┐
│  Puppeteer/PDF    │────▶│  Content      │
│  Extraction       │     │  Extraction   │
└───────────────────┘     └───────┬───────┘
                                  │
                                  ▼
                    ┌───────────────────────┐
                    │  OpenAI GPT-4o        │
                    │  Structured Output    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  CV Validation        │
                    │  (JSON Schema)        │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  PostgreSQL           │
                    │  CvFile.content       │
                    └───────────────────────┘
```

### 2. Authentification

```
User Login
    │
    ├──▶ Credentials ──▶ bcrypt verify ──▶ JWT
    │
    └──▶ OAuth (Google/GitHub/Apple) ──▶ JWT
                                            │
                                            ▼
                                    Session (7 days max)
```

### 3. Paiement (Stripe)

```
Checkout Session
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Stripe    │────▶│  Webhook    │
│   Payment   │     │  Handler    │
└─────────────┘     └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    Subscription      CreditBalance    EmailLog
       Update           Update          Send
```

---

## Sécurité

### Authentification & Autorisation

- **JWT Strategy** : Tokens signés, refresh automatique
- **OAuth** : Google, GitHub, Apple avec PKCE
- **Password** : bcryptjs (hash + salt)
- **reCAPTCHA v3** : Protection formulaires

### Validation & Sanitization

```javascript
// lib/security/
validateUploadedFile()  // MIME type, size, virus scan
sanitizeFilename()      // Path traversal prevention
sanitizeHtml()          // XSS prevention
checkPasswordStrength() // Policy enforcement
```

### Protection Données

- **CV Encryption** : Données sensibles chiffrées
- **RGPD** : Consent logging, export/delete data
- **Secure Headers** : CSP, HSTS via Next.js

---

## Performance

### Caching

| Niveau | Stratégie |
|--------|-----------|
| **OpenAI** | Cache déduplication 5min (concurrent requests) |
| **Settings** | In-memory cache (modèles IA) |
| **Static** | Next.js ISR pour pages publiques |

### Optimisations

- **Code Splitting** : App Router automatic
- **Image Optimization** : Next/Image + Sharp
- **DB Queries** : Prisma query optimization, indexes
- **Background Jobs** : Max 3 concurrent (memory management)

---

## Monitoring & Observabilité

### Telemetry (`lib/telemetry/`)

```javascript
// Events trackés
trackUserRegistration(), trackUserLogin()
trackCvGeneration(), trackCvImport(), trackCvExport()
trackMatchScore(), trackOpenAIUsage()
```

### Admin Dashboard

- **KPIs** : Users, CVs, Revenue, OpenAI costs
- **Logs** : Email logs, webhook logs, error tracking
- **Alerts** : OpenAI budget alerts

---

## Intégrations Externes

| Service | Usage | Configuration |
|---------|-------|---------------|
| **OpenAI** | CV generation, improvement, translation | `OPENAI_API_KEY` |
| **Stripe** | Subscriptions, credits, invoices | `STRIPE_SECRET_KEY` |
| **Resend** | Email transactionnel (fallback) | `RESEND_API_KEY` |
| **SMTP OVH** | Email primaire | `SMTP_*` env vars |
| **Google** | OAuth, reCAPTCHA | `GOOGLE_*` env vars |
| **GitHub** | OAuth | `GITHUB_*` env vars |
| **Apple** | OAuth | `APPLE_*` env vars |

---

## Scalabilité

### Horizontal Scaling

L'architecture permet un scaling horizontal :

1. **Stateless API** : JWT (pas de sessions serveur)
2. **Database** : PostgreSQL avec connection pooling
3. **Background Jobs** : Queue en mémoire (à migrer vers Redis pour multi-instance)

### Limitations Actuelles

- Background jobs en mémoire (single instance)
- Settings cache local (à synchroniser multi-instance)

### Recommandations Evolution

1. Redis pour job queue et cache partagé
2. CDN pour assets statiques
3. Read replicas PostgreSQL si besoin

---

## Fichiers Clés

| Fichier | Purpose |
|---------|---------|
| `app/layout.jsx` | Layout racine, providers |
| `app/page.jsx` | CV Editor principal |
| `middleware.js` | Auth, i18n, redirects |
| `lib/prisma.js` | Singleton Prisma client |
| `prisma/schema.prisma` | 33 modèles de données |
| `next.config.js` | Configuration Next.js |
| `tailwind.config.js` | Design system |
