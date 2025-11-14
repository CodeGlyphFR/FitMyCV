# Référence des Commandes - FitMyCv.ai

> **Part of FitMyCv.ai technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Development: [DEVELOPMENT.md](./DEVELOPMENT.md) | Installation: [INSTALLATION.md](./INSTALLATION.md)

## Table des matières

1. [Next.js](#nextjs)
2. [Prisma](#prisma)
3. [Stripe CLI](#stripe-cli)
4. [MCP Puppeteer](#mcp-puppeteer)
5. [Scripts de Maintenance](#scripts-de-maintenance)
6. [Tâches Planifiées (CRON)](#tâches-planifiées-cron)

---

## Next.js

### Commandes de Base

```bash
# Démarre le serveur de développement (port 3001)
npm run dev

# Build de production
npm run build

# Démarre le serveur de production (port 3000)
npm start

# Backfill des données de télémétrie
npm run backfill:telemetry
```

### Ports

- **Développement** : `3001` (configuré dans package.json)
- **Production** : `3000`

### Notes

- Le port de développement est **3001** pour éviter les conflits
- Toujours utiliser `npm run dev` pour le développement local
- Exécuter `npm run build` après chaque changement de code pour validation

---

## Prisma

### Migrations

```bash
# Applique les migrations en production
npx prisma migrate deploy

# Créer une nouvelle migration en développement
npx prisma migrate dev --name description_migration

# Générer le client Prisma après modification du schema
npx prisma generate
```

### Database Management

```bash
# Ouvrir Prisma Studio (interface graphique pour la base de données)
npx prisma studio

# Seed la base de données (plans d'abonnement par défaut)
node prisma/seed.js
```

### Important

- **DATABASE_URL** doit être dans `.env.local`
- Valeur : `DATABASE_URL="file:./dev.db"` (relatif au dossier `prisma/`)
- **NE JAMAIS** utiliser `file:./prisma/dev.db`
- Le chemin est toujours `file:./dev.db` car Prisma s'exécute depuis le dossier `prisma/`

**Documentation complète** : [DATABASE.md](./DATABASE.md) | [INSTALLATION.md](./INSTALLATION.md)

---

## Stripe CLI

### Installation (macOS)

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Se connecter à Stripe
stripe login
```

### Développement Local

```bash
# Transférer webhooks en local (terminal séparé)
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Tester un webhook spécifique
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger checkout.session.completed
```

### Utilisation

1. Ouvrir un **terminal séparé** pour `stripe listen`
2. Copier le **webhook secret** généré (`whsec_...`)
3. Ajouter dans `.env.local` : `STRIPE_WEBHOOK_SECRET="whsec_..."`
4. Redémarrer le serveur Next.js

**Documentation complète** : [STRIPE_SETUP.md](./STRIPE_SETUP.md)

---

## MCP Puppeteer

### Installation Rapide

```bash
# Ajouter le serveur MCP Puppeteer
claude mcp add-json "puppeteer" '{"command":"npx","args":["-y","@modelcontextprotocol/server-puppeteer"]}'

# Vérifier l'installation
claude mcp list

# Redémarrer Claude Code pour activer
```

### Outils Disponibles (7)

- `navigate` - Naviguer vers une URL
- `screenshot` - Capturer une screenshot
- `click` - Cliquer sur un élément
- `fill` - Remplir un input
- `evaluate` - Exécuter du JavaScript dans le navigateur
- `hover` - Survoler un élément
- `select` - Sélectionner une option

### Configuration Linux

Ajouter dans la configuration MCP :
```json
{
  "allowDangerous": true,
  "launchOptions": {
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  }
}
```

### Exemple Minimal

```javascript
// Naviguer et capturer
await puppeteer_navigate({
  url: "https://176.136.226.121.nip.io",
  allowDangerous: true,
  launchOptions: { headless: true, args: ["--no-sandbox"] }
});

await puppeteer_screenshot({
  name: "homepage",
  width: 1920,
  height: 1080
});
```

**Documentation complète** : [MCP_PUPPETEER.md](./MCP_PUPPETEER.md)

---

## Scripts de Maintenance

### Gestion Utilisateurs

```bash
# Promouvoir un utilisateur en admin
node scripts/make-admin.js user@example.com

# Debug abonnement utilisateur
node scripts/debug-user-subscription.js <userId>
```

### Stripe & Abonnements

```bash
# Synchroniser produits/prix Stripe depuis la DB
node scripts/sync-stripe-products.js

# Test API abonnements
node scripts/test-subscription-api.js

# Attribuer un plan gratuit aux utilisateurs
node scripts/assign-free-plan-to-users.js

# Attribuer un plan spécifique à un utilisateur
node scripts/assign-plan-to-user.js

# Vérifier l'abonnement d'un utilisateur
node scripts/check-user-subscription.js

# Définir les métadonnées d'un plan
node scripts/set-plan-metadata.js
```

### Features & Compteurs

```bash
# Reset compteurs features expirés (à exécuter quotidiennement)
node scripts/reset-feature-counters.js

# Debug utilisation features
node scripts/debug-feature-usage.js

# Reset compteurs features pour un utilisateur
node scripts/reset-feature-counters.js --userId=<userId>
```

### Télémétrie

```bash
# Backfill données de télémétrie manquantes
npm run backfill:telemetry
# ou
node scripts/backfill-telemetry.mjs

# Recalculer les agrégations télémétrie
node scripts/recalculate-telemetry.js

# Générer événements télémétrie manquants
node scripts/generate-missing-telemetry-events.js
```

### Database Cleanup

```bash
# Nettoyer les enregistrements orphelins
node scripts/cleanup-orphaned-records.js
```

### Notes

- Tous les scripts sont dans le dossier `scripts/`
- Certains scripts nécessitent des arguments (userId, email, etc.)
- Toujours exécuter depuis la racine du projet
- Consulter le code source de chaque script pour plus de détails sur son utilisation

---

## Tâches Planifiées (CRON)

### Configuration en Production

À configurer dans le crontab du serveur :

```bash
# Éditer le crontab
crontab -e
```

### Tâches Recommandées

#### 1. Reset Compteurs Features (Quotidien)

```bash
# Tous les jours à 00:00
0 0 * * * cd /path/to/app && node scripts/reset-feature-counters.js >> /var/log/fitmycv/cron-reset-counters.log 2>&1
```

**Pourquoi** : Reset les compteurs d'utilisation des features expirés (mensuels)

#### 2. Nettoyage Télémétrie (Hebdomadaire - Optionnel)

```bash
# Tous les dimanches à 02:00
0 2 * * 0 cd /path/to/app && curl -X POST https://domain.com/api/admin/telemetry/cleanup \
  -H "Content-Type: application/json" \
  -d '{"olderThan":"90d"}' \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  >> /var/log/fitmycv/cron-telemetry-cleanup.log 2>&1
```

**Pourquoi** : Supprime les données de télémétrie anciennes (TelemetryEvent, FeatureUsage, OpenAICall > 90 jours)

#### 3. Cleanup Orphaned Records (Hebdomadaire)

```bash
# Tous les lundis à 03:00
0 3 * * 1 cd /path/to/app && node scripts/cleanup-orphaned-records.js >> /var/log/fitmycv/cron-cleanup-orphaned.log 2>&1
```

**Pourquoi** : Nettoie les enregistrements orphelins dans la base de données

### Monitoring des CRON

```bash
# Vérifier les logs
tail -f /var/log/fitmycv/cron-reset-counters.log
tail -f /var/log/fitmycv/cron-telemetry-cleanup.log

# Vérifier l'exécution des tâches CRON
grep CRON /var/log/syslog
```

### Important

- **Toujours utiliser des chemins absolus** dans les commandes CRON
- **Logger la sortie** pour debugging (>> /var/log/...)
- **Tester les commandes manuellement** avant de les ajouter au crontab
- **Configurer les variables d'environnement** si nécessaire (source .env)

**Documentation complète** : [CRON_SETUP.md](./CRON_SETUP.md)

---

## Workflow de Développement Typique

### 1. Premier Setup

```bash
# Cloner le repo
git clone <repo-url>
cd fitmycv

# Installer dépendances
npm install

# Configurer .env.local (voir ENVIRONMENT_VARIABLES.md)
cp .env.example .env.local

# Appliquer migrations
npx prisma migrate deploy

# Seed base de données
node prisma/seed.js

# Lancer développement
npm run dev
```

### 2. Développement Quotidien

```bash
# Terminal 1: Serveur Next.js
npm run dev

# Terminal 2: Prisma Studio (optionnel)
npx prisma studio

# Terminal 3: Stripe CLI (si besoin webhooks)
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

### 3. Avant Commit

```bash
# Build pour validation
npm run build

# Vérifier et mettre à jour documentation
# Voir docs/ pour les fichiers à jour

# Commit (seulement si demandé explicitement)
git add .
git commit -m "Description"
```

### 4. Migrations Database

```bash
# Créer migration
npx prisma migrate dev --name add_new_field

# Générer client
npx prisma generate

# Redémarrer serveur
# Ctrl+C puis npm run dev
```

---

## Dépannage

### Erreur Prisma

```bash
# Régénérer client Prisma
npx prisma generate

# Réappliquer migrations
npx prisma migrate deploy
```

### Port déjà utilisé

```bash
# Trouver processus sur port 3001
lsof -i :3001

# Tuer processus
kill -9 <PID>
```

### Problèmes Stripe

```bash
# Vérifier connexion Stripe
stripe listen

# Re-login si nécessaire
stripe login
```

**Documentation complète** : [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Liens Connexes

- [CLAUDE.md](../CLAUDE.md) - Quick reference
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Guide développement complet
- [INSTALLATION.md](./INSTALLATION.md) - Installation initiale
- [DATABASE.md](./DATABASE.md) - Gestion base de données
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Configuration Stripe
- [CRON_SETUP.md](./CRON_SETUP.md) - Configuration tâches planifiées
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Résolution problèmes
- [CODE_PATTERNS.md](./CODE_PATTERNS.md) - Patterns de code
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) - Variables d'environnement
