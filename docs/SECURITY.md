# Sécurité - FitMyCv.ai

Guide complet des mesures de sécurité implémentées dans FitMyCv.ai.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Chiffrement des données](#chiffrement-des-données)
- [Authentification & Autorisation](#authentification--autorisation)
- [Rate Limiting](#rate-limiting)
- [Headers de sécurité](#headers-de-sécurité)
- [Validation & Sanitization](#validation--sanitization)
- [RGPD & Cookies](#rgpd--cookies)
- [Best Practices](#best-practices)

---

## Vue d'ensemble

FitMyCv.ai implémente une sécurité multi-couches :

```
┌─────────────────────────────────────────┐
│  HTTPS (TLS 1.3)                        │ ← Transport
├─────────────────────────────────────────┤
│  Security Headers (CSP, HSTS, etc.)     │ ← Navigateur
├─────────────────────────────────────────┤
│  Middleware (Auth, Rate Limit)          │ ← Next.js
├─────────────────────────────────────────┤
│  API Routes (Validation, Sanitization)  │ ← Application
├─────────────────────────────────────────┤
│  Encryption (AES-256-GCM)               │ ← Données
├─────────────────────────────────────────┤
│  Database (Prisma avec parameterized)   │ ← Stockage
└─────────────────────────────────────────┘
```

---

## Chiffrement des données

### AES-256-GCM

Tous les CVs sont chiffrés avant stockage avec **AES-256-GCM** (Galois/Counter Mode).

**Fichier** : `lib/cv/crypto.js`

### Configuration

```bash
# .env.local
# Générer avec: openssl rand -base64 32
CV_ENCRYPTION_KEY="votre-cle-32-octets-en-base64"
```

**IMPORTANT** : Cette clé doit faire exactement **32 octets** (256 bits).

### Format des fichiers chiffrés

```
cv1:{iv}:{authTag}:{ciphertext}
│   │   │          └─ Données chiffrées (Base64)
│   │   └──────────── Tag d'authentification (16 bytes, Base64)
│   └──────────────── Vecteur d'initialisation (12 bytes, Base64)
└──────────────────── Préfixe de version
```

**Exemple** :

```
cv1:aBcD123...==:xYz789...==:dEf456...==
```

### Fonctions de chiffrement

#### encryptString(plaintext)

```javascript
import crypto from 'crypto';

export function encryptString(plaintext) {
  const key = Buffer.from(process.env.CV_ENCRYPTION_KEY, 'base64');
  const iv = crypto.randomBytes(12); // 96 bits pour GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  return `cv1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
}
```

#### decryptString(ciphertext)

```javascript
export function decryptString(ciphertext) {
  if (!ciphertext.startsWith('cv1:')) {
    throw new Error('Invalid cipher format');
  }

  const [version, ivB64, authTagB64, dataB64] = ciphertext.split(':');

  const key = Buffer.from(process.env.CV_ENCRYPTION_KEY, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(dataB64, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}
```

### Sécurité

- **Authenticité** : GCM garantit l'intégrité (pas de modification sans détection)
- **IV aléatoire** : Chaque fichier a un IV unique (pas de patterns répétitifs)
- **Key rotation** : Possible en déchiffrant puis rechiffrant tous les CVs

---

## Authentification & Autorisation

### NextAuth.js

**Fichier** : `lib/auth/options.js`

#### Session JWT

```javascript
session: {
  strategy: "jwt",
  maxAge: 7 * 24 * 60 * 60,  // 7 jours
  updateAge: 24 * 60 * 60,   // Mise à jour 24h
}
```

#### Cookies sécurisés

```javascript
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token',
    options: {
      httpOnly: true,       // Pas accessible en JS
      sameSite: 'lax',      // Protection CSRF
      path: '/',
      secure: process.env.NODE_ENV === 'production',  // HTTPS only en prod
      maxAge: 7 * 24 * 60 * 60
    }
  }
}
```

**Protection** :

- `httpOnly`: Empêche l'accès JavaScript (XSS)
- `secure`: HTTPS obligatoire en production
- `sameSite: lax`: Protection contre CSRF

### Politique de mot de passe

**Fichier** : `lib/security/passwordPolicy.js`

**Règles** :

- Longueur minimale : **8 caractères**
- Au moins **1 majuscule**
- Au moins **1 minuscule**
- Au moins **1 chiffre**
- Au moins **1 caractère spécial** (`!@#$%^&*()_+-=[]{}|;:,.<>?`)

**Hashing** : bcrypt avec **10 rounds**

```javascript
import bcrypt from 'bcryptjs';

const hash = await bcrypt.hash(password, 10);
const valid = await bcrypt.compare(password, hash);
```

### Vérification email

**Obligatoire** pour tous les utilisateurs (credentials).

**Middleware** : `middleware.js:84-103`

```javascript
if (token?.id && !token?.emailVerified) {
  // Rediriger vers /auth/verify-email-required
  const url = request.nextUrl.clone();
  url.pathname = '/auth/verify-email-required';
  return NextResponse.redirect(url);
}
```

### Tokens

| Type | Durée de vie | Usage | Table |
|------|-------------|-------|-------|
| **Email Verification** | 24h | Vérifier email | EmailVerificationToken |
| **Auto Sign In** | 15 min | Connexion auto post-vérif | AutoSignInToken |
| **Password Reset** | 1h | Reset mot de passe | User.resetToken |
| **Email Change** | 24h | Changement email | EmailChangeRequest |

### RBAC (Role-Based Access Control)

**Rôles** :

- `USER` : Utilisateur standard
- `ADMIN` : Administrateur

**Vérification** :

```javascript
// lib/auth/session.js
export async function requireAdmin(session) {
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  if (session.user.role !== 'ADMIN') {
    throw new Error('Not authorized (admin required)');
  }

  return session.user;
}
```

---

## Rate Limiting

### Implémentation

**Fichier** : `middleware.js:4-61`

**Algorithme** : Sliding window (fenêtre glissante) in-memory

```javascript
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

const RATE_LIMIT_MAX_REQUESTS = {
  '/api/auth/register': 5,
  '/api/auth/signin': 10,
  '/api/admin': 40,
  '/api/admin/users': 60,
  '/api/background-tasks/sync': 120,
  '/api/background-tasks': 30,
  '/api/feedback': 10,
  '/api/cv': 60,
  default: 100,
};
```

### Fonctionnement

```javascript
function checkRateLimit(ip, pathname) {
  const key = `${ip}:${pathname}`;
  const now = Date.now();

  const record = rateLimitStore.get(key) || {
    count: 0,
    resetTime: now + RATE_LIMIT_WINDOW
  };

  // Reset si fenêtre expirée
  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  }

  record.count++;
  rateLimitStore.set(key, record);

  return {
    allowed: record.count <= maxRequests,
    remaining: Math.max(0, maxRequests - record.count),
    resetTime: record.resetTime,
  };
}
```

### Response

**Headers** :

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705315800000
```

**Body** :

```json
{
  "error": "Trop de requêtes. Veuillez réessayer plus tard.",
  "retryAfter": 45
}
```

### Cleanup

Pour éviter les memory leaks, le store est nettoyé automatiquement :

```javascript
if (rateLimitStore.size > 10000) {
  const cutoff = now - RATE_LIMIT_WINDOW;
  for (const [k, v] of rateLimitStore.entries()) {
    if (v.resetTime < cutoff) {
      rateLimitStore.delete(k);
    }
  }
}
```

**Production** : Utiliser Redis pour le rate limiting distribué

---

## Headers de sécurité

### Configuration

**Fichier** : `middleware.js:130-170`

### Headers appliqués

#### X-Frame-Options

```http
X-Frame-Options: DENY
```

**Protection** : Clickjacking

#### X-Content-Type-Options

```http
X-Content-Type-Options: nosniff
```

**Protection** : MIME type sniffing

#### X-XSS-Protection

```http
X-XSS-Protection: 1; mode=block
```

**Protection** : XSS (anciens navigateurs)

#### Referrer-Policy

```http
Referrer-Policy: strict-origin-when-cross-origin
```

**Protection** : Fuite d'informations via referrer

#### Permissions-Policy

```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
```

**Protection** : Accès non autorisé aux APIs navigateur

#### Content-Security-Policy

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self' https://api.openai.com https://www.google.com;
  frame-src https://www.google.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

**Protection** : XSS, injection de contenu malveillant

**Notes** :

- `unsafe-inline` pour Tailwind CSS
- `unsafe-eval` pour Next.js
- `https://www.google.com` pour reCAPTCHA

#### Strict-Transport-Security (HSTS)

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

**Production only**

**Protection** : Force HTTPS pendant 2 ans

---

## Validation & Sanitization

### Validation des CVs (AJV)

**Fichier** : `lib/cv/validation.js`

**Schema** : `data/schema.json`

```javascript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '@/data/schema.json';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);

export function validateCvData(cvData) {
  const valid = validate(cvData);

  if (!valid) {
    return {
      valid: false,
      errors: validate.errors,
    };
  }

  return { valid: true, data: cvData };
}
```

### Sanitization générique

**Fichier** : `lib/sanitize.js`

```javascript
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';

  return str
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeEmail(email) {
  return email.toLowerCase().trim();
}
```

### XSS Sanitization

**Fichier** : `lib/security/xssSanitization.js`

```javascript
export function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

export function escapeHtml(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, (char) => map[char]);
}
```

### File Validation

**Fichier** : `lib/security/fileValidation.js`

```javascript
export function validatePdfFile(base64) {
  // Check magic bytes (PDF starts with %PDF)
  const buffer = Buffer.from(base64, 'base64');
  const header = buffer.toString('ascii', 0, 4);

  if (header !== '%PDF') {
    throw new Error('Invalid PDF file');
  }

  // Check file size (max 5MB)
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('File too large (max 5MB)');
  }

  return true;
}
```

---

## RGPD & Cookies

### Consentement

**Fichier** : `lib/cookies/consent.js`

**Catégories** :

- **Necessary** : Toujours actifs (session, sécurité)
- **Functional** : Fonctionnalités avancées
- **Analytics** : Statistiques d'usage
- **Marketing** : Publicités (non utilisé actuellement)

### Logging des consentements

Tous les consentements sont loggés dans `ConsentLog` :

```javascript
await prisma.consentLog.create({
  data: {
    userId,
    action: 'created',  // 'created' | 'updated' | 'revoked'
    preferences: JSON.stringify({
      necessary: true,
      functional: false,
      analytics: true,
      marketing: false,
    }),
    ip: clientIp,
    userAgent: request.headers.get('user-agent'),
  }
});
```

### Registre des cookies

**Fichier** : `lib/cookies/registry.js`

Liste de tous les cookies utilisés par l'application :

| Cookie | Catégorie | Durée | Description |
|--------|-----------|-------|-------------|
| `next-auth.session-token` | Necessary | 7 jours | Session NextAuth |
| `next-auth.csrf-token` | Necessary | Session | Protection CSRF |
| `cookie-consent` | Necessary | 1 an | Préférences cookies |

---

## Best Practices

### ✅ Do's

1. **Toujours valider les inputs** (API, formulaires)
2. **Toujours sanitizer les outputs** (HTML, JSON)
3. **Utiliser HTTPS en production**
4. **Logger les événements de sécurité** (failed logins, etc.)
5. **Mettre à jour les dépendances régulièrement**
6. **Utiliser des variables d'environnement pour les secrets**
7. **Implémenter le principe du moindre privilège** (RBAC)
8. **Tester les vulnérabilités** (OWASP Top 10)

### ❌ Don'ts

1. **Ne jamais commit les secrets** (.env dans .gitignore)
2. **Ne jamais exposer les stack traces** en production
3. **Ne jamais faire confiance au client** (valider côté serveur)
4. **Ne jamais stocker les mots de passe en clair**
5. **Ne jamais utiliser `eval()` ou `dangerouslySetInnerHTML` sans sanitization
6. **Ne jamais skip la vérification email**
7. **Ne jamais désactiver CORS sans raison**

### Checklist Sécurité

- [ ] HTTPS configuré (production)
- [ ] Headers de sécurité actifs
- [ ] Rate limiting configuré
- [ ] Validation des inputs
- [ ] Sanitization des outputs
- [ ] Chiffrement des données sensibles
- [ ] Authentification forte (mots de passe + OAuth)
- [ ] Vérification email obligatoire
- [ ] RBAC implémenté
- [ ] Logs de sécurité actifs
- [ ] RGPD compliant (cookies, consentement)
- [ ] Dépendances à jour

---

**Sécurité multi-couches** | AES-256-GCM, NextAuth, Headers, Rate Limiting, RGPD
