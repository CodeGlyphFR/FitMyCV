# Guide d'installation - FitMyCv.ai

> **Part of FitMyCv.ai technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Environment Variables: [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Commands: [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md)

Ce guide vous accompagne pas à pas dans l'installation et la configuration de FitMyCv.ai.

---

## Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [Premiers pas](#premiers-pas)
- [Vérification](#vérification)
- [Problèmes courants](#problèmes-courants)

---

## Prérequis

### Logiciels requis

| Logiciel | Version minimale | Recommandée | Notes |
|----------|-----------------|-------------|-------|
| **Node.js** | 18.x | 20.x LTS | Runtime JavaScript |
| **npm** | 9.x | 10.x | Gestionnaire de paquets |
| **Git** | 2.x | Latest | Contrôle de version |
| **SQLite** | 3.x | 3.40+ | Base de données (dev) |

### Services externes

| Service | Obligatoire | Description |
|---------|-------------|-------------|
| **OpenAI API** | ✅ Oui | Génération de CV par IA |
| **Google OAuth** | ❌ Non | Connexion Google |
| **GitHub OAuth** | ❌ Non | Connexion GitHub |
| **Apple OAuth** | ❌ Non | Connexion Apple |
| **Resend** | ❌ Non | Envoi d'emails (vérification, reset mdp) |
| **reCAPTCHA v3** | ❌ Non | Protection anti-spam |

### Prérequis système

- **OS** : Linux, macOS, ou Windows (avec WSL2 recommandé)
- **RAM** : Minimum 4 GB (8 GB recommandé pour Puppeteer)
- **Espace disque** : 500 MB pour node_modules + espace pour CVs

---

## Installation

### 1. Cloner le repository

```bash
git clone <repository-url>
cd cv-site
```

### 2. Installer les dépendances

```bash
npm install
```

Cette commande installe toutes les dépendances définies dans `package.json` :
- **Next.js 14** : Framework principal
- **Prisma 6** : ORM pour la base de données
- **Puppeteer** : Web scraping et export PDF
- **OpenAI SDK** : Client OpenAI
- Et plus de 40 autres packages...

**Note** : L'installation de Puppeteer télécharge automatiquement Chrome/Chromium (~300 MB).

### 3. Vérifier l'installation

```bash
# Vérifier que Next.js est bien installé
npx next --version
# Devrait afficher : 14.2.32 (ou supérieur)

# Vérifier que Prisma est bien installé
npx prisma --version
# Devrait afficher : 6.16.2 (ou supérieur)
```

---

## Configuration

### 1. Créer les fichiers d'environnement

#### a) Fichier `.env.local` (Next.js)

```bash
cp .env.example .env.local
```

Éditer `.env.local` avec vos valeurs :

```bash
# =====================================
# APPLICATION
# =====================================
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3001

# =====================================
# DATABASE (pour Next.js)
# =====================================
DATABASE_URL="file:./dev.db"

# =====================================
# NEXTAUTH
# =====================================
# Générer avec: openssl rand -base64 32
NEXTAUTH_SECRET="votre-secret-aleatoire-32-caracteres"
NEXTAUTH_URL=http://localhost:3001

# =====================================
# OPENAI (OBLIGATOIRE)
# =====================================
OPENAI_API_KEY="sk-proj-..."

# =====================================
# CHIFFREMENT CV (OBLIGATOIRE)
# =====================================
# Générer avec: openssl rand -base64 32
CV_ENCRYPTION_KEY="votre-cle-chiffrement-32-octets"

# =====================================
# OAUTH (OPTIONNEL)
# =====================================
# Google OAuth
GOOGLE_CLIENT_ID="votre-google-client-id"
GOOGLE_CLIENT_SECRET="votre-google-client-secret"

# GitHub OAuth
GITHUB_ID="votre-github-client-id"
GITHUB_SECRET="votre-github-client-secret"

# Apple OAuth (configuration avancée)
# APPLE_CLIENT_ID="votre-apple-client-id"
# APPLE_CLIENT_SECRET="votre-apple-client-secret"
# APPLE_TEAM_ID="votre-apple-team-id"
# APPLE_KEY_ID="votre-apple-key-id"
# APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# =====================================
# EMAIL (OPTIONNEL)
# =====================================
# Resend API (pour envoi emails)
# RESEND_API_KEY="re_..."
# EMAIL_FROM="noreply@fitmycv.ai"

# =====================================
# RECAPTCHA (OPTIONNEL)
# =====================================
# reCAPTCHA v3 (protection anti-spam)
# NEXT_PUBLIC_RECAPTCHA_SITE_KEY="6Le..."
# RECAPTCHA_SECRET_KEY="6Le..."

# =====================================
# DÉVELOPPEMENT
# =====================================
# Origines autorisées (séparées par virgules)
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
```

#### b) Fichier `prisma/.env` (Prisma)

```bash
# Créer le fichier .env dans le dossier prisma/
echo 'DATABASE_URL="file:./dev.db"' > prisma/.env
```

**IMPORTANT** :
- Pour **Prisma** : `DATABASE_URL` doit être dans `prisma/.env` avec `file:./dev.db`
- Pour **Next.js** : `DATABASE_URL` peut être dans `.env.local` avec la même valeur
- Le chemin est **toujours** `file:./dev.db` (relatif au dossier `prisma/`)
- **NE JAMAIS** utiliser `file:./prisma/dev.db`

### 2. Générer les clés de sécurité

#### Générer NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Copier le résultat dans `.env.local` :

```bash
NEXTAUTH_SECRET="le-resultat-genere"
```

#### Générer CV_ENCRYPTION_KEY

```bash
openssl rand -base64 32
```

Copier le résultat dans `.env.local` :

```bash
CV_ENCRYPTION_KEY="le-resultat-genere"
```

**Note** : Cette clé sert à chiffrer les CV en AES-256-GCM. Si vous la perdez, tous les CV seront irrécupérables !

### 3. Obtenir une clé OpenAI

1. Créer un compte sur [OpenAI Platform](https://platform.openai.com/)
2. Aller dans **API Keys**
3. Créer une nouvelle clé : **Create new secret key**
4. Copier la clé (elle commence par `sk-proj-...`)
5. Ajouter dans `.env.local` :

```bash
OPENAI_API_KEY="sk-proj-votre-cle"
```

**Coût estimé** :
- ~0.01$ par génération de CV (modèle rapid)
- ~0.05$ par génération de CV (modèle medium)
- ~0.20$ par génération de CV (modèle deep)

### 4. Configurer OAuth (Optionnel)

#### Google OAuth

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet
3. Activer **Google+ API**
4. Créer des identifiants OAuth 2.0
5. Ajouter les **Authorized redirect URIs** :
   - `http://localhost:3001/api/auth/callback/google` (dev)
   - `https://votre-domaine.com/api/auth/callback/google` (prod)
6. Copier Client ID et Client Secret dans `.env.local`

#### GitHub OAuth

1. Aller sur [GitHub Developer Settings](https://github.com/settings/developers)
2. Créer une nouvelle **OAuth App**
3. Configurer :
   - **Homepage URL** : `http://localhost:3001`
   - **Authorization callback URL** : `http://localhost:3001/api/auth/callback/github`
4. Copier Client ID et Client Secret dans `.env.local`

---

## Base de données

### 1. Initialiser Prisma

```bash
# Générer le client Prisma
npx prisma generate
```

Cette commande génère le client Prisma TypeScript basé sur `prisma/schema.prisma`.

### 2. Appliquer les migrations

```bash
# Appliquer toutes les migrations
npx prisma migrate deploy
```

Cette commande :
- Crée le fichier `prisma/dev.db` (SQLite)
- Applique toutes les migrations (15 migrations)
- Crée 23 tables (User, CvFile, BackgroundTask, etc.)

### 3. Vérifier la base de données

```bash
# Ouvrir Prisma Studio (interface graphique)
npx prisma studio
```

Prisma Studio s'ouvre sur `http://localhost:5555` et permet de :
- Visualiser toutes les tables
- Ajouter/modifier/supprimer des données
- Tester les relations

### 4. (Optionnel) Peupler la base de données

```bash
# Exécuter le seed (si défini)
npx prisma db seed
```

**Note** : Le seed n'est pas obligatoire. L'application crée automatiquement les données nécessaires au premier lancement.

---

## Premiers pas

### 1. Lancer le serveur de développement

```bash
npm run dev
```

Le serveur démarre sur **http://localhost:3001** (port 3001 par défaut, configurable).

**Logs attendus** :

```
▲ Next.js 14.2.32
- Local:        http://localhost:3001
- Environments: .env.local

✓ Ready in 2.3s
```

### 2. Créer un compte admin

1. Ouvrir **http://localhost:3001/auth**
2. Créer un compte avec email/mot de passe
3. Vérifier l'email (si service email configuré) ou vérifier manuellement :

```bash
# Ouvrir Prisma Studio
npx prisma studio

# Dans la table User :
# 1. Trouver votre utilisateur
# 2. Mettre emailVerified à la date actuelle
# 3. Changer role de "USER" à "ADMIN"
```

### 3. Se connecter

1. Aller sur **http://localhost:3001/auth**
2. Se connecter avec vos identifiants
3. Vous êtes redirigé vers la page d'accueil

### 4. Tester la génération de CV

1. Cliquer sur **+ Générer un CV**
2. Coller une URL d'offre d'emploi (ex: Indeed, LinkedIn)
3. Sélectionner le niveau d'analyse (rapid/medium/deep)
4. Cliquer sur **Générer**
5. Suivre la progression dans la modal de tâches
6. Le CV apparaît automatiquement une fois généré

---

## Vérification

### Checklist de vérification

- [ ] `npm run dev` démarre sans erreur
- [ ] http://localhost:3001 affiche la page d'accueil
- [ ] Création de compte fonctionne
- [ ] Connexion fonctionne
- [ ] Base de données créée : `prisma/dev.db` existe
- [ ] Dossier utilisateurs créé : `data/users/` existe
- [ ] OpenAI configuré : Génération de CV fonctionne
- [ ] (Optionnel) OAuth fonctionne
- [ ] (Optionnel) Emails envoyés

### Tests manuels

```bash
# 1. Test Next.js
curl http://localhost:3001
# Devrait retourner du HTML

# 2. Test API
curl http://localhost:3001/api/settings
# Devrait retourner un JSON avec les settings publics

# 3. Test base de données
ls -lh prisma/dev.db
# Devrait afficher le fichier de base de données
```

---

## Problèmes courants

### Erreur : `Error: Invalid 'DATABASE_URL'`

**Cause** : Le chemin DATABASE_URL est incorrect.

**Solution** :

```bash
# Dans prisma/.env
DATABASE_URL="file:./dev.db"

# PAS file:./prisma/dev.db ❌
# PAS file:../prisma/dev.db ❌
```

### Erreur : `Error: Cannot find module 'next'`

**Cause** : Les dépendances ne sont pas installées.

**Solution** :

```bash
rm -rf node_modules package-lock.json
npm install
```

### Erreur : `Error: OPENAI_API_KEY is not set`

**Cause** : La clé OpenAI n'est pas configurée.

**Solution** :

```bash
# Ajouter dans .env.local
OPENAI_API_KEY="sk-proj-votre-cle"
```

### Erreur : `Error: CV_ENCRYPTION_KEY must be 32 bytes`

**Cause** : La clé de chiffrement est invalide ou absente.

**Solution** :

```bash
# Générer une nouvelle clé
openssl rand -base64 32

# Ajouter dans .env.local
CV_ENCRYPTION_KEY="le-resultat-genere"
```

### Puppeteer ne se lance pas

**Cause** : Dépendances système manquantes (Linux).

**Solution** :

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxkbcommon0 \
  libgbm1 \
  libasound2

# Ou installer chrome/chromium
sudo apt-get install -y chromium-browser
```

### Port 3001 déjà utilisé

**Cause** : Un autre processus utilise le port.

**Solution** :

```bash
# Trouver le processus
lsof -i :3001

# Tuer le processus
kill -9 <PID>

# Ou utiliser un autre port
npm run dev -- -p 3002
```

---

## Prochaines étapes

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Comprendre l'architecture
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Workflow de développement
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Référence API
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Résolution de problèmes avancés

---

**Installation terminée !** Votre environnement FitMyCv.ai est prêt.
