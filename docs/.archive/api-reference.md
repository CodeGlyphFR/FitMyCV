# Référence API - FitMyCV.io

> Document généré automatiquement le 2026-01-07 par scan exhaustif du projet
> **110 endpoints** documentés

## Vue d'Ensemble

- **Base URL** : `/api`
- **Authentification** : NextAuth.js JWT (cookie automatique)
- **Format** : JSON

---

## Table des Matières

1. [Authentification (9 endpoints)](#authentification)
2. [Gestion Compte (6 endpoints)](#gestion-compte)
3. [Opérations CV (13 endpoints)](#opérations-cv)
4. [Tâches Background (8 endpoints)](#tâches-background)
5. [Abonnements (11 endpoints)](#abonnements)
6. [Crédits (3 endpoints)](#crédits)
7. [Checkout (3 endpoints)](#checkout)
8. [Administration (33 endpoints)](#administration)
9. [Analytics (8 endpoints)](#analytics)
10. [Webhooks (1 endpoint)](#webhooks)
11. [Divers (5+ endpoints)](#divers)

---

## Authentification

### `POST /api/auth/register`
Inscription utilisateur avec email/password.

**Body :**
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "recaptchaToken": "string (optionnel)"
}
```

**Réponse :** `{ "ok": true, "userId": "string" }`

---

### `GET /api/auth/verify-email?token=xxx`
Vérifie l'email utilisateur.

**Réponse :** `{ "success": true, "user": {...} }`

---

### `POST /api/auth/resend-verification`
Renvoie l'email de vérification.

**Auth requise** : Oui

---

### `POST /api/auth/request-reset`
Demande réinitialisation mot de passe.

**Body :** `{ "email": "string" }`

---

### `POST /api/auth/reset-password`
Réinitialise le mot de passe.

**Body :** `{ "token": "string", "newPassword": "string" }`

---

### `GET /api/auth/verify-reset-token?token=xxx`
Vérifie validité du token de reset.

---

### `POST /api/auth/[...nextauth]`
Endpoints NextAuth (signin, signout, callback).

---

## Gestion Compte

### `PUT /api/account/profile`
Met à jour nom et/ou email.

**Auth requise** : Oui

**Body :**
```json
{
  "name": "string (optionnel)",
  "email": "string (optionnel)"
}
```

---

### `PUT /api/account/password`
Change le mot de passe.

**Auth requise** : Oui

**Body :**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

---

### `DELETE /api/account/delete`
Supprime définitivement le compte.

**Auth requise** : Oui

**Body :**
```json
{
  "password": "string (pour non-OAuth)",
  "email": "string (pour OAuth)"
}
```

---

### `GET /api/account/linked-accounts`
Liste les comptes OAuth liés.

**Auth requise** : Oui

---

### `POST /api/account/link-oauth`
Initie la liaison d'un compte OAuth.

**Body :** `{ "provider": "google|github|apple" }`

---

### `POST /api/account/unlink-oauth`
Délie un compte OAuth.

**Body :** `{ "provider": "google|github|apple" }`

---

## Opérations CV

### `GET /api/cvs`
Liste tous les CVs de l'utilisateur.

**Auth requise** : Oui

**Réponse :**
```json
{
  "items": [{
    "file": "timestamp.json",
    "label": "date - title",
    "title": "string",
    "sourceType": "link|pdf|null",
    "isGenerated": boolean,
    "language": "fr|en|de|es",
    "createdAt": "ISO date"
  }],
  "current": "filename"
}
```

---

### `GET /api/cvs/read?file=xxx.json`
Récupère le contenu d'un CV.

**Auth requise** : Oui

**Réponse :** `{ "cv": {...} }`

---

### `POST /api/cvs/create`
Crée un nouveau CV vide.

**Auth requise** : Oui

**Body :**
```json
{
  "full_name": "string",
  "current_title": "string",
  "email": "string"
}
```

---

### `POST /api/cvs/delete`
Supprime un CV.

**Body :** `{ "file": "filename.json" }`

---

### `GET /api/cvs/versions?file=xxx.json`
Récupère l'historique des versions.

**Réponse :**
```json
{
  "versions": [{
    "version": number,
    "changelog": "string",
    "createdAt": "ISO date",
    "matchScore": number
  }]
}
```

---

### `POST /api/cvs/versions`
Restaure une version précédente.

**Body :**
```json
{
  "filename": "string",
  "version": number,
  "action": "restore"
}
```

---

### `POST /api/cv/improve`
Optimise un CV avec l'IA.

**Auth requise** : Oui

**Body :**
```json
{
  "cvFile": "filename.json",
  "replaceExisting": boolean
}
```

**Réponse :** `{ "success": true, "taskId": "string" }` (202)

---

### `POST /api/cv/match-score`
Calcule le score de correspondance.

**Body :** `{ "cvFile": "filename.json" }`

**Réponse :**
```json
{
  "score": number,
  "scoreBreakdown": {...},
  "suggestions": [...],
  "missingSkills": [...],
  "matchingSkills": [...]
}
```

---

### `GET /api/cv/match-score?file=xxx.json`
Récupère le score existant (sans recalcul).

---

### `POST /api/cv/can-create`
Vérifie si l'utilisateur peut créer un CV.

**Réponse :** `{ "canCreate": boolean, "limit": number, "current": number }`

---

## Tâches Background

### `POST /api/background-tasks/generate-cv`
Lance la génération CV depuis une offre.

**Content-Type** : `multipart/form-data`

**Form Fields :**
- `links` : JSON array d'URLs
- `files` : Fichiers PDF
- `baseFile` : CV source (optionnel)
- `deviceId` : Identifiant appareil

**Réponse :** `{ "success": true, "queued": true, "taskIds": [...] }` (202)

---

### `POST /api/background-tasks/import-pdf`
Importe un PDF comme CV.

**Content-Type** : `multipart/form-data`

**Form Fields :**
- `pdfFile` : Fichier PDF
- `deviceId` : Identifiant appareil

**Réponse :** `{ "success": true, "taskId": "string" }` (202)

---

### `POST /api/background-tasks/translate-cv`
Traduit un CV.

**Body :**
```json
{
  "cvFile": "filename.json",
  "targetLanguage": "fr|en|de|es"
}
```

---

### `GET /api/background-tasks/sync`
Synchronise l'état des tâches.

**Query :** `?deviceId=xxx&since=timestamp`

**Réponse :**
```json
{
  "tasks": [{
    "id": "string",
    "type": "generation|import|improve-cv|translate",
    "status": "queued|running|completed|failed",
    "result": {...}
  }]
}
```

---

### `DELETE /api/background-tasks/sync?taskId=xxx&action=cancel`
Annule ou supprime une tâche.

---

## Abonnements

### `GET /api/subscription/current`
Récupère l'abonnement actuel.

**Réponse :**
```json
{
  "id": "string",
  "status": "active|inactive|cancelled",
  "plan": {
    "name": "string",
    "tier": number,
    "priceMonthly": number
  },
  "billingPeriod": "monthly|yearly",
  "currentPeriodEnd": "ISO date"
}
```

---

### `GET /api/subscription/plans`
Liste les plans disponibles (public).

---

### `POST /api/subscription/change`
Change de plan.

**Body :**
```json
{
  "planId": number,
  "billingPeriod": "monthly|yearly"
}
```

---

### `POST /api/subscription/cancel`
Annule l'abonnement.

**Body :** `{ "immediate": boolean }`

---

### `POST /api/subscription/reactivate`
Réactive un abonnement annulé.

---

### `GET /api/subscription/billing-portal`
URL du portail Stripe.

**Réponse :** `{ "url": "https://billing.stripe.com/..." }`

---

## Crédits

### `GET /api/credits/balance`
Solde de crédits.

**Réponse :** `{ "balance": number }`

---

### `GET /api/credits/transactions`
Historique des transactions.

---

### `GET /api/credits/costs`
Coûts des features en crédits.

**Réponse :**
```json
{
  "features": {
    "gpt_cv_generation": number,
    "import_pdf": number,
    "translate_cv": number,
    "export_cv": number
  }
}
```

---

## Checkout

### `POST /api/checkout/subscription`
Crée une session Stripe pour abonnement.

**Body :**
```json
{
  "planId": number,
  "billingPeriod": "monthly|yearly"
}
```

**Réponse :** `{ "url": "https://checkout.stripe.com/..." }`

---

### `POST /api/checkout/credits`
Crée une session pour achat de crédits.

**Body :** `{ "packId": number }`

---

### `POST /api/checkout/verify`
Vérifie une session checkout.

---

## Administration

> Tous les endpoints admin nécessitent `role: ADMIN`

### `GET /api/admin/users`
Liste les utilisateurs avec pagination.

**Query :** `?page=1&limit=10&role=USER&search=xxx`

---

### `POST /api/admin/users`
Crée un utilisateur manuellement.

---

### `GET /api/admin/settings`
Récupère tous les paramètres système.

---

### `POST /api/admin/settings`
Met à jour un paramètre.

**Body :** `{ "settingName": "string", "value": "string" }`

---

### `GET /api/admin/email-templates`
Liste les templates email.

---

### `POST /api/admin/email-templates`
Crée un template email.

---

### `PUT /api/admin/email-templates/[id]`
Met à jour un template.

---

### `POST /api/admin/email-test`
Envoie un email de test.

---

### `GET /api/admin/subscription-plans`
Liste les plans (vue admin).

---

### `POST /api/admin/subscription-plans`
Crée un plan.

---

### `GET /api/admin/credit-packs`
Liste les packs de crédits.

---

### `GET /api/admin/revenue`
Statistiques de revenus.

---

### `GET /api/admin/openai-balance`
Solde OpenAI.

---

## Analytics

### `GET /api/analytics/summary?period=30d`
KPIs résumés.

**Réponse :**
```json
{
  "kpis": {
    "totalUsers": number,
    "activeUsers": number,
    "cvGenerated": number,
    "jobSuccessRate": number
  }
}
```

---

### `GET /api/analytics/events`
Liste les événements télémétrie.

---

### `GET /api/analytics/features`
Usage des features.

---

### `GET /api/analytics/openai-usage`
Usage API OpenAI.

---

## Webhooks

### `POST /api/webhooks/stripe`
Webhook Stripe (signature vérifiée).

**Events gérés :**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.dispute.created`

---

## Divers

### `POST /api/export-pdf`
Génère et télécharge un CV en PDF.

**Body :**
```json
{
  "filename": "string",
  "language": "fr|en|de|es",
  "selections": {...}
}
```

**Réponse :** PDF binaire

---

### `POST /api/feedback`
Soumet un feedback.

**Body :**
```json
{
  "rating": 1-5,
  "comment": "string",
  "isBugReport": boolean
}
```

---

### `POST /api/telemetry/track`
Enregistre des événements.

**Body :**
```json
{
  "events": [{
    "type": "string",
    "metadata": {...}
  }]
}
```

---

### `GET /api/events/stream`
Stream SSE pour mises à jour temps réel.

---

### `GET /api/settings`
Paramètres publics de l'application.

---

## Codes d'Erreur

| Code | Signification |
|------|---------------|
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Non autorisé (limite, permissions) |
| 404 | Ressource non trouvée |
| 409 | Conflit (email existant) |
| 429 | Rate limit dépassé |
| 500 | Erreur serveur |

---

## Format d'Erreur

```json
{
  "error": "Message d'erreur",
  "details": "Détails optionnels",
  "actionRequired": "Action suggérée",
  "redirectUrl": "URL de redirection"
}
```
