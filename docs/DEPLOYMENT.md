# Guide de déploiement - FitMyCv.ai

Guide complet pour déployer FitMyCv.ai en production.

---

## Table des matières

- [Prérequis](#prérequis)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données](#base-de-données)
- [Build & Déploiement](#build--déploiement)
- [Plateforme cible](#plateforme-cible)
- [Post-déploiement](#post-déploiement)
- [Monitoring](#monitoring)
- [Backup & Restauration](#backup--restauration)

---

## Prérequis

### Serveur

- **OS** : Linux (Ubuntu 22.04 LTS recommandé)
- **Node.js** : 20.x LTS
- **RAM** : Minimum 2 GB (4 GB recommandé)
- **Storage** : 10 GB minimum (pour node_modules, build, CVs, DB)
- **CPU** : 2 cores minimum

### Services

- **Domain** : Nom de domaine configuré
- **SSL** : Certificat SSL (Let's Encrypt recommandé)
- **Database** : PostgreSQL 14+ ou MySQL 8+
- **OpenAI** : Compte avec crédit

---

## Variables d'environnement

### Fichier .env.production

Créer `.env.production` sur le serveur :

```bash
# =====================================
# APPLICATION
# =====================================
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://fitmycv.ai

# =====================================
# DATABASE
# =====================================
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/fitmycv?schema=public"

# MySQL
# DATABASE_URL="mysql://user:password@localhost:3306/fitmycv"

# =====================================
# NEXTAUTH
# =====================================
NEXTAUTH_SECRET="votre-secret-production-unique-32-caracteres"
NEXTAUTH_URL=https://fitmycv.ai

# =====================================
# OPENAI
# =====================================
OPENAI_API_KEY="sk-proj-production-key"

# =====================================
# CHIFFREMENT CV
# =====================================
CV_ENCRYPTION_KEY="votre-cle-production-unique-32-octets"

# =====================================
# OAUTH (OPTIONNEL)
# =====================================
GOOGLE_CLIENT_ID="production-google-client-id"
GOOGLE_CLIENT_SECRET="production-google-client-secret"

GITHUB_ID="production-github-client-id"
GITHUB_SECRET="production-github-client-secret"

# =====================================
# EMAIL (OPTIONNEL)
# =====================================
RESEND_API_KEY="re_production_key"
EMAIL_FROM="noreply@fitmycv.ai"

# =====================================
# RECAPTCHA (OPTIONNEL)
# =====================================
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="production-site-key"
RECAPTCHA_SECRET_KEY="production-secret-key"

# =====================================
# SÉCURITÉ
# =====================================
ALLOWED_ORIGINS="https://fitmycv.ai"
```

### Génération des secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CV_ENCRYPTION_KEY
openssl rand -base64 32
```

**IMPORTANT** :

- Ne **JAMAIS** réutiliser les clés de dev en production
- Stocker les secrets dans un gestionnaire (AWS Secrets Manager, Vault, etc.)
- Ne **JAMAIS** commit les fichiers .env

---

## Base de données

### PostgreSQL (Recommandé)

#### Installation

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Démarrer PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Configuration

```bash
# Se connecter
sudo -u postgres psql

# Créer database et user
CREATE DATABASE fitmycv;
CREATE USER fitmycv_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE fitmycv TO fitmycv_user;
\q
```

#### Prisma Schema

Modifier `prisma/schema.prisma` :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Migrations

```bash
# Production : appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate
```

**IMPORTANT** :

- **NE JAMAIS** utiliser `prisma migrate dev` en production
- Toujours utiliser `prisma migrate deploy`

---

## Build & Déploiement

### Build local

```bash
# Installer les dépendances
npm ci --production=false

# Build Next.js
npm run build

# Test du build
npm start
```

### Vérification du build

```bash
# Vérifier que le build fonctionne
curl http://localhost:3000

# Vérifier les API routes
curl http://localhost:3000/api/settings
```

### Structure de déploiement

```
/var/www/fitmycv/
├── .next/                # Build Next.js
├── node_modules/         # Dépendances
├── public/               # Assets statiques
├── prisma/               # Schema & migrations
├── data/                 # CVs chiffrés
│   └── users/
├── .env.production       # Variables d'environnement
├── package.json
├── package-lock.json
└── next.config.js
```

---

## Plateforme cible

### Option 1 : VPS (DigitalOcean, Hetzner, etc.)

#### Reverse Proxy avec Nginx

**Installation** :

```bash
sudo apt install nginx
```

**Configuration** `/etc/nginx/sites-available/fitmycv` :

```nginx
server {
    listen 80;
    server_name fitmycv.ai www.fitmycv.ai;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout for long requests (Puppeteer)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

**Activer** :

```bash
sudo ln -s /etc/nginx/sites-available/fitmycv /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir certificat
sudo certbot --nginx -d fitmycv.ai -d www.fitmycv.ai

# Renouvellement automatique
sudo certbot renew --dry-run
```

#### Process Manager avec PM2

```bash
# Installer PM2
npm install -g pm2

# Démarrer Next.js
pm2 start npm --name "fitmycv" -- start

# Auto-restart au boot
pm2 startup
pm2 save

# Commandes utiles
pm2 status
pm2 logs fitmycv
pm2 restart fitmycv
pm2 stop fitmycv
```

**Configuration PM2** (`ecosystem.config.js`) :

```javascript
module.exports = {
  apps: [{
    name: 'fitmycv',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/fitmycv',
    instances: 2,  // Cluster mode
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/pm2/fitmycv-error.log',
    out_file: '/var/log/pm2/fitmycv-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

#### Process Manager avec systemd

**Alternative à PM2** : Service systemd natif

**Créer** `/etc/systemd/system/cv-site.service` :

```ini
[Unit]
Description=CV Builder Website
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=votre-utilisateur
Group=votre-groupe
WorkingDirectory=/var/www/fitmycv

Environment=HOME=/home/votre-utilisateur
Environment=NODE_ENV=production

# Lancer uniquement npm start (build doit être fait manuellement avant)
ExecStart=/usr/bin/env bash -lc 'export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; cd /var/www/fitmycv; exec npm start'

Restart=always
RestartSec=5
KillSignal=SIGTERM
KillMode=mixed
TimeoutStopSec=30

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Commandes** :

```bash
# Copier le fichier
sudo cp cv-site.service /etc/systemd/system/

# Recharger systemd
sudo systemctl daemon-reload

# Build (une seule fois, ne sera plus refait à chaque démarrage)
npm run build

# Activer au démarrage
sudo systemctl enable cv-site.service

# Démarrer le service
sudo systemctl start cv-site.service

# Vérifier le statut
sudo systemctl status cv-site.service

# Logs
sudo journalctl -u cv-site.service -f
```

**Avantages systemd vs PM2** :
- ✅ Graceful shutdown (pas de timeout/SIGKILL)
- ✅ Intégré au système (pas de dépendance npm global)
- ✅ Logs centralisés (journalctl)
- ✅ Build séparé du démarrage (plus rapide)

---

### Option 2 : Vercel (Recommandé pour Next.js)

#### Configuration

1. **Connecter le repository GitHub**
2. **Configurer les variables d'environnement**
3. **Déployer** (automatique à chaque push)

**Limitations** :

- Serverless (pas de state persistant en mémoire)
- Rate limiting : Utiliser Redis (Vercel KV)
- Puppeteer : Fonctionne avec `@vercel/og` ou API externe

#### vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "CV_ENCRYPTION_KEY": "@cv-encryption-key",
    "OPENAI_API_KEY": "@openai-api-key"
  }
}
```

---

### Option 3 : Docker

#### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://fitmycv:password@db:5432/fitmycv
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - CV_ENCRYPTION_KEY=${CV_ENCRYPTION_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
    volumes:
      - ./data:/app/data

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=fitmycv
      - POSTGRES_USER=fitmycv
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

---

## Post-déploiement

### 1. Vérifications

```bash
# Vérifier que Next.js fonctionne
curl https://fitmycv.ai

# Vérifier les API routes
curl https://fitmycv.ai/api/settings

# Vérifier SSL
curl -I https://fitmycv.ai
```

### 2. Créer un compte admin

```bash
# Via Prisma Studio
npx prisma studio

# Ou via SQL
psql -U fitmycv_user -d fitmycv
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@fitmycv.ai';
```

### 3. Configurer les Settings

Aller sur `/admin/analytics` → **Settings** :

- Vérifier les modèles OpenAI
- Configurer `registration_enabled`
- Configurer `default_token_limit`

### 4. Tester les fonctionnalités

- ✅ Inscription
- ✅ Connexion
- ✅ Génération CV
- ✅ Import PDF
- ✅ Traduction
- ✅ Match Score
- ✅ Export PDF
- ✅ Dashboard admin

---

## Monitoring

### Logs

```bash
# PM2
pm2 logs fitmycv

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Système
sudo journalctl -u fitmycv -f
```

### Métriques

**PM2 Monitor** :

```bash
pm2 monit
```

**Dashboard admin** :

- Analytics → Overview
- OpenAI Costs
- Errors

### Alertes

- **OpenAI Alerts** : Configurer des alertes de coûts
- **Uptime monitoring** : UptimeRobot, Pingdom
- **Error tracking** : Sentry (optionnel)

---

## Backup & Restauration

### Base de données

**Backup PostgreSQL** :

```bash
# Backup
pg_dump -U fitmycv_user fitmycv > backup_$(date +%Y%m%d).sql

# Restauration
psql -U fitmycv_user fitmycv < backup_20250115.sql
```

**Automatisation** (crontab) :

```cron
# Backup quotidien à 2h du matin
0 2 * * * pg_dump -U fitmycv_user fitmycv > /backups/db_$(date +\%Y\%m\%d).sql
```

### Fichiers CVs

```bash
# Backup des CVs chiffrés
tar -czf cvs_backup_$(date +%Y%m%d).tar.gz /var/www/fitmycv/data/users/

# Restauration
tar -xzf cvs_backup_20250115.tar.gz -C /var/www/fitmycv/
```

### Stratégie de backup

- **Quotidien** : Base de données + CVs
- **Rétention** : 30 jours
- **Stockage** : S3, Backblaze B2, etc.
- **Test de restauration** : Mensuel

---

**Déploiement production-ready** | VPS, Vercel, Docker, SSL, Monitoring
