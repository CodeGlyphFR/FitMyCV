# Fonctionnalités - FitMyCv.ai

Guide complet des fonctionnalités de FitMyCv.ai.

---

## Table des matières

- [Génération de CV par IA](#génération-de-cv-par-ia)
- [Import PDF](#import-pdf)
- [Traduction de CV](#traduction-de-cv)
- [Match Score](#match-score)
- [Optimisation de CV](#optimisation-de-cv)
- [Export PDF](#export-pdf)
- [Système de tâches background](#système-de-tâches-background)
- [Authentification multi-provider](#authentification-multi-provider)

---

## Génération de CV par IA

### Description

Génère automatiquement un CV personnalisé à partir d'une offre d'emploi (URL ou PDF).

### Processus

```
1. Utilisateur fournit URL offre → Indeed, LinkedIn, etc.
2. Extraction du contenu (Puppeteer Stealth mode)
3. Parsing HTML → Extraction titre, description, compétences
4. Chargement CV de référence de l'utilisateur
5. Appel OpenAI avec prompt optimisé
6. Génération CV JSON personnalisé
7. Validation AJV contre schema.json
8. Chiffrement AES-256-GCM
9. Sauvegarde dans data/users/{userId}/cvs/
10. Métadonnées enregistrées dans CvFile
```

### Niveaux d'analyse

| Niveau | Modèle | Coût estimé | Contexte | Usage |
|--------|--------|-------------|----------|-------|
| **Rapid** | gpt-5-nano-2025-08-07 | ~0.01$ | 8K tokens | Tests rapides |
| **Medium** | gpt-5-mini-2025-08-07 | ~0.05$ | 16K tokens | Usage quotidien |
| **Deep** | gpt-5-2025-08-07 | ~0.20$ | 32K tokens | Candidatures importantes |

### Extraction web optimisée

**Puppeteer Stealth** :
- Contourne les blocages anti-bot (Indeed, etc.)
- User agent réaliste
- Headers HTTP optimisés
- Détection automatique du titre d'offre (patterns H/F)

**Optimisation HTML** :
- Suppression des balises inutiles (script, style, nav)
- Réduction du contexte envoyé à OpenAI
- Focus sur le contenu de l'offre

**Cache** :
- Extraction sauvegardée dans `CvFile.extractedJobOffer`
- Évite de re-scraper pour match score / optimisation
- Économie de coûts et de temps

### API

```javascript
// POST /api/background-tasks/generate-cv
{
  "url": "https://indeed.com/job/123",
  "analysisLevel": "medium",
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/generateCvJob.js`
**Fonction IA** : `lib/openai/generateCv.js`
**Prompts** : `lib/openai/prompts/generate-cv/`

---

## Import PDF

### Description

Convertit un CV PDF en JSON structuré utilisable par l'application.

### Processus

```
1. Upload PDF (Base64)
2. Parsing avec pdf2json
3. Extraction texte brut
4. Appel OpenAI pour structuration
5. Parsing JSON (header, summary, skills, experience, etc.)
6. Validation AJV
7. Sauvegarde chiffrée
8. Métadonnées CvFile avec createdBy: 'import-pdf'
```

### Formats supportés

- PDF texte (natif)
- PDF scanné (OCR limité, dépend de pdf2json)

### Limitations

- Taille max : 5 MB
- Pages max : 10 pages
- Format : Majoritairement texte (pas d'images complexes)

### API

```javascript
// POST /api/background-tasks/import-pdf
{
  "pdfBase64": "JVBERi0xLjQKJ...",
  "filename": "mon_cv.pdf",
  "analysisLevel": "medium",
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/importPdfJob.js`
**Fonction IA** : `lib/openai/importPdf.js`

---

## Traduction de CV

### Description

Traduit un CV existant vers une autre langue.

### Langues supportées

- Français (fr)
- English (en)
- Español (es)
- Deutsch (de)
- Italiano (it)
- Português (pt)

### Processus

```
1. Chargement CV source
2. Détection langue source (auto)
3. Appel OpenAI pour traduction
4. Préservation de la structure JSON
5. Traduction de tous les champs texte
6. Validation
7. Sauvegarde avec isTranslated: true
8. Métadonnées originalCreatedBy préservées (pour icône)
```

### API

```javascript
// POST /api/background-tasks/translate-cv
{
  "filename": "cv_1234567890.json",
  "targetLanguage": "en",
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/translateCvJob.js`
**Fonction IA** : `lib/openai/translateCv.js`

---

## Match Score

### Description

Calcule un score de correspondance (0-100) entre un CV et une offre d'emploi, avec analyse détaillée.

### Calcul du score

**Critères** :

1. **Compétences techniques** (35 points max)
   - Compétences requises présentes
   - Niveau de maîtrise

2. **Expérience** (25 points max)
   - Années d'expérience
   - Domaines pertinents
   - Responsabilités similaires

3. **Formation** (15 points max)
   - Diplômes requis
   - Spécialisation

4. **Projets** (15 points max)
   - Projets similaires
   - Technologies utilisées

5. **Soft skills** (10 points max)
   - Compétences comportementales
   - Leadership, communication, etc.

### Analyse détaillée

**Score Breakdown** :

```json
{
  "technical_skills": 28,
  "experience": 22,
  "education": 15,
  "projects": 12,
  "soft_skills": 8
}
```

**Suggestions d'amélioration** :

```json
[
  {
    "priority": "high",
    "suggestion": "Ajouter plus de métriques quantifiables dans les réalisations",
    "impact": "+8"
  },
  {
    "priority": "medium",
    "suggestion": "Détailler davantage les projets personnels",
    "impact": "+5"
  }
]
```

**Compétences** :

```json
{
  "missingSkills": ["Kubernetes", "TypeScript", "CI/CD"],
  "matchingSkills": ["React", "Node.js", "Docker", "Git", "Agile"]
}
```

### API

```javascript
// POST /api/background-tasks/calculate-match-score
{
  "filename": "cv_1234567890.json",
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/calculateMatchScoreJob.js`
**Fonction IA** : `lib/openai/calculateMatchScoreWithAnalysis.js`

---

## Optimisation de CV

### Description

Améliore automatiquement un CV basé sur les suggestions du match score.

### Prérequis

- Match score calculé (`matchScoreStatus === 'idle'`)
- Suggestions disponibles

### Processus

```
1. Vérification prérequis
2. Mise à jour optimiseStatus → 'inprogress'
3. Chargement CV + suggestions
4. Appel OpenAI avec prompt d'amélioration
5. Génération CV optimisé
6. Validation
7. Remplacement du CV existant (chiffré)
8. Mise à jour optimiseStatus → 'idle'
9. Rechargement automatique de la page
```

### Améliorations appliquées

- **Métriques quantifiables** : Ajout de chiffres, pourcentages, résultats
- **Mots-clés ATS** : Optimisation pour les systèmes de tracking
- **Structure** : Réorganisation des sections
- **Compétences manquantes** : Mise en avant des compétences acquises
- **Clarté** : Reformulation des descriptions

### UI

**Bouton "Optimiser"** :

- Visible uniquement si suggestions disponibles
- Grisé si match score en cours (`matchScoreStatus === 'inprogress'`)
- Grisé si optimisation en cours (`optimiseStatus === 'inprogress'`)
- Rechargement automatique après optimisation

### API

```javascript
// POST /api/cv/improve
{
  "filename": "cv_1234567890.json"
}
```

### Code

**Fonction IA** : `lib/openai/improveCv.js`

---

## Export PDF

### Description

Exporte un CV au format PDF professionnel avec options personnalisables.

### Options d'export

**Sections** :

- ✅ Header (nom, contact)
- ✅ Summary (résumé)
- ✅ Skills (compétences)
- ✅ Experience (expériences)
- ✅ Education (formation)
- ✅ Languages (langues)
- ✅ Projects (projets)
- ✅ Extras (informations complémentaires)

**Thèmes** :

- Default (bleu professionnel)
- Modern (design épuré)
- Classic (traditionnel)

### Processus

```
1. Sélection des sections à inclure
2. Choix du thème
3. Génération HTML du CV
4. Puppeteer → Rendu PDF
5. Download automatique
```

### Format

- **Format** : A4 (210mm × 297mm)
- **Marges** : 10mm
- **Police** : Inter (professionnelle)
- **Taille** : ~100-500 KB

### API

```javascript
// POST /api/export-pdf
{
  "filename": "cv_1234567890.json",
  "options": {
    "sections": {
      "header": true,
      "summary": true,
      "skills": true,
      // ...
    },
    "theme": "default"
  }
}
```

### Code

**Route** : `app/api/export-pdf/route.js`

---

## Système de tâches background

### Description

Queue de jobs pour gérer les opérations longues de manière asynchrone.

### Architecture

**Job Queue** (`lib/backgroundTasks/jobQueue.js`) :

- File FIFO (First In First Out)
- Max 3 jobs concurrents (`MAX_CONCURRENT_JOBS`)
- Évite la surcharge serveur

**Registre de processus** (`lib/backgroundTasks/processRegistry.js`) :

- Tracking des jobs en cours
- Nettoyage des jobs orphelins au démarrage

### Types de tâches

| Type | Description | Durée moyenne |
|------|-------------|---------------|
| `generate-cv` | Génération depuis offre | 10-30s |
| `import-pdf` | Import PDF → JSON | 5-15s |
| `translate-cv` | Traduction | 5-10s |
| `create-template-cv` | Template vide | 2-5s |
| `generate-cv-from-job-title` | Génération depuis titre | 10-20s |
| `calculate-match-score` | Calcul score | 5-15s |

### États des tâches

```
queued → running → completed
                → failed
                → cancelled
```

### Synchronisation client

**Polling** :

```javascript
// Toutes les 2 secondes
GET /api/background-tasks/sync?deviceId={deviceId}
```

**Server-Sent Events (SSE)** (optionnel) :

```javascript
// GET /api/events/stream
event: task-updated
data: {"taskId": "task_123", "status": "completed"}
```

### UI

**Mobile** : `TaskQueueModal.jsx`

- Modal plein écran
- Liste des tâches
- Progress bars
- Auto-refresh

**Desktop** : `TaskQueueDropdown.jsx`

- Dropdown dans TopBar
- Badge avec nombre de tâches actives
- Notifications desktop

### Code

**Queue** : `lib/backgroundTasks/jobQueue.js`
**Jobs** : `lib/backgroundTasks/*Job.js`
**Sync API** : `app/api/background-tasks/sync/route.js`

---

## Authentification multi-provider

### Providers supportés

1. **Credentials** (Email/Mot de passe)
   - Inscription classique
   - Vérification email obligatoire
   - Politique de mot de passe stricte

2. **Google OAuth**
   - Sign in with Google
   - Email auto-vérifié

3. **GitHub OAuth**
   - Sign in with GitHub
   - Email auto-vérifié

4. **Apple Sign In**
   - Sign in with Apple
   - Configuration avancée (Team ID, Key ID, Private Key)

### Fonctionnalités auth

**Inscription** :

- Validation email/mot de passe
- reCAPTCHA v3 (anti-spam)
- Email de vérification envoyé
- Tokens temporaires

**Connexion** :

- Session JWT (7 jours)
- Cookie sécurisé (httpOnly, secure en prod)
- Refresh automatique (24h)

**Vérification email** :

- Token unique (expire après 24h)
- Auto sign-in après vérification
- Resend email possible

**Reset mot de passe** :

- Token unique (expire après 1h)
- Email avec lien de reset
- Politique de mot de passe appliquée

**Changement email** :

- Vérification de la nouvelle adresse
- Token temporaire
- Ancien email notifié

### Sécurité

- **Password hashing** : bcrypt (10 rounds)
- **Session** : JWT avec secret
- **CSRF** : Protection NextAuth intégrée
- **Rate limiting** : 10 req/min pour signin, 5 req/min pour register
- **Email verification** : Obligatoire (middleware)

### Configuration

```bash
# .env.local
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3001"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# GitHub OAuth
GITHUB_ID="..."
GITHUB_SECRET="..."

# Apple Sign In (optionnel)
APPLE_CLIENT_ID="..."
APPLE_CLIENT_SECRET="..."
APPLE_TEAM_ID="..."
APPLE_KEY_ID="..."
APPLE_PRIVATE_KEY="..."
```

### Code

**Auth options** : `lib/auth/options.js`
**Session** : `lib/auth/session.js`
**Auto sign-in** : `lib/auth/autoSignIn.js`

---

**8 fonctionnalités majeures** | Powered by OpenAI & Puppeteer
