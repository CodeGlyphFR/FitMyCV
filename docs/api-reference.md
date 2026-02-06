# Référence API - FitMyCV.io

> 114 endpoints REST documentés

---

## Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| **Total endpoints** | 114 |
| **Endpoints publics** | 11 |
| **Endpoints authentifiés** | 64 |
| **Endpoints admin** | 39 |

### Méthodes HTTP

| Méthode | Nombre |
|---------|--------|
| GET | 57 |
| POST | 48 |
| DELETE | 15 |
| PUT | 5 |
| PATCH | 3 |

---

## Table des matières

1. [Endpoints Publics](#1-endpoints-publics-11) (11)
2. [Endpoints Authentifiés](#2-endpoints-authentifiés-64) (64)
3. [Endpoints Admin](#3-endpoints-admin-39) (39)

---

## Format des erreurs

```json
{
  "error": "errors.api.cv.notFound",
  "params": { "filename": "cv.json" },
  "status": 404
}
```

Les clés d'erreur (`errors.api.*`) sont utilisées pour l'internationalisation côté client.

### Codes d'erreur

| Code | Signification |
|------|---------------|
| 400 | Bad Request - Paramètres invalides |
| 401 | Unauthorized - Non authentifié |
| 403 | Forbidden - Accès refusé (limite atteinte, pas admin) |
| 404 | Not Found - Ressource inexistante |
| 409 | Conflict - Conflit (doublon, etc.) |
| 429 | Too Many Requests - Rate limit |
| 500 | Internal Server Error |

---

# 1. Endpoints Publics (11)

> Aucune authentification requise.

## 1.1 Authentification

### POST `/api/auth/register`
Créer un nouveau compte utilisateur.

**reCAPTCHA :** Oui

```json
// Request
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "recaptchaToken": "..."
}

// Response 201
{
  "success": true,
  "message": "Verification email sent"
}
```

---

### POST `/api/auth/request-reset`
Demander une réinitialisation de mot de passe.

**Rate limit :** 3 req / 15min

```json
// Request
{ "email": "john@example.com" }

// Response 200
{ "success": true }
```

---

### POST `/api/auth/reset-password`
Réinitialiser le mot de passe avec un token.

```json
// Request
{
  "token": "reset-token-xxx",
  "password": "NewSecurePass123!"
}

// Response 200
{ "success": true }
```

---

### GET `/api/auth/verify-email?token=xxx`
Vérifier l'email via token.

```json
// Response 200
{
  "success": true,
  "autoSignInToken": "auto-signin-token-xxx"
}
```

---

### GET `/api/auth/verify-email-change?token=xxx`
Confirmer un changement d'email.

```json
// Response 200
{ "success": true }
```

---

### GET `/api/auth/verify-reset-token?token=xxx`
Vérifier la validité d'un token de reset.

```json
// Response 200
{ "valid": true, "email": "john@example.com" }

// Response 400
{ "valid": false, "error": "Token expired" }
```

---

### * `/api/auth/[...nextauth]`
Handler NextAuth.js (OAuth, sessions, callbacks).

Gère automatiquement : login, logout, callbacks OAuth (Google, GitHub, Apple).

---

## 1.2 Utilitaires

### GET `/api/health`
Health check de l'application.

```json
// Response 200
{
  "status": "ok",
  "uptime": 123456,
  "env": "production"
}
```

---

### POST `/api/recaptcha/verify`
Vérifier un token reCAPTCHA.

```json
// Request
{ "token": "recaptcha-token-xxx" }

// Response 200
{ "success": true, "score": 0.9 }

// Response 400 (score < 0.5)
{ "success": false, "score": 0.3 }
```

---

## 1.3 Webhooks

### POST `/api/webhooks/stripe`
Webhook Stripe pour événements de paiement.

**Authentification :** Signature Stripe (`STRIPE_WEBHOOK_SECRET`)

Événements gérés :
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

---

# 2. Endpoints Authentifiés (64)

> Session NextAuth.js requise.

```javascript
// Vérification côté serveur
import { auth } from '@/lib/auth/session';

export async function GET(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Non authentifié' }, { status: 401 });
  }
  // ...
}
```

---

## 2.1 Gestion de Compte (7 endpoints)

### PUT `/api/account/profile`
Mettre à jour le profil utilisateur.

```json
// Request
{
  "name": "John Updated",
  "email": "newemail@example.com"
}

// Response 200
{
  "success": true,
  "emailChangeRequired": true  // Si email modifié
}
```

---

### PUT `/api/account/password`
Changer le mot de passe.

```json
// Request
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!"
}

// Response 200
{ "success": true }
```

---

### DELETE `/api/account/delete`
Supprimer le compte utilisateur.

```json
// Request
{ "confirmation": "DELETE" }

// Response 200
{ "success": true }
```

---

### GET `/api/account/linked-accounts`
Lister les comptes OAuth liés.

```json
// Response 200
{
  "accounts": [
    { "provider": "google", "email": "john@gmail.com" },
    { "provider": "github", "email": "john@github.com" }
  ],
  "availableProviders": ["apple"]
}
```

---

### POST `/api/account/link-oauth`
Initier la liaison d'un compte OAuth.

**reCAPTCHA :** Oui

```json
// Request
{ "provider": "github" }

// Response 200
{ "authUrl": "https://github.com/login/oauth/authorize?..." }
```

---

### DELETE `/api/account/unlink-oauth`
Supprimer une liaison OAuth.

```json
// Request
{ "provider": "github" }

// Response 200
{ "success": true }

// Response 400 (dernier compte)
{ "error": "Cannot unlink last authentication method" }
```

---

### POST `/api/auth/resend-verification`
Renvoyer l'email de vérification.

**Rate limit :** 1 req / 60s

```json
// Response 200
{ "success": true }

// Response 429
{ "error": "Please wait before requesting again" }
```

---

## 2.2 Gestion des CV (11 endpoints)

### GET `/api/cvs`
Lister tous les CV de l'utilisateur.

```json
// Response 200
{
  "files": [
    {
      "filename": "cv-2024-01-15.json",
      "sourceType": "import",
      "sourceValue": "uploaded.pdf",
      "language": "fr",
      "createdBy": "pdf_import",
      "matchScore": 85,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-16T14:30:00Z"
    }
  ]
}
```

---

### POST `/api/cvs/create`
Créer un nouveau CV vide.

**Feature :** `create_cv_manual`

```json
// Request
{
  "filename": "mon-nouveau-cv.json",
  "language": "fr"
}

// Response 201
{
  "success": true,
  "filename": "mon-nouveau-cv.json"
}
```

---

### GET `/api/cvs/read?file=filename.json`
Lire le contenu d'un CV.

```json
// Response 200
{
  "content": {
    "header": { "name": "John Doe", ... },
    "summary": "...",
    "experiences": [...],
    "education": [...],
    "skills": [...],
    "languages": [...],
    "projects": [...],
    "extras": [...]
  }
}
```

---

### POST `/api/cvs/delete`
Supprimer un CV.

```json
// Request
{ "filename": "cv-to-delete.json" }

// Response 200
{
  "success": true,
  "nextFile": "other-cv.json"
}
```

---

### POST `/api/cvs/delete-bulk`
Supprimer plusieurs CV.

```json
// Request
{ "filenames": ["cv1.json", "cv2.json", "cv3.json"] }

// Response 200
{ "success": true, "deleted": 3 }
```

---

### GET `/api/cvs/versions?file=filename.json`
Lister les versions d'un CV.

```json
// Response 200
{
  "versions": [
    {
      "version": 3,
      "changelog": "Optimization",
      "changeType": "optimization",
      "createdAt": "2024-01-16T14:30:00Z",
      "matchScore": 85
    }
  ],
  "currentVersion": 3
}
```

---

### POST `/api/cvs/restore`
Restaurer une version précédente.

```json
// Request
{
  "filename": "cv.json",
  "version": 2
}

// Response 200
{
  "success": true,
  "newVersion": 4,
  "changelog": "Restored from v2"
}
```

---

### GET `/api/cv/source?file=filename.json`
Récupérer la source d'un CV.

```json
// Response 200
{
  "sourceType": "url",
  "sourceValue": "https://linkedin.com/jobs/view/123"
}
```

---

### GET `/api/cv/metadata?file=filename.json`
Récupérer les métadonnées d'un CV.

```json
// Response 200
{
  "matchScore": 85,
  "matchScoreStatus": "completed",
  "scoreBreakdown": {...},
  "improvementSuggestions": [...],
  "missingSkills": [...],
  "matchingSkills": [...]
}
```

---

### GET `/api/cv/can-edit?file=filename.json`
Vérifier le droit d'édition sur un CV.

```json
// Response 200
{ "canEdit": true }
```

---

### GET `/api/cvs/changes?file=filename.json`
Historique des modifications d'un CV.

```json
// Response 200
{
  "changes": [
    {
      "type": "optimization",
      "timestamp": "2024-01-16T14:30:00Z",
      "details": {...}
    }
  ]
}
```

---

## 2.3 CV - Scoring & Amélioration (4 endpoints)

### POST `/api/cv/match-score`
Déclencher le calcul du score de matching.

**Feature :** `calculate_match_score`

```json
// Request
{ "filename": "cv.json" }

// Response 202
{
  "status": "calculating",
  "taskId": "task-xxx"
}
```

---

### GET `/api/cv/match-score?file=filename.json`
Récupérer le score de matching.

```json
// Response 200
{
  "score": 85,
  "status": "completed",
  "breakdown": {
    "skills": 90,
    "experience": 80,
    "education": 85
  },
  "suggestions": [...]
}
```

---

### POST `/api/cv/improve`
Lancer l'optimisation IA du CV.

**Feature :** `optimize_cv`
**Crédits :** Variable selon plan

```json
// Request
{
  "filename": "cv.json",
  "suggestions": ["skill-gap-1", "experience-enhance-2"]
}

// Response 202
{
  "status": "processing",
  "taskId": "task-xxx"
}
```

---

### POST `/api/cv/apply-review`
Appliquer les modifications après review.

```json
// Request
{
  "filename": "cv.json",
  "acceptedChanges": ["change-1", "change-3"],
  "rejectedChanges": ["change-2"]
}

// Response 200
{ "success": true }
```

---

## 2.4 Tâches de Fond (8 endpoints)

### POST `/api/background-tasks/generate-cv`
Générer un CV à partir d'une offre d'emploi.

**Feature :** `gpt_cv_generation`
**Crédits :** 1 par génération

```json
// Request (URL)
{
  "sourceCvFilename": "cv-base.json",
  "urls": ["https://linkedin.com/jobs/view/123"]
}

// Request (PDF)
{
  "sourceCvFilename": "cv-base.json",
  "pdfFile": "base64-encoded-pdf"
}

// Response 202
{
  "taskId": "task-xxx",
  "status": "pending"
}
```

---

### POST `/api/background-tasks/generate-cv-from-job-title`
Générer un CV template depuis un titre de poste.

**Feature :** `gpt_cv_generation`

```json
// Request
{
  "jobTitle": "Senior Software Engineer",
  "language": "français"
}

// Response 202
{
  "taskId": "task-xxx",
  "status": "pending"
}
```

**Langues supportées pour le CV généré :**

| Valeur | Langue |
|--------|--------|
| `français` | Français (défaut) |
| `anglais` | Anglais |
| `allemand` | Allemand |
| `espagnol` | Espagnol |

---

### POST `/api/background-tasks/import-pdf`
Importer un CV depuis un fichier PDF.

**Feature :** `pdf_import`

```
// Request (multipart/form-data)
file: [PDF file]

// Response 202
{
  "taskId": "task-xxx",
  "status": "pending"
}
```

---

### POST `/api/background-tasks/translate-cv`
Traduire un CV dans une autre langue.

**Feature :** `translate_cv`

```json
// Request
{
  "filename": "cv.json",
  "targetLanguage": "en"
}

// Response 202
{
  "taskId": "task-xxx",
  "status": "pending"
}
```

---

### POST `/api/background-tasks/create-template-cv`
Créer un CV template.

**Feature :** `create_template_cv`

```json
// Request
{
  "sourceUrl": "https://linkedin.com/jobs/view/123",
  "language": "fr"
}

// Response 202
{
  "taskId": "task-xxx",
  "status": "pending"
}
```

---

### POST `/api/background-tasks/calculate-match-score`
Calculer le score de matching (worker interne).

```json
// Request
{
  "filename": "cv.json",
  "taskId": "task-xxx"
}

// Response 202
{ "status": "calculating" }
```

---

### GET `/api/background-tasks/sync?deviceId=xxx`
Synchroniser l'état des tâches pour un device.

```json
// Response 200
{
  "tasks": [
    {
      "id": "task-xxx",
      "type": "cv_generation",
      "status": "completed",
      "result": { "filename": "cv-generated.json" }
    }
  ]
}
```

---

### POST `/api/background-tasks/sync`
Créer/mettre à jour une tâche.

```json
// Request
{
  "id": "task-xxx",
  "type": "cv_generation",
  "status": "pending",
  "deviceId": "device-xxx"
}

// Response 200
{ "success": true }
```

---

### DELETE `/api/background-tasks/sync`
Supprimer les tâches terminées.

```json
// Request
{ "taskIds": ["task-1", "task-2"] }

// Response 200
{ "deleted": 2 }
```

---

## 2.5 Exports (5 endpoints)

### POST `/api/export-pdf`
Exporter un CV en PDF.

**Feature :** `export_cv`

```json
// Request
{
  "filename": "cv.json",
  "options": {
    "sections": ["header", "summary", "experiences", "skills"],
    "template": "professional"
  }
}

// Response 200
// Content-Type: application/pdf
// Binary PDF data
```

---

### POST `/api/preview-pdf`
Prévisualiser un CV en PDF (sans débit crédit).

```json
// Request
{
  "filename": "cv.json",
  "options": { ... }
}

// Response 200
// Content-Type: application/pdf
```

---

### POST `/api/export-word`
Exporter un CV en DOCX.

**Feature :** `export_cv`

```json
// Request
{
  "filename": "cv.json",
  "options": { ... }
}

// Response 200
// Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

---

### GET `/api/export-templates`
Lister les templates d'export de l'utilisateur.

```json
// Response 200
{
  "templates": [
    {
      "id": "tpl-xxx",
      "name": "Mon template",
      "selections": { ... }
    }
  ]
}
```

---

### POST `/api/export-templates`
Créer un template d'export.

```json
// Request
{
  "name": "Template complet",
  "selections": {
    "header": { "enabled": true },
    "experiences": { "enabled": true, "showDeliverables": true }
  }
}

// Response 201
{ "id": "tpl-xxx", "success": true }
```

---

### PUT `/api/export-templates/[id]`
Modifier un template d'export.

```json
// Request
{
  "name": "Template modifié",
  "selections": { ... }
}

// Response 200
{ "success": true }
```

---

### DELETE `/api/export-templates/[id]`
Supprimer un template d'export.

```json
// Response 200
{ "success": true }
```

---

## 2.6 Abonnements (11 endpoints)

### GET `/api/subscription/plans`
Lister les plans disponibles.

```json
// Response 200
{
  "plans": [
    {
      "id": 1,
      "name": "Free",
      "priceMonthly": 0,
      "priceYearly": 0,
      "features": {
        "gpt_cv_generation": { "limit": 3 },
        "export_cv": { "limit": 5 }
      }
    },
    {
      "id": 2,
      "name": "Pro",
      "priceMonthly": 9.99,
      "priceYearly": 99.99,
      "features": { ... }
    }
  ]
}
```

---

### GET `/api/subscription/current`
Récupérer l'abonnement actuel.

```json
// Response 200
{
  "subscription": {
    "planId": 2,
    "planName": "Pro",
    "status": "active",
    "billingPeriod": "monthly",
    "currentPeriodEnd": "2024-02-15T00:00:00Z",
    "cancelAtPeriodEnd": false
  },
  "featureCounters": {
    "gpt_cv_generation": { "used": 5, "limit": 20 },
    "export_cv": { "used": 3, "limit": -1 }
  }
}
```

---

### POST `/api/subscription/change`
Changer de plan (upgrade/downgrade).

```json
// Request
{
  "planId": 3,
  "billingPeriod": "yearly"
}

// Response 200 (upgrade immédiat)
{
  "success": true,
  "effective": "immediate",
  "prorationAmount": 5.50
}

// Response 200 (downgrade programmé)
{
  "success": true,
  "effective": "end_of_period",
  "effectiveDate": "2024-02-15T00:00:00Z"
}
```

---

### POST `/api/subscription/preview-upgrade`
Prévisualiser un changement de plan.

```json
// Request
{
  "planId": 3,
  "billingPeriod": "yearly"
}

// Response 200
{
  "prorationAmount": 5.50,
  "newPrice": 99.99,
  "effectiveDate": "2024-01-15T00:00:00Z"
}
```

---

### POST `/api/subscription/cancel`
Annuler l'abonnement.

```json
// Request
{ "immediate": false }

// Response 200
{
  "success": true,
  "cancelAt": "2024-02-15T00:00:00Z"
}
```

---

### POST `/api/subscription/cancel-downgrade`
Annuler un downgrade programmé.

```json
// Response 200
{ "success": true }
```

---

### POST `/api/subscription/reactivate`
Réactiver un abonnement annulé.

```json
// Response 200
{ "success": true }
```

---

### POST `/api/subscription/billing-portal`
Accéder au portail de facturation Stripe.

```json
// Response 200
{ "url": "https://billing.stripe.com/session/xxx" }
```

---

### GET `/api/subscription/invoices`
Lister les factures.

```json
// Response 200
{
  "invoices": [
    {
      "id": "inv_xxx",
      "amount": 999,
      "currency": "eur",
      "status": "paid",
      "pdfUrl": "https://...",
      "createdAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

---

### GET `/api/subscription/credit-packs`
Lister les packs de crédits disponibles.

```json
// Response 200
{
  "packs": [
    { "id": 1, "credits": 5, "price": 4.99 },
    { "id": 2, "credits": 10, "price": 8.99 },
    { "id": 3, "credits": 25, "price": 19.99 }
  ]
}
```

---

### POST `/api/checkout/subscription`
Créer une session checkout pour abonnement.

```json
// Request
{
  "planId": 2,
  "billingPeriod": "monthly",
  "locale": "fr"  // Optionnel: fr, en, es, de (défaut: en)
}

// Response 200
{ "checkoutUrl": "https://checkout.stripe.com/xxx" }
```

**Paramètre `locale`** : Localise le message d'acceptation des CGV affiché dans Stripe Checkout. Utilise les traductions existantes du projet.

---

## 2.7 Crédits (4 endpoints)

### GET `/api/credits/balance`
Récupérer le solde de crédits.

```json
// Response 200
{
  "balance": 15,
  "totalPurchased": 50,
  "totalUsed": 35
}
```

---

### GET `/api/credits/costs`
Récupérer les coûts des features en crédits.

```json
// Response 200
{
  "costs": {
    "gpt_cv_generation": 1,
    "optimize_cv": 1,
    "export_cv": 0
  }
}
```

---

### GET `/api/credits/transactions`
Historique des transactions.

```json
// Response 200
{
  "transactions": [
    {
      "id": "txn-xxx",
      "type": "debit",
      "amount": -1,
      "featureName": "gpt_cv_generation",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST `/api/checkout/credits`
Créer une session d'achat de crédits.

```json
// Request
{
  "packId": 2,
  "locale": "fr"  // Optionnel: fr, en, es, de (défaut: en)
}

// Response 200
{ "checkoutUrl": "https://checkout.stripe.com/xxx" }
```

**Paramètre `locale`** : Localise le message d'acceptation des CGV affiché dans Stripe Checkout. Utilise les traductions existantes du projet.

---

## 2.8 Télémétrie & Feedback (4 endpoints)

### POST `/api/telemetry/track`
Tracker un événement utilisateur.

```json
// Request
{
  "type": "cv_export",
  "category": "cv",
  "metadata": { "format": "pdf" }
}

// Response 200
{ "success": true }
```

---

### POST `/api/feedback`
Envoyer un feedback utilisateur.

```json
// Request
{
  "rating": 5,
  "comment": "Super application !",
  "isBugReport": false
}

// Response 201
{ "success": true }
```

---

### POST `/api/consent/log`
Logger un consentement RGPD.

```json
// Request
{
  "action": "updated",
  "preferences": {
    "necessary": true,
    "functional": true,
    "analytics": false,
    "marketing": false
  }
}

// Response 200
{ "success": true }
```

---

### GET `/api/consent/history`
Historique des consentements.

```json
// Response 200
{
  "history": [
    {
      "action": "created",
      "preferences": { ... },
      "createdAt": "2024-01-10T10:00:00Z"
    }
  ]
}
```

---

## 2.9 Autres (5 endpoints)

### GET `/api/settings`
Récupérer les paramètres utilisateur.

```json
// Response 200
{
  "language": "fr",
  "theme": "dark"
}
```

---

### GET `/api/user/onboarding`
Récupérer l'état de l'onboarding.

```json
// Response 200
{
  "completed": false,
  "currentStep": "import_cv",
  "completedSteps": ["welcome", "account_setup"]
}
```

---

### POST `/api/user/onboarding`
Mettre à jour l'onboarding.

```json
// Request
{
  "step": "import_cv",
  "completed": true
}

// Response 200
{ "success": true }
```

---

### GET `/api/link-history`
Historique des liens d'offres utilisés.

```json
// Response 200
{
  "links": [
    {
      "url": "https://linkedin.com/jobs/view/123",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST `/api/link-history`
Ajouter un lien à l'historique.

```json
// Request
{ "url": "https://linkedin.com/jobs/view/456" }

// Response 201
{ "success": true }
```

---

### DELETE `/api/link-history`
Supprimer un lien de l'historique.

```json
// Request
{ "url": "https://linkedin.com/jobs/view/456" }

// Response 200
{ "success": true }
```

---

### GET `/api/events/stream`
Stream d'événements temps réel (SSE).

```
// Response (Server-Sent Events)
event: cv_updated
data: {"filename": "cv.json"}

event: credits_updated
data: {"balance": 14}
```

---

# 3. Endpoints Admin (39)

> Rôle `ADMIN` requis.

```javascript
// Vérification côté serveur
const session = await auth();
if (session?.user?.role !== 'ADMIN') {
  return Response.json({ error: 'Accès refusé' }, { status: 403 });
}
```

---

## 3.1 Gestion des Utilisateurs (5 endpoints)

### GET `/api/admin/users`
Lister les utilisateurs avec pagination et filtres.

**Query params :** `page`, `limit`, `search`, `role`, `emailVerified`

```json
// Response 200
{
  "users": [
    {
      "id": "user-xxx",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER",
      "emailVerified": true,
      "createdAt": "2024-01-10T10:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 15
}
```

---

### POST `/api/admin/users`
Créer un utilisateur.

```json
// Request
{
  "name": "New User",
  "email": "new@example.com",
  "password": "TempPass123!",
  "role": "USER"
}

// Response 201
{ "id": "user-xxx", "success": true }
```

---

### GET `/api/admin/users/[userId]`
Détails d'un utilisateur.

```json
// Response 200
{
  "user": {
    "id": "user-xxx",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER",
    "subscription": { ... },
    "creditBalance": 15,
    "cvCount": 5,
    "createdAt": "2024-01-10T10:00:00Z"
  }
}
```

---

### PUT `/api/admin/users/[userId]`
Modifier un utilisateur.

```json
// Request
{
  "name": "John Updated",
  "role": "ADMIN"
}

// Response 200
{ "success": true }
```

---

### DELETE `/api/admin/users/[userId]`
Supprimer un utilisateur.

```json
// Response 200
{ "success": true }
```

---

## 3.2 Gestion des Plans (6 endpoints)

### GET `/api/admin/subscription-plans`
Lister tous les plans.

```json
// Response 200
{
  "plans": [
    {
      "id": 1,
      "name": "Free",
      "priceMonthly": 0,
      "priceYearly": 0,
      "tier": 0,
      "featureLimits": [...]
    }
  ]
}
```

---

### POST `/api/admin/subscription-plans`
Créer un plan.

```json
// Request
{
  "name": "Business",
  "priceMonthly": 29.99,
  "priceYearly": 299.99,
  "tier": 3,
  "featureLimits": [
    { "featureName": "gpt_cv_generation", "limit": -1 }
  ]
}

// Response 201
{ "id": 4, "success": true }
```

---

### PUT `/api/admin/subscription-plans/[id]`
Modifier un plan.

---

### DELETE `/api/admin/subscription-plans/[id]`
Supprimer un plan.

---

### GET `/api/admin/subscription-mode`
Récupérer le mode abonnement.

```json
// Response 200
{ "enabled": true }
```

---

### POST `/api/admin/subscription-mode`
Activer/désactiver le mode abonnement.

```json
// Request
{ "enabled": false }

// Response 200
{ "success": true }
```

---

## 3.3 Gestion des Crédits (4 endpoints)

### GET `/api/admin/credit-packs`
Lister les packs de crédits.

---

### POST `/api/admin/credit-packs`
Créer un pack de crédits.

```json
// Request
{
  "name": "Pack 50",
  "credits": 50,
  "price": 39.99
}

// Response 201
{ "id": 4, "success": true }
```

---

### PUT `/api/admin/credit-packs/[id]`
Modifier un pack.

---

### DELETE `/api/admin/credit-packs/[id]`
Supprimer un pack.

---

## 3.4 Gestion des Emails (8 endpoints)

### GET `/api/admin/email-templates`
Lister les templates email.

---

### POST `/api/admin/email-templates`
Créer un template.

---

### GET `/api/admin/email-templates/[id]`
Détails d'un template.

---

### PUT `/api/admin/email-templates/[id]`
Modifier un template.

---

### DELETE `/api/admin/email-templates/[id]`
Supprimer un template.

---

### POST `/api/admin/email-templates/[id]/activate`
Activer un template.

---

### POST `/api/admin/email-templates/[id]/set-default`
Définir comme template par défaut.

---

### GET `/api/admin/email-triggers`
Lister les triggers email.

```json
// Response 200
{
  "triggers": [
    {
      "id": "email_verification",
      "name": "Vérification email",
      "variables": ["name", "verificationUrl"]
    }
  ]
}
```

---

### GET `/api/admin/email-triggers/[name]/templates`
Templates associés à un trigger.

---

### GET `/api/admin/email-logs`
Logs des envois email.

**Query params :** `page`, `limit`, `status`, `templateId`

---

### GET `/api/admin/email-stats`
Statistiques emails.

---

### POST `/api/admin/email-test`
Envoyer un email de test.

---

## 3.5 Monitoring OpenAI (4 endpoints)

### GET `/api/admin/openai-balance`
Solde compte OpenAI.

```json
// Response 200
{
  "balance": 150.00,
  "currency": "USD"
}
```

---

### GET `/api/admin/openai-pricing`
Prix des modèles OpenAI.

```json
// Response 200
{
  "models": [
    {
      "name": "gpt-4o",
      "inputPrice": 2.50,
      "outputPrice": 10.00,
      "cachePrice": 1.25
    }
  ]
}
```

---

### GET `/api/admin/openai-alerts`
Lister les alertes usage.

---

### POST `/api/admin/openai-alerts`
Créer/modifier une alerte.

---

### GET `/api/admin/openai-alerts/triggered`
Alertes déclenchées.

---

## 3.6 Paramètres Globaux (4 endpoints)

### GET `/api/admin/settings`
Lister tous les settings.

```json
// Response 200
{
  "settings": [
    {
      "id": "xxx",
      "name": "registration_enabled",
      "value": "true",
      "category": "auth"
    }
  ]
}
```

---

### POST `/api/admin/settings`
Créer un setting.

---

### PUT `/api/admin/settings/[id]`
Modifier un setting.

---

### DELETE `/api/admin/settings/[id]`
Supprimer un setting.

---

### GET `/api/admin/settings/history`
Historique des modifications.

---

## 3.7 Analytics (9 endpoints)

### GET `/api/analytics/summary`
KPIs globaux.

**Query params :** `period` (24h, 7d, 30d, all)

```json
// Response 200
{
  "users": { "total": 1500, "new": 45 },
  "cvs": { "total": 5000, "generated": 120 },
  "revenue": { "mrr": 2500, "arr": 30000 }
}
```

---

### GET `/api/analytics/events`
Liste des événements télémétrie.

---

### GET `/api/analytics/errors`
Erreurs système.

---

### GET `/api/analytics/features`
Usage par feature.

---

### GET `/api/analytics/feedbacks`
Retours utilisateurs.

---

### GET `/api/analytics/users`
Comparaison utilisateurs.

---

### GET `/api/analytics/users/[userId]/summary`
Analytics d'un utilisateur.

---

### GET `/api/analytics/cv-generation-costs`
Coûts génération CV (OpenAI).

---

### GET `/api/analytics/cv-improvement-costs`
Coûts amélioration CV.

---

### GET `/api/analytics/openai-usage`
Usage OpenAI détaillé.

---

## 3.8 Autres Admin (4 endpoints)

### GET `/api/admin/revenue`
Métriques de revenus.

---

### GET `/api/admin/plan-costs`
Coûts par plan.

---

### GET `/api/admin/onboarding/users`
Utilisateurs en cours d'onboarding.

---

### GET `/api/admin/onboarding/analytics`
Analytics onboarding.

---

### POST `/api/admin/onboarding/reset`
Reset onboarding d'un utilisateur.

---

### GET `/api/admin/public-images`
Lister les images publiques.

---

### POST `/api/admin/public-images`
Uploader une image.

---

### GET `/api/admin/maintenance/active-sessions`
Sessions actives.

---

### POST `/api/admin/cancel-all-subscriptions`
Annuler TOUS les abonnements (destructif).

---

### POST `/api/admin/mutate`
Exécuter une mutation arbitraire.

⚠️ **Endpoint puissant - utiliser avec précaution**

---

### POST `/api/admin/sync-stripe`
Synchroniser les produits avec Stripe.

---

### POST `/api/admin/telemetry/cleanup`
Nettoyer les anciennes données de télémétrie.

---

### GET `/api/admin/docs/[[...path]]`
Servir la documentation HTML technique.

**Paramètre** : `path` - Chemin du fichier dans `docs/html-docs/`

**Content-Types supportés** : HTML, CSS, JS, PNG, JPG, GIF, SVG, WOFF, WOFF2, TTF, EOT

**Sécurité** : Protection contre path traversal (chemins limités à `docs/html-docs/`)

```http
GET /api/admin/docs/index.html
GET /api/admin/docs/assets/css/style.css
GET /api/admin/docs/01-architecture/overview.html
```

---

## Rate Limiting

| Endpoint | Limite |
|----------|--------|
| `/api/auth/resend-verification` | 1 req / 60s |
| `/api/auth/request-reset` | 3 req / 15min |
| Webhooks Stripe | Illimité (signature) |
| Endpoints auth | 10 req / min |

---

## Headers requis

```http
Content-Type: application/json
Cookie: next-auth.session-token=xxx  (automatique via NextAuth)
```

Pour les uploads de fichiers :
```http
Content-Type: multipart/form-data
```
