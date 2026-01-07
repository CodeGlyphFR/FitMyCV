# Modèles de Données - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet
> **29 modèles Prisma** documentés

## Vue d'Ensemble

- **ORM** : Prisma 6.16.2
- **Base de données** : PostgreSQL 14+
- **Stockage CV** : JSONB (colonne `CvFile.content`)

---

## Schéma de Relations

```
                    ┌─────────────────┐
                    │      User       │
                    └────────┬────────┘
         ┌──────────────────┬┴───────────────────┬───────────────────┐
         │                  │                    │                   │
         ▼                  ▼                    ▼                   ▼
┌─────────────────┐ ┌───────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    Account      │ │   CvFile      │ │  Subscription    │ │ CreditBalance    │
│  (OAuth links)  │ │   (CVs)       │ │  (Plans)         │ │ (Crédits)        │
└─────────────────┘ └───────┬───────┘ └────────┬─────────┘ └────────┬─────────┘
                            │                  │                    │
                    ┌───────┴───────┐          │                    │
                    ▼               ▼          ▼                    ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  CvVersion   │ │   JobOffer   │ │ FeatureLimit │ │CreditTrans.  │
            │ (Historique) │ │ (Offres)     │ │ (Limites)    │ │(Transactions)│
            └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Modèles Détaillés

### User

Utilisateur de l'application.

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String?   // Hash bcrypt (null si OAuth uniquement)
  role          Role      @default(USER)
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts          Account[]
  sessions          Session[]
  cvFiles           CvFile[]
  subscription      Subscription?
  creditBalance     CreditBalance?
  creditTransactions CreditTransaction[]
  featureCounters   FeatureCounter[]
  backgroundTasks   BackgroundTask[]
  feedbacks         Feedback[]
  telemetryEvents   TelemetryEvent[]
  autoSignInTokens  AutoSignInToken[]
  verificationTokens VerificationToken[]
  passwordResetTokens PasswordResetToken[]
  emailChangeRequests EmailChangeRequest[]
  consentLogs       ConsentLog[]
  onboardingState   Json?
}

enum Role {
  USER
  ADMIN
}
```

---

### Account

Comptes OAuth liés (Google, GitHub, Apple).

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

---

### CvFile

Fichier CV stocké en base de données.

```prisma
model CvFile {
  id              String    @id @default(cuid())
  userId          String
  filename        String    // Ex: "1704067200000.json"
  content         Json?     // Contenu CV complet (JSONB)

  // Métadonnées source
  sourceType      String?   // "link" | "pdf"
  sourceValue     String?   // URL ou nom du fichier PDF
  createdBy       String?   // "generate-cv" | "import-pdf" | "translate-cv"
  language        String?   // "fr" | "en" | "de" | "es"

  // Score de correspondance
  matchScore            Int?
  matchScoreBreakdown   Json?
  scoreBefore           Int?      // Score avant optimisation
  suggestions           Json?     // Suggestions d'amélioration
  missingSkills         Json?
  matchingSkills        Json?

  // Versioning
  contentVersion  Int       @default(1)

  // Soft delete
  deletedAt       DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  versions  CvVersion[]
  jobOffer  JobOffer?   @relation(fields: [jobOfferId], references: [id])
  jobOfferId String?

  @@unique([userId, filename])
}
```

**Structure JSON `content` :**
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
    "links": [{"type": "linkedin|github|portfolio|other", "url": "string"}]
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
    "start_date": "YYYY-MM",
    "end_date": "YYYY-MM|Present|null",
    "location": "string",
    "description": "string",
    "responsibilities": ["string"],
    "deliverables": ["string"],
    "skills_used": ["string"]
  }],
  "education": [{
    "degree": "string",
    "institution": "string",
    "year": "string",
    "field": "string"
  }],
  "languages": [{
    "name": "string",
    "level": "Native|Fluent|Professional|Intermediate|Basic"
  }],
  "extras": [{
    "category": "string",
    "items": ["string"]
  }],
  "projects": [{
    "title": "string",
    "description": "string",
    "technologies": ["string"],
    "url": "string"
  }],
  "section_titles": {
    "summary": "string",
    "skills": "string",
    "experience": "string",
    "education": "string",
    "languages": "string",
    "extras": "string",
    "projects": "string"
  }
}
```

---

### CvVersion

Historique des versions d'un CV.

```prisma
model CvVersion {
  id          String   @id @default(cuid())
  cvFileId    String
  version     Int
  content     Json     // Snapshot du CV
  changelog   String?  // Description des changements
  changeType  String?  // Type de modification
  matchScore  Int?     // Score au moment de la version
  createdAt   DateTime @default(now())

  cvFile CvFile @relation(fields: [cvFileId], references: [id], onDelete: Cascade)

  @@unique([cvFileId, version])
}
```

---

### JobOffer

Offre d'emploi parsée.

```prisma
model JobOffer {
  id            String   @id @default(cuid())
  contentHash   String   @unique  // SHA256 pour déduplication
  rawContent    String   @db.Text // Contenu brut
  parsedData    Json?    // Données structurées extraites
  sourceUrl     String?  // URL source
  sourceFilename String? // Nom fichier PDF
  createdAt     DateTime @default(now())

  cvFiles CvFile[]
}
```

---

### Subscription

Abonnement utilisateur.

```prisma
model Subscription {
  id                    String   @id @default(cuid())
  userId                String   @unique
  planId                Int
  status                String   @default("active") // active|inactive|cancelled|past_due
  billingPeriod         String   @default("monthly") // monthly|yearly
  stripeCustomerId      String?
  stripeSubscriptionId  String?
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan SubscriptionPlan @relation(fields: [planId], references: [id])
}
```

---

### SubscriptionPlan

Plans d'abonnement disponibles.

```prisma
model SubscriptionPlan {
  id                    Int      @id @default(autoincrement())
  name                  String
  tier                  Int      @default(0) // 0=Free, 1=Basic, 2=Pro, 3=Enterprise
  priceMonthly          Float
  priceYearly           Float
  stripePriceIdMonthly  String?
  stripePriceIdYearly   String?
  isActive              Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  subscriptions Subscription[]
  featureLimits SubscriptionPlanFeatureLimit[]
}
```

---

### SubscriptionPlanFeatureLimit

Limites de features par plan.

```prisma
model SubscriptionPlanFeatureLimit {
  id           Int      @id @default(autoincrement())
  planId       Int
  featureName  String
  monthlyLimit Int?     // null = illimité
  creditCost   Int?     // Coût si dépassement
  createdAt    DateTime @default(now())

  plan SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([planId, featureName])
}
```

---

### CreditBalance

Solde de crédits utilisateur.

```prisma
model CreditBalance {
  id             String   @id @default(cuid())
  userId         String   @unique
  balance        Int      @default(0)
  totalPurchased Int      @default(0)
  totalUsed      Int      @default(0)
  totalRefunded  Int      @default(0)
  totalGifted    Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### CreditTransaction

Transactions de crédits.

```prisma
model CreditTransaction {
  id           String    @id @default(cuid())
  userId       String
  amount       Int       // Positif = crédit, négatif = débit
  type         String    // purchase|usage|refund|gift
  featureName  String?   // Feature concernée
  metadata     Json?
  refundedAt   DateTime?
  refundReason String?
  createdAt    DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### FeatureCounter

Compteurs d'usage mensuels.

```prisma
model FeatureCounter {
  id          String   @id @default(cuid())
  userId      String
  featureName String
  count       Int      @default(0)
  periodStart DateTime
  periodEnd   DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, featureName, periodStart])
}
```

---

### CreditPack

Packs de crédits à l'achat.

```prisma
model CreditPack {
  id            Int      @id @default(autoincrement())
  creditAmount  Int
  priceInCents  Int
  currency      String   @default("eur")
  stripePriceId String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

---

### BackgroundTask

Tâches en arrière-plan.

```prisma
model BackgroundTask {
  id        String   @id @default(cuid())
  userId    String
  title     String
  type      String   // generation|import|improve-cv|translate|match-score
  status    String   @default("queued") // queued|running|completed|failed|cancelled
  payload   Json?    // Paramètres d'entrée
  result    Json?    // Résultat (success ou erreur)
  error     String?
  deviceId  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### EmailTemplate

Templates email Maily.to.

```prisma
model EmailTemplate {
  id          String   @id @default(cuid())
  name        String
  subject     String
  htmlContent String?  @db.Text
  designJson  String?  @db.Text  // JSON Maily.to
  variables   String?  // Variables disponibles (JSON)
  triggerId   String?
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  trigger EmailTrigger? @relation(fields: [triggerId], references: [id])
}
```

---

### EmailTrigger

Déclencheurs d'envoi email.

```prisma
model EmailTrigger {
  id          String   @id @default(cuid())
  name        String   @unique // email_verification, password_reset, etc.
  description String?
  createdAt   DateTime @default(now())

  templates EmailTemplate[]
}
```

---

### EmailLog

Logs d'envoi email.

```prisma
model EmailLog {
  id         String   @id @default(cuid())
  userId     String?
  to         String
  subject    String
  templateId String?
  provider   String   // smtp|resend
  status     String   // sent|failed
  error      String?
  messageId  String?
  createdAt  DateTime @default(now())
}
```

---

### TelemetryEvent

Événements analytics.

```prisma
model TelemetryEvent {
  id        String   @id @default(cuid())
  userId    String?
  type      String   // CV_GENERATED, USER_LOGIN, etc.
  status    String?  // success|error
  metadata  Json?
  duration  Int?     // Durée en ms
  createdAt DateTime @default(now())

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)
}
```

---

### Setting

Paramètres système.

```prisma
model Setting {
  id        String   @id @default(cuid())
  name      String   @unique
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Settings importants :**
- `subscription_mode_enabled` : Active/désactive le mode abonnement
- `maintenance_enabled` : Mode maintenance
- `registration_enabled` : Autorise les inscriptions
- `welcome_credits` : Bonus crédits de bienvenue
- `cv_max_versions` : Nombre max de versions conservées
- `cv_generation_model` : Modèle GPT utilisé

---

### Feedback

Feedbacks utilisateurs.

```prisma
model Feedback {
  id            String   @id @default(cuid())
  userId        String
  rating        Int      // 1-5
  comment       String?
  isBugReport   Boolean  @default(false)
  currentCvFile String?
  userAgent     String?
  pageUrl       String?
  createdAt     DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### ConsentLog

Logs de consentement RGPD.

```prisma
model ConsentLog {
  id          String   @id @default(cuid())
  userId      String
  consentType String
  accepted    Boolean
  createdAt   DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

### Tokens d'Authentification

```prisma
model VerificationToken {
  id      String   @id @default(cuid())
  userId  String
  token   String   @unique
  expires DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PasswordResetToken {
  id      String   @id @default(cuid())
  userId  String
  token   String   @unique
  expires DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model AutoSignInToken {
  id      String   @id @default(cuid())
  userId  String
  token   String   @unique
  expires DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model EmailChangeRequest {
  id       String   @id @default(cuid())
  userId   String
  newEmail String
  token    String   @unique
  expires  DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Index et Contraintes

### Index Principaux
- `User.email` : UNIQUE
- `Account.provider + providerAccountId` : UNIQUE
- `CvFile.userId + filename` : UNIQUE
- `CvVersion.cvFileId + version` : UNIQUE
- `JobOffer.contentHash` : UNIQUE
- `FeatureCounter.userId + featureName + periodStart` : UNIQUE

### Cascade Delete
- Suppression User → Supprime tous les CVs, abonnements, crédits, tâches
- Suppression CvFile → Supprime toutes les versions

---

## Migrations

14 migrations appliquées, incluant :
1. `0_init_baseline` - Schema initial
2. `20251204154619_refactor_feature_usage_counter` - Compteurs features
3. `20251205180457_add_cv_content_and_versioning` - Stockage CV en JSONB
4. `20251206180000_add_job_offer_table` - Table JobOffer
5. `20260105111045_add_email_triggers` - Système triggers email
