# Troubleshooting - FitMyCv.ai

Guide de résolution des problèmes courants.

---

## Table des matières

- [Installation & Configuration](#installation--configuration)
- [Base de données (Prisma)](#base-de-données-prisma)
- [OpenAI](#openai)
- [NextAuth](#nextauth)
- [Puppeteer](#puppeteer)
- [Performance](#performance)
- [Erreurs courantes](#erreurs-courantes)

---

## Installation & Configuration

### ❌ Erreur: `Cannot find module 'next'`

**Cause** : node_modules corrompu ou incomplet

**Solution** :

```bash
rm -rf node_modules package-lock.json
npm install
```

---

### ❌ Erreur: `OPENAI_API_KEY is not set`

**Cause** : Variable d'environnement manquante

**Solution** :

```bash
# .env.local
OPENAI_API_KEY="sk-proj-votre-cle"
```

**Vérifier** :

```bash
# En dev
cat .env.local | grep OPENAI_API_KEY

# En production
echo $OPENAI_API_KEY
```

---

### ❌ Erreur: `CV_ENCRYPTION_KEY must be 32 bytes`

**Cause** : Clé de chiffrement invalide

**Solution** :

```bash
# Générer une nouvelle clé (32 octets)
openssl rand -base64 32

# Ajouter dans .env.local
CV_ENCRYPTION_KEY="le-resultat-genere"
```

**Vérifier la longueur** :

```javascript
const key = Buffer.from(process.env.CV_ENCRYPTION_KEY, 'base64');
console.log(key.length); // Doit être 32
```

---

### ❌ Port 3001 déjà utilisé

**Cause** : Un autre processus utilise le port

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

## Base de données (Prisma)

### ❌ Erreur: `Invalid 'DATABASE_URL'`

**Cause** : Chemin DATABASE_URL incorrect

**Solution** :

```bash
# Dans prisma/.env
DATABASE_URL="file:./dev.db"

# PAS:
# DATABASE_URL="file:./prisma/dev.db" ❌
# DATABASE_URL="file:../prisma/dev.db" ❌
```

**Explication** :

- Le chemin est relatif au dossier `prisma/`
- Prisma cherche depuis `prisma/`, donc `./dev.db` = `prisma/dev.db`

---

### ❌ Erreur: `Can't reach database server`

**Cause** : Base de données inaccessible (PostgreSQL/MySQL)

**Solution** :

```bash
# Vérifier que PostgreSQL est démarré
sudo systemctl status postgresql

# Démarrer si nécessaire
sudo systemctl start postgresql

# Tester la connexion
psql -U fitmycv_user -d fitmycv
```

**Vérifier DATABASE_URL** :

```bash
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/fitmycv"

# MySQL
DATABASE_URL="mysql://user:password@localhost:3306/fitmycv"
```

---

### ❌ Erreur: `Migration failed`

**Cause** : Migration incompatible ou DB corrompue

**Solution 1 : Reset la DB (DEV ONLY)** :

```bash
npx prisma migrate reset
```

**Solution 2 : Appliquer manuellement** :

```bash
# Voir les migrations appliquées
npx prisma migrate status

# Appliquer les migrations manquantes
npx prisma migrate deploy
```

**Solution 3 : Recréer la DB** :

```bash
# SQLite
rm prisma/dev.db
npx prisma migrate deploy

# PostgreSQL
dropdb fitmycv
createdb fitmycv
npx prisma migrate deploy
```

---

### ❌ Erreur: `Prisma Client not generated`

**Cause** : Client Prisma non généré

**Solution** :

```bash
npx prisma generate
```

**Post-install hook** :

Ajouter dans `package.json` :

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

---

## OpenAI

### ❌ Erreur: `Incorrect API key provided`

**Cause** : Clé API invalide ou expirée

**Solution** :

1. Vérifier la clé sur [OpenAI Platform](https://platform.openai.com/api-keys)
2. Régénérer si nécessaire
3. Mettre à jour `.env.local`

```bash
OPENAI_API_KEY="sk-proj-nouvelle-cle"
```

---

### ❌ Erreur: `You exceeded your current quota`

**Cause** : Crédit OpenAI épuisé

**Solution** :

1. Vérifier le solde : [OpenAI Usage](https://platform.openai.com/usage)
2. Ajouter des fonds : [Billing](https://platform.openai.com/account/billing)

**Workaround temporaire** :

- Utiliser `analysisLevel: 'rapid'` (moins cher)
- Limiter les générations

---

### ❌ Erreur: `Rate limit reached`

**Cause** : Trop de requêtes OpenAI

**Solution** :

Attendre quelques secondes ou minutes selon la limite.

**Limites OpenAI** :

| Tier | RPM (Requests per Minute) | TPM (Tokens per Minute) |
|------|---------------------------|-------------------------|
| Free | 3 | 40,000 |
| Tier 1 | 60 | 1,000,000 |
| Tier 2 | 3,500 | 10,000,000 |

**Upgrade tier** : [OpenAI Limits](https://platform.openai.com/account/limits)

---

### ❌ Timeout OpenAI (2 minutes)

**Cause** : Requête trop longue (gros prompt, modèle lent)

**Solution** :

```javascript
// lib/openai/client.js
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 180000, // 3 minutes au lieu de 2
});
```

---

## NextAuth

### ❌ Erreur: `[next-auth][error][SIGNIN_EMAIL_ERROR]`

**Cause** : Service email non configuré

**Solution** :

Configurer Resend :

```bash
# .env.local
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@fitmycv.ai"
```

**Alternative** : Vérifier manuellement l'email via Prisma Studio

---

### ❌ Session non persistante

**Cause** : Cookie non sauvegardé (HTTPS requis en prod)

**Solution** :

```javascript
// lib/auth/options.js
cookies: {
  sessionToken: {
    options: {
      secure: process.env.NODE_ENV === 'production',  // HTTPS en prod
      sameSite: 'lax',
      httpOnly: true,
    }
  }
}
```

---

### ❌ Redirect infini `/auth`

**Cause** : Email non vérifié + middleware bloque

**Solution** :

Vérifier l'email via Prisma Studio :

```sql
UPDATE User
SET emailVerified = CURRENT_TIMESTAMP
WHERE email = 'user@example.com';
```

---

## Puppeteer

### ❌ Erreur: `Failed to launch browser`

**Cause** : Dépendances système manquantes (Linux)

**Solution** :

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

---

### ❌ Timeout Puppeteer

**Cause** : Page web trop longue à charger

**Solution** :

```javascript
// Augmenter le timeout
await page.goto(url, {
  waitUntil: 'networkidle0',
  timeout: 60000  // 60 secondes
});
```

---

### ❌ Erreur: `ERR_BLOCKED_BY_CLIENT` (anti-bot)

**Cause** : Site bloque Puppeteer (Indeed, etc.)

**Solution** : Puppeteer Stealth (déjà implémenté)

```javascript
// Vérifier que stealth est activé
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());
```

**Workaround** :

- Tester avec une autre URL
- Copier/coller manuellement le contenu

---

## Performance

### ⚠️ Build Next.js lent

**Cause** : Trop de dépendances, cache corrompu

**Solution** :

```bash
# Nettoyer le cache
rm -rf .next
npm run build
```

---

### ❌ Erreur: `DYNAMIC_SERVER_USAGE` pendant le build

**Cause** : Routes API tentent d'utiliser `headers()` ou `request.url` pendant le rendu statique

**Symptômes** :

```
Error: Route /api/analytics/events couldn't be rendered statically because it used `headers`.
```

**Solution** :

Ajouter `export const dynamic = 'force-dynamic'` dans les routes API concernées :

```javascript
// app/api/analytics/events/route.js
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';  // ← Ajouter cette ligne

export async function GET(request) {
  // ...
}
```

**Routes concernées** (déjà corrigé) :
- `/api/admin/settings/history`
- `/api/analytics/*` (events, errors, features, openai-usage, summary, users)
- `/api/auth/verify-reset-token`
- `/api/cvs/read`

---

### ⚠️ Logs verbeux pendant le build

**Cause** : `console.log()` s'affichent pendant `Generating static pages`

**Symptômes** :

```
[openai-balance] Attempting credit_grants...
[first-import-duration] Average duration: 45879ms
```

**Solution** :

Conditionner les logs au mode development :

```javascript
// N'afficher les logs qu'en dev
if (process.env.NODE_ENV !== 'production') {
  console.log('[debug] Message de debug');
}
```

**Fichiers concernés** (déjà corrigé) :
- `/api/admin/openai-balance/route.js`
- `/api/telemetry/first-import-duration/route.js`

---

### ❌ systemd service timeout au shutdown

**Cause** : Service systemd ne s'arrête pas proprement (timeout → SIGKILL)

**Symptômes** :

```
cv-site.service: State 'stop-sigterm' timed out. Killing.
cv-site.service: Killing process with signal SIGKILL.
cv-site.service: Failed with result 'timeout'.
```

**Solution** :

Configurer systemd pour graceful shutdown :

```ini
[Service]
# Utiliser SIGTERM au lieu de SIGINT
KillSignal=SIGTERM

# Tuer tous les processus enfants (npm, node, next-server)
KillMode=mixed

# Augmenter le timeout
TimeoutStopSec=30

# Ne PAS rebuilder à chaque démarrage
ExecStart=/usr/bin/env bash -lc 'exec npm start'
```

**Fichier** : `cv-site.service` (déjà corrigé)

**Redémarrage requis** :

```bash
sudo cp cv-site.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart cv-site.service
```

---

### ⚠️ Page lente à charger

**Cause** : Composants non optimisés, images lourdes

**Solution** :

```javascript
// 1. Lazy loading
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('@/components/HeavyComponent'), {
  loading: () => <p>Loading...</p>
});

// 2. Optimiser les images
import Image from 'next/image';

<Image
  src="/image.jpg"
  width={500}
  height={300}
  loading="lazy"
  alt="..."
/>

// 3. Memoization
import { useMemo } from 'react';

const expensiveValue = useMemo(() => computeExpensive(data), [data]);
```

---

### ⚠️ Job queue bloqué

**Cause** : Job en erreur bloque la queue

**Solution** :

```javascript
// Vérifier les tâches
GET /api/background-tasks/sync?deviceId=admin

// Marquer les tâches failed comme cancelled
UPDATE BackgroundTask
SET status = 'cancelled'
WHERE status = 'running' OR status = 'queued';
```

---

## Erreurs courantes

### ❌ `CORS error`

**Cause** : Requête cross-origin bloquée

**Solution** :

```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE' },
      ],
    },
  ];
}
```

---

### ❌ `Module not found: Can't resolve '@/...'`

**Cause** : Alias `@` non configuré

**Solution** :

Vérifier `jsconfig.json` ou `tsconfig.json` :

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

### ❌ Hydration error (React)

**Cause** : HTML server ≠ HTML client

**Solution** :

```javascript
// Utiliser useEffect pour le code client-only
import { useEffect, useState } from 'react';

export default function Component() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <div>{/* Client-only code */}</div>;
}
```

---

### ❌ Memory leak (useEffect)

**Cause** : Cleanup manquant

**Solution** :

```javascript
useEffect(() => {
  const interval = setInterval(() => {
    // Logic
  }, 1000);

  // Cleanup function
  return () => clearInterval(interval);
}, []);
```

---

## Logs utiles

### Next.js

```bash
# Dev mode verbose
DEBUG=* npm run dev

# Build verbose
npm run build -- --debug
```

### Prisma

```bash
# Debug queries
DEBUG=prisma:query npm run dev

# All Prisma logs
DEBUG=prisma:* npm run dev
```

### OpenAI

```javascript
// lib/openai/client.js
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: false,
  maxRetries: 3,
  timeout: 120000,
});

// Log requests
console.log('[OpenAI] Request:', { model, messages });

// Log responses
console.log('[OpenAI] Response:', response.choices[0].message);
```

---

## Obtenir de l'aide

### Ressources

- **Documentation** : [docs/](./docs/)
- **Next.js Docs** : https://nextjs.org/docs
- **Prisma Docs** : https://www.prisma.io/docs
- **OpenAI Docs** : https://platform.openai.com/docs

### Support

- **Issues GitHub** : Créer un issue avec :
  - Description du problème
  - Steps to reproduce
  - Logs d'erreur
  - Environnement (OS, Node version, etc.)

---

**Troubleshooting complet** | Solutions aux problèmes courants
