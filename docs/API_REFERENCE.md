# Référence API - FitMyCV.io

Documentation complète des 96 routes API de FitMyCV.io.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Authentication](#authentication)
- [CV Management](#cv-management)
- [Background Tasks](#background-tasks)
- [Admin](#admin)
- [Analytics](#analytics)
- [Account](#account)
- [Subscription & Billing](#subscription--billing)
- [User Onboarding](#user-onboarding)
- [Autres routes](#autres-routes)
- [Codes d'erreur](#codes-derreur)

---

## Vue d'ensemble

### Base URL

```
Développement: http://localhost:3001/api
Production: https://FitMyCV.io/api
```

### Authentification

La plupart des routes nécessitent une session NextAuth valide.

**Headers requis** :

```http
Cookie: next-auth.session-token=<token>
```

### Rate Limiting

Toutes les routes API sont limitées par le middleware (middleware.js:6-17) :

| Route | Limite | Fenêtre |
|-------|--------|---------|
| `/api/auth/register` | 5 req | 1 minute |
| `/api/auth/signin` | 10 req | 1 minute |
| `/api/admin/*` | 40 req | 1 minute |
| `/api/admin/users` | 60 req | 1 minute |
| `/api/background-tasks/sync` | 120 req | 1 minute |
| `/api/background-tasks/*` | 30 req | 1 minute |
| `/api/feedback` | 10 req | 1 minute |
| `/api/cv/*` | 60 req | 1 minute |
| **Autres** | 100 req | 1 minute |

**Headers de réponse** :

```http
X-RateLimit-Remaining: 95
```

### Format des réponses

**Succès** :

```json
{
  "data": { ... },
  "message": "Opération réussie"
}
```

**Erreur (format i18n)** :

Les erreurs API utilisent des clés de traduction i18n permettant l'affichage de messages localisés côté client.

```json
{
  "error": "errors.api.auth.emailRequired",    // Clé de traduction i18n
  "params": { "resource": "user" },            // Paramètres dynamiques (optionnel)
  "actionRequired": true,                       // Action utilisateur requise (optionnel)
  "redirectUrl": "/auth/verify-email"           // URL de redirection (optionnel)
}
```

**Traitement côté client** :

```javascript
import { parseApiError } from '@/lib/api/parseApiError';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const { t } = useLanguage();
const response = await fetch('/api/...');
const data = await response.json();

if (!response.ok) {
  const { message, actionRequired, redirectUrl } = parseApiError(data, t);
  // message = "L'adresse email est requise" (traduit)
}
```

**Catégories d'erreurs** :

| Préfixe | Description |
|---------|-------------|
| `errors.api.common.*` | Erreurs génériques (notAuthenticated, serverError, etc.) |
| `errors.api.auth.*` | Erreurs d'authentification |
| `errors.api.cv.*` | Erreurs liées aux CVs |
| `errors.api.subscription.*` | Erreurs d'abonnement |
| `errors.api.account.*` | Erreurs de compte |
| `errors.api.background.*` | Erreurs de tâches background |

---

## Authentication

### POST `/api/auth/[...nextauth]`

Endpoint NextAuth pour tous les providers.

**Providers disponibles** :
- `credentials` : Email/mot de passe
- `google` : Google OAuth
- `github` : GitHub OAuth
- `apple` : Apple Sign In

**Exemple (credentials)** :

```javascript
fetch('/api/auth/callback/credentials', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePass123!'
  })
});
```

**Réponse** :

```json
{
  "url": "http://localhost:3001/",
  "ok": true,
  "status": 200
}
```

---

### POST `/api/auth/register`

Créer un nouveau compte utilisateur.

**Body** :

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "recaptchaToken": "03AGdBq..." // Si reCAPTCHA activé
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Compte créé. Vérifiez votre email.",
  "userId": "clxxx..."
}
```

**Erreurs** :
- `400` : Email déjà utilisé
- `400` : Mot de passe faible
- `403` : Inscriptions désactivées
- `429` : Rate limit dépassé

---

### GET `/api/auth/verify-email?token={token}`

Vérifier l'adresse email d'un utilisateur.

**Query params** :

```
token: string (required) - Token de vérification envoyé par email
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Email vérifié avec succès"
}
```

**Erreurs** :
- `400` : Token invalide ou expiré
- `404` : Token non trouvé

---

### POST `/api/auth/resend-verification`

Renvoyer l'email de vérification.

**Body** :

```json
{
  "email": "user@example.com"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Email de vérification renvoyé"
}
```

---

### POST `/api/auth/request-reset`

Demander un reset de mot de passe.

**Body** :

```json
{
  "email": "user@example.com"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Email de réinitialisation envoyé"
}
```

---

### GET `/api/auth/verify-reset-token?token={token}`

Vérifier la validité d'un token de reset.

**Query params** :

```
token: string (required)
```

**Réponse (200)** :

```json
{
  "valid": true
}
```

---

### POST `/api/auth/reset-password`

Réinitialiser le mot de passe avec un token.

**Body** :

```json
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePass123!"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Mot de passe réinitialisé"
}
```

---

## CV Management

### GET `/api/cvs`

Lister tous les CVs de l'utilisateur connecté.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "cvs": [
    {
      "id": "clxxx...",
      "filename": "cv_1234567890.json",
      "sourceType": "link",
      "sourceValue": "https://indeed.com/job/123",
      "createdBy": "generate-cv",
      "analysisLevel": "medium",
      "matchScore": 85,
      "isTranslated": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:35:00.000Z"
    }
  ]
}
```

---

### GET `/api/cvs/read?filename={filename}`

Lire le contenu d'un CV (déchiffré).

**Auth** : Requise

**Query params** :

```
filename: string (required) - Nom du fichier CV
```

**Réponse (200)** :

```json
{
  "data": {
    "generated_at": "2025-01-15T10:30:00Z",
    "header": {
      "full_name": "John Doe",
      "current_title": "Full Stack Developer",
      "contact": {
        "email": "john.doe@example.com",
        "phone": "+33 6 12 34 56 78",
        "links": ["https://github.com/johndoe"],
        "location": "Paris, France"
      }
    },
    "summary": {
      "description": "Développeur Full Stack...",
      "domains": ["Web", "Mobile"]
    },
    "skills": {
      "hard_skills": ["JavaScript", "React", "Node.js"],
      "soft_skills": ["Communication", "Teamwork"],
      "tools": ["Git", "Docker"],
      "methodologies": ["Agile", "Scrum"]
    },
    "experience": [...],
    "education": [...],
    "languages": [...],
    "projects": [...],
    "extras": []
  }
}
```

**Erreurs** :
- `401` : Non authentifié
- `403` : CV ne vous appartient pas
- `404` : CV non trouvé

---

### POST `/api/cvs/create`

Créer un nouveau CV vide.

**Auth** : Requise

**Body** :

```json
{
  "cvData": {
    "header": { ... },
    "summary": { ... },
    // ... structure complète du CV
  }
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "filename": "cv_1234567890.json"
}
```

---

### POST `/api/cvs/delete`

Supprimer un CV.

**Auth** : Requise

**Body** :

```json
{
  "file": "1234567890.json"
}
```

**Réponse (200)** :

```json
{
  "ok": true,
  "nextFile": "autre_fichier.json"
}
```

---

### GET `/api/cvs/versions?file={filename}`

Récupérer la liste des versions d'un CV (créées lors des optimisations IA).

**Auth** : Requise

**Query params** :
- `file` (requis) : Nom du fichier CV
- `version` (optionnel) : Si spécifié, retourne le contenu de cette version

**Réponse (200) - Liste des versions** :

```json
{
  "filename": "1234567890.json",
  "versions": [
    {
      "version": 2,
      "changelog": "Avant optimisation IA",
      "createdAt": "2025-12-05T18:00:00.000Z"
    },
    {
      "version": 1,
      "changelog": "Avant optimisation IA",
      "createdAt": "2025-12-04T10:00:00.000Z"
    }
  ]
}
```

**Réponse (200) - Contenu d'une version** (avec `?version=2`) :

```json
{
  "version": 2,
  "content": { ... }
}
```

---

### POST `/api/cvs/restore`

Restaurer une version antérieure d'un CV. Crée automatiquement une version de sauvegarde du contenu actuel.

**Auth** : Requise

**Body** :

```json
{
  "filename": "1234567890.json",
  "version": 2
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "filename": "1234567890.json",
  "restoredVersion": 2,
  "content": { ... }
}
```

---

### GET `/api/cv/metadata?filename={filename}`

Récupérer les métadonnées d'un CV.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "metadata": {
    "id": "clxxx...",
    "filename": "cv_1234567890.json",
    "sourceType": "link",
    "sourceValue": "https://indeed.com/job/123",
    "createdBy": "generate-cv",
    "analysisLevel": "medium",
    "matchScore": 85,
    "matchScoreStatus": "idle",
    "scoreBreakdown": {
      "technical_skills": 28,
      "experience": 22,
      "education": 15,
      "projects": 12,
      "soft_skills": 8
    },
    "improvementSuggestions": [
      {
        "priority": "high",
        "suggestion": "Ajouter plus de métriques...",
        "impact": "+8"
      }
    ],
    "missingSkills": ["Kubernetes", "TypeScript"],
    "matchingSkills": ["React", "Node.js", "Docker"],
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### PATCH `/api/cv/metadata`

Mettre à jour les métadonnées d'un CV.

**Auth** : Requise

**Body** :

```json
{
  "filename": "cv_1234567890.json",
  "updates": {
    "matchScore": 90,
    "scoreBreakdown": { ... }
  }
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "metadata": { ... }
}
```

---

### GET `/api/cv/source?filename={filename}`

Récupérer la source d'un CV (offre d'emploi extraite).

**Auth** : Requise

**Réponse (200)** :

```json
{
  "source": {
    "type": "link",
    "value": "https://indeed.com/job/123",
    "extractedContent": "Titre: Développeur Full Stack\n\nDescription: ..."
  }
}
```

---

### POST `/api/cv/match-score`

Calculer le score de correspondance (DEPRECATED - utiliser background-tasks/calculate-match-score).

---

### POST `/api/cv/improve`

Améliorer un CV basé sur les suggestions.

**Auth** : Requise

**Body** :

```json
{
  "filename": "cv_1234567890.json"
}
```

**Process** :

1. Vérifie que `matchScoreStatus === 'idle'`
2. Vérifie que des suggestions existent
3. Met `optimiseStatus = 'inprogress'`
4. Appelle OpenAI pour améliorer le CV
5. Remplace le CV existant
6. Met `optimiseStatus = 'idle'`

**Réponse (200)** :

```json
{
  "success": true,
  "message": "CV optimisé"
}
```

**Erreurs** :
- `400` : Match score non calculé
- `400` : Pas de suggestions disponibles
- `409` : Optimisation déjà en cours

---

### GET `/api/cv/can-create`

Vérifier si l'utilisateur peut créer un nouveau CV.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "allowed": true,
  "reason": null,
  "currentCount": 2,
  "maxCount": 5
}
```

**Réponse (200 - refusé)** :

```json
{
  "allowed": false,
  "reason": "limit_reached",
  "currentCount": 5,
  "maxCount": 5,
  "message": "Limite de CVs atteinte pour votre plan"
}
```

---

### GET `/api/cv/can-edit?filename={filename}`

Vérifier si l'utilisateur peut activer le mode édition (sans débiter).

**Auth** : Requise

**Query params** :

```
filename: string (required) - Nom du fichier CV
```

**Réponse (200)** :

```json
{
  "allowed": true,
  "reason": null
}
```

**Réponse (403)** :

```json
{
  "allowed": false,
  "reason": "limit_reached",
  "message": "Limite d'édition atteinte. Passez à un plan supérieur ou utilisez vos crédits.",
  "needsCredit": true
}
```

**Erreurs** :
- `401` : Non authentifié
- `403` : Limite atteinte + pas de crédits
- `404` : CV non trouvé

---

### POST `/api/cv/debit-edit`

Débiter 1 usage de la feature `edit_cv` (une fois par session d'édition).

**Auth** : Requise

**Body** :

```json
{
  "filename": "cv_1234567890.json"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Usage débité",
  "usedCredit": false
}
```

**Réponse (200 avec crédit)** :

```json
{
  "success": true,
  "message": "1 crédit utilisé",
  "usedCredit": true,
  "remainingCredits": 9
}
```

**Erreurs** :
- `401` : Non authentifié
- `403` : Limite atteinte + pas de crédits
- `404` : CV non trouvé

**Note** : Cette route est appelée automatiquement à la première modification dans une session d'édition. Elle débite 1 compteur d'abonnement OU 1 crédit si la limite mensuelle est atteinte.

---

## Background Tasks

### GET `/api/background-tasks/sync?deviceId={deviceId}`

Synchroniser l'état des tâches en arrière-plan (polling).

**Auth** : Requise

**Query params** :

```
deviceId: string (required) - Device ID unique
```

**Réponse (200)** :

```json
{
  "tasks": [
    {
      "id": "task_1234567890",
      "title": "Génération du CV",
      "type": "generate-cv",
      "status": "running",
      "createdAt": 1705315800000,
      "progress": 65
    },
    {
      "id": "task_0987654321",
      "title": "Import PDF",
      "type": "import-pdf",
      "status": "completed",
      "result": {
        "filename": "cv_imported.json"
      },
      "successMessage": "CV importé avec succès"
    }
  ],
  "shouldUpdateCvList": true
}
```

**Statuts possibles** :
- `queued` : En attente
- `running` : En cours
- `completed` : Terminé
- `failed` : Échoué
- `cancelled` : Annulé

---

### POST `/api/background-tasks/generate-cv`

Générer un CV depuis une offre d'emploi.

**Auth** : Requise

**Body** :

```json
{
  "url": "https://indeed.com/job/123",
  "analysisLevel": "medium",
  "deviceId": "device_uuid"
}
```

**Options analysisLevel** :
- `rapid` : Modèle rapide (configuré dans admin) - ~0.01$
- `medium` : Modèle standard (configuré dans admin) - ~0.05$
- `deep` : Modèle avancé (configuré dans admin) - ~0.20$

**Note** : Les modèles OpenAI utilisés pour chaque niveau sont configurables via l'interface admin (Settings → AI Models).

**Réponse (200)** :

```json
{
  "taskId": "task_1234567890",
  "message": "Tâche créée"
}
```

---

### POST `/api/background-tasks/import-pdf`

Importer un CV depuis un fichier PDF.

**Auth** : Requise

**Body** :

```json
{
  "pdfBase64": "JVBERi0xLjQKJ...",
  "filename": "mon_cv.pdf",
  "analysisLevel": "medium",
  "deviceId": "device_uuid"
}
```

**Réponse (200)** :

```json
{
  "taskId": "task_1234567890",
  "message": "Import PDF en cours"
}
```

---

### POST `/api/background-tasks/translate-cv`

Traduire un CV.

**Auth** : Requise

**Body** :

```json
{
  "filename": "cv_1234567890.json",
  "targetLanguage": "en",
  "deviceId": "device_uuid"
}
```

**Langues supportées** : `en`, `fr`, `es`, `de`, `it`, `pt`

**Réponse (200)** :

```json
{
  "taskId": "task_1234567890",
  "message": "Traduction en cours"
}
```

---

### POST `/api/background-tasks/create-template-cv`

Créer un CV template vide.

**Auth** : Requise

**Body** :

```json
{
  "deviceId": "device_uuid"
}
```

**Réponse (200)** :

```json
{
  "taskId": "task_1234567890",
  "message": "Création du template en cours"
}
```

---

### POST `/api/background-tasks/generate-cv-from-job-title`

Générer un CV depuis un titre de poste (sans offre).

**Auth** : Requise

**Body** :

```json
{
  "jobTitle": "Développeur Full Stack React/Node.js",
  "analysisLevel": "medium",
  "deviceId": "device_uuid"
}
```

**Réponse (200)** :

```json
{
  "taskId": "task_1234567890",
  "message": "Génération en cours"
}
```

---

### POST `/api/background-tasks/calculate-match-score`

Calculer le score de correspondance entre un CV et une offre.

**Auth** : Requise

**Body** :

```json
{
  "filename": "cv_1234567890.json",
  "deviceId": "device_uuid"
}
```

**Réponse (200)** :

```json
{
  "taskId": "task_1234567890",
  "message": "Calcul du score en cours"
}
```

---

### POST `/api/background-tasks/test`

Tester la job queue (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "duration": 5000,
  "deviceId": "device_uuid"
}
```

---

## Admin

### GET `/api/admin/users`

Lister tous les utilisateurs (admin only).

**Auth** : Admin requise

**Query params** :

```
page: number (default: 1)
limit: number (default: 50)
search: string (optional) - Recherche par email/nom
```

**Réponse (200)** :

```json
{
  "users": [
    {
      "id": "clxxx...",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "USER",
      "emailVerified": "2025-01-15T10:00:00.000Z",
      "createdAt": "2025-01-15T09:00:00.000Z",
      "_count": {
        "cvs": 5,
        "feedbacks": 2
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

---

### GET `/api/admin/users/[userId]`

Détails d'un utilisateur (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "user": {
    "id": "clxxx...",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER",
    "emailVerified": "2025-01-15T10:00:00.000Z",
    "createdAt": "2025-01-15T09:00:00.000Z",
    "cvs": [...],
    "feedbacks": [...],
    "telemetryEvents": [...]
  }
}
```

---

### DELETE `/api/admin/users/[userId]`

Supprimer un utilisateur (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Utilisateur supprimé"
}
```

---

### POST `/api/admin/mutate`

Mutation admin (suppression utilisateur, etc.).

**Auth** : Admin requise

**Body** :

```json
{
  "action": "deleteUser",
  "userId": "clxxx..."
}
```

**Actions disponibles** :
- `deleteUser` : Supprimer un utilisateur

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Utilisateur supprimé"
}
```

---

### POST `/api/admin/update`

Mise à jour admin (rôles, etc.).

**Auth** : Admin requise

**Body** :

```json
{
  "action": "updateRole",
  "userId": "clxxx...",
  "role": "ADMIN"
}
```

---

### GET `/api/admin/settings`

Liste tous les settings (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "settings": [
    {
      "id": "clxxx...",
      "settingName": "model_analysis_rapid",
      "value": "gpt-5-nano-2025-08-07",
      "category": "ai_models",
      "description": "Modèle pour analyse rapide"
    }
  ]
}
```

---

### POST `/api/admin/settings`

Créer un nouveau setting (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "settingName": "new_setting",
  "value": "value",
  "category": "general",
  "description": "Description"
}
```

---

### PUT `/api/admin/settings/[id]`

Mettre à jour un setting (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "value": "new_value"
}
```

---

### DELETE `/api/admin/settings/[id]`

Supprimer un setting (admin only).

**Auth** : Admin requise

---

### GET `/api/admin/settings/history`

Historique des modifications de settings (admin only).

**Auth** : Admin requise

---

### GET `/api/admin/subscription-plans`

Liste des plans d'abonnement (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "plans": [
    {
      "id": 1,
      "name": "Gratuit",
      "priceMonthly": 0,
      "priceYearly": 0,
      "maxCvCount": 3,
      "tokenCount": 5,
      "featureLimits": [...]
    }
  ]
}
```

---

### GET `/api/admin/plan-costs`

Coûts API estimés et marges par plan d'abonnement (admin only).

**Auth** : Admin requise

**Source de données** : Vue PostgreSQL `v_cout_api_par_plan`

**Réponse (200)** :

```json
{
  "success": true,
  "data": {
    "costs": [
      {
        "plan": "Pro",
        "priceMonthlyEur": 9.99,
        "costMinUsd": 1.25,
        "costAvgUsd": 1.52,
        "costMaxUsd": 2.04,
        "costMaxEur": 1.88,
        "grossMarginEur": 8.11,
        "marginPercent": 81.2
      }
    ],
    "exchangeRate": {
      "usdToEur": 0.9215,
      "cached": true
    },
    "timestamp": "2024-12-03T14:30:00.000Z"
  }
}
```

**Notes** :
- Taux de change USD/EUR récupéré via `api.frankfurter.app` (cache 1h)
- Fallback sur taux fixe 0.92 si API indisponible
- Marge calculée : `prix_mensuel - (cout_max * taux_change)`

---

### GET `/api/admin/openai-pricing`

Tarification OpenAI (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "pricing": [
    {
      "modelName": "gpt-5-nano-2025-08-07",
      "inputPricePerMToken": 0.10,
      "outputPricePerMToken": 0.40,
      "cachePricePerMToken": 0.05,
      "isActive": true
    }
  ]
}
```

---

### GET `/api/admin/openai-balance`

Balance OpenAI (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "balance": {
    "available": 25.50,
    "used": 4.50,
    "total": 30.00
  }
}
```

---

### GET `/api/admin/email-templates`

Liste tous les templates email (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "templates": [
    {
      "id": "clxxx...",
      "name": "verification",
      "subject": "Vérifiez votre adresse email",
      "designJson": "{...}",
      "htmlContent": "<html>...</html>",
      "variables": "[\"userName\", \"verificationUrl\"]",
      "isActive": true,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/admin/email-templates`

Créer un nouveau template email (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "name": "welcome",
  "subject": "Bienvenue sur FitMyCV",
  "designJson": "{...}",
  "htmlContent": "<html>...</html>",
  "variables": "[\"userName\"]"
}
```

**Réponse (201)** :

```json
{
  "template": { ... }
}
```

**Erreurs** :
- `400` : name, subject ou htmlContent manquant
- `409` : Template avec ce nom existe déjà

---

### GET `/api/admin/email-templates/[id]`

Récupérer un template email spécifique (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "template": {
    "id": "clxxx...",
    "name": "verification",
    "subject": "Vérifiez votre adresse email",
    "designJson": "{...}",
    "htmlContent": "<html>...</html>",
    "variables": "[\"userName\", \"verificationUrl\"]",
    "isActive": true
  }
}
```

---

### PUT `/api/admin/email-templates/[id]`

Mettre à jour un template email (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "subject": "Nouveau sujet",
  "designJson": "{...}",
  "htmlContent": "<html>...</html>",
  "isActive": true
}
```

**Réponse (200)** :

```json
{
  "template": { ... }
}
```

---

### DELETE `/api/admin/email-templates/[id]`

Supprimer un template email (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "success": true
}
```

---

### GET `/api/admin/email-logs`

Historique des emails envoyés avec pagination (admin only).

**Auth** : Admin requise

**Query params** :

```
page: number (default: 1)
limit: number (default: 25)
template: string (optional) - Filtrer par nom de template
status: string (optional) - Filtrer par status (sent, failed)
```

**Réponse (200)** :

```json
{
  "logs": [
    {
      "id": "clxxx...",
      "templateId": "clyyy...",
      "templateName": "verification",
      "recipientEmail": "user@example.com",
      "recipientUserId": "clzzz...",
      "subject": "Vérifiez votre adresse email",
      "status": "sent",
      "error": null,
      "resendId": "abc123",
      "isTestEmail": false,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "template": {
        "name": "verification",
        "subject": "Vérifiez votre adresse email"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6
  }
}
```

---

### POST `/api/admin/email-test`

Envoyer un email de test (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "templateId": "clxxx...",
  "testEmail": "admin@example.com"
}
```

**Variables de test utilisées** :
- `{{userName}}` : "Jean Dupont (Test)"
- `{{verificationUrl}}` : URL de vérification test
- `{{resetUrl}}` : URL de reset test
- `{{newEmail}}` : "nouveau.email@test.com"

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Test email sent to admin@example.com",
  "resendId": "abc123"
}
```

**Erreurs** :
- `400` : templateId ou testEmail manquant
- `404` : Template non trouvé
- `500` : Erreur d'envoi Resend

---

### POST `/api/admin/onboarding/reset`

Réinitialiser l'onboarding d'un utilisateur (admin only).

**Auth** : Admin requise

**Body** :

```json
{
  "userId": "clxxx..."
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "user": {
    "id": "clxxx...",
    "name": "John Doe",
    "email": "user@example.com"
  },
  "message": "Onboarding réinitialisé pour user@example.com"
}
```

**Erreurs** :
- `400` : userId manquant ou invalide
- `404` : Utilisateur non trouvé

---

### GET `/api/admin/onboarding/analytics`

Récupérer les KPIs et statistiques d'onboarding (admin only).

**Auth** : Admin requise

**Query params** :

```
period: '7d' | '30d' | '90d' | 'all' (default: '30d')
```

**Réponse (200)** :

```json
{
  "period": "30d",
  "kpis": {
    "totalUsers": 150,
    "started": 120,
    "completed": 80,
    "skipped": 15,
    "inProgress": 25,
    "notStarted": 30,
    "stuckCount": 5,
    "completionRate": 66.7,
    "skipRate": 12.5,
    "avgCompletionTimeMs": 180000,
    "avgCompletionTime": "3m 00s",
    "healthScore": 75
  },
  "funnel": [
    { "step": 0, "name": "Bienvenue", "icon": "👋", "reached": 120, "completed": 115 },
    { "step": 1, "name": "Import CV", "icon": "📄", "reached": 115, "completed": 100 }
  ],
  "stepDropoff": [
    { "from": 0, "to": 1, "fromName": "Bienvenue", "toName": "Import CV", "dropoffCount": 5, "dropoffRate": 4.2 }
  ],
  "modals": {
    "step1": { "name": "Welcome Modal", "completed": 100, "total": 120, "rate": 83.3 }
  },
  "timeline": [
    { "date": "01/01", "started": 5, "completed": 3, "skipped": 1 }
  ]
}
```

---

### GET `/api/admin/onboarding/users`

Liste des utilisateurs avec leur statut d'onboarding (admin only).

**Auth** : Admin requise

**Query params** :

```
page: number (default: 1)
limit: number (default: 10, max: 50)
status: 'completed' | 'in_progress' | 'skipped' | 'not_started' | 'stuck' | 'all'
step: number (0-8) - Filtrer par étape actuelle
search: string - Recherche par nom/email
sortBy: 'newest' | 'oldest' | 'progress'
```

**Réponse (200)** :

```json
{
  "users": [
    {
      "id": "clxxx...",
      "name": "John Doe",
      "email": "user@example.com",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "status": "in_progress",
      "currentStep": 3,
      "currentStepName": "Génération CV",
      "completedSteps": [0, 1, 2],
      "modalsCompleted": 2,
      "totalModals": 6,
      "progressPercent": 37.5,
      "startedAt": "2025-01-15T10:00:00.000Z",
      "completedAt": null,
      "lastActivity": "2025-01-15T11:00:00.000Z",
      "isStuck": false,
      "stuckDays": 0
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasMore": true
  }
}
```

---

## Analytics

### GET `/api/analytics/summary`

Résumé global des analytics (admin only).

**Auth** : Admin requise

**Query params** :

```
startDate: string (ISO format)
endDate: string (ISO format)
```

**Réponse (200)** :

```json
{
  "summary": {
    "totalUsers": 150,
    "newUsers": 25,
    "totalCvs": 450,
    "cvsGenerated": 120,
    "openaiCost": 45.50,
    "avgMatchScore": 78
  }
}
```

---

### GET `/api/analytics/users`

Analytics détaillées par utilisateur (admin only).

**Auth** : Admin requise

---

### GET `/api/analytics/users/[userId]/summary`

Résumé analytics d'un utilisateur (admin only).

**Auth** : Admin requise

---

### GET `/api/analytics/features`

Analytics par feature (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "features": [
    {
      "featureName": "generate_cv",
      "usageCount": 350,
      "avgDuration": 15000,
      "successRate": 0.95
    }
  ]
}
```

---

### GET `/api/analytics/feedbacks`

Analytics des feedbacks (admin only).

**Auth** : Admin requise

---

### GET `/api/analytics/errors`

Analytics des erreurs (admin only).

**Auth** : Admin requise

---

### GET `/api/analytics/events`

Analytics des événements (admin only).

**Auth** : Admin requise

---

### GET `/api/analytics/openai-usage`

Analytics d'usage OpenAI (admin only).

**Auth** : Admin requise

**Réponse (200)** :

```json
{
  "usage": [
    {
      "date": "2025-01-15",
      "model": "gpt-5-mini-2025-08-07",
      "featureName": "generate_cv",
      "totalTokens": 125000,
      "estimatedCost": 6.25,
      "callsCount": 45
    }
  ],
  "total": {
    "tokens": 500000,
    "cost": 25.00,
    "calls": 180
  }
}
```

---

## Account

### GET `/api/account/profile`

Récupérer le profil de l'utilisateur connecté.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "user": {
    "id": "clxxx...",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": "2025-01-15T10:00:00.000Z",
    "createdAt": "2025-01-15T09:00:00.000Z"
  }
}
```

---

### PUT `/api/account/profile`

Mettre à jour le profil.

**Auth** : Requise

**Body** :

```json
{
  "name": "John Smith",
  "email": "john.smith@example.com"
}
```

**Note** : Si l'email change, un email de vérification est envoyé.

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Profil mis à jour"
}
```

---

### PUT `/api/account/password`

Changer le mot de passe.

**Auth** : Requise

**Body** :

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Mot de passe mis à jour"
}
```

---

### DELETE `/api/account/delete`

Supprimer son compte.

**Auth** : Requise

**Body** :

```json
{
  "password": "MyPassword123!",
  "confirmation": "DELETE"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Compte supprimé"
}
```

---

### GET `/api/account/linked-accounts`

Récupérer les comptes OAuth liés et les providers disponibles.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "linkedAccounts": [
    {
      "provider": "google",
      "providerAccountId": "1234567890",
      "linkedAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "availableProviders": {
    "google": true,
    "github": true,
    "apple": false
  },
  "canUnlink": {
    "google": false
  }
}
```

**Notes** :
- `availableProviders` : providers configurés côté serveur (env vars)
- `canUnlink` : `true` seulement si l'utilisateur a plus d'un provider lié

---

### POST `/api/account/link-oauth`

Initier le flow OAuth pour lier un nouveau provider au compte.

**Auth** : Requise

**reCAPTCHA** : Requise (score threshold: 0.5)

**Body** :

```json
{
  "provider": "github",
  "recaptchaToken": "..."
}
```

**Providers supportés** : `google`, `github`, `apple`

**Réponse (200)** :

```json
{
  "authUrl": "https://github.com/login/oauth/authorize?client_id=...",
  "provider": "github"
}
```

**Erreurs** :

| Code | Clé traduction | Description |
|------|----------------|-------------|
| 400 | `errors.api.auth.providerRequired` | Provider manquant |
| 400 | `errors.api.auth.providerInvalid` | Provider non supporté |
| 400 | `errors.api.auth.providerNotConfigured` | Provider non configuré (env vars) |
| 400 | `errors.api.auth.providerAlreadyLinked` | Provider déjà lié au compte |
| 403 | `errors.api.auth.recaptchaFailed` | Vérification reCAPTCHA échouée |

**Sécurité** :
- State token généré avec `crypto.randomBytes(32)`
- Expire dans 10 minutes
- Stocké dans cookie `oauth_link_state` (httpOnly, secure)

---

### DELETE `/api/account/unlink-oauth`

Supprimer un lien OAuth du compte.

**Auth** : Requise

**Body** :

```json
{
  "provider": "github"
}
```

**Réponse (200)** :

```json
{
  "ok": true,
  "provider": "github"
}
```

**Erreurs** :

| Code | Clé traduction | Description |
|------|----------------|-------------|
| 400 | `errors.api.auth.providerRequired` | Provider manquant |
| 400 | `errors.api.auth.providerInvalid` | Provider non supporté |
| 404 | `errors.api.auth.providerNotLinked` | Provider non lié au compte |
| 400 | `errors.api.auth.cannotUnlinkLastProvider` | Impossible de délier le dernier provider |
| 500 | `errors.api.account.unlinkFailed` | Erreur serveur lors de la suppression |

**Règle de protection** : On ne peut pas délier un provider si c'est le seul moyen de connexion.

---

### GET `/api/auth/callback/link/[provider]`

Callback OAuth pour compléter la liaison d'un provider.

**Auth** : Session requise (même utilisateur que l'initiation)

**Query params** (fournis par le provider) :

| Param | Description |
|-------|-------------|
| `code` | Code d'autorisation OAuth |
| `state` | State token pour validation CSRF |
| `error` | Erreur OAuth (optionnel) |

**Comportement** :
- Valide le state token depuis le cookie
- Échange le code contre un access token
- Vérifie que l'email OAuth correspond à l'email FitMyCV
- Crée le lien dans la table `Account`
- Redirige vers `/account` avec paramètres de succès/erreur

**Redirections** :

| Paramètre | Description |
|-----------|-------------|
| `linkSuccess=true` | Liaison réussie |
| `linkSuccess=already_linked` | Déjà lié (même compte) |
| `linkError=oauth_error` | Erreur OAuth du provider |
| `linkError=missing_params` | Code ou state manquant |
| `linkError=invalid_state` | State invalide (CSRF) |
| `linkError=expired` | State token expiré (>10 min) |
| `linkError=session_expired` | Session utilisateur expirée |
| `linkError=email_mismatch` | Email OAuth ≠ email FitMyCV |
| `linkError=already_linked_other` | Provider lié à un autre compte |
| `linkError=server_error` | Erreur serveur |

---

## Subscription & Billing

### GET `/api/subscription/current`

Récupérer l'abonnement actuel et les compteurs d'utilisation.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "subscription": {
    "planName": "Pro",
    "status": "active",
    "billingCycle": "monthly",
    "currentPeriodEnd": "2025-02-15T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  },
  "counters": {
    "gpt_cv_generation": { "used": 8, "limit": 20 },
    "import_pdf": { "used": 3, "limit": 10 },
    "edit_cv": { "used": 15, "limit": 50 }
  },
  "credits": {
    "balance": 5
  }
}
```

---

### GET `/api/subscription/preview-upgrade?planName={planName}`

Prévisualiser le changement de plan (calcul prorata, coût immédiat).

**Auth** : Requise

**Query params** :

```
planName: string (required) - Nom du plan cible (ex: "Pro", "Enterprise")
```

**Réponse (200)** :

```json
{
  "preview": {
    "currentPlan": "Starter",
    "targetPlan": "Pro",
    "prorataCredit": 5.50,
    "immediateCharge": 14.50,
    "newMonthlyPrice": 20.00,
    "effectiveDate": "2025-01-20T00:00:00.000Z",
    "nextBillingDate": "2025-02-15T00:00:00.000Z"
  }
}
```

**Erreurs** :
- `401` : Non authentifié
- `400` : Plan invalide ou identique au plan actuel
- `404` : Aucun abonnement actif

**Note** : Cette route permet de calculer le coût d'un upgrade/downgrade avant de le confirmer. Le prorata est calculé sur la période restante.

---

### POST `/api/subscription/change`

Changer de plan d'abonnement.

**Auth** : Requise

**Body** :

```json
{
  "planName": "Pro",
  "billingCycle": "monthly"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Abonnement mis à jour",
  "subscription": { ... }
}
```

---

### GET `/api/subscription/invoices`

Récupérer l'historique des factures (abonnements + packs de crédits).

**Auth** : Requise

**Réponse (200)** :

```json
{
  "invoices": [
    {
      "id": "in_xxx",
      "type": "subscription",
      "amount": 2000,
      "currency": "eur",
      "status": "paid",
      "date": "2025-01-15T00:00:00.000Z",
      "pdfUrl": "https://..."
    },
    {
      "id": "pi_xxx",
      "type": "credit_pack",
      "amount": 500,
      "currency": "eur",
      "status": "paid",
      "date": "2025-01-10T00:00:00.000Z",
      "creditAmount": 10
    }
  ]
}
```

---

### POST `/api/subscription/reactivate`

Réactiver un abonnement annulé (cancel_at_period_end).

**Auth** : Requise

**Réponse (200)** :

```json
{
  "success": true,
  "subscription": {
    "id": "clxxx...",
    "status": "active",
    "cancelAtPeriodEnd": false,
    "currentPeriodEnd": "2025-02-15T00:00:00.000Z"
  }
}
```

**Erreurs** :
- `400` : Aucun abonnement à réactiver
- `401` : Non authentifié

**Note** : Cette route annule la demande d'annulation et rétablit le renouvellement automatique, à la fois dans la base de données et sur Stripe.

---

### GET `/api/credits/balance`

Récupérer la balance de crédits.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "balance": 15
}
```

---

### GET `/api/credits/transactions`

Historique des transactions de crédits.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "transactions": [
    {
      "id": "cltxxx...",
      "type": "purchase",
      "amount": 10,
      "reason": "Pack 10 crédits",
      "createdAt": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "cltyyy...",
      "type": "debit",
      "amount": -1,
      "reason": "Génération CV",
      "featureName": "gpt_cv_generation",
      "createdAt": "2025-01-15T11:00:00.000Z"
    }
  ]
}
```

**Note** : Pour plus de détails sur le système d'abonnement et de crédits, consultez `docs/SUBSCRIPTION.md`.

---

## Autres routes

### POST `/api/export-pdf`

Exporter un CV en PDF.

**Auth** : Requise

**Body** :

```json
{
  "filename": "cv_1234567890.json",
  "options": {
    "sections": {
      "header": true,
      "summary": true,
      "skills": true,
      "experience": true,
      "education": true,
      "languages": true,
      "projects": true,
      "extras": true
    },
    "theme": "default"
  }
}
```

**Réponse (200)** :

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="cv_john_doe.pdf"

[Binary PDF data]
```

---

### POST `/api/feedback`

Envoyer un feedback.

**Auth** : Requise

**Body** :

```json
{
  "rating": 5,
  "comment": "Excellent outil !",
  "isBugReport": false,
  "currentCvFile": "cv_1234567890.json"
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "message": "Merci pour votre feedback !"
}
```

---

### GET `/api/feedback`

Liste des feedbacks (admin only).

**Auth** : Admin requise

---

### GET `/api/link-history`

Historique des URLs utilisées.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "history": [
    {
      "id": "clxxx...",
      "url": "https://indeed.com/job/123",
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/settings`

Settings publics (non-admin).

**Auth** : Non requise

**Réponse (200)** :

```json
{
  "settings": {
    "registration_enabled": "1",
    "maintenance_mode": "0"
  }
}
```

---

### POST `/api/recaptcha/verify`

Vérifier un token reCAPTCHA.

**Auth** : Non requise

**Body** :

```json
{
  "token": "03AGdBq..."
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "score": 0.9
}
```

---

### GET `/api/events/stream`

Server-Sent Events pour les mises à jour en temps réel.

**Auth** : Requise

**Headers** :

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Exemple d'événement** :

```
event: cv-updated
data: {"filename": "cv_1234567890.json"}

event: task-completed
data: {"taskId": "task_1234567890"}
```

---

### POST `/api/consent/log`

Logger un consentement cookie (RGPD).

**Auth** : Requise

**Body** :

```json
{
  "action": "created",
  "preferences": {
    "necessary": true,
    "functional": false,
    "analytics": true,
    "marketing": false
  }
}
```

---

### GET `/api/consent/history`

Historique des consentements.

**Auth** : Requise

---

## User Onboarding

### GET `/api/user/onboarding`

Récupérer l'état d'onboarding complet de l'utilisateur connecté.

**Auth** : Requise

**Réponse (200)** :

```json
{
  "currentStep": 3,
  "hasCompleted": false,
  "isSkipped": false,
  "completedAt": null,
  "skippedAt": null,
  "startedAt": "2025-01-15T10:00:00.000Z",
  "onboardingState": {
    "currentStep": 3,
    "hasCompleted": false,
    "isSkipped": false,
    "completedSteps": [0, 1, 2],
    "modals": {
      "step1": { "completed": true, "completedAt": "..." },
      "step2": { "completed": true, "completedAt": "..." }
    },
    "timestamps": {
      "startedAt": "2025-01-15T10:00:00.000Z",
      "lastStepChangeAt": "2025-01-15T10:30:00.000Z"
    }
  }
}
```

---

### PUT `/api/user/onboarding`

Mettre à jour l'étape en cours.

**Auth** : Requise

**Body** :

```json
{
  "step": 4
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "currentStep": 4,
  "hasCompleted": false
}
```

**Erreurs** :
- `400` : Step invalide (0-8)
- `409` : Client désynchronisé (step inférieur à celui en base)

**Note** : Cette route inclut une protection anti-régression multi-device. Si le client tente de régresser à un step inférieur, une erreur 409 est retournée avec le step actuel côté serveur.

---

### PATCH `/api/user/onboarding`

Mettre à jour l'état d'onboarding complet (onboardingState).

**Auth** : Requise

**Body** :

```json
{
  "onboardingState": {
    "currentStep": 4,
    "completedSteps": [0, 1, 2, 3],
    "modals": {
      "step1": { "completed": true, "completedAt": "..." }
    }
  }
}
```

**Réponse (200)** :

```json
{
  "success": true,
  "onboardingState": { ... }
}
```

**Note** : Utilise un cache in-memory avec TTL de 1000ms pour éviter les écritures DB multiples lors de mises à jour rapides. Synchronise via SSE pour les autres devices.

---

### POST `/api/user/onboarding?action={action}`

Actions sur l'onboarding.

**Auth** : Requise

**Query params** :

```
action: 'complete' | 'skip' | 'reset'
```

**Actions** :

| Action | Description |
|--------|-------------|
| `complete` | Marquer l'onboarding comme complété |
| `skip` | Marquer l'onboarding comme ignoré (skip ≠ complete) |
| `reset` | Réinitialiser l'onboarding à l'état initial |

**Réponse (complete)** :

```json
{
  "success": true,
  "completedAt": "2025-01-15T12:00:00.000Z"
}
```

**Réponse (skip)** :

```json
{
  "success": true,
  "skippedAt": "2025-01-15T12:00:00.000Z"
}
```

**Réponse (reset)** :

```json
{
  "success": true,
  "message": "Onboarding réinitialisé",
  "onboardingState": { ... }
}
```

**Erreurs** :
- `400` : Action invalide

---

### POST `/api/user/onboarding/subscribe`

Souscrire aux mises à jour SSE de l'onboarding.

**Auth** : Requise

**Note** : Cette route est utilisée pour la synchronisation temps réel multi-device via Server-Sent Events.

---

### POST `/api/telemetry/track`

Tracker un événement télémétrie.

**Auth** : Requise

**Body** :

```json
{
  "type": "CV_VIEWED",
  "category": "navigation",
  "metadata": {
    "filename": "cv_1234567890.json"
  },
  "deviceId": "device_uuid"
}
```

---

### POST `/api/telemetry/first-import-duration`

Logger la durée du premier import (onboarding).

**Auth** : Requise

**Body** :

```json
{
  "duration": 45000
}
```

---

## Codes d'erreur

| Code | Signification | Description |
|------|--------------|-------------|
| **200** | OK | Requête réussie |
| **201** | Created | Ressource créée |
| **400** | Bad Request | Paramètres invalides |
| **401** | Unauthorized | Authentication requise |
| **403** | Forbidden | Accès refusé (permissions insuffisantes) |
| **404** | Not Found | Ressource non trouvée |
| **409** | Conflict | Conflit (ex: email déjà utilisé) |
| **429** | Too Many Requests | Rate limit dépassé |
| **500** | Internal Server Error | Erreur serveur |
| **503** | Service Unavailable | Service temporairement indisponible |

---

**Documentation complète de l'API FitMyCV.io** | 96 endpoints documentés
