# Scripts de Maintenance

Guide pour l'utilisation des scripts en environnement de production.

---

## Prérequis

Tous les scripts utilisent les variables d'environnement du fichier `.env` :
- `DATABASE_URL` - Connexion PostgreSQL (indique l'environnement dev/prod)
- `STRIPE_SECRET_KEY` - Clé Stripe (test ou live selon l'environnement)

**Vérifier l'environnement avant exécution** : La variable `DATABASE_URL` dans `.env` détermine si vous êtes en dev ou prod.

---

## Scripts Disponibles

### Synchronisation Stripe

```bash
node scripts/sync-stripe.mjs
```

Synchronise les produits et prix Stripe avec la base de données :
- Crée les produits/prix manquants dans Stripe
- Met à jour les IDs Stripe en DB (`stripePriceId`, `stripeProductId`)

**Note** : La synchronisation est aussi déclenchée automatiquement depuis l'interface Admin.

---

### Migrations de Données

#### Migration CV vers Database

```bash
node scripts/migrate-cv-to-database.mjs
```

Migre les CV du filesystem vers la base de données (champ `content` JSON).

#### Migration Feature Names

```bash
node scripts/migrate-feature-names.js
```

Met à jour les noms de features dans les compteurs et transactions.

#### Migration Skill Proficiency

```bash
node scripts/migrate-skill-proficiency.mjs
```

Migre le format des niveaux de compétences dans les CV.

---

### Nettoyage de Données

#### Nettoyage Métadonnées CV

```bash
node scripts/clean-cv-metadata.js
```

Nettoie les métadonnées obsolètes des CV.

#### Suppression Domaines CV

```bash
node scripts/remove-domains-from-cvs.js
```

Supprime les domaines de compétences des CV (restructuration).

---

### Email

#### Export Templates Email

```bash
node scripts/export-email-templates.js
```

Exporte les templates email de la base de données.

#### Preview Emails

```bash
node scripts/preview-emails.js
```

Prévisualise les templates email en local.

---

### Debug (Développement)

Scripts de debug pour la génération CV :
- `check-batch.mjs`, `check-batch2.mjs`, `check-batch3.mjs`
- `debug-new-generation.mjs`
- `debug-projects.mjs`
- `debug-skills-format.mjs`

---

## Bonnes Pratiques Production

1. **Toujours vérifier `.env`** avant d'exécuter un script
2. **Backup base de données** avant les migrations de données
3. **Tester en dev** avant d'exécuter en production
4. **Logger l'exécution** des scripts de migration pour traçabilité
