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
4. `match_score` - Score de correspondance
5. `optimize_cv` - Optimisation automatique
6. `generate_from_job_title` - Génération depuis titre de poste
7. `export_cv` - Export PDF
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
PromoCode              - Codes promotionnels (🚧 À venir - non implémenté)
```

**Note** : Le modèle `PromoCode` existe dans le schema Prisma pour une utilisation future mais n'est **pas encore intégré dans l'application**. Aucune route API, composant ou logique métier n'utilise actuellement ce modèle. Il sera implémenté dans une future version pour permettre la gestion de codes promotionnels (réductions, offres spéciales, campagnes marketing).

### Modules métier

- `lib/subscription/credits.js` - Gestion crédits
- `lib/subscription/featureUsage.js` - Limites features
- `lib/subscription/cvLimits.js` - Limites CV
- `lib/subscription/subscriptions.js` - Gestion abonnements
- `lib/subscription/stripeSync.js` - Synchronisation automatique Stripe

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
- Changement **immédiat** avec calcul prorata automatique
- Utilisateur hérite des nouvelles limites
- Compteurs conservés jusqu'au prochain reset

#### Downgrade
- Si nombre de CV > nouvelle limite → **Modal de sélection**
- CV bloqués = `blocked: true` (invisibles mais sauvegardés)
- Suggérer en priorité les CV créés avec crédits

#### Logique de détection upgrade/downgrade

**UPGRADE** si :
- Tier supérieur (peu importe la période de facturation)
- **OU** même tier ET mensuel → annuel

**DOWNGRADE** si :
- Tier inférieur (peu importe la période de facturation)
- **OU** même tier ET annuel → mensuel

**Création d'abonnement** (checkout Stripe) si :
- Pas d'abonnement Stripe actif (utilisateur sur plan Gratuit local)

**Comportements** :
- **Upgrades** : Prorata ✅ | Date d'effet : Immédiate | Billing cycle anchor : now
- **Downgrades** : Prorata ❌ | Date d'effet : Fin de période actuelle | Schedule update

#### Tableau exhaustif des cas

| Depuis | Vers | Type | Prorata | Date d'effet | Avertissement modal |
|--------|------|------|---------|--------------|---------------------|
| **Depuis Gratuit (création abonnement)** |
| Gratuit | Pro mensuel | Création | N/A | Immédiate | Checkout Stripe avec CGV |
| Gratuit | Pro annuel | Création | N/A | Immédiate | Checkout Stripe avec CGV |
| Gratuit | Premium mensuel | Création | N/A | Immédiate | Checkout Stripe avec CGV |
| Gratuit | Premium annuel | Création | N/A | Immédiate | Checkout Stripe avec CGV |
| Gratuit | Business mensuel | Création | N/A | Immédiate | Checkout Stripe avec CGV |
| Gratuit | Business annuel | Création | N/A | Immédiate | Checkout Stripe avec CGV |
| **Depuis Pro mensuel** |
| Pro mensuel | Pro annuel | **Upgrade** | ✅ Oui | Immédiate | ⚠️ Engagement annuel irréversible |
| Pro mensuel | Premium mensuel | **Upgrade** | ✅ Oui | Immédiate | Montant prorata à payer immédiatement |
| Pro mensuel | Premium annuel | **Upgrade** | ✅ Oui | Immédiate | ⚠️ Engagement annuel irréversible |
| Pro mensuel | Business mensuel | **Upgrade** | ✅ Oui | Immédiate | Montant prorata à payer immédiatement |
| Pro mensuel | Business annuel | **Upgrade** | ✅ Oui | Immédiate | ⚠️ Engagement annuel irréversible |
| Pro mensuel | Gratuit | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| **Depuis Pro annuel** |
| Pro annuel | Pro mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage mensuel après période annuelle |
| Pro annuel | Premium mensuel | **Upgrade** ✨ | ✅ Oui | Immédiate | ✨ **X mois offerts** grâce au crédit annuel restant |
| Pro annuel | Premium annuel | **Upgrade** | ✅ Oui | Immédiate | ℹ️ Vous resterez en facturation annuelle jusqu'au [date] |
| Pro annuel | Business mensuel | **Upgrade** ✨ | ✅ Oui | Immédiate | ✨ **X mois offerts** grâce au crédit annuel restant |
| Pro annuel | Business annuel | **Upgrade** | ✅ Oui | Immédiate | ℹ️ Vous resterez en facturation annuelle jusqu'au [date] |
| Pro annuel | Gratuit | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| **Depuis Premium mensuel** |
| Premium mensuel | Pro mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| Premium mensuel | Pro annuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage annuel après période mensuelle |
| Premium mensuel | Premium annuel | **Upgrade** | ✅ Oui | Immédiate | ⚠️ Engagement annuel irréversible |
| Premium mensuel | Business mensuel | **Upgrade** | ✅ Oui | Immédiate | Montant prorata à payer immédiatement |
| Premium mensuel | Business annuel | **Upgrade** | ✅ Oui | Immédiate | ⚠️ Engagement annuel irréversible |
| Premium mensuel | Gratuit | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| **Depuis Premium annuel** |
| Premium annuel | Pro mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage mensuel après période annuelle |
| Premium annuel | Pro annuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + maintien facturation annuelle |
| Premium annuel | Premium mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage mensuel après période annuelle |
| Premium annuel | Business mensuel | **Upgrade** ✨ | ✅ Oui | Immédiate | ✨ **X mois offerts** grâce au crédit annuel restant |
| Premium annuel | Business annuel | **Upgrade** | ✅ Oui | Immédiate | ℹ️ Vous resterez en facturation annuelle jusqu'au [date] |
| Premium annuel | Gratuit | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| **Depuis Business mensuel** |
| Business mensuel | Pro mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| Business mensuel | Pro annuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage annuel après période mensuelle |
| Business mensuel | Premium mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| Business mensuel | Premium annuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage annuel après période mensuelle |
| Business mensuel | Business annuel | **Upgrade** | ✅ Oui | Immédiate | ⚠️ Engagement annuel irréversible |
| Business mensuel | Gratuit | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |
| **Depuis Business annuel** |
| Business annuel | Pro mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage mensuel après période annuelle |
| Business annuel | Pro annuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + maintien facturation annuelle |
| Business annuel | Premium mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage mensuel après période annuelle |
| Business annuel | Premium annuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + maintien facturation annuelle |
| Business annuel | Business mensuel | **Downgrade** | ❌ Non | Fin de période | Date d'effet + passage mensuel après période annuelle |
| Business annuel | Gratuit | **Downgrade** | ❌ Non | Fin de période | Date d'effet + sélection CV à conserver |

**Légende** :
- ✨ **Upgrade avec crédit** : Passage d'un tier supérieur avec annuel → mensuel applique le crédit de la période annuelle restante
- ⚠️ **Engagement annuel** : Mensuel → annuel ne peut plus revenir en mensuel (sauf downgrade de tier en fin de période)
- ℹ️ **Maintien annuel** : Upgrade tier en restant annuel, l'utilisateur reste engagé jusqu'à la fin de sa période

#### Solde créditeur Stripe (Customer Balance)

Le calcul du prorata **prend en compte automatiquement** le solde créditeur du customer Stripe :

**Exemple** :
```
User balance: -69.99€ (crédit)
Prorata calculé: 120.00€
Montant final à payer: 120.00 + (-69.99) = 50.01€
```

**Affichage dans le modal** :
```
Montant du prorata:     120.00€
Solde créditeur:        -69.99€
─────────────────────────────
Montant à payer:         50.01€
```

**Implémentation** :
- Route `/api/subscription/preview-upgrade` récupère `customer.balance` via Stripe
- Calcul : `finalAmount = Math.max(0, prorataAmount + customerBalance)`
- Affichage conditionnel si `customerBalance < 0`

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

### Banner de Crédit de Facturation

**Composant** : `CreditBalanceBanner.jsx`

Affiche le crédit de facturation Stripe (customer balance) quand l'utilisateur a un solde positif suite à un downgrade (ex: annuel → mensuel).

**Fonctionnement** :

L'API `/api/subscription/invoices` récupère automatiquement le `customer.balance` depuis Stripe :
```javascript
const customer = await stripe.customers.retrieve(stripeCustomerId);
// Balance négatif = crédit (ex: -4599 = 45,99€ de crédit)
creditBalance = customer.balance < 0 ? Math.abs(customer.balance) / 100 : 0;
```

**Affichage conditionnel** :
- ✅ Affiché si `creditBalance > 0`
- ❌ Masqué si `creditBalance === 0`

**Calcul des mois gratuits** :
```javascript
const nextInvoicePrice = plan.billingPeriod === 'yearly'
  ? plan.priceYearly
  : plan.priceMonthly;
const estimatedMonths = Math.floor(creditBalance / nextInvoicePrice);
```

**Messages affichés** :
- Si crédit ≥ 1 facture : "Soit environ X mois gratuits 🎉"
- Si crédit < 1 facture : "Ce crédit couvrira une partie de votre prochaine facture"

**Position** : En haut de l'onglet Factures, avant les filtres

**Style** : Banner vert avec icône Info, responsive (stack vertical sur mobile)

---

## Synchronisation Automatique Stripe

### Principe

Toute modification de prix dans l'interface admin (plans d'abonnement ou packs de crédits) déclenche automatiquement une synchronisation avec Stripe.

### Fonctionnement

**Déclencheurs** :
- Création d'un plan ou pack (`POST /api/admin/subscription-plans`, `/api/admin/credit-packs`)
- Modification d'un plan ou pack (`PATCH /api/admin/subscription-plans/[id]`, `/api/admin/credit-packs/[id]`)
- Suppression d'un plan ou pack (`DELETE /api/admin/subscription-plans/[id]`, `/api/admin/credit-packs/[id]`)

**Processus** :
1. Opération CRUD dans la base de données
2. Appel **non-bloquant** de `syncStripeProductsInternal()`
3. Synchronisation en arrière-plan

### Archivage automatique des prix

**Problème Stripe** : Les prix sont **immuables** - impossible de modifier le montant d'un prix existant.

**Solution implémentée** :

Lors de la modification du montant d'un prix :

1. **Créer** le nouveau prix avec le nouveau montant
2. **Définir** le nouveau prix comme `default_price` sur le produit (libère l'ancien)
3. **Archiver** l'ancien prix (`active: false`)

**Résultat** :
- ✅ Un seul prix actif par produit/période
- ✅ Ancien prix archivé mais visible dans l'historique
- ✅ Pas de confusion pour les utilisateurs
- ✅ Historique complet conservé

**Exemple de logs** :
```
[Sync] Produit Stripe trouvé pour pack 5 Crédits
[Sync] Prix défini comme default_price pour pack 5 Crédits
[Sync] Ancien prix archivé pour pack 5 Crédits
[Sync] Synchronisation terminée: { plans: { updated: 0 }, packs: { updated: 1 } }
```

### API de synchronisation

**Route HTTP** : `POST /api/admin/sync-stripe`
- Requiert authentification admin
- Appelle `syncStripeProductsInternal()` et retourne les résultats

**Fonction interne** : `syncStripeProductsInternal()`
- Appelée directement par les routes admin (pas via HTTP)
- Pas de vérification auth requise (déjà faite en amont)
- Retourne : `{ success: boolean, results: object, message: string }`

**Gestion des erreurs** :
- Échec non-bloquant : L'opération BDD réussit même si la sync Stripe échoue
- Logs console pour debugging
- Tableau `results.plans.errors[]` et `results.packs.errors[]` avec détails

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

### stripeSync.js
```javascript
// Synchroniser tous les produits et prix avec Stripe
const result = await syncStripeProductsInternal();

// Retourne:
// {
//   success: true,
//   results: {
//     plans: { created: 0, updated: 1, skipped: 2, errors: [] },
//     packs: { created: 0, updated: 1, skipped: 0, errors: [] }
//   },
//   message: "Synchronisation réussie : 2 plans, 1 packs"
// }
```

**Comportement** :
- Pour chaque plan/pack en BDD :
  - Crée le produit Stripe si nécessaire
  - Compare les montants des prix
  - Si changement détecté :
    1. Crée nouveau prix
    2. Définit comme default_price (packs uniquement)
    3. Archive l'ancien prix
- Gère les erreurs par produit (continue même si un produit échoue)
- Retourne statistiques détaillées

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
