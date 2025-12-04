# Guide d'installation - FitMyCV.io

> **Part of FitMyCV.io technical documentation**
> Quick reference: [CLAUDE.md](../CLAUDE.md) | Environment Variables: [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) | Commands: [COMMANDS_REFERENCE.md](./COMMANDS_REFERENCE.md)

Ce guide vous accompagne pas à pas dans l'installation et la configuration de FitMyCV.io.

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
| **PostgreSQL** | 14.x | 15.x | Base de données |
| **pg_dump/psql** | - | Latest | Outils PostgreSQL (pour sync) |

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
cd fitmycv
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

#### a) Fichier `.env` (Next.js)

```bash
cp .env.example .env
```

Éditer `.env` avec vos valeurs.

#### b) Database URL (PostgreSQL)

```bash
# Ajouter dans .env
DATABASE_URL="postgresql://fitmycv:devpass@localhost:5433/fitmycv_dev"
```

**Note** : Le projet utilise PostgreSQL via Docker pour le développement (port 5433).

### 2. Générer les clés de sécurité

#### Générer NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Copier le résultat dans `.env` :

```bash
NEXTAUTH_SECRET="le-resultat-genere"
```

#### Générer CV_ENCRYPTION_KEY

```bash
openssl rand -base64 32
```

Copier le résultat dans `.env` :

```bash
CV_ENCRYPTION_KEY="le-resultat-genere"
```

**Note** : Cette clé sert à chiffrer les CV en AES-256-GCM. Si vous la perdez, tous les CV seront irrécupérables !

### 3. Obtenir une clé OpenAI

1. Créer un compte sur [OpenAI Platform](https://platform.openai.com/)
2. Aller dans **API Keys**
3. Créer une nouvelle clé : **Create new secret key**
4. Copier la clé (elle commence par `sk-proj-...`)
5. Ajouter dans `.env` :

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
   - `https://your-domain.com/api/auth/callback/google` (prod)
6. Copier Client ID et Client Secret dans `.env`

#### GitHub OAuth

1. Aller sur [GitHub Developer Settings](https://github.com/settings/developers)
2. Créer une nouvelle **OAuth App**
3. Configurer :
   - **Homepage URL** : `https://your-domain.com`
   - **Authorization callback URL** : `https://your-domain.com/api/auth/callback/github`
4. Copier Client ID et Client Secret dans `.env`

---

## Base de données

### 1. Créer la base de données de développement

Créer la base `fitmycv_dev` sur le serveur PostgreSQL :

```sql
CREATE DATABASE fitmycv_dev;
GRANT ALL PRIVILEGES ON DATABASE fitmycv_dev TO fitmycv;
```

### 2. Configurer DATABASE_URL

Ajouter dans `.env` :

```bash
DATABASE_URL="postgresql://fitmycv:password@localhost:5432/fitmycv_dev"
```

### 3. Initialiser la base de données

```bash
# Option 1: Setup avec seed data (données par défaut)
npm run db:setup

# Option 2: Copier les données de production
npm run db:sync-from-prod
```

Le setup :
- Génère le client Prisma
- Applique la migration baseline (34 tables)
- Peuple la base avec les données par défaut (plans, crédits, settings, etc.)

### 4. Vérifier la base de données

```bash
# Ouvrir Prisma Studio (interface graphique)
npm run db:studio
```

Prisma Studio s'ouvre sur `http://localhost:5555` et permet de :
- Visualiser toutes les tables
- Ajouter/modifier/supprimer des données
- Tester les relations

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

# 3. Test base de données (Docker doit être running)
docker exec fitmycv-dev-db pg_isready -U fitmycv -d fitmycv_dev
# Devrait retourner "accepting connections"
```

---

## Problèmes courants

### Erreur : `Error: Can't reach database server`

**Cause** : PostgreSQL Docker n'est pas démarré.

**Solution** :

```bash
# Démarrer PostgreSQL
npm run db:dev:start

# Vérifier que le container tourne
docker ps | grep fitmycv-dev-db
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

**Installation terminée !** Votre environnement FitMyCV.io est prêt.
