# Configuration Stripe - FitMyCv.ai

Guide complet pour configurer Stripe en mode Test puis Production.

## 📋 Prérequis

- Compte Stripe ([créer un compte](https://dashboard.stripe.com/register))
- Node.js installé
- Application FitMyCv.ai installée

---

## Étape 1 : Créer un compte Stripe

1. Aller sur [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Créer un compte avec votre email professionnel
3. Vérifier votre email
4. **Important** : Restez en **mode Test** pour le développement

---

## Étape 2 : Récupérer les clés API Test

### Dashboard Stripe

1. Connectez-vous au [Stripe Dashboard](https://dashboard.stripe.com)
2. Assurez-vous que le toggle **"Mode Test"** est activé (en haut à droite)
3. Allez dans **Developers → API keys**
4. Récupérez :
   - **Publishable key** (commence par `pk_test_...`)
   - **Secret key** (commence par `sk_test_...`) - Cliquez sur "Reveal test key"

### Ajouter dans `.env.local`

```bash
# Stripe Test Mode
STRIPE_SECRET_KEY="sk_test_VOTRE_CLE_SECRETE"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_VOTRE_CLE_PUBLIQUE"
```

---

## Étape 3 : Configurer les Webhooks

Les webhooks permettent à Stripe de notifier votre application des événements (paiements, abonnements, etc.).

### 3.1 Installer Stripe CLI (Développement local)

```bash
# macOS/Linux
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Vérifier l'installation
stripe version
```

### 3.2 Se connecter avec Stripe CLI

```bash
stripe login
```

Suivez les instructions pour autoriser le CLI.

### 3.3 Transférer les webhooks en local

```bash
# Terminal 1 : Démarrer Next.js
npm run dev

# Terminal 2 : Transférer webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Vous obtiendrez un **webhook signing secret** (commence par `whsec_...`).

### 3.4 Ajouter le secret dans `.env.local`

```bash
STRIPE_WEBHOOK_SECRET="whsec_VOTRE_SECRET_WEBHOOK"
```

### 3.5 Tester les webhooks

```bash
# Simuler un paiement réussi
stripe trigger payment_intent.succeeded

# Simuler une création d'abonnement
stripe trigger customer.subscription.created
```

Vérifiez les logs dans votre terminal Next.js et dans la table `StripeWebhookLog`.

---

## Étape 4 : Synchroniser les produits Stripe

Le script `sync-stripe-products.js` crée automatiquement les produits et prix Stripe depuis votre base de données.

### 4.1 Vérifier les plans en BDD

```bash
# Lancer le seed si pas déjà fait
node prisma/seed-subscription-plans.js
```

Cela crée 3 plans :
- **Gratuit** (0€/mois)
- **Pro** (9.99€/mois ou 99.99€/an)
- **Premium** (29.99€/mois ou 299.99€/an)

### 4.2 Exécuter le script de synchronisation

```bash
node scripts/sync-stripe-products.js
```

**Résultat attendu** :
```
🚀 Démarrage de la synchronisation Stripe...
🔑 Mode: TEST
✅ Connecté au compte Stripe: votre-compte@email.com

📋 Synchronisation des plans d'abonnement...
✅ Produit Stripe créé: Gratuit (prod_xxx)
  ├─ Prix mensuel créé: 0 EUR/mois
  └─ BDD mise à jour pour le plan Gratuit

...

✨ Synchronisation terminée avec succès!
📍 Vérifiez vos produits: https://dashboard.stripe.com/test/products
```

### 4.3 Vérifier dans Stripe Dashboard

1. Allez sur [https://dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
2. Vous devriez voir :
   - `[Gratuit] Abonnement FitMyCv.ai`
   - `[Pro] Abonnement FitMyCv.ai`
   - `[Premium] Abonnement FitMyCv.ai`
   - `Pack Starter - 10 crédits`
   - etc.

---

## Étape 5 : Tester les paiements

### 5.1 Cartes de test Stripe

Utilisez ces numéros de cartes de test :

| Cas de test | Numéro de carte | CVC | Date d'expiration |
|-------------|-----------------|-----|-------------------|
| Paiement réussi | `4242 4242 4242 4242` | N'importe quel 3 chiffres | N'importe quelle date future |
| Paiement échoué | `4000 0000 0000 0002` | N'importe quel 3 chiffres | N'importe quelle date future |
| 3D Secure requis | `4000 0027 6000 3184` | N'importe quel 3 chiffres | N'importe quelle date future |

### 5.2 Workflow de test - Abonnement

1. Créer un compte sur votre app (ou utiliser un compte test)
2. Aller sur `/account/subscriptions`
3. Cliquer sur "Upgrade vers Pro"
4. Utiliser la carte `4242 4242 4242 4242`
5. Compléter le paiement
6. Vérifier :
   - Redirection vers `/account/subscriptions?success=true`
   - Webhook `customer.subscription.created` reçu
   - Abonnement actif dans la BDD
   - Plan mis à jour

### 5.3 Workflow de test - Crédits

1. Aller sur `/account/subscriptions`
2. Onglet "Crédits"
3. Cliquer sur "Acheter 10 crédits"
4. Payer avec carte test
5. Vérifier :
   - Webhook `payment_intent.succeeded` reçu
   - Balance crédits mise à jour
   - Transaction enregistrée

---

## Étape 6 : Configuration Production

### 6.1 Activer le compte Stripe

1. Compléter les informations de votre entreprise
2. Vérifier votre identité
3. Ajouter un compte bancaire

### 6.2 Récupérer les clés Production

1. Basculer en **mode Live** (toggle en haut à droite)
2. Allez dans **Developers → API keys**
3. Récupérez les clés **Live** (commencent par `pk_live_...` et `sk_live_...`)

### 6.3 Créer un webhook endpoint Production

1. **Developers → Webhooks**
2. **Add endpoint**
3. URL : `https://votre-domaine.com/api/webhooks/stripe`
4. Sélectionner les événements :
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.failed`
   - `invoice.payment_failed`
5. **Add endpoint**
6. Récupérer le **Signing secret** (commence par `whsec_...`)

### 6.4 Variables d'environnement Production

Mettre à jour `.env.local` ou configurer dans votre plateforme d'hébergement :

```bash
# Stripe Live Mode
STRIPE_SECRET_KEY="sk_live_VOTRE_CLE_LIVE"
STRIPE_WEBHOOK_SECRET="whsec_VOTRE_SECRET_LIVE"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_VOTRE_CLE_PUBLIQUE_LIVE"
```

### 6.5 Re-synchroniser les produits en Production

```bash
# Avec les nouvelles clés Live
node scripts/sync-stripe-products.js
```

---

## Étape 7 : Configuration avancée

### 7.1 Branding Stripe Checkout

1. **Settings → Branding**
2. Ajouter :
   - Logo de votre entreprise
   - Couleur principale
   - Favicon

### 7.2 Emails Stripe

1. **Settings → Emails**
2. Personnaliser les emails de :
   - Confirmation d'abonnement
   - Reçus de paiement
   - Échecs de paiement
   - Factures

### 7.3 Gestion des taxes

1. **Produits → Tax rates**
2. Ajouter la TVA selon votre pays (ex: 20% France)
3. Activer **Stripe Tax** pour calcul automatique

### 7.4 Customer Portal

Permet aux clients de gérer leur abonnement directement :

1. **Settings → Customer portal**
2. Activer le portal
3. Configurer les actions autorisées :
   - Annuler abonnement
   - Modifier méthode de paiement
   - Voir factures

Code pour rediriger vers le portal :

```javascript
// API Route
import stripe from '@/lib/stripe';

const session = await stripe.billingPortal.sessions.create({
  customer: user.stripeCustomerId,
  return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions`,
});

return NextResponse.json({ url: session.url });
```

---

## Monitoring et Logs

### Dashboard Stripe

- **Payments** : Tous les paiements
- **Subscriptions** : Abonnements actifs/annulés
- **Customers** : Liste des clients
- **Logs** : Tous les événements API

### Logs Application

```sql
-- Vérifier les webhooks reçus
SELECT * FROM StripeWebhookLog ORDER BY createdAt DESC LIMIT 20;

-- Vérifier les abonnements
SELECT * FROM Subscription WHERE status = 'active';

-- Vérifier les transactions crédits
SELECT * FROM CreditTransaction ORDER BY createdAt DESC LIMIT 50;
```

---

## Troubleshooting

### Webhook non reçu

1. Vérifier que l'URL est accessible publiquement
2. Vérifier les logs Stripe : **Developers → Webhooks → [votre endpoint] → Events**
3. Vérifier `STRIPE_WEBHOOK_SECRET` dans `.env.local`
4. Tester avec Stripe CLI : `stripe trigger payment_intent.succeeded`

### Erreur "No such customer"

Le customer n'existe pas dans Stripe :
1. Vérifier `stripeCustomerId` dans la table `User`
2. Si vide ou commence par `local_`, le customer sera créé au premier paiement

### Erreur "No such price"

Le prix Stripe n'existe pas :
1. Re-lancer `node scripts/sync-stripe-products.js`
2. Vérifier que `stripePriceIdMonthly` et `stripePriceIdYearly` sont remplis dans `SubscriptionPlan`

### Paiement test échoue en production

Vous utilisez une carte de test en mode Live :
- Mode Test : cartes `4242...`
- Mode Live : vraies cartes bancaires uniquement

---

## Sécurité

### Checklist de sécurité

- [ ] STRIPE_SECRET_KEY jamais exposé côté client
- [ ] Webhooks vérifiés avec signature
- [ ] HTTPS en production (requis par Stripe)
- [ ] Rate limiting sur les API de checkout
- [ ] Logs sensibles (paiements) protégés
- [ ] Stripe CLI désactivé en production

### Variables sensibles

**❌ Ne jamais commit** :
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

**✅ Peut être public** :
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Ressources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe API Reference](https://stripe.com/docs/api)

## Support

- [Stripe Support](https://support.stripe.com)
- [Stripe Discord](https://stripe.com/discord)
