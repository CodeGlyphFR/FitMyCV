# Base de données - FitMyCv.ai

Documentation complète du schéma Prisma et des modèles de données.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Modèles de données](#modèles-de-données)
- [Relations](#relations)
- [Index et optimisations](#index-et-optimisations)
- [Migrations](#migrations)
- [Requêtes courantes](#requêtes-courantes)

---

## Vue d'ensemble

### Technologie

- **ORM** : Prisma 6.16.2
- **Database (dev)** : SQLite 3
- **Database (prod)** : PostgreSQL ou MySQL (recommandé)
- **Modèles** : 28 tables
- **Migrations** : 16+ migrations appliquées

### Configuration

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"  // "postgresql" ou "mysql" en production
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

**Chemin DATABASE_URL** :
- **Prisma** : `prisma/.env` avec `DATABASE_URL="file:./dev.db"`
- **Next.js** : `.env.local` avec `DATABASE_URL="file:./dev.db"`

---

## Modèles de données

### 1. User (Utilisateurs)

Table centrale pour les utilisateurs de l'application.

```prisma
model User {
  id            String        @id @default(cuid())
  name          String?
  email         String?       @unique
  emailVerified DateTime?
  passwordHash  String?       // null pour OAuth users
  image         String?
  role          String        @default("USER") // USER | ADMIN

  // Password reset
  resetToken       String?
  resetTokenExpiry DateTime?

  // Relations
  accounts         Account[]
  cvs              CvFile[]
  linkHistory      LinkHistory[]
  feedbacks        Feedback[]
  consentLogs      ConsentLog[]
  telemetryEvents  TelemetryEvent[]
  featureUsage     FeatureUsage[]
  openaiUsage      OpenAIUsage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Champs clés** :

| Champ | Type | Description |
|-------|------|-------------|
| `id` | cuid | ID unique généré automatiquement |
| `email` | String | Email unique (index) |
| `emailVerified` | DateTime | Date de vérification email |
| `passwordHash` | String | Hash bcrypt (null pour OAuth) |
| `role` | String | USER ou ADMIN |

---

### 2. Account (Comptes OAuth - NextAuth)

Stocke les informations des providers OAuth.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // google | github | apple
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([provider, providerAccountId])
}
```

---

### 3. CvFile (Métadonnées des CVs)

Stocke les métadonnées des CVs (le contenu est chiffré dans `data/users/`).

```prisma
model CvFile {
  id               String   @id @default(cuid())
  userId           String
  filename         String   // Ex: cv_1234567890.json

  // Source
  sourceType       String?  // 'link' | 'pdf' | null (manual)
  sourceValue      String?  // URL ou nom du PDF
  extractedJobOffer String? // Contenu de l'offre extrait (cache)

  // Création
  createdBy        String?  // 'generate-cv' | 'import-pdf' | 'translate-cv' | null
  originalCreatedBy String? // Pour les traductions (garde l'icône originale)
  analysisLevel    String?  // 'rapid' | 'medium' | 'deep'
  isTranslated     Boolean  @default(false)

  // Match Score
  matchScore       Int?     // 0-100
  matchScoreUpdatedAt DateTime?
  matchScoreStatus String?  @default("idle") // 'idle' | 'inprogress' | 'failed'

  // Score détaillé (JSON)
  scoreBreakdown   String?  // {"technical_skills": 28, "experience": 22, ...}
  improvementSuggestions String? // [{"priority": "high", "suggestion": "...", "impact": "+8"}]
  missingSkills    String?  // ["Kubernetes", "TypeScript"]
  matchingSkills   String?  // ["React", "Node.js"]

  // Optimisation
  optimiseStatus   String?  @default("idle") // 'idle' | 'inprogress' | 'failed'
  optimiseUpdatedAt DateTime?

  // Système de crédits
  createdWithCredit   Boolean  @default(false) // CV créé avec un crédit
  creditUsedAt        DateTime? // Date d'utilisation du crédit
  creditTransactionId String?  @unique // ID de la transaction crédit liée
  blocked             Boolean  @default(false) // Bloqué en cas de downgrade

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, filename])
}
```

**Champs JSON** :

```javascript
// scoreBreakdown
{
  "technical_skills": 28,
  "experience": 22,
  "education": 15,
  "projects": 12,
  "soft_skills": 8
}

// improvementSuggestions
[
  {
    "priority": "high",
    "suggestion": "Ajouter plus de métriques quantifiables",
    "impact": "+8"
  },
  {
    "priority": "medium",
    "suggestion": "Détailler les projets personnels",
    "impact": "+5"
  }
]

// missingSkills
["Kubernetes", "TypeScript", "CI/CD"]

// matchingSkills
["React", "Node.js", "Docker", "Git"]
```

---

### 4. BackgroundTask (Tâches asynchrones)

Gère la queue de tâches en arrière-plan.

```prisma
model BackgroundTask {
  id                String   @id
  title             String
  successMessage    String?
  type              String   // 'generate-cv' | 'import-pdf' | 'translate-cv' | ...
  status            String   // 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt         BigInt   // Timestamp en millisecondes
  shouldUpdateCvList Boolean @default(false)

  result   String?  // JSON: résultat de la tâche
  error    String?  // Message d'erreur si failed
  payload  String?  // JSON: payload de la tâche

  deviceId String   // Device ID pour filtrer par client
  userId   String?  // User ID pour les tâches utilisateur
  cvFile   String?  // Filename du CV lié (pour improve-cv, calculate-match-score)

  updatedAt DateTime @default(now()) @updatedAt

  @@index([deviceId])
  @@index([status])
  @@index([createdAt])
  @@index([cvFile, status])
}
```

**Types de tâches** :

| Type | Description |
|------|-------------|
| `generate-cv` | Génération CV depuis offre |
| `import-pdf` | Import PDF vers JSON |
| `translate-cv` | Traduction CV |
| `create-template-cv` | Création template vide |
| `generate-cv-from-job-title` | Génération depuis titre |
| `calculate-match-score` | Calcul match score |
| `test` | Test de la queue |

---

### 5. LinkHistory (Historique des URLs)

Stocke les URLs d'offres d'emploi utilisées.

```prisma
model LinkHistory {
  id        String   @id @default(cuid())
  userId    String
  url       String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, url])
  @@index([userId, createdAt])
}
```

---

### 6. Feedback (Retours utilisateurs)

```prisma
model Feedback {
  id              String   @id @default(cuid())
  userId          String

  rating          Int      // 1-5 (étoiles)
  comment         String   // Max 500 caractères
  isBugReport     Boolean  @default(false)

  // Contexte
  currentCvFile   String?  // CV affiché
  userAgent       String?  // Navigateur
  pageUrl         String?  // URL de la page

  createdAt       DateTime @default(now())
  status          String   @default("new") // 'new' | 'reviewed' | 'resolved'

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
  @@index([isBugReport])
  @@index([status])
}
```

---

### 7. ConsentLog (Logs RGPD cookies)

```prisma
model ConsentLog {
  id          String   @id @default(cuid())
  userId      String

  action      String   // "created" | "updated" | "revoked"
  preferences String   // JSON: { necessary: true, functional: false, ... }

  ip          String?
  userAgent   String?

  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([createdAt])
}
```

---

### 8. Setting (Configuration admin)

```prisma
model Setting {
  id          String   @id @default(cuid())
  settingName String   @unique  // Ex: "model_analysis_rapid"
  value       String   // Ex: "gpt-5-nano-2025-08-07"
  category    String   // 'ai_models' | 'features' | 'general'
  description String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([settingName])
}
```

**Settings courants** :

| settingName | value | category |
|------------|-------|----------|
| `model_analysis_rapid` | gpt-5-nano-2025-08-07 | ai_models |
| `model_analysis_medium` | gpt-5-mini-2025-08-07 | ai_models |
| `model_analysis_deep` | gpt-5-2025-08-07 | ai_models |
| `registration_enabled` | 1 | features |
| `maintenance_mode` | 0 | general |
| `default_token_limit` | 5 | general |

---

### 9. TelemetryEvent (Événements)

```prisma
model TelemetryEvent {
  id          String   @id @default(cuid())
  userId      String?

  type        String   // CV_GENERATED | CV_IMPORTED | CV_EXPORTED | ...
  category    String   // cv_management | auth | job_processing | ...

  metadata    String?  // JSON: détails de l'événement
  deviceId    String?

  duration    Int?     // Durée en millisecondes
  status      String?  // 'success' | 'error' | 'cancelled'
  error       String?

  timestamp   DateTime @default(now())
  createdAt   DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([type])
  @@index([category])
  @@index([deviceId])
  @@index([timestamp])
  @@index([userId, type])
  @@index([type, timestamp])
}
```

---

### 10. FeatureUsage (Usage features)

Agrégation de l'usage par feature et par utilisateur.

```prisma
model FeatureUsage {
  id            String   @id @default(cuid())
  userId        String
  featureName   String   // 'generate_cv' | 'import_pdf' | 'export_cv' | ...

  usageCount    Int      @default(0)
  lastUsedAt    DateTime @default(now())
  totalDuration Int      @default(0)  // Millisecondes

  metadata      String?  // JSON: { rapid: 5, medium: 2, deep: 1 }

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, featureName])
  @@index([userId])
  @@index([featureName])
  @@index([lastUsedAt])
}
```

---

### 11. OpenAIUsage (Agrégation quotidienne)

```prisma
model OpenAIUsage {
  id              String   @id @default(cuid())
  userId          String
  featureName     String
  model           String   // gpt-5-nano-2025-08-07 | ...
  date            DateTime // Jour (agrégation quotidienne)

  promptTokens    Int      @default(0)
  cachedTokens    Int      @default(0)  // Prompt caching
  completionTokens Int     @default(0)
  totalTokens     Int      @default(0)

  estimatedCost   Float    @default(0)  // Dollars
  callsCount      Int      @default(0)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, featureName, model, date])
  @@index([userId])
  @@index([featureName])
  @@index([model])
  @@index([date])
  @@index([userId, date])
  @@index([featureName, date])
}
```

---

### 12. OpenAICall (Logs individuels)

```prisma
model OpenAICall {
  id               String   @id @default(cuid())
  userId           String
  featureName      String
  model            String

  promptTokens     Int      @default(0)
  cachedTokens     Int      @default(0)
  completionTokens Int      @default(0)
  totalTokens      Int      @default(0)
  estimatedCost    Float    @default(0)

  duration         Int?     // Millisecondes
  metadata         String?  // JSON

  createdAt        DateTime @default(now())

  @@index([userId])
  @@index([featureName])
  @@index([featureName, createdAt])
  @@index([userId, featureName])
  @@index([createdAt])
}
```

---

### 13-23. Autres modèles

**13. EmailVerificationToken** : Tokens de vérification email
**14. AutoSignInToken** : Tokens de connexion automatique
**15. EmailChangeRequest** : Demandes de changement d'email
**16. VerificationToken** : Tokens NextAuth
**17. OpenAIPricing** : Tarification OpenAI par modèle
**18. OpenAIAlert** : Alertes de coûts OpenAI
**19. SubscriptionPlan** : Plans d'abonnement
**20. SubscriptionPlanFeatureLimit** : Limites par plan

---

### 21. CreditPack (Packs de crédits)

Packs de crédits achetables par les utilisateurs (micro-transactions).

```prisma
model CreditPack {
  id            Int      @id @default(autoincrement())
  name          String   @unique // "Pack Starter", "Pack Pro", etc.
  description   String?  // Description du pack
  creditAmount  Int      // Nombre de crédits dans ce pack
  price         Float    // Prix fixe du pack
  priceCurrency String   @default("EUR") // EUR, USD, GBP
  isActive      Boolean  @default(true)  // Pack actif ou désactivé
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([name])
  @@index([isActive])
}
```

**Champs clés** :

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String | Nom unique du pack (ex: "Pack 10 crédits") |
| `creditAmount` | Int | Nombre de crédits inclus dans le pack |
| `price` | Float | Prix fixe du pack |
| `priceCurrency` | String | Devise (EUR, USD, GBP) |
| `isActive` | Boolean | Si false, le pack n'est pas affiché aux utilisateurs |

**Notes** :
- Crédits universels (utilisables pour toutes features IA)
- Crédits permanents (pas d'expiration)
- Prix fixe par pack (ex: 10 crédits = 5€)
- Gestion admin via `/admin/analytics` onglet "Abonnements"

---

## Relations

### Schéma de relations

```
User (1) ──────┬──────── (N) CvFile
               ├──────── (N) Account
               ├──────── (N) LinkHistory
               ├──────── (N) Feedback
               ├──────── (N) ConsentLog
               ├──────── (N) TelemetryEvent
               ├──────── (N) FeatureUsage
               └──────── (N) OpenAIUsage

SubscriptionPlan (1) ──── (N) SubscriptionPlanFeatureLimit
```

### Cascade Delete

Toutes les relations utilisent `onDelete: Cascade` :

- Supprimer un **User** supprime :
  - Tous ses **CvFile**
  - Tous ses **Account**
  - Tout son **LinkHistory**
  - Tous ses **Feedback**
  - Tous ses **ConsentLog**
  - Tous ses **TelemetryEvent**
  - Tous ses **FeatureUsage**
  - Tous ses **OpenAIUsage**

---

## Index et optimisations

### Index principaux

```prisma
// User
@@index([email])

// CvFile
@@unique([userId, filename])
@@index([userId])

// BackgroundTask
@@index([deviceId])
@@index([status])
@@index([createdAt])
@@index([cvFile, status])

// LinkHistory
@@unique([userId, url])
@@index([userId, createdAt])

// Feedback
@@index([userId])
@@index([createdAt])
@@index([isBugReport])
@@index([status])

// TelemetryEvent
@@index([userId])
@@index([type])
@@index([category])
@@index([deviceId])
@@index([timestamp])
@@index([userId, type])
@@index([type, timestamp])

// FeatureUsage
@@unique([userId, featureName])
@@index([featureName])
@@index([lastUsedAt])

// OpenAIUsage
@@unique([userId, featureName, model, date])
@@index([date])
@@index([featureName, date])
```

### Optimisations

1. **Index composites** : Pour les requêtes fréquentes (ex: `userId + type`)
2. **Index uniques** : Pour éviter les doublons (ex: `userId + filename`)
3. **Index temporels** : Pour les tris par date (ex: `createdAt`, `date`)

---

## Migrations

### Commandes

```bash
# Créer une migration en dev
npx prisma migrate dev --name nom_migration

# Appliquer les migrations en prod
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Reset la base (dev uniquement)
npx prisma migrate reset

# Interface graphique
npx prisma studio
```

### Historique des migrations

```
prisma/migrations/
├── 20240101000000_init/
├── 20240102000000_add_cv_metadata/
├── 20240103000000_add_background_tasks/
├── 20240104000000_add_feedback/
├── 20240105000000_add_consent_logs/
├── 20240106000000_add_telemetry/
├── 20240107000000_add_feature_usage/
├── 20240108000000_add_openai_usage/
├── 20240109000000_add_settings/
├── 20240110000000_add_match_score/
├── 20240111000000_add_email_verification/
├── 20240112000000_add_subscription_plans/
├── 20240113000000_add_openai_pricing/
├── 20240114000000_add_optimise_status/
└── 20240115000000_add_token_last_usage/
```

---

## Requêtes courantes

### 1. Lister les CVs d'un utilisateur

```javascript
const cvs = await prisma.cvFile.findMany({
  where: { userId },
  select: {
    id: true,
    filename: true,
    sourceType: true,
    createdBy: true,
    matchScore: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'desc' },
});
```

### 2. Récupérer un CV avec métadonnées complètes

```javascript
const cv = await prisma.cvFile.findUnique({
  where: {
    userId_filename: { userId, filename }
  },
  include: {
    user: {
      select: { email: true, name: true }
    }
  }
});
```

### 3. Créer une tâche background

```javascript
const task = await prisma.backgroundTask.create({
  data: {
    id: `task_${Date.now()}`,
    title: 'Génération du CV',
    type: 'generate-cv',
    status: 'queued',
    createdAt: BigInt(Date.now()),
    deviceId,
    userId,
    payload: JSON.stringify({ url, analysisLevel }),
  }
});
```

### 4. Logger un événement télémétrie

```javascript
await prisma.telemetryEvent.create({
  data: {
    userId,
    type: 'CV_GENERATED',
    category: 'cv_management',
    metadata: JSON.stringify({ analysisLevel, duration }),
    deviceId,
    duration,
    status: 'success',
  }
});
```

### 5. Agrégation usage OpenAI par jour

```javascript
const usage = await prisma.openAIUsage.groupBy({
  by: ['date'],
  _sum: {
    totalTokens: true,
    estimatedCost: true,
    callsCount: true,
  },
  where: {
    date: {
      gte: startDate,
      lte: endDate,
    }
  },
  orderBy: { date: 'desc' }
});
```

---

## Modèles d'abonnement

Les 10 modèles liés au système d'abonnement et de crédits sont documentés en détail dans **[docs/SUBSCRIPTION.md](/docs/SUBSCRIPTION.md)** :

- `Subscription` - Abonnements utilisateurs
- `SubscriptionPlan` - Plans d'abonnement disponibles
- `SubscriptionPlanFeatureLimit` - Limites par feature et par plan
- `CreditBalance` - Balance de crédits par utilisateur
- `CreditTransaction` - Historique transactions de crédits
- `CreditPack` - Packs de crédits achetables
- `FeatureUsageCounter` - Compteurs mensuels par feature/user
- `StripeWebhookLog` - Logs des webhooks Stripe
- `Referral` - Système de parrainage
- `PromoCode` - Codes promotionnels (🚧 planifié)

Pour une documentation complète de l'architecture d'abonnement, des règles métier et des workflows, consultez `docs/SUBSCRIPTION.md`.

---

**Base de données robuste et optimisée** | 28 modèles, 16+ migrations
