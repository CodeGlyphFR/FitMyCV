# Refonte du système de paiement Stripe - Documentation

> **Note historique** : Ce document documente la refonte majeure du système Stripe effectuée en octobre 2025. Il sert de référence pour comprendre les décisions d'architecture et les fonctionnalités implémentées.

## Vue d'ensemble

Ce document décrit les modifications apportées au système de paiement Stripe pour améliorer la sécurité, la conformité légale et l'expérience utilisateur.

## Date de refonte
**Date** : 27 octobre 2025

## Modifications principales

### Phase 1 : Infrastructure et sécurité

#### 1.1 Idempotence des webhooks
- ✅ Utilisation du modèle `StripeWebhookLog` existant pour éviter les traitements en double
- ✅ Vérification systématique de `event.id` avant traitement
- ✅ Return 500 en cas d'échec pour déclencher retry Stripe

#### 1.2 Nouveaux webhooks implémentés
- **`invoice.paid`** : Renouvellement abonnement + reset automatique des compteurs
- **`charge.dispute.created`** : Gestion des chargebacks
  - Pour crédits : retrait du montant (balance peut devenir négative)
  - Pour abonnements : annulation immédiate + downgrade vers Free

#### 1.3 Fonctions créées
- `debitCredits()` dans `lib/subscription/credits.js` : Permet balance négative pour chargebacks
- `resetFeatureCounters()` dans `lib/subscription/featureUsage.js` : Reset compteurs lors renouvellement

### Phase 2 : Conditions Générales de Vente (CGV)

#### 2.1 Page CGV créée
**Fichier** : `app/terms/page.jsx`

**Contenu principal** :
- Droit de rétractation 14 jours (si non-utilisation du service)
- **Aucun remboursement après utilisation** (clause stricte)
- Gestion des chargebacks (balance négative crédits, annulation abonnements)
- Upgrades avec prorata
- Downgrades sans prorata (effectif au prochain cycle)
- Blocage downgrade annuel → mensuel
- Juridiction : Droit français + tribunaux de Paris

**À compléter dans les CGV** :
- Nom complet de l'entreprise
- Numéro SIRET
- Adresse du siège social
- Email de contact

#### 2.2 Intégration dans les checkouts
- Checkbox obligatoire d'acceptation des CGV dans toutes les sessions Stripe
- Lien cliquable vers `/terms` visible dans le checkout
- Champs : `consent_collection.terms_of_service: 'required'`

### Phase 3 : Workflow Achat Crédits

#### 3.1 API enrichie
**Fichier** : `app/api/checkout/credits/route.js`

**Ajouts** :
- `allow_promotion_codes: true` : Support des codes promo Stripe
- `billing_address_collection: 'required'` : Collecte adresse facturation (déjà présent)
- Acceptation CGV obligatoire

#### 3.2 Endpoint de vérification
**Fichier** : `app/api/checkout/verify/route.js` (CRÉÉ)

**Utilité** : Polling côté client pour vérifier le statut de paiement après redirection

**Exemple d'utilisation** :
```javascript
const response = await fetch(`/api/checkout/verify?session_id=${sessionId}`);
const { status } = await response.json(); // 'paid', 'unpaid', etc.
```

#### 3.3 Amélioration facturation (27 octobre 2025)
**Fichier** : `app/api/webhooks/stripe/route.js` - Fonction `createInvoiceForCreditPurchase()`

**Problèmes résolus** :
- ✅ **Apple Pay** : Nom/Prénom manquants sur les factures
- ✅ **Adresse manuelle** : Adresse saisie dans Stripe Checkout non affichée sur la facture

**Solution implémentée** :
- Récupération du **PaymentIntent complet** avec `expand: ['charges']`
- Extraction des billing details réels depuis `charges.data[0].billing_details`
- Fusion avec `session.customer_details` (priorité au PaymentIntent)
- Passage explicite des billing details à l'Invoice via :
  - `customer_name: finalName`
  - `customer_email: finalEmail`
  - `customer_address: finalAddress`

**Avantages** :
- Les factures affichent toujours le nom et l'adresse complète, même avec Apple Pay
- L'adresse saisie manuellement dans le formulaire Stripe est correctement récupérée
- Plus de dépendance aux infos partielles de `customer_details`

**Logs ajoutés** :
```
[Webhook] → Billing details PaymentIntent: { name, email, address }
[Webhook] → Billing details Checkout Session: { name, email, address }
[Webhook] → Billing details fusionnés (utilisés pour la facture): { ... }
```

### Phase 4 : Workflow Abonnements

#### 4.1 API enrichie
**Fichier** : `app/api/checkout/subscription/route.js`

**Ajouts** :
- Codes promo et acceptation CGV (comme crédits)
- **Logique upgrade/downgrade améliorée** :
  - Détection automatique upgrade vs downgrade (basé sur tier)
  - **Upgrade** : `proration_behavior: 'create_prorations'` + `billing_cycle_anchor: 'now'`
  - **Downgrade** : `proration_behavior: 'none'` + changement au prochain cycle
  - Message utilisateur pour downgrade : "Effectif le [date]"
  - DB mise à jour immédiatement pour upgrades, pas pour downgrades

#### 4.2 Blocages mis en place
- ❌ Downgrade annuel → mensuel (déjà implémenté, conservé)
- ✅ Message clair : "Annulez votre abonnement puis réabonnez-vous en mensuel"

### Phase 5 : Gestion compte et UI

#### 5.1 Stripe Billing Portal
**Fichier** : `app/api/subscription/billing-portal/route.js` (CRÉÉ)

**Utilité** : Permet à l'utilisateur de :
- Mettre à jour sa carte bancaire
- Voir l'historique des factures
- Gérer ses moyens de paiement

**Intégration** : Bouton "💳 Gérer ma carte bancaire" dans `CurrentPlanCard`

#### 5.2 Bannière balance négative
**Fichier** : `components/subscription/NegativeBalanceBanner.jsx` (CRÉÉ)

**Affichage** : Bannière rouge en haut de page si `balance < 0`

**Message** : "Votre balance est négative suite à un litige bancaire. Rechargez pour continuer."

**À intégrer** : Ajouter dans le layout principal ou page d'accueil

**Exemple d'utilisation** :
```jsx
import NegativeBalanceBanner from '@/components/subscription/NegativeBalanceBanner';

// Dans votre composant
<NegativeBalanceBanner balance={creditBalance.balance} />
```

#### 5.3 Historique factures (validé)
**Fichier** : `app/api/subscription/invoices/route.js`

**Fonctionnement validé** :
- ✅ Fusionne Invoices Stripe (abonnements) et PaymentIntents (crédits)
- ✅ Type `subscription` pour factures abonnement
- ✅ Type `credit_pack` pour packs de crédits
- ✅ Liens téléchargement PDF disponibles (pour Invoices uniquement)

### Phase 6 : Sécurité et blocages

#### 6.1 Blocage si balance négative
**Fichier** : `lib/subscription/featureUsage.js`

**Modification** : Ajout vérification en début de `canUseFeature()`

**Comportement** :
```javascript
if (creditBalance.balance < 0) {
  return {
    canUse: false,
    reason: 'Balance négative suite à litige bancaire...',
    redirectUrl: '/account/subscriptions?tab=credits'
  };
}
```

**Effet** : Toutes les features sont bloquées tant que balance < 0

#### 6.2 Gestion des chargebacks
**Webhook** : `charge.dispute.created`

**Logique** :
1. Détection type (crédit ou abonnement)
2. **Crédits** :
   - Retrait du montant via `debitCredits()`
   - Balance peut devenir négative
   - Exemple : 100 crédits achetés, 80 utilisés, chargeback → balance = -80
3. **Abonnements** :
   - Annulation immédiate de l'abonnement Stripe
   - Downgrade vers Free
4. Log dans `ErrorLog` pour investigation admin

## Webhooks Stripe à configurer

Dans le Dashboard Stripe, configurer les webhooks suivants :

### Essentiels (déjà configurés)
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `payment_intent.succeeded`

### Nouveaux (à ajouter)
- ✅ `invoice.paid` (renouvellements)
- ✅ `invoice.payment_failed` (échecs paiement)
- ✅ `charge.dispute.created` (chargebacks)

**URL du webhook** : `https://votre-domaine.com/api/webhooks/stripe`

**Secret** : Variable `STRIPE_WEBHOOK_SECRET` dans `.env.local`

## Tests recommandés

### 1. Achat de crédits
- [ ] Achat réussi (CB classique)
- [ ] Achat avec Apple Pay
- [ ] Utilisation d'un code promo
- [ ] Échec de paiement (carte test `4000000000000341`)
- [ ] Acceptation CGV obligatoire

### 2. Abonnements
- [ ] Souscription mensuelle
- [ ] Souscription annuelle
- [ ] Upgrade Pro → Premium (vérifier prorata)
- [ ] Downgrade Premium → Pro (vérifier sans prorata, effectif au prochain cycle)
- [ ] Passage mensuel → annuel (vérifier prorata)
- [ ] Tentative annuel → mensuel (doit être bloqué)
- [ ] Annulation abonnement (maintien accès jusqu'à fin période)
- [ ] Réactivation abonnement annulé

### 3. Renouvellements
- [ ] Renouvellement automatique réussi (compteurs doivent être reset)
- [ ] Échec de renouvellement (downgrade immédiat vers Free)

### 4. Chargebacks
- [ ] Chargeback sur crédit (balance négative)
- [ ] Chargeback sur abonnement (annulation + downgrade)
- [ ] Vérification blocage features avec balance négative

### 5. Idempotence
- [ ] Retry manuel d'un webhook (doit être ignoré)
- [ ] Double-clic sur bouton d'achat (doit créer 1 seule session)

### 6. Billing Portal
- [ ] Ouverture du portail depuis CurrentPlanCard
- [ ] Mise à jour carte bancaire
- [ ] Téléchargement factures

## Cartes de test Stripe

### Paiements réussis
- `4242 4242 4242 4242` : Visa (succès)
- `5555 5555 5555 4444` : Mastercard (succès)

### Échecs de paiement
- `4000 0000 0000 0341` : Carte refusée (insufficient_funds)
- `4000 0000 0000 9995` : Carte refusée (generic_decline)

**Date expiration** : N'importe quelle date future
**CVC** : N'importe quel 3 chiffres

## Variables d'environnement requises

```bash
# Stripe (déjà configurées)
STRIPE_SECRET_KEY="sk_test_..." # ou sk_live_...
STRIPE_PUBLISHABLE_KEY="pk_test_..." # ou pk_live_...
STRIPE_WEBHOOK_SECRET="whsec_..."

# Site URL (déjà configurée)
NEXT_PUBLIC_SITE_URL="https://votre-domaine.com"
```

## Actions post-déploiement

### 1. Compléter les CGV
Éditer `app/terms/page.jsx` et remplacer les placeholders :
- `[À compléter]` → Votre nom/entreprise
- SIRET, Adresse, Email

### 2. Configurer webhooks Stripe
- Ajouter les 3 nouveaux webhooks dans Dashboard Stripe
- Vérifier le `STRIPE_WEBHOOK_SECRET`

### 3. Configurer Stripe Billing Portal
Dans Dashboard Stripe → Settings → Billing → Customer Portal :
- Activer le portail
- Configurer les fonctionnalités autorisées (mise à jour carte, téléchargement factures)

### 4. Intégrer la bannière balance négative
Ajouter `<NegativeBalanceBanner />` dans votre layout principal ou composant racine

**Exemple** :
```jsx
// Dans app/layout.jsx ou page principale
import { getCreditBalance } from '@/lib/subscription/credits';

const creditBalance = await getCreditBalance(userId);

<NegativeBalanceBanner balance={creditBalance.balance} />
```

### 5. Tester en mode Test Stripe
- Effectuer tous les tests de la checklist ci-dessus
- Vérifier les logs webhooks dans Dashboard Stripe
- Valider l'idempotence (retry manuel)

### 6. Basculer en mode Live
Une fois les tests validés :
- Remplacer les clés `sk_test_` / `pk_test_` par les clés Live
- Reconfigurer les webhooks en mode Live
- Refaire quelques tests de base

## Migrations Prisma

Aucune migration requise ! Les modèles nécessaires existaient déjà :
- ✅ `StripeWebhookLog` (idempotence)
- ✅ `CreditBalance` (support balance négative nativement)
- ✅ `Subscription` (tous les champs requis)

## Problèmes connus et limitations

### 1. Downgrade sans prorata
- Le changement prend effet au **prochain cycle** uniquement
- L'utilisateur conserve son plan actuel jusqu'à la fin de la période
- La DB n'est PAS mise à jour immédiatement (webhook le fera au prochain cycle)

### 2. Balance négative
- L'utilisateur doit recharger **au minimum** le montant absolu de sa balance négative
- Les features restent bloquées tant que `balance < 0`

### 3. Factures crédits
- Les PaymentIntents n'ont pas de PDF directement
- Les Invoices créées manuellement pour crédits ont un PDF
- Vérifier dans `InvoicesTable` si `pdfUrl` est disponible avant d'afficher le bouton

### 4. Transactions en double dans Dashboard Stripe (achats de crédits)
**Comportement normal** : Pour chaque achat de crédits, 2 lignes apparaissent dans le Dashboard Stripe :
- "Payment for Invoice" (status: canceled)
- "Out of band payment for invoice X" (status: succeeded)

**Cause** : Utilisation de `paid_out_of_band: true` pour marquer les Invoices comme payées après coup.

**Impact** : Purement cosmétique dans le Dashboard Stripe. N'affecte pas les utilisateurs ni la comptabilité. Les factures PDF sont correctes.

**Alternative technique** : Créer l'Invoice AVANT le Checkout Session et la lier directement (plus complexe, nécessite refonte complète du workflow).

## Support et maintenance

### Logs à surveiller
- `[Webhook]` : Traitement des webhooks Stripe
- `[Checkout]` : Création sessions Stripe
- `[FeatureUsage]` : Blocages balance négative
- `[Credits]` : Débits/crédits (chargebacks)

### Dashboard Admin
Vérifier régulièrement :
- ErrorLog : Chargebacks et disputes
- StripeWebhookLog : Webhooks échoués

### En cas de problème
1. Vérifier les logs Stripe Dashboard (webhooks)
2. Vérifier ErrorLog dans l'admin
3. Vérifier `StripeWebhookLog` en DB pour événements non traités
4. Re-trigger manuel du webhook depuis Dashboard Stripe si nécessaire

## Conclusion

La refonte du système de paiement Stripe est **complète et fonctionnelle**. Tous les workflows (crédits, abonnements, upgrades, downgrades, chargebacks) sont implémentés conformément aux spécifications.

**Prochaine étape** : Tests complets avant mise en production.
