# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Next.js
```bash
npm run dev              # Démarre le serveur de développement (port 3001)
npm run build            # Build de production
npm start                # Démarre le serveur de production (port 3000)
npm run backfill:telemetry   # Backfill des données de télémétrie
```

**Ports** :
- Développement : `3001` (configuré dans package.json)
- Production : `3000`

### Prisma
```bash
npx prisma migrate deploy    # Applique les migrations
npx prisma migrate dev       # Créer une migration en dev
npx prisma studio            # Interface graphique pour la base de données
npx prisma generate          # Génère le client Prisma
```

### Stripe (développement local)
```bash
# Installer Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Se connecter
stripe login

# Transférer webhooks en local (terminal séparé)
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Tester un webhook
stripe trigger payment_intent.succeeded
```

**IMPORTANT - Base de données** :
- La base SQLite est dans `prisma/dev.db`
- Pour les **migrations Prisma** : DATABASE_URL doit être dans `.env.local` avec la valeur `DATABASE_URL="file:./dev.db"` car Prisma s'exécute depuis le dossier `prisma/`
- Pour **Next.js** : DATABASE_URL peut être dans `.env.local` avec la même valeur `DATABASE_URL="file:./dev.db"`
- **NE JAMAIS** utiliser `file:./prisma/dev.db` - le chemin est toujours `file:./dev.db` car relatif au dossier `prisma/`

## Architecture

### Vue d'ensemble
Application Next.js 14 (App Router) pour créer des CV personnalisés par offre d'emploi avec IA.
- **Frontend**: React 18 + Tailwind CSS
- **Backend**: Next.js API Routes + NextAuth
- **Database**: Prisma + SQLite (par défaut)
- **IA**: OpenAI API pour génération et optimisation ATS des CV
- **Sécurité**: CV chiffrés en AES-256-GCM côté serveur

### Structure des données CV
Les CV sont stockés au format JSON validé par le template dans `data/template.json`. Structure principale:
- `header`: nom, titre, contact
- `summary`: description, domaines
- `skills`: hard_skills, soft_skills, tools, methodologies
- `experience`: expériences professionnelles
- `education`, `languages`, `extras`, `projects`
- `order_hint`: ordre d'affichage des sections
- `section_titles`: titres personnalisés

### Chiffrement des CV
Les fichiers CV sont chiffrés avant stockage avec AES-256-GCM (`lib/cv/crypto.js`):
- Clé: `CV_ENCRYPTION_KEY` (32 octets base64 dans .env.local)
- Format: `cv1` prefix + IV (12 bytes) + authTag (16 bytes) + ciphertext
- Fonctions: `encryptString()`, `decryptString()`

### Système de tâches en arrière-plan
Architecture de job queue pour les opérations longues (génération IA, import PDF, traductions). Il existe un job queue pour un affichage sur mobile et un job queue pour un affichage sur desktop:

**Job Queue** (`lib/backgroundTasks/jobQueue.js`):
- Max 3 jobs concurrents (`MAX_CONCURRENT_JOBS`)
- `enqueueJob(jobRunner)`: ajoute un job
- `getQueueSnapshot()`: état de la queue

**Types de tâches** (stockées dans `BackgroundTask` model):
- `generate-cv`: Génère un CV à partir d'une offre (lien/PDF)
- `import-pdf`: Import d'un CV depuis PDF
- `translate-cv`: Traduction d'un CV
- `create-template-cv`: Création d'un CV template
- `generate-cv-from-job-title`: Génération depuis un titre de poste
- `calculate-match-score`: Calcul du score de correspondance

**Processus de job**:
1. Route API (`app/api/background-tasks/{type}/route.js`) reçoit la requête
2. Job spécifique (`lib/backgroundTasks/{type}Job.js`) est enqueué
3. Fonction OpenAI (`lib/openai/{type}.js`) exécute la logique métier
4. État synchronisé via polling (`app/api/background-tasks/sync/route.js`)

**État des tâches**:
- `queued`: en attente
- `running`: en cours
- `completed`: terminée
- `failed`: échouée
- `cancelled`: annulée

### Génération de CV par IA
Flux principal dans `lib/openai/generateCv.js`:
1. Extraction du contenu de l'offre (URL scraping avec Puppeteer stealth ou PDF parsing)
2. Récupération du CV de référence de l'utilisateur
3. **Appel OpenAI** qui génère un CV adapté à l'offre
4. Validation du JSON retourné contre `data/template.json`
5. Stockage chiffré du nouveau CV avec métadonnées enrichies

**Niveaux d'analyse** (`analysisLevel`):
- `rapid`: modèle rapide (économique) - `gpt-5-nano-2025-08-07`
- `medium`: modèle standard - `gpt-5-mini-2025-08-07`
- `deep`: modèle avancé (plus de contexte) - `gpt-5-2025-08-07`

**Extraction web optimisée**:
- Puppeteer + Stealth plugin pour contourner blocages (Indeed, etc.)
- Détection automatique du titre d'offre (H/F patterns)
- Optimisation HTML (réduction contexte inutile)
- Cache de l'extraction dans `CvFile.extractedJobOffer`

### Auth & User Management
**NextAuth** (`lib/auth/options.js`):
- Providers: credentials (email/password), Google, GitHub, Apple
- Adapter Prisma pour persistence
- Session strategy: JWT

**Models Prisma clés**:
- `User`: utilisateurs avec relations (cvs, accounts, sessions, feedbacks, subscription)
- `CvFile`: métadonnées des CV (sourceType, createdBy, matchScore, isTranslated, createdWithCredit, blocked)
- `BackgroundTask`: suivi des jobs asynchrones (creditUsed, creditTransactionId)
- `LinkHistory`: historique des URLs utilisées
- `Feedback`: retours utilisateurs

### Système d'Abonnements et Crédits
**Architecture hybride** : Abonnements mensuels + micro-transactions (crédits)

**Nouveaux modèles** (`prisma/schema.prisma`):
- `Subscription`: Abonnement utilisateur avec lien Stripe
- `CreditBalance`: Balance de crédits par utilisateur
- `CreditTransaction`: Historique des transactions de crédits
- `FeatureUsageCounter`: Compteurs mensuels par feature/user
- `StripeWebhookLog`: Logging webhooks Stripe
- `Referral`: Système de parrainage
- `PromoCode`: Codes promotionnels

**9 Macro-features trackées** avec limites mensuelles:
1. `gpt_cv_generation` - Génération CV avec IA
2. `import_pdf` - Import CV depuis PDF
3. `translate_cv` - Traduction de CV
4. `calculate_match_score` - Score de correspondance
5. `improve_cv` - Optimisation automatique
6. `generate_from_job_title` - Génération depuis titre
7. `export_pdf` - Export PDF
8. `edit_cv` - Édition de CV
9. `create_manual_cv` - Création manuelle

**Règles métier** :
- Plan par défaut : **Gratuit** (attribué automatiquement à l'inscription)
- Compteurs mensuels reset à date anniversaire abonnement
- Limite atteinte → utilisation crédit (1 crédit = 1 feature)
- CV créés avec crédits : flag `createdWithCredit: true`, badge 💎
- Downgrade : blocage automatique des CV en excès (priorité CV avec crédits)
- Échec paiement : downgrade immédiat vers Gratuit

**Modules core** (`lib/subscription/`):
- `credits.js`: Gestion crédits (debit, refund, grant)
- `featureUsage.js`: Vérification limites + compteurs
- `cvLimits.js`: Limites CV avec crédits
- `subscriptions.js`: Gestion abonnements (upgrade, downgrade, cancel)

**Intégration jobs** :
- `generateCvJob.js` : Débite compteur/crédit au début, rembourse si échec/annulation
- Autres jobs : À intégrer de la même manière

**API Routes** :
- `/api/checkout/subscription` - Session Stripe abonnement
- `/api/checkout/credits` - Session Stripe pack crédits
- `/api/webhooks/stripe` - Handler webhooks Stripe
- `/api/subscription/current` - Abonnement + compteurs
- `/api/subscription/change` - Changer de plan
- `/api/subscription/cancel` - Annuler abonnement
- `/api/subscription/reactivate` - Réactiver abonnement annulé
- `/api/subscription/plans` - Liste des plans disponibles
- `/api/subscription/invoices` - Historique factures Stripe (invoices + PaymentIntents)
- `/api/credits/balance` - Balance crédits
- `/api/credits/transactions` - Historique transactions crédits
- `/api/cv/can-create` - Vérifier si peut créer CV

**Scripts maintenance** :
- `scripts/sync-stripe-products.js` - Synchroniser produits/prix Stripe depuis DB
- `scripts/reset-feature-counters.js` - Reset compteurs expirés (cron quotidien)

**Composants UI** (`components/subscription/`):
- `SubscriptionsPage.jsx` - Page principale avec 3 onglets (Abonnement, Crédits, Historique)
- `CurrentPlanCard.jsx` - Affichage plan actuel + annulation/réactivation
- `PlanComparisonCards.jsx` - Cartes de comparaison des plans avec upgrade/downgrade
- `FeatureCountersCard.jsx` - Compteurs d'utilisation par feature
- `CreditBalanceCard.jsx` - Balance de crédits
- `CreditPacksCards.jsx` - Packs de crédits achetables
- `CreditTransactionsTable.jsx` - Historique transactions crédits
- `InvoicesTable.jsx` - Historique factures Stripe (invoices + PaymentIntents)

**Historique factures** (`InvoicesTable.jsx`):
- Fusionne **Invoices Stripe** (abonnements) et **PaymentIntents** (packs de crédits)
- Récupération automatique du `stripeCustomerId` depuis les PaymentIntents si customer local
- Badge type : 👑 Abonnement (violet) ou 💎 Crédits (bleu)
- Badge statut : Payé (vert), En attente (orange), Annulé (rouge)
- Téléchargement PDF pour les factures d'abonnement
- Responsive : Table desktop + cards mobile

**Documentation** :
- `docs/SUBSCRIPTION.md` - Documentation complète du système
- `docs/STRIPE_SETUP.md` - Guide configuration Stripe
- `docs/CRON_SETUP.md` - Configuration tâches planifiées

### Match Score
Score de correspondance (0-100) entre CV et offre d'emploi:
- Calculé via OpenAI (`lib/openai/calculateMatchScoreWithAnalysis.js`)
- Stocké dans `CvFile.matchScore`
- Rate limiting: `User.matchScoreRefreshCount` et `matchScoreFirstRefreshAt`
- États: `idle`, `inprogress`, `failed` (`matchScoreStatus`)
- Retourne aussi: scoreBreakdown, suggestions, missingSkills, matchingSkills

### CV Optimization
Optimisation automatique des CV basée sur les suggestions d'amélioration:
- Route: `/api/cv/improve` (POST)
- Fonction OpenAI: `lib/openai/improveCv.js`
- États: `idle`, `inprogress`, `failed` (`optimiseStatus`)
- Workflow:
  1. Vérification de `matchScoreStatus === 'idle'` et suggestions disponibles
  2. Lancement: `optimiseStatus → 'inprogress'`
  3. Amélioration en arrière-plan (remplace le CV existant)
  4. Fin: `optimiseStatus → 'idle'` et rechargement automatique de la page
- Anti-spam: Bouton désactivé pendant l'optimisation
- Le bouton "Optimiser" est grisé si `matchScoreStatus === 'inprogress'` OU `optimiseStatus === 'inprogress'`

### Validation & Sanitization
- **Validation**: AJV avec `data/schema.json` (`lib/cv/validation.js`)
- **Sanitization**: Nettoyage des entrées (`lib/sanitize.js`)
- Correction automatique de structure avant rendu

### Export PDF
Une méthodes:
- `export-pdf`: Export complet avec Puppeteer

### Internationalisation
- Labels traduits dans `lib/i18n/cvLabels.js`
- LanguageSwitcher pour changer la langue d'affichage

### Admin System
Dashboard d'administration complet avec analytics, monitoring et gestion.

**Accès** :
- URL: `/admin/analytics`
- Protection: Middleware vérifie `session.user.role === 'ADMIN'`
- Promotion admin: `node scripts/make-admin.js <email>`

**8 onglets principaux** :
1. **Overview** - KPIs globaux, graphiques timeline, métriques utilisateurs
2. **Users** - Gestion utilisateurs (CRUD, recherche, filtres, détails)
3. **Features** - Analytics par feature (usage, durée, taux de succès)
4. **Errors** - Logs d'erreurs avec stack traces et filtres
5. **Feedback** - Feedbacks utilisateurs avec gestion de statut
6. **OpenAI Costs** - Monitoring coûts OpenAI (évolution, répartition, alertes)
7. **Exports** - Analytics exports PDF
8. **Subscription Plans** - Gestion plans et packs de crédits
9. **Settings** - Configuration globale (modèles IA, features, maintenance)

**Composants UI spécialisés** (`components/admin/`):
- `TabsBar.jsx` - Navigation drag-to-scroll
- `CustomSelect.jsx` - Dropdown avec scroll chaining prevention
- `DateRangePicker.jsx` - Sélection de période
- `KPICard.jsx` - Cartes de métriques
- `ConfirmDialog.jsx` - Confirmations actions destructives

**API Routes admin** (`/api/admin/*`):
- `/users` - CRUD utilisateurs + recherche/filtres
- `/settings` - Configuration globale avec historique
- `/subscription-plans` - Gestion plans d'abonnement
- `/credit-packs` - Gestion packs de crédits
- `/openai-balance` - Balance compte OpenAI
- `/openai-pricing` - Tarification modèles
- `/openai-alerts` - Alertes de coûts
- `/sync-stripe` - Synchronisation produits Stripe
- `/telemetry/cleanup` - Nettoyage données anciennes

**Sécurité** :
- Toutes les routes admin vérifient `role === 'ADMIN'` → 403 si non autorisé
- Prévention auto-suppression admin
- Confirmations pour actions destructives

**Documentation complète** : `docs/ADMIN_GUIDE.md`

**Gestion des plans gratuits (0€)** :
- **Un seul plan gratuit autorisé** : Le système ne permet qu'un seul plan avec `priceMonthly: 0` et `priceYearly: 0`
- **Pas de synchronisation Stripe** : Les plans gratuits ne sont jamais synchronisés avec Stripe (ils restent locaux uniquement)
- **Attribution automatique** : Les nouveaux utilisateurs reçoivent automatiquement le plan gratuit via `assignDefaultPlan()`
- **Recherche par prix** : La détection du plan gratuit se fait par prix (0€) et non par nom, pour plus de robustesse
- **Visible dans UI** : Le plan gratuit reste affiché dans l'interface utilisateur pour permettre la comparaison des plans
- **Scripts de sync** : `sync-stripe-products.js` et `stripeSync.js` ignorent automatiquement les plans gratuits

### Telemetry & Monitoring
Système de tracking et analytics pour monitoring de l'application.

**Models Prisma** :
- `TelemetryEvent` - Événements utilisateurs (login, logout, actions)
- `FeatureUsage` - Compteurs d'utilisation par feature
- `OpenAICall` - Logs appels OpenAI individuels (tokens, coût, durée)
- `OpenAIUsage` - Agrégations usage OpenAI (par user/feature/modèle)
- `ErrorLog` - Logs d'erreurs avec stack traces

**Scripts de maintenance** :
- `scripts/backfill-telemetry.mjs` - Backfill données manquantes
- `scripts/recalculate-telemetry.js` - Recalcul agrégations
- `scripts/generate-missing-telemetry-events.js` - Génération événements

**Nettoyage automatique** :
- Endpoint: `POST /api/admin/telemetry/cleanup`
- Paramètre: `olderThan` (ex: "90d")
- Supprime TelemetryEvent, FeatureUsage, OpenAICall anciens
- Conserve OpenAIUsage (agrégations) indéfiniment

**Initialisation serveur** (`instrumentation.js`):
- Marquage automatique des tâches orphelines (running/queued → failed)
- Exécuté au redémarrage du serveur

## Variables d'environnement essentielles

```bash
# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"

# Database (chemin dans .env.local pour Prisma)
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# Chiffrement CV (32 octets base64: openssl rand -base64 32)
CV_ENCRYPTION_KEY="..."

# OAuth providers (optionnels)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."

# Stripe (paiements et abonnements)
STRIPE_SECRET_KEY="sk_test_..."  # Test: sk_test_... | Live: sk_live_...
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."  # Test: pk_test_... | Live: pk_live_...
```

**Notes** :
- DATABASE_URL : Toujours `file:./dev.db` (relatif au dossier `prisma/`)
- CV_ENCRYPTION_KEY : Générer avec `openssl rand -base64 32`
- STRIPE_SECRET_KEY : Mode Test pour développement, Live pour production
- Voir `docs/STRIPE_SETUP.md` pour configuration complète Stripe

## Organisation des fichiers

```
app/
├── api/                    # API Routes
│   ├── admin/              # Routes admin (users, settings, monitoring)
│   ├── background-tasks/   # Endpoints pour jobs asynchrones
│   ├── cv/                 # CRUD des CV
│   ├── cvs/                # Liste et gestion des CV
│   ├── auth/               # NextAuth endpoints
│   ├── checkout/           # Stripe checkout (subscription, credits)
│   ├── subscription/       # Gestion abonnements
│   ├── credits/            # Gestion crédits
│   ├── webhooks/           # Webhooks Stripe
│   └── feedback/           # Système de feedback
├── admin/                  # Pages admin
│   └── analytics/          # Dashboard analytics
├── account/                # Pages compte utilisateur
│   └── subscriptions/      # Page abonnements et crédits
└── page.jsx                # Page d'accueil (viewer CV)

components/
├── admin/                  # Composants dashboard admin
│   ├── TabsBar.jsx         # Navigation avec drag-to-scroll
│   ├── OverviewTab.jsx     # KPIs et graphiques
│   ├── UsersTab.jsx        # Gestion utilisateurs
│   ├── OpenAICostsTab.jsx  # Monitoring coûts OpenAI
│   ├── SettingsTab.jsx     # Configuration globale
│   └── ...                 # Autres onglets et composants UI
├── subscription/           # Composants abonnements et crédits
│   ├── SubscriptionsPage.jsx
│   ├── PlanComparisonCards.jsx
│   ├── CreditBalanceCard.jsx
│   └── InvoicesTable.jsx
├── TopBar.jsx              # Barre de navigation principale
├── EmptyState.jsx          # État vide avec onboarding
├── TaskQueueModal.jsx      # Modal de suivi des tâches
├── Header.jsx              # En-tête du CV
├── Summary.jsx, Skills.jsx, Experience.jsx, etc.
├── feedback/               # Composants feedback
└── ui/                     # Composants UI réutilisables

lib/
├── admin/                  # Logique admin (userManagement, settings)
├── auth/                   # NextAuth config et session
├── backgroundTasks/        # Job queue et jobs
├── cv/                     # Crypto, storage, validation, source
├── openai/                 # Intégrations OpenAI
├── subscription/           # Gestion abonnements, crédits, limites
├── i18n/                   # Traductions
├── stripe.js               # Client Stripe
└── prisma.js               # Client Prisma singleton

prisma/
├── schema.prisma           # Modèles de données
└── dev.db                  # Base SQLite (dev)

scripts/
├── make-admin.js           # Promouvoir utilisateur en admin
├── sync-stripe-products.js # Synchroniser produits Stripe
├── reset-feature-counters.js # Reset compteurs expirés (cron)
├── backfill-telemetry.mjs  # Backfill télémétrie
└── ...                     # Autres scripts maintenance

data/
├── schema.json             # Schéma JSON validation CV
└── template.json           # Template CV

docs/
├── ADMIN_GUIDE.md          # Guide dashboard admin
├── STRIPE_SETUP.md         # Configuration Stripe
├── SUBSCRIPTION.md         # Système abonnements
├── CRON_SETUP.md           # Configuration tâches planifiées
└── ...                     # Autres documentations
```

## Patterns importants

### Accès aux CV chiffrés
```javascript
import { readCv, writeCv } from '@/lib/cv/storage';

const cvData = await readCv(userId, filename);  // Déchiffre automatiquement
await writeCv(userId, filename, cvData);        // Chiffre automatiquement
```

### Enqueuer un job
```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runGenerateCvJob } from '@/lib/backgroundTasks/generateCvJob';

enqueueJob(() => runGenerateCvJob(task));
```

### Validation de CV
```javascript
import { validateCvData } from '@/lib/cv/validation';

const { valid, data, errors } = validateCvData(cvJson);
```

### Session utilisateur
```javascript
import { getSession } from '@/lib/auth/session';

const session = await getSession();
const userId = session?.user?.id;
```

### Gestion du scroll chaining dans les dropdowns

**IMPORTANT** : Pour éviter le scroll de la page quand on scrolle dans un dropdown (ce qui décale les dropdowns en position fixed), utiliser les approches suivantes :

#### 1. Dropdowns avec portals (position: fixed)
Pour les dropdowns rendus via `createPortal` (CustomSelect, UserFilter, etc.) :

```javascript
useEffect(() => {
  if (!isOpen) return;

  // Sauvegarder la position de scroll actuelle
  const scrollY = window.scrollY;

  // Bloquer le scroll du body
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';

  return () => {
    // Restaurer le scroll du body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  };
}, [isOpen]);
```

- Le dropdown peut scroller normalement grâce à `overscroll-behavior: contain`
- La page reste figée à sa position, pas de décalage

#### 2. Listes scrollables in-page (non-portals)
Pour les listes directement dans le DOM (OpenAICostsTab, etc.) :

```javascript
useEffect(() => {
  const scrollContainer = scrollContainerRef.current;
  if (!isVisible || !scrollContainer) return;

  function preventScrollChaining(e) {
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isAtTop = scrollTop <= 1;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // Bloquer UNIQUEMENT aux limites pour éviter le scroll chaining
    if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  scrollContainer.addEventListener('wheel', preventScrollChaining, { passive: false });

  return () => {
    scrollContainer.removeEventListener('wheel', preventScrollChaining);
  };
}, [isVisible]);
```

- Le scroll fonctionne normalement dans la liste
- Se bloque aux limites pour empêcher la propagation à la page
- Nécessite `[overscroll-behavior:contain]` sur le conteneur

**Références d'implémentation** :
- CustomSelect : `components/admin/CustomSelect.jsx:57-77`
- UserFilter : `components/admin/UserFilter.jsx:63-83`
- OpenAICostsTab : `components/admin/OpenAICostsTab.jsx:61-106`

### Gestion Stripe et abonnements
```javascript
import { stripe } from '@/lib/stripe';

// Créer une session de checkout pour abonnement
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  customer: stripeCustomerId,
  line_items: [{ price: stripePriceId, quantity: 1 }],
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions?success=true`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account/subscriptions`,
});

// Créer une session de checkout pour crédits
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: stripePriceId, quantity: 1 }],
  metadata: { creditAmount: '10', userId },
  // ...
});
```

### Vérification de limites feature
```javascript
import { checkFeatureLimit } from '@/lib/subscription/featureUsage';

// Vérifier si l'utilisateur peut utiliser une feature
const { allowed, reason, needsCredit } = await checkFeatureLimit(
  userId,
  'gpt_cv_generation',
  { analysisLevel: 'medium' }
);

if (!allowed) {
  if (needsCredit) {
    // Proposer d'utiliser un crédit
  } else {
    // Proposer upgrade
  }
}
```

## Scripts de maintenance

### Scripts principaux
```bash
# Promouvoir un utilisateur en admin
node scripts/make-admin.js user@example.com

# Synchroniser produits/prix Stripe depuis la DB
node scripts/sync-stripe-products.js

# Reset compteurs features expirés (à exécuter quotidiennement)
node scripts/reset-feature-counters.js

# Backfill données de télémétrie manquantes
npm run backfill:telemetry

# Recalculer les agrégations télémétrie
node scripts/recalculate-telemetry.js

# Test API abonnements
node scripts/test-subscription-api.js

# Debug abonnement utilisateur
node scripts/debug-user-subscription.js <userId>
```

### Scripts de développement
```bash
# Générer client Prisma après modification schema
npx prisma generate

# Créer une migration
npx prisma migrate dev --name description_migration

# Ouvrir Prisma Studio (interface graphique DB)
npx prisma studio

# Seed base de données (plans d'abonnement par défaut)
node prisma/seed.js
```

### Tâches planifiées (CRON)
À configurer en production (voir `docs/CRON_SETUP.md`) :

```bash
# Quotidien à 00:00 - Reset compteurs expirés
0 0 * * * cd /path/to/app && node scripts/reset-feature-counters.js

# Hebdomadaire - Nettoyage télémétrie ancienne (optionnel)
0 2 * * 0 cd /path/to/app && curl -X POST https://domain.com/api/admin/telemetry/cleanup \
  -H "Content-Type: application/json" \
  -d '{"olderThan":"90d"}' \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Project Rules
- Ne merge jamais sans une demande explicite. Si un merge est demandé il faudra merge avec main avec l'option `--no-ff`
- Ne commit jamais sans une demande explicite
- Si tu dois utiliser npm, utilise le port 3001
- Pour les migrations Prisma, le chemin DATABASE_URL se trouve dans .env.local
- Quand je veux créer ou ajouter une feature, créer une branche feature/name_of_the_feature
- Quand je veux ajouter ou modifier une feature, créer une branche
  improvement/name_of_the_feature, si elle existe déjà incrémente là
- Quand je veux corriger un gros bug, créer une branche
  bug/name_of_the_feature, si elle existe déjà incrémente là
- Quand je veux corriger un petit bug, créer une branche
  hotfix/name_of_the_feature, si elle existe déjà incrémente là
- N'utilise jamais "🤖 Generated with" dans un commit, ne fait aucune mention de Claude Code
- A chaque fois que tu termines une réponse ou une tache, je veux que tu executes le code 'echo -e '\a''
- Avant chaque commit tu dois vérifier la documentation dans le dossier @docs/ et la mettre à jour si nécéssaire
- A chaque changement du code utilise 'npm run build'
