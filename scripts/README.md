# Scripts de maintenance

Ce dossier contient les scripts essentiels pour FitMyCV.

---

## Scripts disponibles

### `sync-stripe-products.js`

Synchronise les produits et prix Stripe depuis la base de données locale.

**Usage :**
```bash
node scripts/sync-stripe-products.js
```

**Quand l'utiliser :**
- Setup initial Stripe (obligatoire)
- Après ajout de nouveaux plans en BDD
- Après modification des prix
- Migration test → production

**Ce que fait le script :**
- Parcourt `SubscriptionPlan` et `CreditPack` en BDD
- Crée les produits Stripe correspondants
- Stocke les IDs Stripe en retour (`stripeProductId`, `stripePriceIdMonthly`, etc.)
- Skip automatiquement les plans gratuits (`isFree: true`)

---

## Prérequis

- Base de données accessible (`.env` configuré avec `DATABASE_URL`)
- Prisma client généré (`npx prisma generate`)
- Node.js 18+
- `STRIPE_SECRET_KEY` configuré

## Voir aussi

- [COMMANDS_REFERENCE.md](../docs/COMMANDS_REFERENCE.md) - Toutes les commandes
- [STRIPE_SETUP.md](../docs/STRIPE_SETUP.md) - Configuration Stripe
