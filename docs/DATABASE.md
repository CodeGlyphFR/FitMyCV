# Base de données - FitMyCV.io

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
- **Database (dev)** : PostgreSQL `fitmycv_dev`
- **Database (prod)** : PostgreSQL `fitmycv_prod`
- **Modèles** : 35 tables
- **Migrations** : Baseline + incremental

### Configuration

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

**DATABASE_URL par environnement** :
- **Dev** : `postgresql://fitmycv:password@localhost:5432/fitmycv_dev`
- **Prod** : `postgresql://fitmycv:password@localhost:5432/fitmycv_prod`

**Synchronisation prod → dev** :
```bash
npm run db:sync-from-prod
```

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

  // Stripe
  stripeCustomerId String?     @unique

  // Referral
  referralCode     String?     @unique
  referredBy       String?

  // Onboarding (source unique de vérité)
  onboardingState  Json?       // {currentStep, hasCompleted, isSkipped, timestamps, ...}

  // Relations
  accounts         Account[]
  cvs              CvFile[]
  linkHistory      LinkHistory[]
  feedbacks        Feedback[]
  consentLogs      ConsentLog[]
  telemetryEvents  TelemetryEvent[]
  featureUsage     FeatureUsage[]
  openaiUsage      OpenAIUsage[]
  subscription     Subscription?
  creditBalance    CreditBalance?
  creditTransactions CreditTransaction[]
  referrals        Referral[]  @relation("Referrer")
  referredUsers    Referral?   @relation("Referred")

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
| `stripeCustomerId` | String | ID client Stripe (unique) |
| `referralCode` | String | Code de parrainage personnel (unique) |
| `onboardingState` | Json | État complet de l'onboarding |

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

### 3. JobOffer (Offres d'emploi extraites)

Stocke les extractions structurées des offres d'emploi, réutilisables par plusieurs CVs.

```prisma
model JobOffer {
  id              String    @id @default(cuid())
  userId          String
  sourceType      String    // 'url' | 'pdf'
  sourceValue     String    // URL ou nom fichier PDF
  content         Json      // Extraction structurée (JSON)
  extractedAt     DateTime  @default(now())
  extractionModel String    // Modèle OpenAI utilisé
  tokensUsed      Int       @default(0)

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  cvFiles         CvFile[]  // Relation 1-N

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, sourceValue])
  @@index([userId])
}
```

**Champs clés** :

| Champ | Type | Description |
|-------|------|-------------|
| `sourceType` | String | Type de source : 'url' ou 'pdf' |
| `sourceValue` | String | URL complète ou nom du fichier PDF |
| `content` | Json | Extraction structurée (voir AI_INTEGRATION.md) |
| `extractionModel` | String | Modèle utilisé (ex: gpt-5-mini) |
| `tokensUsed` | Int | Tokens consommés pour l'extraction |

**Structure du champ `content`** :

```javascript
{
  "title": "Software Engineer",
  "company": "TechCorp",
  "contract": "CDI",         // CDI, CDD, Freelance, Stage, Alternance
  "experience": { "min_years": 3, "max_years": 5, "level": "mid" },
  "location": { "city": "Paris", "country": "France", "remote": "hybrid" },
  "salary": { "min": 45000, "max": 55000, "currency": "EUR", "period": "year" },
  "skills": {
    "required": ["React", "Node.js"],
    "nice_to_have": ["GraphQL"]
  },
  "education": { "level": "Bac+5", "field": "Informatique" },
  "languages": [{ "language": "English", "level": "fluent" }],
  "responsibilities": ["Développer des features"],
  "benefits": ["RTT", "Télétravail"]
}
```

**Avantages** :
- Réutilisation : plusieurs CVs peuvent référencer la même offre
- Réduction tokens : extraction une seule fois
- Validation structurée : JSON Schema strict via OpenAI Structured Outputs

---

### 4. CvFile (Contenu et métadonnées des CVs)

Stocke le contenu JSON et les métadonnées des CVs directement en base de données.

```prisma
model CvFile {
  id               String   @id @default(cuid())
  userId           String
  filename         String   // Ex: 1234567890.json

  // Contenu CV (migré depuis filesystem)
  content          Json?    // Contenu JSON complet du CV
  contentVersion   Int      @default(1) // Numéro de version courante

  // Source
  sourceType       String?  // 'link' | 'pdf' | null (manual)
  sourceValue      String?  // URL ou nom du PDF
  jobOfferId       String?  // Relation vers JobOffer

  // Création
  createdBy        String?  // 'generate-cv' | 'import-pdf' | 'translate-cv' | null
  originalCreatedBy String? // Pour les traductions (garde l'icône originale)
  isTranslated     Boolean  @default(false)

  // Match Score
  matchScore       Int?     // 0-100
  matchScoreUpdatedAt DateTime?
  matchScoreStatus String?  @default("idle") // 'idle' | 'inprogress' | 'failed'

  // Score détaillé (JSON serialized)
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
  blockedAt           DateTime? // Date de blocage
  blockedReason       String?   // Raison du blocage

  // Relations
  user     User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobOffer JobOffer?   @relation(fields: [jobOfferId], references: [id], onDelete: SetNull)
  versions CvVersion[] // Historique des versions (optimisation IA)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, filename])
}
```

---

### 4.1 CvVersion (Historique des versions)

Stocke l'historique des versions de CV, créées lors des optimisations IA.

```prisma
model CvVersion {
  id        String   @id @default(cuid())
  cvFileId  String
  version   Int      // Numéro de version (1, 2, 3...)
  content   Json     // Contenu JSON complet
  changelog String?  // "Optimisation IA", "Restauration depuis v2"
  createdAt DateTime @default(now())

  cvFile CvFile @relation(fields: [cvFileId], references: [id], onDelete: Cascade)

  @@unique([cvFileId, version])
  @@index([cvFileId, createdAt(sort: Desc)])
}
```

**Comportement par action** :

| Action | Comportement |
|--------|--------------|
| Édition manuelle | Écrase `CvFile.content` directement, **aucune CvVersion créée** |
| Import PDF | Crée un nouveau `CvFile` (son propre historique) |
| Traduction | Crée un nouveau `CvFile` |
| Génération CV | Crée un nouveau `CvFile` |
| **Optimisation IA** | **Crée une nouvelle `CvVersion`** |
| **Restauration** | **Crée une nouvelle `CvVersion`** (copie du contenu ancien) |

**Configuration** : `cv_max_versions` dans Settings (défaut: 5)

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

### 5. BackgroundTask (Tâches asynchrones)

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

  // Système de crédits
  creditUsed              Boolean   @default(false)
  creditTransactionId     String?   @unique
  featureName             String?   // Feature liée
  featureCounterPeriodStart DateTime? // Début période compteur

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

### 6. LinkHistory (Historique des URLs)

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

### 7. Feedback (Retours utilisateurs)

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

### 8. ConsentLog (Logs RGPD cookies)

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

### 9. Setting (Configuration admin)

```prisma
model Setting {
  id          String   @id @default(cuid())
  settingName String   @unique  // Ex: "model_cv_generation"
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
| `model_cv_generation` | gpt-4.1-2025-04-14 | ai_models |
| `model_extract_job_offer` | gpt-5-mini-2025-08-07 | ai_models |
| `registration_enabled` | 1 | features |
| `maintenance_mode` | 0 | general |
| `default_token_limit` | 5 | general |

---

### 10. TelemetryEvent (Événements)

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

### 11. FeatureUsage (Usage features)

Agrégation de l'usage par feature et par utilisateur.

```prisma
model FeatureUsage {
  id            String   @id @default(cuid())
  userId        String
  featureName   String   // 'generate_cv' | 'import_pdf' | 'export_cv' | ...

  usageCount    Int      @default(0)
  lastUsedAt    DateTime @default(now())
  totalDuration Int      @default(0)  // Millisecondes

  metadata      String?  // JSON: détails feature-specific

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

### 12. OpenAIUsage (Agrégation quotidienne)

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

### 13. OpenAICall (Logs individuels)

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

### 14-24. Autres modèles

**14. EmailVerificationToken** : Tokens de vérification email
**15. AutoSignInToken** : Tokens de connexion automatique
**16. EmailChangeRequest** : Demandes de changement d'email
**17. VerificationToken** : Tokens NextAuth
**18. OpenAIPricing** : Tarification OpenAI par modèle
**19. OpenAIAlert** : Alertes de coûts OpenAI
**20. SubscriptionPlan** : Plans d'abonnement
**21. SubscriptionPlanFeatureLimit** : Limites par plan

---

### 22. CreditPack (Packs de crédits)

Packs de crédits achetables par les utilisateurs (micro-transactions).

```prisma
model CreditPack {
  id            Int      @id @default(autoincrement())
  name          String   // "Pack Starter", "Pack Pro", etc.
  description   String?  // Description du pack
  creditAmount  Int      @unique // Nombre de crédits dans ce pack
  price         Float    // Prix fixe du pack
  priceCurrency String   @default("EUR") // EUR, USD, GBP
  isActive      Boolean  @default(true)  // Pack actif ou désactivé

  // Stripe
  stripePriceId   String?  @unique
  stripeProductId String?  @unique

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([creditAmount])
  @@index([isActive])
}
```

**Champs clés** :

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String | Nom du pack (ex: "Pack 10 crédits") |
| `creditAmount` | Int | Nombre de crédits (unique - identifie le pack) |
| `price` | Float | Prix fixe du pack |
| `priceCurrency` | String | Devise (EUR, USD, GBP) |
| `stripePriceId` | String | ID Stripe Price (unique) |
| `stripeProductId` | String | ID Stripe Product (unique) |
| `isActive` | Boolean | Si false, le pack n'est pas affiché |

**Notes** :
- Crédits universels (utilisables pour toutes features IA)
- Crédits permanents (pas d'expiration)
- Prix fixe par pack (ex: 10 crédits = 5€)
- Intégration Stripe pour paiement
- Gestion admin via `/admin/analytics` onglet "Abonnements"

---

### 23. EmailTemplate (Templates email)

Templates d'emails personnalisables pour l'admin.

```prisma
model EmailTemplate {
  id          String     @id @default(cuid())
  name        String     @unique
  subject     String
  designJson  String
  htmlContent String
  variables   String
  isActive    Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  emailLogs   EmailLog[]

  @@index([name])
  @@index([isActive])
}
```

**Champs clés** :

| Champ | Type | Description |
|-------|------|-------------|
| `name` | String | Nom unique du template (ex: "welcome", "password-reset") |
| `subject` | String | Sujet de l'email |
| `designJson` | String | JSON du design (pour éditeur visuel) |
| `htmlContent` | String | Contenu HTML final de l'email |
| `variables` | String | Liste des variables disponibles (JSON) |
| `isActive` | Boolean | Template activé ou désactivé |

**Notes** :
- Éditable via l'interface admin
- Supporte les variables dynamiques ({{name}}, {{resetLink}}, etc.)
- Relation avec EmailLog pour le suivi

---

### 24. EmailLog (Logs d'emails)

Historique des emails envoyés via Resend.

```prisma
model EmailLog {
  id              String         @id @default(cuid())
  templateId      String?
  templateName    String
  recipientEmail  String
  recipientUserId String?
  subject         String
  status          String
  error           String?
  resendId        String?
  isTestEmail     Boolean        @default(false)
  createdAt       DateTime       @default(now())
  template        EmailTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)

  @@index([templateId])
  @@index([templateName])
  @@index([recipientEmail])
  @@index([recipientUserId])
  @@index([status])
  @@index([createdAt])
}
```

**Champs clés** :

| Champ | Type | Description |
|-------|------|-------------|
| `templateName` | String | Nom du template utilisé |
| `recipientEmail` | String | Email du destinataire |
| `recipientUserId` | String? | ID utilisateur si connecté |
| `status` | String | Statut (sent, delivered, bounced, failed) |
| `error` | String? | Message d'erreur si échec |
| `resendId` | String? | ID retourné par Resend |
| `isTestEmail` | Boolean | Email de test (admin) |

**Notes** :
- Conserve l'historique même si le template est supprimé (onDelete: SetNull)
- Permet le debug des emails non reçus
- Statistiques d'envoi dans l'admin

---

## Relations

### Schéma de relations

```
User (1) ──────┬──────── (N) CvFile
               ├──────── (N) JobOffer
               ├──────── (N) Account
               ├──────── (N) LinkHistory
               ├──────── (N) Feedback
               ├──────── (N) ConsentLog
               ├──────── (N) TelemetryEvent
               ├──────── (N) FeatureUsage
               └──────── (N) OpenAIUsage

JobOffer (1) ──────────── (N) CvFile

SubscriptionPlan (1) ──── (N) SubscriptionPlanFeatureLimit
```

### Cascade Delete

Toutes les relations utilisent `onDelete: Cascade` :

- Supprimer un **User** supprime :
  - Tous ses **CvFile**
  - Tous ses **JobOffer**
  - Tous ses **Account**
  - Tout son **LinkHistory**
  - Tous ses **Feedback**
  - Tous ses **ConsentLog**
  - Tous ses **TelemetryEvent**
  - Tous ses **FeatureUsage**
  - Tous ses **OpenAIUsage**

- Supprimer un **JobOffer** :
  - Met à `null` le `jobOfferId` des **CvFile** liés (`onDelete: SetNull`)

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

### Scripts npm

```bash
# Setup complet (migrations + seed)
npm run db:setup

# Reset base de données (dev uniquement)
npm run db:reset

# Seed uniquement
npm run db:seed

# Interface graphique Prisma Studio
npm run db:studio

# Générer le client Prisma
npm run db:generate

# Sync prod → dev (copie complète)
npm run db:sync-from-prod
```

### Commandes Prisma

```bash
# Créer une nouvelle migration en dev
npx prisma migrate dev --name nom_migration

# Appliquer les migrations en prod
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Reset la base (dev uniquement - SUPPRIME TOUTES LES DONNÉES)
npx prisma migrate reset

# Interface graphique
npx prisma studio
```

### Approche Baseline

Le projet utilise une **migration baseline** pour PostgreSQL. Cette approche permet :
- De démarrer avec un état cohérent du schéma
- D'éviter les problèmes de compatibilité SQLite/PostgreSQL
- D'avoir un historique propre pour les futures migrations

```
prisma/migrations/
└── 0_init_baseline/
    └── migration.sql    # Schéma PostgreSQL complet (34 tables)
```

### Workflow développement

```bash
# Option 1: Setup avec seed data (données par défaut)
npm run db:setup

# Option 2: Reset complet avec seed data
npm run db:reset

# Option 3: Copier les données de production
npm run db:sync-from-prod

# Puis lancer le serveur dev
npm run dev
```

**Scripts disponibles** :
- `./scripts/db-dev-reset.sh` - Reset dev avec seed (confirmation requise)
- `./scripts/db-sync-prod-to-dev.sh` - Copie prod → dev (confirmation requise)

### Workflow production

Pour un déploiement sur une base existante créée via `db push` :

```bash
# 1. Marquer la baseline comme appliquée (une seule fois)
npx prisma migrate resolve --applied 0_init_baseline

# 2. Appliquer les futures migrations
npx prisma migrate deploy

# 3. Seeder si nécessaire
npm run db:seed
```

**Script automatisé** : `./scripts/db-setup-fresh.sh` (pour nouvelle installation)

### Créer une nouvelle migration

```bash
# 1. Modifier prisma/schema.prisma

# 2. Créer la migration
npx prisma migrate dev --name description_changement

# 3. Vérifier le fichier SQL généré dans prisma/migrations/

# 4. Committer la migration avec le code
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat(db): description du changement"
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
    payload: JSON.stringify({ url }),
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
    metadata: JSON.stringify({ duration }),
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
- `PromoCode` - Codes promotionnels

Pour une documentation complète de l'architecture d'abonnement, des règles métier et des workflows, consultez `docs/SUBSCRIPTION.md`.

---

**Base de données robuste et optimisée** | 30 modèles, 20 migrations
