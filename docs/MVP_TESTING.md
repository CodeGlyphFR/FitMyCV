# Guide de Test MVP - Système d'Abonnements et Crédits

Guide de test pour valider le système d'abonnements et crédits avant passage en production.

## 📋 Prérequis

- Backend complété (Phases 1-5, 8-9)
- Stripe configuré en mode Test
- Variables d'environnement configurées
- Build réussi (`npm run build`)

---

## Étape 1 : Configuration Stripe Test

### 1.1 Suivre le guide STRIPE_SETUP.md

Suivre les étapes 1-4 du guide `docs/STRIPE_SETUP.md` :

```bash
# Étapes à compléter :
1. Créer compte Stripe (mode Test)
2. Récupérer les clés API Test
3. Configurer les webhooks (Stripe CLI)
4. Synchroniser les produits Stripe
```

### 1.2 Vérifier les variables d'environnement

Dans `.env.local` :

```bash
# Stripe Test Mode
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

### 1.3 Exécuter le script de synchronisation

```bash
node scripts/sync-stripe-products.js
```

**Résultat attendu** :
- ✅ 3 produits d'abonnement créés dans Stripe
- ✅ 3 packs de crédits créés dans Stripe
- ✅ Tous les prix (mensuels/annuels) créés
- ✅ IDs Stripe sauvegardés dans la base de données

### 1.4 Lancer Stripe CLI pour les webhooks

Dans un terminal séparé :

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copier le `webhook signing secret` dans `.env.local`.

---

## Étape 2 : Tests d'Inscription et Plan Gratuit

### Test 2.1 : Inscription d'un nouveau compte

**Action** :
1. Aller sur `/register` (ou via votre flow d'inscription)
2. Créer un compte avec email test : `test1@example.com`

**Vérifications** :
```sql
-- Vérifier que l'utilisateur existe
SELECT id, email, name FROM User WHERE email = 'test1@example.com';

-- Vérifier qu'un abonnement Gratuit a été créé
SELECT
  s.id,
  s.userId,
  s.status,
  sp.name as planName,
  s.currentPeriodEnd
FROM Subscription s
JOIN SubscriptionPlan sp ON s.planId = sp.id
WHERE s.userId = (SELECT id FROM User WHERE email = 'test1@example.com');

-- Vérifier que la balance de crédits existe (initialisée à 0)
SELECT * FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
```

**Résultat attendu** :
- ✅ User créé
- ✅ Subscription créée avec planId = 1 (Gratuit)
- ✅ status = 'active'
- ✅ CreditBalance créée avec balance = 0
- ✅ Log dans la console : "Plan Gratuit attribué à user [userId]"

---

## Étape 3 : Tests de Limites du Plan Gratuit

### Test 3.1 : Génération de CV (première utilisation)

**Contexte** : Plan Gratuit = 3 utilisations de `gpt_cv_generation`

**Action** :
1. Se connecter avec `test1@example.com`
2. Lancer une génération de CV (bouton GPT avec lien LinkedIn ou offre)
3. Attendre la fin du job

**Vérifications** :
```sql
-- Vérifier le compteur de feature
SELECT * FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation';

-- Vérifier le BackgroundTask
SELECT
  id,
  type,
  status,
  creditUsed,
  creditTransactionId
FROM BackgroundTask
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
ORDER BY createdAt DESC
LIMIT 1;
```

**Résultat attendu** :
- ✅ FeatureUsageCounter créé avec count = 1
- ✅ BackgroundTask status = 'completed'
- ✅ creditUsed = false (pas de crédit utilisé)
- ✅ CV créé avec createdWithCredit = false

### Test 3.2 : Épuiser la limite du plan

**Action** :
1. Générer 2 CV supplémentaires (total = 3/3)
2. Tenter une 4ème génération

**Vérifications après 3 générations** :
```sql
SELECT count FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation';
-- Attendu : count = 3
```

**Vérifications après 4ème tentative SANS crédit** :
```sql
SELECT status, error FROM BackgroundTask
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : status = 'failed', error contient "Limite atteinte"
```

**Résultat attendu** :
- ✅ Première génération : count = 1, succès
- ✅ Deuxième génération : count = 2, succès
- ✅ Troisième génération : count = 3, succès
- ✅ Quatrième génération : échec avec erreur "Limite atteinte et crédits insuffisants"

---

## Étape 4 : Tests d'Achat de Crédits

### Test 4.1 : Acheter un pack de crédits

**Action** :
1. Aller sur `/account/subscriptions` (ou votre page de gestion)
2. Cliquer sur "Acheter 10 crédits" (Pack Starter)
3. Utiliser la carte de test Stripe : `4242 4242 4242 4242`
4. Compléter le paiement

**Vérifications dans les logs Stripe CLI** :
```
⚡ Webhook received: payment_intent.succeeded
```

**Vérifications en base** :
```sql
-- Vérifier la balance de crédits
SELECT balance, totalPurchased, totalUsed
FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : balance = 10, totalPurchased = 10, totalUsed = 0

-- Vérifier la transaction
SELECT amount, type, stripePaymentIntentId
FROM CreditTransaction
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND type = 'purchase'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : amount = 10, type = 'purchase', stripePaymentIntentId renseigné

-- Vérifier le webhook log
SELECT eventType, processed
FROM StripeWebhookLog
WHERE eventType = 'payment_intent.succeeded'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : eventType = 'payment_intent.succeeded', processed = true
```

**Résultat attendu** :
- ✅ Redirection vers Stripe Checkout
- ✅ Paiement réussi
- ✅ Webhook `payment_intent.succeeded` reçu
- ✅ 10 crédits ajoutés à la balance
- ✅ Transaction enregistrée avec stripePaymentIntentId

### Test 4.2 : Utiliser un crédit pour générer un CV

**Contexte** : 3/3 générations utilisées + 10 crédits

**Action** :
1. Lancer une nouvelle génération de CV (4ème)
2. Attendre la fin du job

**Vérifications** :
```sql
-- Vérifier le compteur (ne devrait pas changer)
SELECT count FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation';
-- Attendu : count = 3 (inchangé)

-- Vérifier la balance
SELECT balance, totalUsed FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : balance = 9, totalUsed = 1

-- Vérifier le BackgroundTask
SELECT creditUsed, creditTransactionId FROM BackgroundTask
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : creditUsed = true, creditTransactionId renseigné

-- Vérifier la transaction
SELECT amount, type, featureName FROM CreditTransaction
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND type = 'usage'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : amount = -1, type = 'usage', featureName = 'gpt_cv_generation'
```

**Résultat attendu** :
- ✅ Génération réussie
- ✅ 1 crédit débité (balance = 9)
- ✅ Compteur mensuel inchangé (count = 3)
- ✅ BackgroundTask avec creditUsed = true
- ✅ Transaction de type 'usage' créée

---

## Étape 5 : Tests de Remboursement (Tâche Échouée)

### Test 5.1 : Simuler un échec de génération

**Action** :
1. Modifier temporairement `lib/openai/generateCv.js` pour forcer une erreur :
```javascript
// Au début de la fonction
throw new Error('Test error for refund');
```
2. Lancer une génération de CV (devrait utiliser un crédit car limite atteinte)
3. Attendre l'échec du job

**Vérifications** :
```sql
-- Vérifier la balance (crédit remboursé)
SELECT balance, totalUsed, totalRefunded FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : balance = 9 (inchangé), totalUsed = 1, totalRefunded = 1

-- Vérifier les transactions
SELECT amount, type, refunded FROM CreditTransaction
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND type = 'usage'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : amount = -1, type = 'usage', refunded = true

-- Vérifier la transaction de remboursement
SELECT amount, type, relatedTransactionId FROM CreditTransaction
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND type = 'refund'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : amount = +1, type = 'refund', relatedTransactionId pointe vers la transaction usage
```

**Résultat attendu** :
- ✅ Job échoué avec status = 'failed'
- ✅ Crédit remboursé automatiquement
- ✅ Balance inchangée (9 crédits)
- ✅ 2 transactions créées : usage (refunded=true) + refund
- ✅ totalRefunded incrémenté

**Nettoyage** : Retirer l'erreur forcée dans `generateCv.js`.

---

## Étape 6 : Tests d'Upgrade de Plan

### Test 6.1 : Upgrade vers Plan Pro

**Action** :
1. Aller sur `/account/subscriptions`
2. Cliquer sur "Upgrade vers Pro"
3. Choisir "Mensuel" (9.99€)
4. Payer avec carte test `4242 4242 4242 4242`

**Vérifications dans Stripe CLI** :
```
⚡ Webhook received: customer.subscription.created
⚡ Webhook received: invoice.payment_succeeded
```

**Vérifications en base** :
```sql
-- Vérifier l'abonnement
SELECT
  s.planId,
  sp.name as planName,
  s.status,
  s.billingPeriod,
  s.stripeSubscriptionId
FROM Subscription s
JOIN SubscriptionPlan sp ON s.planId = sp.id
WHERE s.userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : planId = 2, planName = 'Pro', status = 'active', billingPeriod = 'monthly'

-- Vérifier le compteur (devrait être conservé)
SELECT count FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation';
-- Attendu : count = 3 (inchangé jusqu'au prochain reset mensuel)

-- Vérifier le webhook log
SELECT eventType, processed
FROM StripeWebhookLog
WHERE eventType = 'customer.subscription.created'
ORDER BY createdAt DESC
LIMIT 1;
```

**Résultat attendu** :
- ✅ Redirection vers Stripe Checkout
- ✅ Paiement réussi (9.99€)
- ✅ Webhook `customer.subscription.created` reçu
- ✅ Abonnement mis à jour vers Plan Pro
- ✅ stripeSubscriptionId sauvegardé
- ✅ Compteur mensuel conservé

### Test 6.2 : Tester les nouvelles limites Pro

**Contexte** : Plan Pro = 30 utilisations de `gpt_cv_generation`

**Action** :
1. Lancer une nouvelle génération de CV
2. Vérifier que le compteur s'incrémente (pas de crédit utilisé)

**Vérifications** :
```sql
SELECT count FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation';
-- Attendu : count = 4 (incrémenté)

-- Vérifier le BackgroundTask
SELECT creditUsed FROM BackgroundTask
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : creditUsed = false

-- Vérifier la balance (inchangée)
SELECT balance FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : balance = 9 (inchangé car limite non atteinte)
```

**Résultat attendu** :
- ✅ Génération réussie
- ✅ Compteur incrémenté à 4/30
- ✅ Pas de crédit débité (dans la limite du plan)

---

## Étape 7 : Tests de Limite de CV avec Crédits

### Test 7.1 : Créer des CV jusqu'à la limite

**Contexte** : Plan Pro = 10 CV max

**Action** :
1. Créer 10 CV manuellement ou par génération
2. Vérifier le nombre de CV

**Vérifications** :
```sql
SELECT COUNT(*) as cvCount FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = false;
-- Attendu : cvCount = 10
```

### Test 7.2 : Créer un CV avec crédit (au-delà de la limite)

**Action** :
1. Tenter de créer un 11ème CV
2. Modal devrait proposer d'utiliser un crédit
3. Accepter l'utilisation du crédit

**Vérifications** :
```sql
-- Vérifier le nombre de CV
SELECT COUNT(*) as cvCount FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = false;
-- Attendu : cvCount = 11

-- Vérifier que le CV est marqué comme créé avec crédit
SELECT createdWithCredit, creditTransactionId FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : createdWithCredit = true, creditTransactionId renseigné

-- Vérifier la balance
SELECT balance FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : balance = 8 (1 crédit débité)

-- Vérifier la transaction
SELECT amount, type FROM CreditTransaction
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND type = 'cv_creation'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : amount = -1, type = 'cv_creation'
```

**Résultat attendu** :
- ✅ 11ème CV créé (10 plan + 1 crédit)
- ✅ CV marqué avec createdWithCredit = true
- ✅ 1 crédit débité (balance = 8)
- ✅ Transaction de type 'cv_creation' créée

### Test 7.3 : Supprimer un CV créé avec crédit

**Action** :
1. Supprimer le 11ème CV (créé avec crédit)

**Vérifications** :
```sql
-- Vérifier la balance (PAS de remboursement)
SELECT balance FROM CreditBalance
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : balance = 8 (inchangé, pas de remboursement)

-- Vérifier que le CV est supprimé
SELECT COUNT(*) FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = false;
-- Attendu : count = 10
```

**Résultat attendu** :
- ✅ CV supprimé
- ✅ Pas de remboursement de crédit (règle métier)
- ✅ Compteur de CV retombe à 10

---

## Étape 8 : Tests de Downgrade avec Blocage de CV

### Test 8.1 : Downgrade vers Plan Gratuit

**Contexte** : User a 10 CV, Plan Gratuit = 3 CV max

**Action** :
1. Annuler l'abonnement Pro (downgrade immédiat ou à la fin de période)
2. Si downgrade immédiat, modal de sélection de 7 CV à bloquer

**Vérifications** :
```sql
-- Vérifier l'abonnement
SELECT planId, status FROM Subscription
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : planId = 1 (Gratuit), status = 'active' ou 'canceled'

-- Vérifier les CV bloqués
SELECT
  COUNT(*) as blockedCount,
  GROUP_CONCAT(filename) as blockedFiles
FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = true;
-- Attendu : blockedCount = 7

-- Vérifier les CV actifs
SELECT COUNT(*) as activeCount FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = false;
-- Attendu : activeCount = 3
```

**Résultat attendu** :
- ✅ Abonnement downgrade vers Gratuit
- ✅ 7 CV bloqués (blocked = true)
- ✅ 3 CV actifs (les plus récents ou sélectionnés)
- ✅ CV bloqués invisibles dans l'interface

### Test 8.2 : Re-upgrade pour débloquer les CV

**Action** :
1. Re-souscrire au Plan Pro
2. Vérifier que les CV sont débloqués

**Vérifications** :
```sql
-- Vérifier les CV débloqués
SELECT COUNT(*) as unblockedCount FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = false;
-- Attendu : unblockedCount = 10 (tous débloqués)

SELECT COUNT(*) as blockedCount FROM CvFile
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND blocked = true;
-- Attendu : blockedCount = 0
```

**Résultat attendu** :
- ✅ Upgrade vers Pro réussi
- ✅ Tous les CV débloqués automatiquement

---

## Étape 9 : Tests de Reset Mensuel des Compteurs

### Test 9.1 : Exécuter le script de reset

**Action** :
```bash
node scripts/reset-feature-counters.js
```

**Vérifications** :
```sql
-- Vérifier que les compteurs expirés sont supprimés
SELECT COUNT(*) as expiredCount FROM FeatureUsageCounter
WHERE periodEnd < datetime('now');
-- Attendu : expiredCount = 0 (tous supprimés)

-- Vérifier les compteurs actifs
SELECT
  featureName,
  count,
  periodStart,
  periodEnd
FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : compteurs encore dans la période (si période non expirée)
```

**Résultat attendu** :
- ✅ Script exécuté sans erreur
- ✅ Compteurs expirés supprimés
- ✅ Compteurs actifs conservés
- ✅ Log : "X compteur(s) expiré(s) supprimé(s)"

### Test 9.2 : Simuler une expiration manuelle

**Action** :
```sql
-- Modifier manuellement un compteur pour qu'il expire
UPDATE FeatureUsageCounter
SET periodEnd = datetime('now', '-1 day')
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation'
LIMIT 1;

-- Exécuter le script
node scripts/reset-feature-counters.js

-- Vérifier que le compteur a été supprimé
SELECT COUNT(*) FROM FeatureUsageCounter
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
  AND featureName = 'gpt_cv_generation';
-- Attendu : count = 0
```

**Résultat attendu** :
- ✅ Compteur expiré supprimé
- ✅ Prochain usage de la feature créera un nouveau compteur à 1

---

## Étape 10 : Tests d'Échec de Paiement

### Test 10.1 : Simuler un échec de paiement

**Action** :
1. Utiliser la carte de test Stripe `4000 0000 0000 0341` (paiement décliné)
2. Tenter un upgrade vers Pro

**Résultat attendu** :
- ✅ Paiement décliné par Stripe
- ✅ Pas d'upgrade effectué
- ✅ User reste sur Plan Gratuit
- ✅ Message d'erreur affiché

### Test 10.2 : Simuler un webhook d'échec de facture

**Action** :
```bash
# Via Stripe CLI
stripe trigger invoice.payment_failed
```

**Vérifications** :
```sql
-- Vérifier le webhook log
SELECT eventType, processed FROM StripeWebhookLog
WHERE eventType = 'invoice.payment_failed'
ORDER BY createdAt DESC
LIMIT 1;
-- Attendu : eventType = 'invoice.payment_failed', processed = true

-- Vérifier le downgrade automatique (si applicable)
SELECT planId FROM Subscription
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com');
-- Attendu : planId = 1 (Gratuit si downgrade immédiat)
```

**Résultat attendu** :
- ✅ Webhook reçu et traité
- ✅ Downgrade automatique vers Gratuit (selon règle métier)
- ✅ CV bloqués si > 3

---

## Checklist Finale MVP

### Backend
- [x] Modèles Prisma créés et migrés
- [x] Modules métier fonctionnels (credits.js, featureUsage.js, cvLimits.js, subscriptions.js)
- [x] API Routes créées et testées (checkout, webhooks, subscription, credits, cv)
- [x] Intégration dans generateCvJob.js
- [x] Hook d'inscription avec assignDefaultPlan
- [x] Script de sync Stripe
- [x] Script de reset des compteurs

### Stripe
- [ ] Compte Stripe Test configuré
- [ ] Clés API Test récupérées et dans .env.local
- [ ] Stripe CLI installé et connecté
- [ ] Webhooks configurés et fonctionnels
- [ ] Produits synchronisés dans Stripe Dashboard

### Tests Fonctionnels
- [ ] Inscription avec attribution Plan Gratuit
- [ ] Génération CV avec limite de plan
- [ ] Épuisement de limite et blocage
- [ ] Achat de crédits
- [ ] Utilisation de crédit pour feature
- [ ] Remboursement automatique sur échec
- [ ] Upgrade de plan
- [ ] Downgrade avec blocage de CV
- [ ] Reset des compteurs mensuels
- [ ] Échec de paiement

### Documentation
- [x] SUBSCRIPTION.md complet
- [x] STRIPE_SETUP.md détaillé
- [x] CRON_SETUP.md avec exemples
- [x] CLAUDE.md mis à jour
- [x] MVP_TESTING.md (ce fichier)

---

## Logs Utiles pour Débogage

### Vérifier les webhooks reçus
```sql
SELECT
  eventType,
  processed,
  error,
  createdAt
FROM StripeWebhookLog
ORDER BY createdAt DESC
LIMIT 20;
```

### Vérifier toutes les transactions d'un utilisateur
```sql
SELECT
  type,
  amount,
  featureName,
  refunded,
  createdAt
FROM CreditTransaction
WHERE userId = (SELECT id FROM User WHERE email = 'test1@example.com')
ORDER BY createdAt DESC;
```

### Vérifier l'historique des abonnements
```sql
SELECT
  u.email,
  s.status,
  sp.name as planName,
  s.currentPeriodEnd,
  s.cancelAtPeriodEnd
FROM Subscription s
JOIN User u ON s.userId = u.id
JOIN SubscriptionPlan sp ON s.planId = sp.id
ORDER BY s.updatedAt DESC;
```

### Vérifier les compteurs actifs
```sql
SELECT
  u.email,
  fc.featureName,
  fc.count,
  fc.periodEnd
FROM FeatureUsageCounter fc
JOIN User u ON fc.userId = u.id
WHERE fc.periodEnd > datetime('now')
ORDER BY u.email, fc.featureName;
```

---

## Prochaines Étapes

Une fois le MVP testé et validé :

1. **Phase 6** : Créer l'interface utilisateur (`/account/subscriptions`)
2. **Phase 7** : Créer le dashboard admin pour gestion des abonnements
3. **Phase 10** : Passer en mode Production Stripe
4. **Monitoring** : Configurer des alertes pour échecs de paiement
5. **Optimisations** : Ajouter des webhooks additionnels (renouvellement, etc.)

---

## Support

- [Documentation Stripe](https://stripe.com/docs)
- [Stripe Test Mode](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Webhooks Stripe](https://stripe.com/docs/webhooks)
