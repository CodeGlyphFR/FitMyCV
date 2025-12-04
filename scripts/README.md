# Scripts de maintenance

Ce dossier contient les scripts utilitaires pour FitMyCV.

---

## Synchronisation Stripe

La synchronisation des produits et prix Stripe est **automatique** :

- **Chaque modification** dans l'interface Admin (plans d'abonnement, packs de crédits) déclenche automatiquement une synchronisation avec Stripe
- **Sync manuelle** disponible via `POST /api/admin/sync-stripe` si nécessaire

**Fonction interne** : `lib/subscription/stripeSync.js` → `syncStripeProductsInternal()`

---

## Voir aussi

- [COMMANDS_REFERENCE.md](../docs/COMMANDS_REFERENCE.md) - Toutes les commandes
- [STRIPE_SETUP.md](../docs/STRIPE_SETUP.md) - Configuration Stripe
