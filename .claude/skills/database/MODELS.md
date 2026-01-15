# Référence des modèles Prisma

Schéma complet : `prisma/schema.prisma`

## Modèles principaux

### User
Table centrale des utilisateurs.
```
id, name, email, emailVerified, passwordHash, image, role,
resetToken, resetTokenExpiry, stripeCustomerId, referralCode,
referredBy, onboardingState (JSON), createdAt, updatedAt
```
**Relations :** accounts, cvs, subscription, creditBalance, backgroundTasks, feedbacks, jobOffers...

### CvFile
CVs des utilisateurs (contenu JSON stocké en DB).
```
id, userId, filename, content (JSON), contentVersion, sourceType, sourceValue,
jobOfferId, language, matchScore, scoreBefore, matchScoreStatus, scoreBreakdown,
improvementSuggestions, missingSkills, matchingSkills, optimiseStatus,
pendingChanges (JSON), blocked, blockedReason, createdAt, updatedAt
```
**Index unique :** `[userId, filename]`

### CvVersion
Historique des versions de CV (optimisation IA).
```
id, cvFileId, version, content (JSON), changelog, changeType,
sourceFile, matchScore, scoreBreakdown, createdAt
```
**Index unique :** `[cvFileId, version]`

### JobOffer
Offres d'emploi extraites (URL ou PDF).
```
id, userId, sourceType ('url'|'pdf'), sourceValue, contentHash,
content (JSON), extractedAt, extractionModel, tokensUsed, createdAt
```

## Authentification

### Account
Comptes OAuth liés.
```
id, userId, type, provider, providerAccountId, refresh_token,
access_token, expires_at, token_type, scope, id_token
```

### VerificationToken / EmailVerificationToken / AutoSignInToken / EmailChangeRequest
Tokens de vérification avec expiration.

## Abonnements & Crédits

### Subscription
Abonnement Stripe de l'utilisateur.
```
id, userId (unique), stripeCustomerId, stripeSubscriptionId,
planId, status, billingPeriod, currentPeriodStart, currentPeriodEnd,
cancelAtPeriodEnd, canceledAt
```

### SubscriptionPlan
Plans disponibles (Free, Pro, etc.).
```
id, name (unique), description, isFree, tier, isPopular,
priceMonthly, priceYearly, stripeProductId, stripePriceIdMonthly, stripePriceIdYearly
```

### SubscriptionPlanFeatureLimit
Limites de features par plan.
```
id, planId, featureName, isEnabled, usageLimit (-1 = illimité)
```

### CreditBalance
Solde de crédits de l'utilisateur.
```
id, userId (unique), balance, totalPurchased, totalUsed, totalRefunded, totalGifted
```

### CreditTransaction
Transactions de crédits.
```
id, userId, amount, type, featureName, taskId, cvFileId,
stripePaymentIntentId, refunded, relatedTransactionId
```

### CreditPack
Packs de crédits à acheter.
```
id, name, creditAmount (unique), price, isActive, stripePriceId
```

## Tâches & Télémétrie

### BackgroundTask
File d'attente des tâches longues.
```
id, title, type, status, createdAt (BigInt), deviceId, userId,
cvFile, result, error, payload, creditUsed, featureName
```
**Status :** queued, running, completed, failed

### TelemetryEvent
Événements de télémétrie.
```
id, userId, type, category, metadata, deviceId, duration, status, error, timestamp
```

### FeatureUsage / FeatureUsageCounter
Suivi d'utilisation des features.

## OpenAI

### OpenAICall
Logs des appels OpenAI individuels.
```
id, userId, featureName, model, promptTokens, cachedTokens,
completionTokens, totalTokens, estimatedCost, duration
```

### OpenAIUsage
Agrégation quotidienne par user/feature/model.

### OpenAIPricing
Tarifs des modèles OpenAI.

### OpenAIAlert
Alertes de consommation.

## Configuration

### Setting
Paramètres système (clé/valeur).
```
id, settingName (unique), value, category, description
```

### FeatureMapping
Mapping features → settings/calls/limits.

## Autres

### Feedback
Retours utilisateurs et bug reports.

### ConsentLog
Logs RGPD de consentement.

### LinkHistory
Historique des URLs d'offres.

### Referral
Programme de parrainage.

### PromoCode
Codes promo.

### EmailTemplate / EmailLog
Templates d'emails et logs d'envoi.

### StripeWebhookLog
Logs des webhooks Stripe.
