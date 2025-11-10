# Référence API - FitMyCv.ai

Documentation complète des 75+ routes API de FitMyCv.ai.

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
- [Autres routes](#autres-routes)
- [Codes d'erreur](#codes-derreur)

---

## Vue d'ensemble

### Base URL

```
Développement: http://localhost:3001/api
Production: https://fitmycv.ai/api
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

**Erreur** :

```json
{
  "error": "Message d'erreur",
  "details": "Détails supplémentaires"
}
```

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

### DELETE `/api/cvs/delete`

Supprimer un CV.

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
  "message": "CV supprimé"
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

**Documentation complète de l'API FitMyCv.ai** | 75+ endpoints documentés
