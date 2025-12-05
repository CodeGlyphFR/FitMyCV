# Scripts de maintenance

Ce dossier contient les scripts utilitaires pour FitMyCV.

---

## Synchronisation Stripe

La synchronisation des produits et prix Stripe est **automatique** :

- **Chaque modification** dans l'interface Admin (plans d'abonnement, packs de crédits) déclenche automatiquement une synchronisation avec Stripe
- **Sync manuelle** disponible via `POST /api/admin/sync-stripe` si nécessaire

### Script CLI

```bash
node scripts/sync-stripe.mjs
```

Ce script :
- Charge les variables d'environnement depuis `.env`
- Crée les produits et prix dans Stripe (mode test ou live selon la clé)
- Met à jour la base de données avec les IDs Stripe (`stripePriceId`, `stripeProductId`)
- Affiche un rapport détaillé des opérations effectuées

**Prérequis** :
- `STRIPE_SECRET_KEY` configuré dans `.env`
- `DATABASE_URL` configuré dans `.env`

**Fonction interne** : `lib/subscription/stripeSync.mjs` → `syncStripeProductsInternal()`

---

## Voir aussi

- [COMMANDS_REFERENCE.md](../docs/COMMANDS_REFERENCE.md) - Toutes les commandes
- [STRIPE_SETUP.md](../docs/STRIPE_SETUP.md) - Configuration Stripe
