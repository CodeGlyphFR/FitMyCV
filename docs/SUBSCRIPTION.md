# Système d'Abonnements et Crédits - FitMyCv.ai

Documentation complète du système hybride abonnements mensuels + micro-transactions (crédits).

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Règles métier](#règles-métier)
4. [Modèles de données](#modèles-de-données)
5. [API Routes](#api-routes)
6. [Modules métier](#modules-métier)
7. [Intégration](#intégration)
8. [Workflows](#workflows)

---

## Vue d'ensemble

### Concept

FitMyCv.ai utilise un **système hybride** combinant :
- **Abonnements mensuels/annuels** avec limites de features
- **Crédits** achetables pour dépasser les limites

### Macro-features trackées

9 features principales avec compteurs mensuels :
1. `gpt_cv_generation` - Génération CV avec IA (bouton GPT)
2. `import_pdf` - Import de CV depuis PDF
3. `translate_cv` - Traduction de CV
4. `calculate_match_score` - Score de correspondance
5. `improve_cv` - Optimisation automatique
6. `generate_from_job_title` - Génération depuis titre de poste
7. `export_pdf` - Export PDF
8. `edit_cv` - Édition de CV
9. `create_manual_cv` - Création manuelle

---

## Architecture

### Stack technique

- **Next.js 14** (App Router)
- **Prisma** + SQLite (8 nouveaux modèles)
- **Stripe** (paiements et abonnements)
- **OpenAI API** (features IA)

### Nouveaux modèles Prisma

```
Subscription           - Abonnement utilisateur
CreditBalance          - Balance de crédits
CreditTransaction      - Historique transactions
FeatureUsageCounter    - Compteurs mensuels par feature
StripeWebhookLog       - Logging webhooks Stripe
Referral               - Système de parrainage
PromoCode              - Codes promotionnels
```

### Modules métier

- `lib/subscription/credits.js` - Gestion crédits
- `lib/subscription/featureUsage.js` - Limites features
- `lib/subscription/cvLimits.js` - Limites CV
- `lib/subscription/subscriptions.js` - Gestion abonnements

---

## Règles métier

### 1. Abonnements

#### Plan par défaut
- Tout nouveau compte = **Plan Gratuit** (0€/mois)
- Attribution automatique à l'inscription
- Créé dans `app/api/auth/register/route.js`

#### Compteurs mensuels
- Chaque feature a un **compteur par utilisateur/mois**
- **Débit instantané** au lancement de la tâche
- **Remboursement automatique** si tâche `failed` ou `cancelled`
- **Reset mensuel** automatique à la date anniversaire

#### Upgrade
- Changement **immédiat** (pas de prorata)
- Utilisateur hérite des nouvelles limites
- Compteurs conservés jusqu'au prochain reset

#### Downgrade
- Si nombre de CV > nouvelle limite → **Modal de sélection**
- CV bloqués = `blocked: true` (invisibles mais sauvegardés)
- Suggérer en priorité les CV créés avec crédits

#### Échec de paiement
- **Pas de période de grâce**
- Downgrade immédiat vers Gratuit
- Blocage automatique des CV en excès (les plus anciens)

### 2. Système de crédits

#### Principe
**1 crédit = 1 utilisation de n'importe quelle feature**

#### Priorité d'utilisation
1. Vérifier limite abonnement
2. Si dans la limite → utiliser abonnement
3. Si limite atteinte → utiliser crédit (si disponible)
4. Si pas de crédit → bloquer + redirection vers souscription

#### Propriétés
- ✅ **Permanents** (pas d'expiration)
- ❌ **Non transférables**
- ✅ **Remboursables** si tâche failed/cancelled
- ✅ **Cumulables** (achats multiples)

### 3. Limite de CV avec crédits

#### Règle clé
**Les crédits permettent de créer des CV au-delà de la limite du plan**

#### Fonctionnement
```
Plan Gratuit : 3 CV max
Utilisateur a : 3/3 CV + 5 crédits

Action : Créer nouveau CV
→ Modal : "Utiliser 1 crédit ?" → OUI
→ Débit immédiat de 1 crédit
→ CV créé avec flag createdWithCredit: true
→ État final : 4/3 CV (3 plan + 1 crédit) + 4 crédits restants
```

#### Suppression
- CV créé avec crédit supprimé = **PAS DE REMBOURSEMENT**
- Raison : Service déjà consommé, évite abus

#### Affichage
- Compteur : "7 CV (3 plan + 4 crédits)"
- Badge sur CV : 💎 "Créé avec crédit"

---

## Modèles de données

### Subscription
```prisma
model Subscription {
  id                    String
  userId                String @unique
  stripeCustomerId      String @unique
  stripeSubscriptionId  String? @unique
  stripePriceId         String?
  planId                Int
  status                String  // active, canceled, past_due
  billingPeriod         String  // monthly, yearly
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean
  canceledAt            DateTime?
}
```

### CreditBalance
```prisma
model CreditBalance {
  id              String
  userId          String @unique
  balance         Int     // Crédits disponibles
  totalPurchased  Int     // Total acheté
  totalUsed       Int     // Total consommé
  totalRefunded   Int     // Total remboursé
  totalGifted     Int     // Total reçu (parrainage, promo)
}
```

### CreditTransaction
```prisma
model CreditTransaction {
  id                    String
  userId                String
  amount                Int    // + pour achat/bonus, - pour consommation
  type                  String // purchase, usage, refund, gift, cv_creation
  featureName           String?
  taskId                String?
  cvFileId              String?
  stripePaymentIntentId String?
  refunded              Boolean
  relatedTransactionId  String?
  metadata              Json?
}
```

### FeatureUsageCounter
```prisma
model FeatureUsageCounter {
  id          String
  userId      String
  featureName String
  count       Int
  periodStart DateTime
  periodEnd   DateTime

  @@unique([userId, featureName, periodStart])
}
```

---

## API Routes

### Checkout Stripe
- `POST /api/checkout/subscription` - Créer session abonnement
- `POST /api/checkout/credits` - Créer session pack crédits

### Webhooks
- `POST /api/webhooks/stripe` - Handler unifié Stripe

### Gestion abonnement
- `GET /api/subscription/current` - Abonnement + compteurs
- `POST /api/subscription/change` - Changer de plan
- `POST /api/subscription/cancel` - Annuler abonnement
- `POST /api/subscription/reactivate` - Réactiver abonnement annulé
- `GET /api/subscription/plans` - Liste des plans disponibles
- `GET /api/subscription/invoices` - Historique factures Stripe

### Gestion crédits
- `GET /api/credits/balance` - Balance crédits
- `GET /api/credits/transactions` - Historique transactions

### CV
- `GET /api/cv/can-create` - Vérifier si peut créer

---

## Historique et Facturation

### API Factures (`/api/subscription/invoices`)

Récupère l'historique complet des transactions Stripe en fusionnant :

**Sources de données** :
1. **Invoices Stripe** : Factures d'abonnements (avec PDF téléchargeable)
2. **PaymentIntents Stripe** : Paiements one-time pour packs de crédits

**Récupération automatique du customer ID** :

Si l'utilisateur a un `stripeCustomerId` local (commence par `local_`), l'API :
1. Récupère un `PaymentIntent` récent depuis `CreditTransaction`
2. Interroge Stripe pour obtenir le vrai `customer` ID
3. Met à jour `Subscription.stripeCustomerId` avec la vraie valeur
4. Permet ainsi d'afficher l'historique même pour les comptes créés en local

**Format de réponse** :
```json
{
  "invoices": [
    {
      "id": "in_xxx",
      "date": "2025-01-24T10:30:00.000Z",
      "amount": 9.99,
      "currency": "EUR",
      "status": "paid",
      "description": "Plan Pro - Mensuel",
      "pdfUrl": "https://...",
      "hostedUrl": "https://...",
      "type": "subscription"
    },
    {
      "id": "pi_xxx",
      "date": "2025-01-20T15:00:00.000Z",
      "amount": 5.00,
      "currency": "EUR",
      "status": "paid",
      "description": "Pack de 5 crédits",
      "pdfUrl": null,
      "hostedUrl": null,
      "type": "credit_pack"
    }
  ]
}
```

### Composant InvoicesTable

Affiche l'historique avec :
- **Badge Type** : 👑 Abonnement (violet) ou 💎 Crédits (bleu)
- **Badge Statut** : Payé (vert), En attente (orange), Annulé (rouge)
- **Téléchargement PDF** : Pour les factures d'abonnement
- **Responsive** : Table desktop + cards mobile
- **Tri** : Plus récent en premier

---

## Modules métier

### credits.js
```javascript
// Récupérer balance
const balance = await getCreditBalance(userId);

// Débiter crédit
const result = await debitCredit(userId, 1, 'usage', {
  featureName: 'generate_cv',
  taskId: 'task_123',
});

// Rembourser crédit
const refund = await refundCredit(userId, transactionId, 'Tâche échouée');

// Attribuer crédits (achat)
const grant = await grantCredits(userId, 10, 'purchase', {
  stripePaymentIntentId: 'pi_xxx',
});
```

### featureUsage.js
```javascript
// Vérifier si peut utiliser
const check = await canUseFeature(userId, 'gpt_cv_generation', 'medium');

// Incrémenter compteur (débite crédit si nécessaire)
const result = await incrementFeatureCounter(userId, 'gpt_cv_generation', {
  taskId: 'task_123',
  analysisLevel: 'medium',
});

// Rembourser si échec
await refundFeatureUsage('task_123');

// Reset mensuel (cron)
await resetExpiredCounters();
```

### cvLimits.js
```javascript
// Vérifier si peut créer CV
const check = await canCreateNewCv(userId);

// Réserver crédit pour CV
const reserve = await reserveCreditForCv(userId, 'cv_123.json');

// Bloquer CV (downgrade)
await blockCvsForDowngrade(userId, ['cv_1', 'cv_2'], 'Downgrade');

// Débloquer CV (upgrade)
await unblockCvs(userId, ['cv_1', 'cv_2']);
```

### subscriptions.js
```javascript
// Récupérer abonnement
const sub = await getUserSubscription(userId);

// Attribuer plan Gratuit (inscription)
await assignDefaultPlan(userId);

// Changer de plan
const change = await changeSubscription(userId, planId);

// Annuler abonnement
await cancelSubscription(userId, immediate = false);

// Résumé complet
const summary = await getSubscriptionSummary(userId);
```

---

## Intégration

### Jobs asynchrones

**Exemple avec `generateCvJob.js`** :

```javascript
import { incrementFeatureCounter, refundFeatureUsage } from '@/lib/subscription/featureUsage';

// Au début du job
const usageResult = await incrementFeatureCounter(userId, 'gpt_cv_generation', {
  taskId,
  analysisLevel: 'medium',
});

if (!usageResult.success) {
  // Limite atteinte
  await updateBackgroundTask(taskId, userId, {
    status: 'failed',
    error: `Limite atteinte: ${usageResult.error}`,
  });
  return;
}

// Si crédit utilisé, sauvegarder transactionId
if (usageResult.usedCredit) {
  await prisma.backgroundTask.update({
    where: { id: taskId },
    data: {
      creditUsed: true,
      creditTransactionId: usageResult.transactionId,
    },
  });
}

// En cas d'échec ou annulation
catch (error) {
  await refundFeatureUsage(taskId); // Remboursement automatique
}
```

### Hook d'inscription

**Dans `app/api/auth/register/route.js`** :

```javascript
import { assignDefaultPlan } from '@/lib/subscription/subscriptions';

// Après création user
const user = await prisma.user.create({ ... });

// Attribuer plan Gratuit
await assignDefaultPlan(user.id);
```

---

## Workflows

### Workflow : Génération de CV

```
1. User lance génération CV
2. Backend vérifie canUseFeature('gpt_cv_generation')
3. Si OK : incrementFeatureCounter()
   - Si dans limite plan → débit compteur
   - Si limite atteinte + crédits dispo → débit 1 crédit
   - Si pas de crédit → erreur "Limite atteinte"
4. Job exécuté
5. Si succès : compteur/crédit débité définitivement
6. Si échec/annulation : refundFeatureUsage() automatique
```

### Workflow : Achat pack crédits

```
1. User clique "Acheter 10 crédits"
2. POST /api/checkout/credits { packId: 1 }
3. Stripe Checkout Session créée
4. User redirigé vers Stripe
5. Paiement effectué
6. Webhook payment_intent.succeeded reçu
7. grantCredits(userId, 10, 'purchase')
8. CreditBalance.balance += 10
9. CreditTransaction créée (type: purchase)
10. User redirigé vers /account/subscriptions?credits_success=true
```

### Workflow : Upgrade plan

```
1. User clique "Upgrade vers Pro"
2. POST /api/checkout/subscription { planId: 2, billingPeriod: 'monthly' }
3. Stripe Checkout Session créée
4. Paiement effectué
5. Webhook customer.subscription.created reçu
6. changeSubscription(userId, planId)
7. Subscription mise à jour
8. Compteurs conservés, nouvelles limites appliquées
9. User redirigé vers /account/subscriptions?success=true
```

### Workflow : Downgrade avec blocage CV

```
1. User annule abonnement Pro → Gratuit
2. Plan Gratuit = 3 CV max, user a 7 CV
3. Backend calcule : 7 - 3 = 4 CV à bloquer
4. getSuggestedCvsToBlock(userId, 3)
   → Priorité : CV créés avec crédits, puis les plus anciens
5. Modal affichée : "Sélectionnez 4 CV à archiver"
6. User confirme sélection
7. blockCvsForDowngrade(userId, ['cv_4', 'cv_5', 'cv_6', 'cv_7'])
8. changeSubscription(userId, freePlanId)
9. CV bloqués marqués blocked: true
10. CV bloqués invisibles dans la liste
```

---

## UX des limites et notifications d'erreur

### Comportement unifié des notifications

Toutes les 9 macro-features suivent le **même pattern UX** quand une limite est atteinte ou une feature désactivée :

#### 1. Validation API avant notification
```javascript
// ✅ Appel API d'abord
const response = await fetch(endpoint, { ... });

// ✅ Vérifier erreur
if (!response.ok) {
  // Parser actionRequired et redirectUrl
  throw errorObj;
}

// ✅ Succès confirmé → notification "Tâche planifiée"
addOptimisticTask({ ... });
addNotification({ type: "info", message: "Tâche planifiée" });
closeModal();
```

**Résultat** : Pas de notification de succès si limite atteinte.

#### 2. Notification d'erreur standardisée

**Durée** : 10 secondes (10000ms)
**Bouton** : "Voir les options"
**Redirection** : `/account/subscriptions` (au clic sur bouton, pas auto)

```javascript
const notification = {
  type: "error",
  message: error.message,
  duration: 10000,
  redirectUrl: '/account/subscriptions',
  linkText: 'Voir les options'
};
```

#### 3. Messages d'erreur explicites

**Feature désactivée** :
```
Cette fonctionnalité est désactivée dans votre plan d'abonnement.
Changez d'abonnement ou achetez des crédits pour l'utiliser.
```

**Limite mensuelle atteinte** :
```
Vous avez atteint votre limite mensuelle pour cette fonctionnalité.
Changez d'abonnement ou achetez des crédits pour continuer.
```

#### 4. Fermeture des modals

Les modals se ferment **avant** d'afficher la notification d'erreur :

| Feature | Modal | Fonction de fermeture |
|---------|-------|----------------------|
| generate-cv | ✅ | `closeGenerator()` |
| create-template-cv | ✅ | `closeGenerator()` |
| import-pdf | ✅ | `closePdfImport()` |
| create-cv-manual | ✅ | `setOpenNewCv(false)` |
| improve-cv | ✅ | `setIsOpen(false)` |
| export-pdf | ✅ | `closeModal()` |
| translate-cv | N/A | Dropdown auto-fermé |
| generate-cv-from-job-title | N/A | Input field |
| calculate-match-score | N/A | Bouton |

### Implémentation dans les composants

**Fichiers concernés** :
- `components/TopBar/hooks/useGeneratorModal.js` - generate-cv, create-template-cv
- `components/TopBar/hooks/useModalStates.js` - import-pdf, create-cv-manual, generate-cv-from-job-title
- `components/TopBar/hooks/useExportModal.js` - export-pdf
- `components/Header.jsx` - translate-cv, calculate-match-score
- `components/CVImprovementPanel.jsx` - improve-cv

**Pattern de gestion d'erreur** :
```javascript
try {
  const response = await fetch(endpoint, { ... });
  const data = await response.json();

  if (!response.ok || !data?.success) {
    const apiError = parseApiError(response, data);
    const errorObj = { message: apiError.message };
    if (apiError.actionRequired && apiError.redirectUrl) {
      errorObj.actionRequired = true;
      errorObj.redirectUrl = apiError.redirectUrl;
    }
    throw errorObj;
  }

  // Succès → notification + modal fermé

} catch (error) {
  closeModal(); // Fermer avant notification

  const notification = {
    type: "error",
    message: error?.message,
    duration: 10000,
  };

  if (error?.actionRequired && error?.redirectUrl) {
    notification.redirectUrl = error.redirectUrl;
    notification.linkText = 'Voir les options';
  }

  addNotification(notification);
}
```

---

## Cron et Maintenance

### Reset des compteurs mensuels

**Script** : `scripts/reset-feature-counters.js`

```bash
# Exécution quotidienne à 3h
0 3 * * * cd /path/to/project && node scripts/reset-feature-counters.js
```

**Fonction** : Supprime les `FeatureUsageCounter` dont `periodEnd < now()`

Voir [CRON_SETUP.md](./CRON_SETUP.md) pour configuration détaillée.

---

## Sécurité

### Transactions atomiques

Toutes les opérations critiques (crédits, abonnements) utilisent `prisma.$transaction()` pour garantir la cohérence.

### Validation Stripe

Tous les webhooks Stripe sont vérifiés avec `stripe.webhooks.constructEvent()` et la signature.

### Rate limiting

Achats de crédits limités (recommandation : 5 max/jour par utilisateur).

### Logging

- `StripeWebhookLog` : Tous les webhooks Stripe
- `CreditTransaction` : Historique complet des crédits
- `ActivityLog` : Actions sensibles (upgrade, downgrade, etc.)

---

## Ressources

- [Stripe Documentation](https://stripe.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Configuration Stripe détaillée
- [CRON_SETUP.md](./CRON_SETUP.md) - Configuration tâches planifiées
