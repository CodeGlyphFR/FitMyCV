# Modèles de Données - FitMyCV.io

> 33 modèles Prisma | PostgreSQL | Généré le 2026-01-07

---

## Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER DOMAIN                              │
│  User ─┬─ Account (OAuth)                                       │
│        ├─ CvFile ── CvVersion                                   │
│        ├─ JobOffer                                              │
│        ├─ Subscription ── SubscriptionPlan                      │
│        ├─ CreditBalance ── CreditTransaction                    │
│        └─ BackgroundTask                                        │
├─────────────────────────────────────────────────────────────────┤
│                       SYSTEM DOMAIN                              │
│  Setting, FeatureMapping, OpenAIPricing, OpenAIAlert            │
│  EmailTrigger ── EmailTemplate ── EmailLog                      │
│  SubscriptionPlan ── SubscriptionPlanFeatureLimit               │
│  CreditPack, PromoCode, Referral                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## User & Authentication

### User
Utilisateur principal de l'application.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `name` | String? | Nom affiché |
| `email` | String? (unique) | Email (login) |
| `emailVerified` | DateTime? | Date vérification email |
| `passwordHash` | String? | Hash bcrypt (credentials) |
| `image` | String? | URL avatar |
| `role` | String | "USER" \| "ADMIN" |
| `stripeCustomerId` | String? | ID client Stripe |
| `referralCode` | String? | Code parrainage unique |
| `referredBy` | String? | Code du parrain |
| `onboardingState` | Json? | État onboarding complet |
| `createdAt` | DateTime | Date création |
| `updatedAt` | DateTime | Dernière modification |

**Relations** : accounts, cvs, subscription, creditBalance, backgroundTasks, featureUsage, referrals...

### Account
Comptes OAuth liés (Google, GitHub, Apple).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `userId` | String | → User.id |
| `provider` | String | "google" \| "github" \| "apple" |
| `providerAccountId` | String | ID chez le provider |
| `access_token` | String? | Token d'accès |
| `refresh_token` | String? | Token de refresh |
| `expires_at` | Int? | Expiration (timestamp) |

**Contrainte** : `@@unique([provider, providerAccountId])`

### VerificationToken
Tokens de vérification email (NextAuth).

| Champ | Type | Description |
|-------|------|-------------|
| `identifier` | String | Email |
| `token` | String | Token unique |
| `expires` | DateTime | Expiration |

---

## CV Domain

### CvFile
Document CV principal stocké en JSON.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `userId` | String | → User.id |
| `filename` | String | Nom fichier unique/user |
| `content` | Json? | **Contenu CV complet** |
| `contentVersion` | Int | Version courante |
| `sourceType` | String? | "url" \| "pdf" \| "manual" \| "template" |
| `sourceValue` | String? | URL source ou nom fichier |
| `jobOfferId` | String? | → JobOffer.id |
| `language` | String? | "fr" \| "en" \| "de" \| "es" |
| `matchScore` | Int? | Score correspondance (0-100) |
| `scoreBefore` | Int? | Score avant optimisation |
| `optimiseStatus` | String? | "idle" \| "pending" \| "done" |
| `pendingChanges` | Json? | Modifications IA en attente |
| `blocked` | Boolean | CV bloqué (limite atteinte) |

**Index** : `@@unique([userId, filename])`, `@@index([jobOfferId])`

### CvVersion
Historique des versions CV (pour rollback).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `cvFileId` | String | → CvFile.id |
| `version` | Int | Numéro de version |
| `content` | Json | Contenu complet à cette version |
| `changelog` | String? | Description du changement |
| `changeType` | String? | "optimization" \| "adaptation" \| "restore" |
| `matchScore` | Int? | Score à cette version |

**Contrainte** : `@@unique([cvFileId, version])`

### JobOffer
Offre d'emploi extraite (source du CV généré).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `userId` | String | → User.id |
| `sourceType` | String | "url" \| "pdf" |
| `sourceValue` | String | URL ou nom fichier |
| `contentHash` | String? | Hash SHA256 du PDF |
| `content` | Json | **Extraction structurée** |
| `extractionModel` | String | Modèle IA utilisé |
| `tokensUsed` | Int | Tokens consommés |

**Contrainte** : `@@unique([userId, sourceValue])`

---

## Background Tasks

### BackgroundTask
Tâches asynchrones (génération CV, import PDF...).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant (UUID) |
| `title` | String | Titre affiché |
| `type` | String | Type de tâche |
| `status` | String | "queued" \| "running" \| "completed" \| "failed" |
| `createdAt` | BigInt | Timestamp création |
| `result` | String? | Résultat JSON |
| `error` | String? | Message d'erreur |
| `payload` | String? | Payload JSON |
| `deviceId` | String | ID device client |
| `userId` | String? | → User.id |
| `cvFile` | String? | Filename concerné |
| `creditUsed` | Boolean | Crédit débité |
| `featureName` | String? | Feature associée |

**Index** : `@@index([deviceId])`, `@@index([status])`, `@@index([cvFile, status])`

---

## Subscription & Credits

### SubscriptionPlan
Plans d'abonnement disponibles.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | Int | Identifiant auto |
| `name` | String | "free" \| "starter" \| "pro" \| "enterprise" |
| `description` | String? | Description |
| `isFree` | Boolean | Plan gratuit |
| `tier` | Int | Niveau (0, 1, 2, 3) |
| `priceMonthly` | Float | Prix mensuel EUR |
| `priceYearly` | Float | Prix annuel EUR |
| `yearlyDiscountPercent` | Float | % réduction annuel |
| `stripeProductId` | String? | ID produit Stripe |
| `stripePriceIdMonthly` | String? | ID prix mensuel |
| `stripePriceIdYearly` | String? | ID prix annuel |

### SubscriptionPlanFeatureLimit
Limites par feature par plan.

| Champ | Type | Description |
|-------|------|-------------|
| `planId` | Int | → SubscriptionPlan.id |
| `featureName` | String | Nom feature |
| `isEnabled` | Boolean | Feature activée |
| `usageLimit` | Int | Limite (-1 = illimité) |

**Contrainte** : `@@unique([planId, featureName])`

### Subscription
Abonnement utilisateur actif.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `userId` | String | → User.id (unique) |
| `stripeCustomerId` | String | ID client Stripe |
| `stripeSubscriptionId` | String? | ID abonnement Stripe |
| `planId` | Int | → SubscriptionPlan.id |
| `status` | String | "active" \| "canceled" \| "past_due" |
| `billingPeriod` | String | "monthly" \| "yearly" |
| `currentPeriodStart` | DateTime | Début période |
| `currentPeriodEnd` | DateTime | Fin période |
| `cancelAtPeriodEnd` | Boolean | Annulation programmée |

### CreditBalance
Solde de crédits utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id (unique) |
| `balance` | Int | Solde actuel |
| `totalPurchased` | Int | Total acheté |
| `totalUsed` | Int | Total utilisé |
| `totalRefunded` | Int | Total remboursé |
| `totalGifted` | Int | Total offert |

### CreditTransaction
Historique transactions crédits.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `userId` | String | → User.id |
| `amount` | Int | Montant (+/-) |
| `type` | String | "purchase" \| "usage" \| "refund" \| "gift" \| "welcome" |
| `featureName` | String? | Feature concernée |
| `taskId` | String? | → BackgroundTask.id |
| `cvFileId` | String? | CV concerné |
| `stripePaymentIntentId` | String? | ID paiement Stripe |
| `refunded` | Boolean | Transaction remboursée |

### CreditPack
Packs de crédits à acheter.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | Int | Identifiant |
| `name` | String | Nom du pack |
| `creditAmount` | Int | Nombre de crédits |
| `price` | Float | Prix EUR |
| `isActive` | Boolean | Pack disponible |
| `stripePriceId` | String? | ID prix Stripe |

### FeatureUsageCounter
Compteur mensuel par feature/user.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id |
| `featureName` | String | Nom feature |
| `count` | Int | Compteur actuel |
| `periodStart` | DateTime | Début période |
| `periodEnd` | DateTime | Fin période |

**Contrainte** : `@@unique([userId, featureName])`

---

## Email System

### EmailTrigger
Déclencheurs d'emails (événements système).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `name` | String | "email_verification" \| "password_reset" \| ... |
| `label` | String | Nom affichable |
| `variables` | String | Variables disponibles (JSON) |
| `category` | String | Catégorie |
| `isSystem` | Boolean | Trigger système (non supprimable) |

### EmailTemplate
Templates email avec design Maily.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant |
| `name` | String | Nom du template |
| `triggerId` | String? | → EmailTrigger.id |
| `subject` | String | Sujet email |
| `designJson` | String | Design Maily/TipTap |
| `htmlContent` | String | HTML généré |
| `variables` | String | Variables utilisées |
| `isActive` | Boolean | Template actif |
| `isDefault` | Boolean | Template par défaut |

### EmailLog
Historique des emails envoyés.

| Champ | Type | Description |
|-------|------|-------------|
| `templateId` | String? | → EmailTemplate.id |
| `templateName` | String | Nom (snapshot) |
| `recipientEmail` | String | Destinataire |
| `recipientUserId` | String? | → User.id |
| `subject` | String | Sujet |
| `status` | String | "sent" \| "failed" \| "bounced" |
| `error` | String? | Erreur si échec |
| `provider` | String | "smtp" \| "resend" |
| `providerId` | String? | ID message provider |

---

## Analytics & Monitoring

### TelemetryEvent
Événements utilisateur trackés.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String? | → User.id |
| `type` | String | Type événement |
| `category` | String | Catégorie |
| `metadata` | String? | Données JSON |
| `deviceId` | String? | ID device |
| `duration` | Int? | Durée (ms) |
| `status` | String? | Statut |
| `error` | String? | Erreur |
| `timestamp` | DateTime | Horodatage |

### FeatureUsage
Usage agrégé par feature/user.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id |
| `featureName` | String | Nom feature |
| `usageCount` | Int | Total utilisations |
| `totalDuration` | Int | Durée totale (ms) |
| `lastUsedAt` | DateTime | Dernière utilisation |

### OpenAIUsage
Usage OpenAI agrégé par jour/feature/model.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id |
| `featureName` | String | Feature |
| `model` | String | Modèle GPT |
| `date` | DateTime | Jour |
| `promptTokens` | Int | Tokens prompt |
| `cachedTokens` | Int | Tokens cachés |
| `completionTokens` | Int | Tokens completion |
| `estimatedCost` | Float | Coût estimé USD |
| `callsCount` | Int | Nombre d'appels |

### OpenAICall
Détail de chaque appel OpenAI.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id |
| `featureName` | String | Feature |
| `model` | String | Modèle |
| `promptTokens` | Int | Tokens prompt |
| `completionTokens` | Int | Tokens completion |
| `estimatedCost` | Float | Coût USD |
| `duration` | Int? | Durée (ms) |

### OpenAIPricing
Tarification par modèle.

| Champ | Type | Description |
|-------|------|-------------|
| `modelName` | String | Nom modèle |
| `inputPricePerMToken` | Float | Prix input/M tokens |
| `outputPricePerMToken` | Float | Prix output/M tokens |
| `cachePricePerMToken` | Float | Prix cache/M tokens |
| `isActive` | Boolean | Modèle actif |

### OpenAIAlert
Alertes budget OpenAI.

| Champ | Type | Description |
|-------|------|-------------|
| `type` | String | Type alerte |
| `threshold` | Float | Seuil |
| `enabled` | Boolean | Alerte active |
| `name` | String | Nom |

---

## Other Models

### Setting
Paramètres globaux application.

| Champ | Type | Description |
|-------|------|-------------|
| `settingName` | String | Clé unique |
| `value` | String | Valeur |
| `category` | String | Catégorie |
| `description` | String? | Description |

### FeatureMapping
Mapping features → settings/pricing.

| Champ | Type | Description |
|-------|------|-------------|
| `featureKey` | String | Clé feature |
| `displayName` | String | Nom affiché |
| `settingNames` | Json | Settings associés |
| `openAICallNames` | Json | Appels OpenAI |
| `planFeatureNames` | Json | Features plan |

### Feedback
Retours utilisateurs.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id |
| `rating` | Int | Note (1-5) |
| `comment` | String | Commentaire |
| `isBugReport` | Boolean | Est un bug report |
| `status` | String | "new" \| "reviewed" \| "resolved" |

### ConsentLog
Historique consentements RGPD.

| Champ | Type | Description |
|-------|------|-------------|
| `userId` | String | → User.id |
| `action` | String | Action ("accept" \| "reject" \| "update") |
| `preferences` | String | Préférences JSON |
| `ip` | String? | Adresse IP |

### Referral
Parrainages.

| Champ | Type | Description |
|-------|------|-------------|
| `referrerId` | String | → User.id (parrain) |
| `referredUserId` | String | → User.id (filleul) |
| `referralCode` | String | Code utilisé |
| `status` | String | "pending" \| "completed" |
| `referrerReward` | Int | Crédits parrain |
| `referredReward` | Int | Crédits filleul |

### PromoCode
Codes promotionnels.

| Champ | Type | Description |
|-------|------|-------------|
| `code` | String | Code unique |
| `type` | String | Type promo |
| `discountType` | String? | "percentage" \| "fixed" |
| `discountValue` | Float? | Valeur réduction |
| `creditBonus` | Int? | Crédits bonus |
| `maxUses` | Int? | Utilisations max |
| `currentUses` | Int | Utilisations actuelles |
| `validFrom` | DateTime | Début validité |
| `validUntil` | DateTime? | Fin validité |
| `isActive` | Boolean | Code actif |

### StripeWebhookLog
Logs webhooks Stripe.

| Champ | Type | Description |
|-------|------|-------------|
| `eventId` | String | ID événement Stripe |
| `eventType` | String | Type événement |
| `payload` | String | Payload JSON |
| `processed` | Boolean | Traité |
| `error` | String? | Erreur |

---

## Schéma Relationnel

```
User (1) ─────────────── (N) Account
  │
  ├── (1) ─────────────── (N) CvFile ──── (N) CvVersion
  │                          │
  │                          └── (N) ──── (1) JobOffer
  │
  ├── (1) ─────────────── (1) Subscription ──── SubscriptionPlan
  │
  ├── (1) ─────────────── (1) CreditBalance
  │
  ├── (1) ─────────────── (N) CreditTransaction
  │
  ├── (1) ─────────────── (N) BackgroundTask
  │
  ├── (1) ─────────────── (N) FeatureUsage
  │
  ├── (1) ─────────────── (N) TelemetryEvent
  │
  └── (1) ─────────────── (N) Referral (as referrer & referred)

SubscriptionPlan (1) ── (N) SubscriptionPlanFeatureLimit

EmailTrigger (1) ────── (N) EmailTemplate ──── (N) EmailLog
```
