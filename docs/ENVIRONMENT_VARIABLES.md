# Variables d'Environnement - FitMyCV.io

> **Part of FitMyCV.io technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Installation: [INSTALLATION.md](./INSTALLATION.md) | Stripe Setup: [STRIPE_SETUP.md](./STRIPE_SETUP.md)

Ce document liste toutes les variables d'environnement nécessaires pour FitMyCV.io, leur utilisation et leur configuration.

## Table des matières

1. [Fichier .env.local](#fichier-envlocal)
2. [Variables OpenAI](#variables-openai)
3. [Variables Database](#variables-database)
4. [Variables NextAuth](#variables-nextauth)
5. [Variables Stripe](#variables-stripe)
6. [Variables OAuth](#variables-oauth)
7. [Variables Chiffrement](#variables-chiffrement)
8. [Variables Optionnelles](#variables-optionnelles)
9. [Génération des Secrets](#génération-des-secrets)
10. [Best Practices Sécurité](#best-practices-sécurité)

---

## Fichier .env.local

Toutes les variables d'environnement doivent être dans le fichier `.env.local` à la racine du projet.

### Créer le fichier

```bash
# Copier le template
cp .env.example .env.local

# Éditer avec vos valeurs
nano .env.local
```

### Important

- ❌ **NE JAMAIS** committer `.env.local` dans git
- ✅ `.env.local` est dans `.gitignore`
- ✅ Utiliser `.env.example` comme template (sans valeurs sensibles)
- ✅ Documenter toutes les nouvelles variables dans ce fichier

---

## Variables OpenAI

### OPENAI_API_KEY (Obligatoire)

Clé API OpenAI pour les fonctionnalités IA (génération CV, match score, optimisation).

```bash
OPENAI_API_KEY="sk-proj-..."
```

**Obtenir la clé** :
1. Aller sur [platform.openai.com](https://platform.openai.com)
2. Créer un compte / Se connecter
3. Aller dans API Keys
4. Créer une nouvelle clé

**Format** : `sk-proj-...` (64+ caractères)

### OPENAI_MODEL (Optionnel)

Modèle OpenAI par défaut pour les opérations.

```bash
OPENAI_MODEL="gpt-4.1-mini"
```

**Valeurs possibles** :
- `gpt-4.1-mini` (par défaut) - Économique et rapide
- `gpt-4.1` - Standard, plus performant
- `gpt-4o-mini` - Version mini de GPT-4o
- `gpt-4o` - Modèle multimodal avancé

**Note** : Les niveaux d'analyse (`rapid`, `medium`, `deep`) configurés dans l'admin peuvent override ce modèle pour les opérations IA spécifiques.

**Documentation** : [AI_INTEGRATION.md](./AI_INTEGRATION.md)

### GPT_MATCH_SCORE_SYSTEM_PROMPT (Optionnel)

Prompt système personnalisé pour le calcul du match score.

```bash
GPT_MATCH_SCORE_SYSTEM_PROMPT="Your custom system prompt here..."
```

**Usage** : Permet de personnaliser le comportement du modèle pour le calcul de score de correspondance CV/offre.

### GPT_MATCH_SCORE_USER_PROMPT (Optionnel)

Prompt utilisateur personnalisé pour le calcul du match score.

```bash
GPT_MATCH_SCORE_USER_PROMPT="Your custom user prompt here..."
```

**Usage** : Template de prompt envoyé au modèle avec les données CV et offre.

---

## Variables Database

### DATABASE_URL (Obligatoire)

URL de connexion à la base de données SQLite (par défaut) ou PostgreSQL.

```bash
# SQLite (développement)
DATABASE_URL="file:./dev.db"

# PostgreSQL (production)
DATABASE_URL="postgresql://user:password@localhost:5432/cv_site"
```

### IMPORTANT - Chemin Database

- Le chemin DATABASE_URL est **TOUJOURS relatif au dossier `prisma/`**
- ✅ **Correct** : `file:./dev.db` (relatif à `prisma/`)
- ❌ **Incorrect** : `file:./prisma/dev.db` (chemin absolu depuis racine)

**Pourquoi** : Prisma s'exécute depuis le dossier `prisma/` pour les migrations.

### Exemple .env.local

```bash
# Pour SQLite (développement)
DATABASE_URL="file:./dev.db"
```

La base de données sera créée dans `prisma/dev.db`.

**Documentation** : [DATABASE.md](./DATABASE.md) | [INSTALLATION.md](./INSTALLATION.md)

---

## Variables NextAuth

### NEXTAUTH_SECRET (Obligatoire)

Secret pour signer les tokens JWT NextAuth.

```bash
NEXTAUTH_SECRET="your-super-secret-key-here"
```

**Générer** :
```bash
openssl rand -base64 32
```

**Important** :
- ✅ Générer une nouvelle clé pour chaque environnement
- ✅ Minimum 32 caractères
- ❌ Ne pas utiliser une valeur par défaut

### NEXTAUTH_URL (Obligatoire)

URL publique de l'application pour NextAuth.

```bash
# Développement
NEXTAUTH_URL="http://localhost:3001"

# Production
NEXTAUTH_URL="https://your-domain.com"
```

**Note** : Doit correspondre au port de développement (3001) ou l'URL de production.

### NEXT_PUBLIC_SITE_URL (Obligatoire)

URL publique du site (accessible côté client).

```bash
# Développement
NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# Production
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
```

**Utilisation** :
- Redirections Stripe
- URLs de callback OAuth
- URLs dans emails

**Documentation** : [FEATURES.md - Authentication](./FEATURES.md#authentification-multi-provider)

---

## Variables Stripe

### Mode Test vs Live

Stripe a deux modes : **Test** (développement) et **Live** (production).

#### Développement (Test Mode)

```bash
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

#### Production (Live Mode)

```bash
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

### STRIPE_SECRET_KEY (Obligatoire)

Clé secrète Stripe pour les opérations côté serveur.

```bash
# Test
STRIPE_SECRET_KEY="sk_test_51..."

# Live
STRIPE_SECRET_KEY="sk_live_51..."
```

**Obtenir** :
1. Aller sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Developers → API keys
3. Copier "Secret key"

### STRIPE_WEBHOOK_SECRET (Obligatoire)

Secret pour vérifier les webhooks Stripe.

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
```

**Obtenir (développement local)** :
```bash
# Lancer Stripe CLI
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# Copier le "webhook signing secret" (whsec_...)
```

**Obtenir (production)** :
1. Aller sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Developers → Webhooks
3. Ajouter un endpoint : `https://your-domain.com/api/webhooks/stripe`
4. Copier le "Signing secret"

### NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (Obligatoire)

Clé publique Stripe pour les opérations côté client.

```bash
# Test
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51..."

# Live
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_51..."
```

**Obtenir** :
1. Aller sur [dashboard.stripe.com](https://dashboard.stripe.com)
2. Developers → API keys
3. Copier "Publishable key"

**Documentation complète** : [STRIPE_SETUP.md](./STRIPE_SETUP.md)

---

## Variables Email

### RESEND_API_KEY (Obligatoire)

Clé API Resend pour l'envoi d'emails transactionnels (vérification email, reset mot de passe, etc.).

```bash
RESEND_API_KEY="re_..."
```

**Obtenir** :
1. Aller sur [resend.com](https://resend.com)
2. Créer un compte / Se connecter
3. API Keys → Create API Key
4. Copier la clé

**Note** : Les emails ne seront pas envoyés si cette variable n'est pas configurée (mode dev: logs console uniquement).

### EMAIL_FROM (Optionnel)

Adresse email expéditrice pour les emails transactionnels.

```bash
EMAIL_FROM="noreply@your-domain.com"
```

**Par défaut** : `onboarding@resend.dev` (domaine de test Resend)

**Production** : Configurer un domaine vérifié dans Resend et utiliser une adresse de ce domaine.

---

## Variables OAuth

Variables pour l'authentification OAuth (Google, GitHub, Apple). **Toutes optionnelles**.

### Google OAuth

```bash
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."
```

**Obtenir** :
1. [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Create OAuth 2.0 Client ID
4. Authorized redirect URIs : `http://localhost:3001/api/auth/callback/google`

### GitHub OAuth

```bash
GITHUB_ID="Iv1...."
GITHUB_SECRET="..."
```

**Obtenir** :
1. [GitHub Settings](https://github.com/settings/developers)
2. OAuth Apps → New OAuth App
3. Authorization callback URL : `http://localhost:3001/api/auth/callback/github`

### Apple OAuth

```bash
APPLE_ID="com.your-app.service"
APPLE_SECRET="..."
```

**Obtenir** :
1. [Apple Developer](https://developer.apple.com)
2. Certificates, Identifiers & Profiles
3. Identifiers → Create Service ID
4. Sign in with Apple configuration

**Documentation** : [FEATURES.md - Authentication](./FEATURES.md#authentification-multi-provider)

---

## reCAPTCHA v3

### NEXT_PUBLIC_RECAPTCHA_SITE_KEY (Obligatoire production)

```bash
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="6Le..."
```

**Obtenir** : [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)

### RECAPTCHA_SECRET_KEY (Obligatoire production)

```bash
RECAPTCHA_SECRET_KEY="6Le..."
```

Clé secrète côté serveur pour validation.

### BYPASS_RECAPTCHA (Développement uniquement)

```bash
BYPASS_RECAPTCHA=true  # Désactive la vérification en développement
```

**Note** : N'utilisez JAMAIS cette variable en production.

**Documentation** : [SECURITY.md - reCAPTCHA](./SECURITY.md#recaptcha-v3)

---

## Variables Chiffrement

### CV_ENCRYPTION_KEY (Obligatoire)

Clé de chiffrement AES-256-GCM pour les CV stockés.

```bash
CV_ENCRYPTION_KEY="base64-encoded-32-bytes-key"
```

**Générer** :
```bash
openssl rand -base64 32
```

**Important** :
- ✅ 32 octets en base64 (44 caractères encodés)
- ✅ Générer UNE FOIS et conserver précieusement
- ❌ **NE JAMAIS** changer cette clé en production (les CV existants deviendraient illisibles)
- ✅ Sauvegarder dans un gestionnaire de secrets (1Password, AWS Secrets Manager, etc.)

**Format** : AES-256-GCM avec IV de 12 bytes et authTag de 16 bytes.

**Documentation** : [SECURITY.md - Chiffrement CV](./SECURITY.md#chiffrement-des-cv)

---

### CV_BASE_DIR (Optionnel)

Chemin vers le dossier contenant les données utilisateurs (CVs chiffrés).

```bash
CV_BASE_DIR="data/users"  # Chemin relatif (par défaut)
# ou
CV_BASE_DIR="/mnt/DATA/PROD/users"  # Chemin absolu
```

**Comportement** :
- **Non défini** : Utilise `data/users` (relatif au dossier du projet)
- **Chemin relatif** : Résolu depuis `process.cwd()` (racine du projet)
- **Chemin absolu** : Utilisé tel quel (recommandé pour stockage externe)

**Cas d'usage** :
- Stocker les CVs sur un disque externe (HDD, SSD, NAS)
- Séparer les données du code source
- Faciliter les backups et migrations

**Structure attendue** :
```
{CV_BASE_DIR}/
├── {userId1}/
│   └── cvs/
│       ├── cv1.json (chiffré)
│       └── cv2.json (chiffré)
└── {userId2}/
    └── cvs/
        └── cv1.json (chiffré)
```

**Module de résolution de chemins** : `lib/utils/paths.js`

Fonctions utilitaires disponibles :
```javascript
import { resolveCvBaseDir, getUserCvPath, getUserRootPath } from "@/lib/utils/paths";

// Résoudre CV_BASE_DIR (absolu ou relatif)
const baseDir = resolveCvBaseDir();

// Chemin vers le dossier CVs d'un user
const cvPath = getUserCvPath("user123");
// -> /mnt/DATA/PROD/users/user123/cvs

// Chemin vers le dossier racine d'un user
const rootPath = getUserRootPath("user123");
// -> /mnt/DATA/PROD/users/user123
```

**Fichiers utilisant cette variable** :
- `lib/utils/paths.js` - Résolution centralisée des chemins
- `lib/cv/storage.js` - Lecture/écriture CVs
- `lib/user/deletion.js` - Suppression dossiers utilisateurs
- `lib/auth/options.js` - Création workspace utilisateur
- `lib/admin/userManagement.js` - Gestion admin

**Tests** : `lib/utils/__tests__/paths.test.js`

**Documentation** : [ARCHITECTURE.md - Structure des données](./ARCHITECTURE.md#structure-des-données-cv)

---

## Variables Optionnelles

### Variables Application

```bash
# Version de l'application (affichée dans l'UI)
NEXT_PUBLIC_APP_VERSION="1.0.9.2"

# Nom du site (utilisé dans le titre)
NEXT_PUBLIC_SITE_NAME="FitMyCV.io"

# Dossier de stockage des CV chiffrés (défaut: data/users)
CV_BASE_DIR="data/users"
```

**Note** : `NEXT_PUBLIC_APP_VERSION` et `NEXT_PUBLIC_SITE_NAME` sont affichés dans la TopBar et le titre de la page.

### Variables de Développement

```bash
# Environnement d'exécution
NODE_ENV="development"  # development | production

# Désactiver télémétrie Next.js
NEXT_TELEMETRY_DISABLED=1

# Mode debug
DEBUG=true

# Niveau de log
LOG_LEVEL="debug"  # debug, info, warn, error
```

### Variables de Production

```bash
# URL base de données de production
DATABASE_URL="postgresql://user:password@host:5432/db"
```

### Variables Planifiées (Non Implémentées)

Les variables suivantes sont documentées pour une utilisation future mais ne sont **pas encore implémentées** dans le code :

```bash
# 🚧 Redis (cache, sessions) - Planifié
# REDIS_URL="redis://localhost:6379"

# 🚧 Sentry (monitoring erreurs) - Planifié
# SENTRY_DSN="https://..."

# 🚧 Google Analytics - Planifié
# NEXT_PUBLIC_GA_MEASUREMENT_ID="G-..."
```

---

## Génération des Secrets

### Générer CV_ENCRYPTION_KEY

```bash
openssl rand -base64 32
```

Output : `7kF2xQ9pL3mN8vB1wC4zD6hJ0sA5tG7yR2eK9uM3nP8=`

### Générer NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Output : `hQ2xL9pK3mN8vB1wC4zD6hJ0sA5tG7yR2eK9uM3nP8=`

### Générer Random String (autre usage)

```bash
# 16 bytes (22 caractères base64)
openssl rand -base64 16

# 32 bytes (44 caractères base64)
openssl rand -base64 32

# 64 bytes (88 caractères base64)
openssl rand -base64 64
```

---

## Best Practices Sécurité

### ✅ À FAIRE

1. **Utiliser .env.local** :
   ```bash
   # Toujours créer .env.local
   cp .env.example .env.local
   ```

2. **Ne jamais committer .env.local** :
   ```gitignore
   # .gitignore
   .env.local
   .env*.local
   ```

3. **Générer des secrets uniques** :
   - Une clé différente par environnement (dev, staging, prod)
   - Ne pas réutiliser les secrets entre projets

4. **Utiliser des gestionnaires de secrets en production** :
   - AWS Secrets Manager
   - Google Secret Manager
   - Azure Key Vault
   - 1Password / Bitwarden

5. **Documenter dans .env.example** :
   ```bash
   # .env.example (sans valeurs sensibles)
   OPENAI_API_KEY="sk-proj-..."
   NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
   CV_ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"
   ```

6. **Rotation des secrets** :
   - Changer régulièrement les secrets en production
   - Sauf CV_ENCRYPTION_KEY (impossible à changer sans re-chiffrer tous les CV)

### ❌ À ÉVITER

1. **Hardcoder des secrets dans le code** :
   ```javascript
   // ❌ MAUVAIS
   const apiKey = "sk-proj-12345...";

   // ✅ BON
   const apiKey = process.env.OPENAI_API_KEY;
   ```

2. **Committer .env.local** :
   ```bash
   # ❌ MAUVAIS
   git add .env.local

   # ✅ BON
   git add .env.example
   ```

3. **Utiliser des secrets par défaut** :
   ```bash
   # ❌ MAUVAIS
   NEXTAUTH_SECRET="change-me-in-production"

   # ✅ BON
   NEXTAUTH_SECRET="7kF2xQ9pL3mN8vB1wC4zD6hJ0sA5tG7yR2eK9uM3nP8="
   ```

4. **Partager secrets par email/chat** :
   - ✅ Utiliser un gestionnaire de secrets partagé
   - ✅ Ou chiffrer avec GPG/Age

---

## Template .env.local Complet

```bash
# ============================================
# OpenAI API
# ============================================
OPENAI_API_KEY="sk-proj-..."
OPENAI_MODEL="gpt-4.1-mini"

# Prompts personnalisés (optionnel)
# GPT_MATCH_SCORE_SYSTEM_PROMPT="..."
# GPT_MATCH_SCORE_USER_PROMPT="..."

# ============================================
# Database
# ============================================
# SQLite (développement) - TOUJOURS relatif à prisma/
DATABASE_URL="file:./dev.db"

# PostgreSQL (production)
# DATABASE_URL="postgresql://user:password@localhost:5432/cv_site"

# ============================================
# NextAuth
# ============================================
# Générer avec: openssl rand -base64 32
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3001"

# ============================================
# Chiffrement CV
# ============================================
# Générer avec: openssl rand -base64 32
# IMPORTANT: NE JAMAIS CHANGER EN PRODUCTION
CV_ENCRYPTION_KEY="your-encryption-key-here"

# ============================================
# Stripe (Test Mode)
# ============================================
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# ============================================
# Email (Resend)
# ============================================
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@your-domain.com"

# ============================================
# OAuth Providers (Optionnel)
# ============================================
# Google
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# GitHub
GITHUB_ID="..."
GITHUB_SECRET="..."

# Apple
APPLE_ID="..."
APPLE_SECRET="..."

# ============================================
# Application
# ============================================
NEXT_PUBLIC_APP_VERSION="1.0.9.2"
NEXT_PUBLIC_SITE_NAME="FitMyCV.io"
CV_BASE_DIR="data/users"

# ============================================
# Environnement
# ============================================
NODE_ENV="development"
NEXT_TELEMETRY_DISABLED=1
DEBUG=true
```

---

## Vérification de Configuration

### Script de Vérification

Créer un script `scripts/check-env.js` :

```javascript
const requiredEnvVars = [
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_SITE_URL',
  'CV_ENCRYPTION_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'RESEND_API_KEY'
];

const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

### Exécuter

```bash
node scripts/check-env.js
```

---

## Environnements Multiples

### Développement

```bash
# .env.local
NEXTAUTH_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3001"
STRIPE_SECRET_KEY="sk_test_..."
```

### Staging

```bash
# .env.staging
NEXTAUTH_URL="https://staging.your-domain.com"
NEXT_PUBLIC_SITE_URL="https://staging.your-domain.com"
STRIPE_SECRET_KEY="sk_test_..."
```

### Production

```bash
# .env.production (ou secrets manager)
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_SITE_URL="https://your-domain.com"
STRIPE_SECRET_KEY="sk_live_..."
```

---

## Liens Connexes

- [CLAUDE.md](../CLAUDE.md) - Quick reference
- [INSTALLATION.md](./INSTALLATION.md) - Installation complète
- [STRIPE_SETUP.md](./STRIPE_SETUP.md) - Configuration Stripe détaillée
- [SECURITY.md](./SECURITY.md) - Best practices sécurité
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Déploiement production
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Résolution problèmes
