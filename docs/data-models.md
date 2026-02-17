# Modèles de Données - FitMyCV.io

> Documentation des 34 modèles Prisma organisés par domaine fonctionnel

---

## Vue d'ensemble

| Catégorie | Modèles | Description |
|-----------|---------|-------------|
| Authentification & Utilisateurs | 5 | Gestion identité, OAuth, tokens |
| CV & Documents | 4 | Stockage CV, versions, offres emploi |
| Pipeline Génération CV | 3 | Orchestration génération IA |
| Tâches Background | 1 | Queue tâches asynchrones |
| Abonnements & Crédits | 8 | Stripe, plans, transactions |
| Email | 3 | Templates, triggers, logs |
| OpenAI & Coûts | 4 | Usage IA, pricing, alertes |
| Télémétrie & Feedback | 5 | Analytics, consentement |
| Configuration | 1 | Paramètres dynamiques |

---

## 1. Authentification & Utilisateurs

### User

Modèle central utilisateur avec authentification et relations.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `name` | String? | Nom affiché |
| `email` | String? (unique) | Email de connexion |
| `emailVerified` | DateTime? | Date vérification email |
| `passwordHash` | String? | Hash bcrypt (credentials auth) |
| `image` | String? | URL avatar |
| `role` | String | `"USER"` \| `"ADMIN"` |
| `resetToken` | String? | Token reset password |
| `resetTokenExpiry` | DateTime? | Expiration token reset |
| `stripeCustomerId` | String? (unique) | ID client Stripe |
| `onboardingState` | Json? | État parcours onboarding |
| `createdAt` | DateTime | Date création |
| `updatedAt` | DateTime | Dernière modification |

**Relations :**
- `accounts` → Account[] (OAuth providers)
- `subscription` → Subscription? (abonnement actif)
- `creditBalance` → CreditBalance? (solde crédits)
- `cvs` → CvFile[] (CV de l'utilisateur)
- `jobOffers` → JobOffer[] (offres extraites)
- `backgroundTasks` → BackgroundTask[] (tâches en cours)
- `telemetryEvents` → TelemetryEvent[] (tracking)

---

### Account

Comptes OAuth liés (Google, GitHub, Apple).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Référence User |
| `type` | String | Type compte (`"oauth"`) |
| `provider` | String | `"google"` \| `"github"` \| `"apple"` |
| `providerAccountId` | String | ID chez le provider |
| `refresh_token` | String? | Token rafraîchissement |
| `access_token` | String? | Token accès |
| `expires_at` | Int? | Timestamp expiration |
| `token_type` | String? | Type token (`"Bearer"`) |
| `scope` | String? | Scopes autorisés |
| `id_token` | String? | JWT OpenID Connect |

**Contrainte unique :** `[provider, providerAccountId]`

---

### EmailVerificationToken

Tokens de vérification email à l'inscription.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Référence User |
| `token` | String (unique) | Token unique |
| `expires` | DateTime | Date expiration |
| `createdAt` | DateTime | Date création |

---

### AutoSignInToken

Tokens de connexion automatique post-vérification.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Référence User |
| `token` | String (unique) | Token unique |
| `expires` | DateTime | Date expiration |
| `createdAt` | DateTime | Date création |

---

### EmailChangeRequest

Demandes de changement d'email (double vérification).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Référence User |
| `newEmail` | String | Nouvel email demandé |
| `token` | String (unique) | Token de confirmation |
| `expires` | DateTime | Date expiration |
| `createdAt` | DateTime | Date création |

---

## 2. CV & Documents

### CvFile

CV stocké en JSON avec métadonnées de scoring et review.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Propriétaire |
| `filename` | String | Nom fichier unique par user |
| `content` | Json? | Contenu CV JSON complet |
| `contentVersion` | Int | Numéro version courante |
| `sourceType` | String? | `"manual"` \| `"import"` \| `"generation"` |
| `sourceValue` | String? | URL/nom fichier source |
| `jobOfferId` | String? | Offre emploi liée |
| `language` | String? | Langue détectée (`fr`, `en`, etc.) |
| `isTranslated` | Boolean | CV traduit automatiquement |
| `matchScore` | Int? | Score matching 0-100 |
| `scoreBefore` | Int? | Score avant optimisation |
| `matchScoreStatus` | String? | `"idle"` \| `"loading"` \| `"done"` |
| `scoreBreakdown` | String? | JSON détail scores par section |
| `improvementSuggestions` | String? | Suggestions IA |
| `missingSkills` | String? | Compétences manquantes |
| `matchingSkills` | String? | Compétences correspondantes |
| `optimiseStatus` | String? | État optimisation IA |
| `pendingChanges` | Json? | Modifications en attente review |
| `pendingSourceVersion` | Int? | Version pour diff |
| `blocked` | Boolean | CV bloqué |
| `blockedReason` | String? | Raison blocage |
| `createdWithCredit` | Boolean | Créé via crédit |
| `creditTransactionId` | String? | Transaction associée |

**Contrainte unique :** `[userId, filename]`

**Relations :**
- `user` → User
- `jobOffer` → JobOffer?
- `versions` → CvVersion[]
- `creditTransaction` → CreditTransaction?

---

### CvVersion

Historique des versions CV pour rollback.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `cvFileId` | String | CV parent |
| `version` | Int | Numéro version (1, 2, 3...) |
| `content` | Json | Contenu JSON snapshot |
| `changelog` | String? | Description modification |
| `changeType` | String? | `"optimization"` \| `"adaptation"` \| `"restore"` |
| `sourceFile` | String? | CV source (adaptation) |
| `matchScore` | Int? | Score au moment de la version |
| `scoreBreakdown` | String? | Détail scores |
| `improvementSuggestions` | String? | Suggestions IA |
| `missingSkills` | String? | Compétences manquantes |
| `matchingSkills` | String? | Compétences correspondantes |
| `createdAt` | DateTime | Date création |

**Contrainte unique :** `[cvFileId, version]`

---

### JobOffer

Offres d'emploi extraites (URL ou PDF).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Propriétaire |
| `sourceType` | String | `"url"` \| `"pdf"` |
| `sourceValue` | String | URL ou nom fichier |
| `contentHash` | String? | Hash SHA256 (PDF) |
| `content` | Json | Extraction structurée |
| `extractedAt` | DateTime | Date extraction |
| `extractionModel` | String | Modèle IA utilisé |
| `tokensUsed` | Int | Tokens consommés |

**Contrainte unique :** `[userId, sourceValue]`

**Relations :**
- `user` → User
- `cvFiles` → CvFile[] (CV générés depuis cette offre)

---

### ExportTemplate

Templates d'export PDF personnalisés par utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Propriétaire |
| `name` | String | Nom du template |
| `selections` | Json | Config sections (enabled, options) |
| `createdAt` | DateTime | Date création |
| `updatedAt` | DateTime | Dernière modification |

**Contrainte unique :** `[userId, name]`

---

## 3. Pipeline Génération CV (v2)

### CvGenerationTask

Tâche de génération CV (peut inclure plusieurs offres).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `sourceCvFileId` | String | CV source |
| `mode` | String | `"adapt"` \| `"optimize"` |
| `status` | String | `"pending"` \| `"running"` \| `"completed"` \| `"failed"` |
| `totalOffers` | Int | Nombre d'offres total |
| `completedOffers` | Int | Offres traitées |
| `creditsDebited` | Int | Crédits débités |
| `creditsRefunded` | Int | Crédits remboursés |
| `error` | String? | Message erreur |
| `startedAt` | DateTime? | Début traitement |
| `completedAt` | DateTime? | Fin traitement |

**Relations :**
- `user` → User
- `offers` → CvGenerationOffer[]

---

### CvGenerationOffer

Traitement d'une offre dans une tâche de génération.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `taskId` | String | Tâche parente |
| `sourceUrl` | String? | URL offre (extraction async) |
| `jobOfferId` | String? | Offre extraite |
| `offerIndex` | Int | Position dans le batch |
| `status` | String | `"pending"` \| `"extracting"` \| `"running"` \| `"completed"` \| `"failed"` |
| `classificationResult` | Json? | Résultat phase classification |
| `batchResults` | Json? | Résultats batches (exp, skills, etc.) |
| `generatedCvFileId` | String? | CV généré |
| `generatedCvFileName` | String? | Nom fichier généré |
| `retryCount` | Int | Tentatives |
| `error` | String? | Message erreur |
| `creditsRefunded` | Boolean | Crédits remboursés |

**Relations :**
- `task` → CvGenerationTask
- `subtasks` → CvGenerationSubtask[]

---

### CvGenerationSubtask

Sous-tâche atomique de génération (classification, batch, recompose).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `offerId` | String | Offre parente |
| `type` | String | `"classify"` \| `"batch_experience"` \| `"batch_project"` \| `"batch_extras"` \| `"batch_skills"` \| `"batch_summary"` \| `"recompose"` |
| `itemIndex` | Int? | Index item (exp 0, exp 1...) |
| `status` | String | `"pending"` \| `"running"` \| `"completed"` \| `"failed"` |
| `input` | Json? | Données entrée (debug) |
| `output` | Json? | Résultat traitement |
| `modifications` | Json? | Array modifications {field, before, after, reason, action} |
| `modelUsed` | String? | Modèle IA utilisé |
| `promptTokens` | Int | Tokens prompt |
| `cachedTokens` | Int | Tokens cache |
| `completionTokens` | Int | Tokens completion |
| `estimatedCost` | Float | Coût estimé USD |
| `durationMs` | Int? | Durée exécution ms |
| `retryCount` | Int | Tentatives |
| `error` | String? | Message erreur |

**Relations :**
- `offer` → CvGenerationOffer

---

## 4. Tâches Background

### BackgroundTask

Tâches asynchrones (génération, import, traduction).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | Identifiant (non-cuid, défini manuellement) |
| `title` | String | Titre affiché |
| `successMessage` | String? | Message succès |
| `type` | String | Type tâche |
| `status` | String | `"pending"` \| `"running"` \| `"completed"` \| `"failed"` |
| `createdAt` | BigInt | Timestamp création (ms) |
| `shouldUpdateCvList` | Boolean | Refresh liste CV après |
| `result` | String? | Résultat JSON |
| `error` | String? | Message erreur |
| `payload` | String? | Données entrée JSON |
| `deviceId` | String | ID device client |
| `userId` | String? | Utilisateur (optionnel) |
| `cvFile` | String? | Fichier CV concerné |
| `creditUsed` | Boolean | Crédit consommé |
| `creditTransactionId` | String? | Transaction associée |
| `featureName` | String? | Feature concernée |
| `featureCounterPeriodStart` | DateTime? | Début période compteur |

**Index :** `[deviceId]`, `[status]`, `[createdAt]`, `[cvFile, status]`

---

## 5. Abonnements & Crédits

### SubscriptionPlan

Plans d'abonnement disponibles.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | Int (auto) | Identifiant unique |
| `name` | String (unique) | Nom plan (`"free"`, `"pro"`, etc.) |
| `description` | String? | Description |
| `isFree` | Boolean | Plan gratuit |
| `tier` | Int | Niveau (0=free, 1=basic, 2=pro...) |
| `isPopular` | Boolean | Badge "populaire" |
| `priceMonthly` | Float | Prix mensuel |
| `priceYearly` | Float | Prix annuel |
| `yearlyDiscountPercent` | Float | % réduction annuel |
| `priceCurrency` | String | Devise (`"EUR"`) |
| `stripeProductId` | String? | ID produit Stripe |
| `stripePriceIdMonthly` | String? | ID prix mensuel Stripe |
| `stripePriceIdYearly` | String? | ID prix annuel Stripe |

**Relations :**
- `subscriptions` → Subscription[]
- `featureLimits` → SubscriptionPlanFeatureLimit[]

---

### SubscriptionPlanFeatureLimit

Limites de features par plan.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `planId` | Int | Plan concerné |
| `featureName` | String | Nom feature |
| `isEnabled` | Boolean | Feature activée |
| `usageLimit` | Int | Limite mensuelle (-1 = illimité) |

**Contrainte unique :** `[planId, featureName]`

---

### Subscription

Abonnement actif d'un utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String (unique) | Utilisateur |
| `stripeCustomerId` | String (unique) | ID client Stripe |
| `stripeSubscriptionId` | String? (unique) | ID abonnement Stripe |
| `stripePriceId` | String? | ID prix actuel |
| `planId` | Int | Plan souscrit |
| `status` | String | `"active"` \| `"canceled"` \| `"past_due"` |
| `billingPeriod` | String | `"monthly"` \| `"yearly"` |
| `currentPeriodStart` | DateTime | Début période |
| `currentPeriodEnd` | DateTime | Fin période |
| `cancelAtPeriodEnd` | Boolean | Annulation programmée |
| `canceledAt` | DateTime? | Date annulation |

**Relations :**
- `user` → User
- `plan` → SubscriptionPlan

---

### CreditPack

Packs de crédits achetables.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | Int (auto) | Identifiant unique |
| `name` | String | Nom pack |
| `description` | String? | Description |
| `creditAmount` | Int (unique) | Nombre de crédits |
| `price` | Float | Prix |
| `priceCurrency` | String | Devise (`"EUR"`) |
| `isActive` | Boolean | Pack actif |
| `stripeProductId` | String? | ID produit Stripe |
| `stripePriceId` | String? | ID prix Stripe |

---

### CreditBalance

Solde de crédits utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String (unique) | Utilisateur |
| `balance` | Int | Solde actuel |
| `totalPurchased` | Int | Total acheté |
| `totalUsed` | Int | Total utilisé |
| `totalRefunded` | Int | Total remboursé |
| `totalGifted` | Int | Total offert |
| `balanceAfterLastPurchase` | Int | Solde après dernier achat |

---

### CreditTransaction

Historique des transactions crédits.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `amount` | Int | Montant (+/-) |
| `type` | String | `"purchase"` \| `"usage"` \| `"refund"` \| `"gift"` |
| `featureName` | String? | Feature consommée |
| `taskId` | String? | Tâche associée |
| `cvFileId` | String? | CV associé |
| `stripePaymentIntentId` | String? | ID paiement Stripe |
| `stripeInvoiceId` | String? | ID facture Stripe |
| `refunded` | Boolean | Remboursée |
| `relatedTransactionId` | String? | Transaction liée |
| `metadata` | String? | Métadonnées JSON |

**Relations :**
- `user` → User
- `task` → BackgroundTask?
- `cvFile` → CvFile?

---

### FeatureUsageCounter

Compteurs d'usage mensuels par feature.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `featureName` | String | Nom feature |
| `count` | Int | Compteur actuel |
| `periodStart` | DateTime | Début période |
| `periodEnd` | DateTime | Fin période |

**Contrainte unique :** `[userId, featureName]` (1 compteur par feature, reset auto)

---

### StripeWebhookLog

Logs des webhooks Stripe reçus.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `eventId` | String (unique) | ID événement Stripe |
| `eventType` | String | Type événement |
| `payload` | String | Payload JSON complet |
| `processed` | Boolean | Traité avec succès |
| `error` | String? | Message erreur |
| `createdAt` | DateTime | Date réception |

---

## 6. Email

### EmailTrigger

Triggers d'email système (événements déclencheurs).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `name` | String (unique) | Identifiant technique (`email_verification`, `password_reset`) |
| `label` | String | Nom affiché |
| `description` | String? | Description |
| `variables` | String | JSON array variables disponibles |
| `category` | String | Catégorie (`"general"`, `"auth"`, etc.) |
| `icon` | String? | Icône UI |
| `isSystem` | Boolean | Trigger système (non supprimable) |

**Relations :**
- `templates` → EmailTemplate[]

---

### EmailTemplate

Templates d'email avec design JSON.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `name` | String | Nom template |
| `triggerId` | String? | Trigger associé |
| `subject` | String | Sujet email |
| `designJson` | String | JSON Maily/TipTap (éditeur) |
| `htmlContent` | String | HTML rendu final |
| `variables` | String | Variables utilisées |
| `isActive` | Boolean | Template actif pour ce trigger |
| `isDefault` | Boolean | Template par défaut global |

**Relations :**
- `trigger` → EmailTrigger?
- `emailLogs` → EmailLog[]

---

### EmailLog

Logs d'envoi d'emails.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `templateId` | String? | Template utilisé |
| `templateName` | String | Nom template (snapshot) |
| `recipientEmail` | String | Email destinataire |
| `recipientUserId` | String? | Utilisateur destinataire |
| `subject` | String | Sujet envoyé |
| `status` | String | `"sent"` \| `"failed"` \| `"bounced"` |
| `error` | String? | Message erreur |
| `provider` | String | `"smtp"` \| `"resend"` |
| `providerId` | String? | ID message provider |
| `isTestEmail` | Boolean | Email de test |
| `createdAt` | DateTime | Date envoi |

---

## 7. OpenAI & Coûts

### OpenAIPricing

Configuration tarifs modèles OpenAI.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `modelName` | String (unique) | Nom modèle (`gpt-4o`, `gpt-4o-mini`) |
| `inputPricePerMToken` | Float | Prix input/M tokens (standard) |
| `outputPricePerMToken` | Float | Prix output/M tokens (standard) |
| `cachePricePerMToken` | Float | Prix cache/M tokens |
| `inputPricePerMTokenPriority` | Float? | Prix input priority (~70% plus cher) |
| `outputPricePerMTokenPriority` | Float? | Prix output priority |
| `cachePricePerMTokenPriority` | Float? | Prix cache priority |
| `description` | String? | Description modèle |
| `isActive` | Boolean | Modèle activé |

---

### OpenAIUsage

Usage agrégé OpenAI par utilisateur/feature/jour.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `featureName` | String | Feature concernée |
| `model` | String | Modèle utilisé |
| `date` | DateTime | Jour (agrégation) |
| `promptTokens` | Int | Tokens prompt total |
| `cachedTokens` | Int | Tokens cache total |
| `completionTokens` | Int | Tokens completion total |
| `totalTokens` | Int | Total tokens |
| `estimatedCost` | Float | Coût estimé USD |
| `callsCount` | Int | Nombre d'appels |

**Contrainte unique :** `[userId, featureName, model, date]`

---

### OpenAIAlert

Alertes de monitoring OpenAI (seuils).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `type` | String | Type alerte |
| `threshold` | Float | Seuil déclenchement |
| `enabled` | Boolean | Alerte activée |
| `name` | String | Nom alerte |
| `description` | String? | Description |

---

### OpenAICall

Log détaillé de chaque appel OpenAI.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `featureName` | String | Feature (`cv_generation`, `job_extraction`, etc.) |
| `model` | String | Modèle utilisé |
| `promptTokens` | Int | Tokens prompt |
| `cachedTokens` | Int | Tokens cache |
| `completionTokens` | Int | Tokens completion |
| `totalTokens` | Int | Total tokens |
| `estimatedCost` | Float | Coût estimé USD |
| `duration` | Int? | Durée ms |
| `metadata` | String? | Métadonnées JSON |
| `createdAt` | DateTime | Date appel |

---

## 8. Télémétrie & Feedback

### TelemetryEvent

Événements de tracking utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String? | Utilisateur (optionnel) |
| `type` | String | Type événement |
| `category` | String | Catégorie |
| `metadata` | String? | Données JSON |
| `deviceId` | String? | ID device |
| `duration` | Int? | Durée action ms |
| `status` | String? | Statut |
| `error` | String? | Erreur |
| `timestamp` | DateTime | Timestamp événement |

**Index :** `[type]`, `[category]`, `[deviceId]`, `[timestamp]`, `[type, timestamp]`

---

### FeatureUsage

Usage cumulé des features (statistiques globales).

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `featureName` | String | Nom feature |
| `usageCount` | Int | Compteur total |
| `lastUsedAt` | DateTime | Dernière utilisation |
| `totalDuration` | Int | Durée totale ms |
| `metadata` | String? | Métadonnées |

**Contrainte unique :** `[userId, featureName]`

---

### Feedback

Feedback et bug reports utilisateurs.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `rating` | Int | Note 1-5 |
| `comment` | String | Commentaire |
| `isBugReport` | Boolean | Report de bug |
| `currentCvFile` | String? | CV actif au moment du feedback |
| `userAgent` | String? | User-Agent navigateur |
| `pageUrl` | String? | URL page |
| `status` | String | `"new"` \| `"reviewed"` \| `"resolved"` |
| `createdAt` | DateTime | Date création |

---

### ConsentLog

Logs de consentement RGPD.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `action` | String | Action (`"accept"`, `"reject"`, `"update"`) |
| `preferences` | String | JSON préférences |
| `ip` | String? | Adresse IP |
| `userAgent` | String? | User-Agent |
| `createdAt` | DateTime | Date action |

---

### LinkHistory

Historique des URLs visitées par utilisateur.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `userId` | String | Utilisateur |
| `url` | String | URL visitée |
| `createdAt` | DateTime | Date visite |

**Contrainte unique :** `[userId, url]`

---

## 9. Configuration

### Setting

Paramètres dynamiques de l'application.

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String (cuid) | Identifiant unique |
| `settingName` | String (unique) | Clé paramètre |
| `value` | String | Valeur |
| `category` | String | Catégorie (`"openai"`, `"stripe"`, `"app"`) |
| `description` | String? | Description |
| `createdAt` | DateTime | Date création |
| `updatedAt` | DateTime | Dernière modification |

**Exemples de settings :**
- `openai_default_model` → `"gpt-4o"`
- `openai_extraction_model` → `"gpt-4o-mini"`
- `maintenance_mode` → `"false"`

---

## Diagramme des Relations

```
User ─────────────────────────────────────────────────────────────────┐
  │                                                                    │
  ├─ 1:N ─ Account (OAuth)                                            │
  ├─ 1:1 ─ Subscription ─── N:1 ─── SubscriptionPlan                  │
  │                                      │                             │
  │                                      └─ 1:N ─ SubscriptionPlanFeatureLimit
  ├─ 1:1 ─ CreditBalance                                              │
  ├─ 1:N ─ CreditTransaction                                          │
  ├─ 1:N ─ FeatureUsageCounter                                        │
  │                                                                    │
  ├─ 1:N ─ CvFile ───────────────────────────────────────────────────┤
  │           │                                                        │
  │           ├─ 1:N ─ CvVersion                                       │
  │           └─ N:1 ─ JobOffer ←────────────────────── 1:N ─ User    │
  │                                                                    │
  ├─ 1:N ─ CvGenerationTask ─── 1:N ─ CvGenerationOffer               │
  │                                      │                             │
  │                                      └─ 1:N ─ CvGenerationSubtask  │
  │                                                                    │
  ├─ 1:N ─ BackgroundTask                                             │
  ├─ 1:N ─ ExportTemplate                                             │
  │                                                                    │
  ├─ 1:N ─ OpenAIUsage                                                │
  ├─ 1:N ─ OpenAICall                                                 │
  │                                                                    │
  ├─ 1:N ─ TelemetryEvent                                             │
  ├─ 1:N ─ FeatureUsage                                               │
  ├─ 1:N ─ Feedback                                                   │
  ├─ 1:N ─ ConsentLog                                                 │
  └─ 1:N ─ LinkHistory                                                │
                                                                       │
EmailTrigger ─── 1:N ─── EmailTemplate ─── 1:N ─── EmailLog           │
                                                                       │
Standalone: Setting, OpenAIPricing, OpenAIAlert, CreditPack,          │
            StripeWebhookLog, EmailVerificationToken, AutoSignInToken, │
            EmailChangeRequest                                         │
```

---

## Conventions

1. **IDs** : `cuid()` par défaut, sauf `SubscriptionPlan`, `CreditPack` (auto-increment)
2. **Timestamps** : `createdAt` + `updatedAt` sur tous les modèles mutables
3. **Soft delete** : Non utilisé (cascade delete avec `onDelete: Cascade`)
4. **JSON fields** : Utilisés pour données flexibles (`content`, `metadata`, `pendingChanges`)
5. **Index** : Définis sur champs fréquemment recherchés
6. **Unique constraints** : Utilisées pour éviter les doublons business
