# Architecture Technique - FitMyCV.io

> Application SaaS de génération de CV optimisés par IA

---

## Vue d'ensemble

**FitMyCV.io** est une application web full-stack monolithique construite avec Next.js 16 (App Router). Elle permet aux utilisateurs de créer, optimiser et exporter des CV personnalisés grâce à l'intelligence artificielle.

### Caractéristiques architecturales

| Aspect | Choix |
|--------|-------|
| **Type** | Monolith full-stack |
| **Framework** | Next.js 16.1.1 (App Router) |
| **Bundler** | Turbopack (défaut Next.js 16) |
| **Rendering** | Hybrid (SSR + Client Components) |
| **API** | API Routes (serverless-like) |
| **Base de données** | PostgreSQL via Prisma 6 |
| **Authentification** | NextAuth.js 4 (OAuth + Credentials) |
| **Paiements** | Stripe (abonnements + crédits) |
| **IA** | OpenAI API (modèles configurables) |

---

## Stack Technologique

### Frontend

| Technologie | Version | Usage |
|-------------|---------|-------|
| React | 19.2.3 | UI Components |
| Next.js | 16.1.1 | Framework (App Router) |
| Tailwind CSS | 4.1.18 | Styling |
| Framer Motion | 12.25.0 | Animations |
| Lucide React | 0.562.0 | Icônes |
| Recharts | 3.6.0 | Graphiques (admin) |
| @dnd-kit | 6.3.1+ | Drag & Drop |

### Backend

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js API Routes | 16.1.1 | REST API |
| Prisma | 6.19.1 | ORM |
| PostgreSQL | - | Base de données |
| NextAuth.js | 4.24.13 | Authentification |

### Services externes

| Service | Usage |
|---------|-------|
| OpenAI API | Génération CV, scoring, extraction offres |
| Stripe | Abonnements, packs crédits, facturation |
| SMTP OVH | Email principal |
| Resend | Email fallback |
| Google reCAPTCHA v3 | Protection bot |

### Outils

| Outil | Usage |
|-------|-------|
| Puppeteer | Export PDF, scraping |
| pdf-parse | Extraction texte PDF |
| docx | Export DOCX |
| AJV | Validation JSON Schema |
| Luxon | Manipulation dates |

---

## Architecture Applicative

### Couches

```
┌─────────────────────────────────────────────────────────────┐
│                    PRÉSENTATION                              │
│  React Components (231) + Tailwind CSS + Framer Motion      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER                                 │
│  Next.js API Routes (113 endpoints)                         │
│  - Auth (9) - CV (15) - Subscription (14) - Admin (38)     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC                            │
│  lib/ modules (31 modules, 165 fichiers)                    │
│  - cv-core - subscription - openai-core - background-jobs   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    DATA ACCESS                               │
│  Prisma ORM (33 modèles)                                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                            │
│  PostgreSQL + OpenAI + Stripe + Email (SMTP/Resend)         │
└─────────────────────────────────────────────────────────────┘
```

### Flux de données principal

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│   API    │────▶│   lib/   │────▶│  Prisma  │
│  React   │◀────│  Routes  │◀────│ modules  │◀────│    DB    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │
                      ▼
              ┌──────────────┐
              │   Services   │
              │   externes   │
              │ OpenAI/Stripe│
              └──────────────┘
```

---

## Modules Métier

### Organisation des domaines

```
lib/
├── AUTHENTIFICATION
│   ├── auth/           # NextAuth config + session
│   ├── security/       # Validation, sanitization
│   └── recaptcha/      # Vérification bot
│
├── CV CORE
│   ├── cv-core/        # Storage, validation, versioning
│   ├── job-offer/      # Extraction offres emploi
│   ├── scoring/        # Match score CV/offre
│   └── translation/    # Traduction CV
│
├── INTELLIGENCE ARTIFICIELLE
│   ├── openai-core/    # Client API, helpers
│   └── prompts-shared/ # Prompts réutilisables
│
├── BILLING
│   ├── subscription/   # Plans, crédits, limites
│   └── stripe/         # Intégration Stripe (client, locale)
│
├── ASYNC PROCESSING
│   └── background-jobs/# Queue tâches (max 3 concurrent)
│
├── COMMUNICATION
│   ├── email/          # SMTP + Resend
│   └── events/         # Event emitter temps réel
│
├── ANALYTICS
│   ├── telemetry/      # Tracking événements
│   ├── analytics/      # Dashboards
│   └── admin/          # Config admin
│
└── SUPPORT
    ├── settings/       # Settings dynamiques
    ├── i18n/           # Labels localisés
    ├── utils/          # Helpers génériques (normalizeJobUrl, etc.)
    └── api/            # Factory erreurs
```

### Dépendances entre modules

```
auth ──────────────▶ subscription (plan par défaut)
                  ├─▶ email (emails bienvenue)
                  └─▶ telemetry (tracking login)

cv-core ───────────▶ settings (max versions)
                  └─▶ utils (sanitization)

subscription ──────▶ settings (mode subscription)
                  ├─▶ events (refresh UI)
                  └─▶ prisma

background-jobs ───▶ subscription (feature limits)
                  └─▶ telemetry (tracking)

openai-core ───────▶ settings (model selection)
```

---

## Patterns Architecturaux

### 1. Feature Authorization Pattern

Contrôle d'accès aux fonctionnalités basé sur le plan d'abonnement et les crédits.

```javascript
// lib/subscription/featureUsage.js
const check = await canUseFeature(userId, 'generate_cv');

if (!check.canUse) {
  return apiError(CommonErrors.limitReached());
}

if (check.useCredit) {
  await debitCredit(userId, check.creditCost, 'generate_cv');
}

// Exécuter la fonctionnalité...

await incrementFeatureCounter(userId, 'generate_cv');
```

### 2. Background Job Queue Pattern

Queue de tâches asynchrones avec limite de concurrence.

```javascript
// lib/background-jobs/jobQueue.js
// Max 3 jobs globaux en parallèle
// Max 3 cv_generation par utilisateur
// Autres types: 1 seul à la fois par utilisateur

const canStart = canStartTaskType(userId, 'cv_generation');
if (!canStart.allowed) return;

registerTaskTypeStart(userId, 'cv_generation');
try {
  enqueueJob(async () => {
    // Tâche longue durée
  });
} finally {
  registerTaskTypeEnd(userId, 'cv_generation');
}
```

### 3. CV Versioning Pattern

Historique des versions avant modifications IA.

```javascript
// lib/cv-core/versioning.js
// AVANT modification IA
const version = await createCvVersion(userId, filename, 'Optimization');

// Modifier le CV
await writeUserCvFile(userId, filename, optimizedContent);

// Restauration possible
await restoreCvVersion(userId, filename, targetVersion);
```

### 4. Error Factory Pattern

Gestion centralisée des erreurs API avec i18n.

```javascript
// lib/api/apiErrors.js
export function apiError(translationKey, options = {}) {
  return NextResponse.json(
    { error: translationKey, ...options.params },
    { status: options.status || 400 }
  );
}

export const CommonErrors = {
  notAuthenticated: () => apiError('errors.api.notAuthenticated', { status: 401 }),
  limitReached: (feature) => apiError('errors.api.limitReached', { feature, status: 403 }),
  // ...
};
```

### 5. Provider Composition Pattern

Imbrication des contextes React.

```javascript
// components/providers/RootProviders.jsx
<SessionProvider>
  <RecaptchaProvider>
    <SettingsProvider>
      <CreditCostsProvider>
        <LanguageProvider>
          <NotificationProvider>
            <AdminProvider>
              <OnboardingProvider>
                {/* App content */}
              </OnboardingProvider>
            </AdminProvider>
          </NotificationProvider>
        </LanguageProvider>
      </CreditCostsProvider>
    </SettingsProvider>
  </RecaptchaProvider>
</SessionProvider>
```

### 6. Event-Driven UI Updates

Mise à jour temps réel via événements custom.

```javascript
// Émission (serveur ou client)
window.dispatchEvent(new CustomEvent('cv:updated', { detail: { filename } }));
window.dispatchEvent(new CustomEvent('credits:updated'));

// Écoute (composants)
useEffect(() => {
  const handler = (e) => refreshData();
  window.addEventListener('cv:updated', handler);
  return () => window.removeEventListener('cv:updated', handler);
}, []);
```

---

## Authentification

### Providers supportés

| Provider | Type | Particularités |
|----------|------|----------------|
| Google | OAuth 2.0 | Login social |
| GitHub | OAuth 2.0 | Login social |
| Apple | OAuth 2.0 | Login social (Sign in with Apple) |
| Credentials | Email/Password | Vérification email requise |

### Flux d'authentification

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Signup    │────▶│  Verify     │────▶│   Login     │
│  (email)    │     │   Email     │     │  (auto)     │
└─────────────┘     └─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐
│   OAuth     │────▶│   Login     │  (direct, email vérifié)
│  Provider   │     │  (session)  │
└─────────────┘     └─────────────┘
```

### Session JWT

- **Durée** : 7 jours
- **Stockage** : Cookie HttpOnly, Secure, SameSite=Lax
- **Contenu** : userId, email, name, role, image

---

## Système de Billing

### Modes de fonctionnement

**Mode Abonnement** (par défaut) :
- Plans : Gratuit, Pro, Premium
- Limites mensuelles par feature
- Compteurs réinitialisés chaque mois
- Crédits supplémentaires achetables

**Mode Crédits uniquement** :
- Pas d'abonnement Stripe
- Crédits de bienvenue configurables
- Tout payé en crédits

### Architecture Stripe

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Checkout  │────▶│   Stripe    │────▶│   Webhook   │
│   Session   │     │   Payment   │     │   Handler   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                        ┌─────────────┐
                                        │   Update    │
                                        │   Database  │
                                        └─────────────┘
```

### Modèles de données billing

```
User ──────▶ Subscription ──────▶ SubscriptionPlan
  │                                      │
  ├──────▶ CreditBalance                 ▼
  │              │              SubscriptionPlanFeatureLimit
  └──────▶ CreditTransaction
                 │
  └──────▶ FeatureUsageCounter
```

---

## Traitement Asynchrone

### Types de tâches

| Type | Description | Concurrence |
|------|-------------|-------------|
| `cv_generation` | Génération CV depuis offre | Max 3/user |
| `pdf_import` | Import CV depuis PDF | 1/user |
| `translate_cv` | Traduction CV | 1/user |
| `match_score` | Calcul score matching | 1/user |
| `optimize_cv` | Optimisation IA | 1/user |

### Cycle de vie d'une tâche

```
pending ──▶ running ──▶ completed
                   └──▶ failed (avec retry possible)
```

### Gestion des erreurs et remboursements

```javascript
try {
  await debitCredit(userId, cost, taskType);
  await executeTask();
  await incrementFeatureCounter(userId, taskType);
} catch (error) {
  await refundCredit(userId, transactionId, 'Task failed');
  await refundFeatureUsage(taskId);
  throw error;
}
```

---

## Sécurité

### Mesures implémentées

| Mesure | Implémentation |
|--------|----------------|
| **Authentification** | NextAuth.js JWT, OAuth 2.0 |
| **Autorisation** | Rôles (USER, ADMIN), feature limits |
| **Protection CSRF** | Tokens NextAuth |
| **Protection XSS** | Sanitization inputs, CSP headers |
| **Protection Bot** | reCAPTCHA v3 (score 0.5) |
| **Validation** | AJV JSON Schema, Zod |
| **Chiffrement CV** | AES-256-GCM (au repos) |
| **Rate Limiting** | Sur endpoints sensibles (email verification) |
| **Webhooks** | Signature Stripe validation |

### Points de contrôle reCAPTCHA

- Inscription (register)
- Connexion (login attempts)
- Liaison OAuth
- Création CV
- Demande reset password

---

## Internationalisation

### Langues supportées

| Code | Langue |
|------|--------|
| `fr` | Français |
| `en` | Anglais |
| `de` | Allemand |
| `es` | Espagnol |

### Architecture i18n

```
locales/
├── fr/common.json    # Traductions françaises
├── en/common.json    # Traductions anglaises
├── de/common.json    # Traductions allemandes
└── es/common.json    # Traductions espagnoles
```

### Détection de langue

1. Cookie `NEXT_LOCALE`
2. Header `Accept-Language`
3. Défaut : `fr`

---

## Monitoring & Télémétrie

### Événements trackés

| Catégorie | Événements |
|-----------|------------|
| **Auth** | login, registration, logout |
| **CV** | creation, generation, optimization, export |
| **Billing** | subscription_change, credit_purchase |
| **Features** | feature_usage, limit_reached |
| **Errors** | api_error, task_failed |

### Métriques admin

- MRR, ARR, ARPU
- Coûts OpenAI par feature
- Taux conversion onboarding
- Usage par feature
- Erreurs système

---

## Performance

### Optimisations Next.js 16

- **Turbopack** : Bundler par défaut (plus rapide que Webpack)
- **React 19** : Concurrent features, Suspense
- **Image Optimization** : AVIF, WebP, responsive
- **Code Splitting** : Automatique par route

### Optimisations client

- **Lazy loading** : Composants lourds (admin, modales)
- **Memoization** : useMemo, useCallback sur calculs coûteux
- **Virtual scrolling** : Listes longues (non implémenté actuellement)

### Optimisations OpenAI

- **Prompt Caching** : 24h retention (GPT-4o, GPT-5)
- **Model selection** : Configurable via settings
- **Structured Output** : JSON Schema pour réponses prévisibles

---

## Déploiement

### Environnements

| Environnement | URL | Base de données |
|---------------|-----|-----------------|
| Development | localhost:3001 | PostgreSQL local |
| Production | app.fitmycv.io | PostgreSQL managed |

### Variables d'environnement critiques

```bash
# Base de données
DATABASE_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://app.fitmycv.io"

# OpenAI
OPENAI_API_KEY="sk-..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email
SMTP_HOST="ssl0.ovh.net"
RESEND_API_KEY="re_..."

# Sécurité
CV_ENCRYPTION_KEY="..."
RECAPTCHA_SECRET_KEY="..."
```

---

## Points d'extension

### Ajouter une nouvelle feature

1. Créer le module dans `lib/`
2. Ajouter les API routes dans `app/api/`
3. Créer les composants UI dans `components/`
4. Ajouter les traductions dans `locales/`
5. Configurer les limites dans `SubscriptionPlanFeatureLimit`

### Ajouter un nouveau provider OAuth

1. Configurer dans `lib/auth/options.js`
2. Ajouter les credentials dans `.env`
3. Mettre à jour `components/auth/AuthScreen.jsx`

### Ajouter un nouveau type de tâche background

1. Définir dans `lib/background-jobs/taskTypes.js`
2. Ajouter le mapping feature dans `taskFeatureMapping.js`
3. Créer l'endpoint API
4. Implémenter le job runner

---

## Utilitaires Notables

### `lib/utils/normalizeJobUrl.js`

Nettoie les URLs d'offres d'emploi en supprimant les paramètres de tracking qui interfèrent avec le cache et le fetching.

```javascript
import { normalizeJobUrl } from '@/lib/utils/normalizeJobUrl';

// Exemple
normalizeJobUrl('https://indeed.com/job?id=123&from=searchOnHP&vjk=abc')
// → 'https://indeed.com/job?id=123'
```

**Paramètres supprimés :**

| Plateforme | Paramètres |
|------------|------------|
| Indeed | `from`, `advn`, `vjk` |
| LinkedIn | `trk`, `trackingId`, `refId` |

### `lib/stripe/checkoutLocale.js`

Génère les messages d'acceptation des CGV localisés pour Stripe Checkout.

```javascript
import { getTermsMessage } from '@/lib/stripe/checkoutLocale';

getTermsMessage('fr')
// → "J'accepte les [Conditions Générales de Vente](https://app.fitmycv.io/terms)."

getTermsMessage('en')
// → "I accept the [Terms of Service](https://app.fitmycv.io/terms)."
```

**Langues supportées :** `fr`, `en`, `es`, `de`

Réutilise les traductions existantes de `locales/{lang}/subscription.json` pour garantir la cohérence.
