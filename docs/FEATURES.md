# Fonctionnalités - FitMyCV.io

Guide complet des fonctionnalités de FitMyCV.io.

---

## Table des matières

- [🤖 Génération de CV par IA](#-génération-de-cv-par-ia)
- [📥 Import de CV](#-import-de-cv)
- [🌍 Traduction de CV](#-traduction-de-cv)
- [🎯 Score de match](#-score-de-match)
- [✨ Optimisation](#-optimisation)
- [📜 Historique de modifications](#-historique-de-modifications)
- [💼 Génération de CV fictif (Modèle)](#-génération-de-cv-fictif-modèle)
- [💾 Export de CV](#-export-de-cv)
- [✏️ Edition de CV](#️-edition-de-cv)
- [📝 Création de CV](#-création-de-cv)
- [Système de tâches background](#système-de-tâches-background)
- [Authentification multi-provider](#authentification-multi-provider)
- [🔗 Liaison de comptes OAuth](#-liaison-de-comptes-oauth)
- [ℹ️ Page À propos](#️-page-à-propos)

---

## 🤖 Génération de CV par IA

### Description

Génère un CV personnalisé et optimisé ATS **à partir d'un CV existant** (importé ou créé manuellement) et d'une ou plusieurs offres d'emploi.

**Principe clé** : L'IA **n'invente jamais** de compétences ni d'expériences. Elle :
- Filtre et met en avant les éléments pertinents du CV source
- Enrichit et reformule les expériences pour correspondre à l'offre
- Détermine les livrables clés et compétences depuis l'expérience existante
- Analyse les formations/certifications et projets personnels pour identifier les compétences
- Détecte les compétences manquantes et évalue le niveau de chacune

### Types de génération

#### 1. À partir d'un CV existant + offre(s) d'emploi

L'utilisateur sélectionne un CV source puis fournit une ou plusieurs offres d'emploi (URL ou PDF).

**Multi-offres** : Si plusieurs offres sont fournies, **un CV distinct est généré pour chaque offre**.

**Analyse de l'offre** :
- Compétences requises (techniques et soft skills)
- Vocabulaire spécifique au poste/secteur
- Contexte de l'offre (entreprise, mission, environnement)
- Mots-clés ATS à intégrer

**Adaptation du CV** :
- Filtrage des éléments non pertinents
- Reformulation des expériences avec le vocabulaire de l'offre
- Mise en avant des livrables clés correspondants
- Ajout de métriques quantifiables si disponibles

#### 2. CV Modèle (fictif) depuis une offre

Génère un CV **fictif mais réaliste** qui correspondrait parfaitement à l'offre d'emploi.

**Usage** : Donner des idées à l'utilisateur pour composer son propre CV. L'utilisateur peut ensuite s'en inspirer pour adapter son vrai profil.

### Processus technique

```
1. Utilisateur fournit URL(s) offre(s) → Indeed, LinkedIn, etc. (ou PDF)
2. Extraction du contenu (Puppeteer Stealth mode)
3. Parsing HTML → Extraction titre, description, compétences
4. Chargement CV source de l'utilisateur (ou template pour CV modèle)
5. Appel OpenAI avec prompt optimisé
6. Génération CV JSON personnalisé (1 CV par offre)
7. Validation AJV contre schema.json
8. Chiffrement AES-256-GCM
9. Sauvegarde dans data/users/{userId}/cvs/
10. Métadonnées enregistrées dans CvFile (avec relation vers JobOffer)
```

### Modèle IA

Le modèle OpenAI utilisé pour la génération de CV est configurable via l'interface admin (Settings → AI Models → `model_cv_generation`). Le modèle recommandé est `gpt-4.1-2025-04-14` qui offre un bon équilibre entre qualité et coût.

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
- Extraction sauvegardée dans la table `JobOffer` (relation via `CvFile.jobOfferId`)
- Évite de re-scraper pour match score / optimisation
- Économie de coûts et de temps

### API

```javascript
// POST /api/background-tasks/generate-cv
{
  "url": "https://indeed.com/job/123",
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/generateCvJob.js`
**Fonction IA** : `lib/openai/generateCv.js`
**Prompts** : `lib/openai/prompts/generate-cv/`

---

## 📥 Import de CV

### Description

Convertit un CV existant en JSON structuré et **optimisé ATS**. L'IA adapte n'importe quelle forme de CV en une structure unifiée et standard, parfaitement interprétable par les logiciels de sélection automatique (ATS).

### Formats supportés

- **PDF** (actuellement supporté)
  - PDF texte (natif)
  - PDF scanné (OCR limité, dépend de pdf2json)
- **DOCX** (prévu dans une future version)

### Processus

```
1. Upload fichier (Base64)
2. Parsing avec pdf2json (PDF)
3. Extraction texte brut
4. Appel OpenAI pour structuration ATS
5. Parsing JSON (header, summary, skills, experience, etc.)
6. Validation AJV
7. Sauvegarde chiffrée
8. Métadonnées CvFile avec createdBy: 'import-pdf'
```

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
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/importPdfJob.js`
**Fonction IA** : `lib/openai/importPdf.js`

---

## 🌍 Traduction de CV

### Description

Traduit un CV existant vers une autre langue.

### Langues supportées

- **Français (fr)**
- **English (en)**
- **Español (es)**
- **Deutsch (de)**

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

## 🎯 Score de match

### Description

Calcule un score de correspondance (0-100) entre un CV et une offre d'emploi, avec analyse détaillée.

### Prérequis

- Le CV doit être lié à une `JobOffer` en base de données (via `CvFile.jobOfferId`, stockée lors de la génération/création)
- Le calcul utilise l'offre extraite en cache (table `JobOffer`), **pas de re-scraping de l'URL**

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

## ✨ Optimisation

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

## 📜 Historique de modifications

### Description

Permet de visualiser les modifications apportées à un CV par la fonction **Optimiser**.

### Fonctionnement

L'historique est **uniquement lié à la fonction "Optimiser"**. Il permet de :
- Voir chaque modification appliquée par l'IA
- Comprendre la justification de chaque changement
- Identifier les améliorations apportées (métriques, mots-clés ATS, reformulations)

### Affichage

Le panneau d'historique montre :
- Les modifications avant/après
- La raison de chaque modification (basée sur les suggestions du match score)
- La date de l'optimisation

**Note** : L'historique ne concerne que les modifications automatiques de l'IA via la fonction Optimiser, pas les éditions manuelles de l'utilisateur.

---

## 💼 Génération de CV fictif (Modèle)

### Description

Génère un CV **fictif mais réaliste** pour aider l'utilisateur à comprendre ce qui est attendu pour un poste donné. Ce CV sert de **modèle d'inspiration** que l'utilisateur peut ensuite adapter à son propre profil.

### Deux modes de génération

#### 1. CV Modèle depuis une offre d'emploi

Génère un CV fictif qui correspondrait **parfaitement** à une offre d'emploi spécifique.

**Usage** : L'utilisateur peut créer ce CV modèle, puis s'en inspirer pour composer son propre CV adapté à l'offre. Chaque CV est entièrement éditable.

#### 2. CV depuis un titre de poste (barre de recherche)

L'utilisateur tape n'importe quel titre de poste et l'IA génère un modèle fictif réaliste.

**Usage** : Exploration de nouvelles carrières, découverte des compétences requises pour un poste.

### Processus

```
1. Utilisateur saisit un titre de poste (ex: "Développeur Full Stack") OU fournit une offre
2. Appel OpenAI pour générer un CV adapté
3. Génération d'un profil fictif mais crédible
4. Validation du JSON généré
5. Chiffrement et sauvegarde
6. Métadonnées avec createdBy: 'generate-from-job-title' ou 'create-template-cv'
```

### Use cases

- **Exploration de carrière** : Découvrir les compétences requises pour un poste
- **Inspiration** : Comprendre comment structurer un CV pour une offre spécifique
- **Préparation d'entretien** : Comprendre les attentes d'un rôle
- **Tests et prototypage** : Créer rapidement des CV de test

### API

```javascript
// POST /api/background-tasks/generate-cv-from-job-title
{
  "jobTitle": "Développeur Full Stack",
  "deviceId": "device_uuid"
}
```

### Code

**Job** : `lib/backgroundTasks/generateCvFromJobTitleJob.js`
**Fonction IA** : `lib/openai/generateCvFromJobTitle.js`

---

## 💾 Export de CV

### Description

Exporte un CV au format PDF professionnel, **optimisé ATS** (sans photo, format standard lisible par les outils d'analyse RH).

L'utilisateur peut **customiser précisément** ce qu'il souhaite exporter.

### Customisation de l'export

**Sections au choix** (activer/désactiver chacune) :

- ✅ Header (nom, contact)
- ✅ Summary (résumé professionnel)
- ✅ Skills (compétences techniques et soft skills)
- ✅ Experience (expériences professionnelles)
  - Option : avec ou sans **livrables clés** (achievements)
- ✅ Education (formation, certifications)
- ✅ Languages (langues maîtrisées)
- ✅ Projects (projets personnels)
- ✅ Extras (informations complémentaires)

**Niveau de détail par section** :

- Expériences : afficher ou masquer les livrables clés individuellement
- Compétences : afficher par catégories ou liste simple

**Thèmes** :

- Default (bleu professionnel)
- Modern (design épuré)
- Classic (traditionnel)

### Caractéristiques ATS

- **Sans photo** : conformité ATS stricte
- **Format standard** : lisible par tous les logiciels de recrutement
- **Structure claire** : hiérarchie respectée, mots-clés visibles

### Processus

```
1. Sélection des sections à inclure
2. Personnalisation du niveau de détail (livrables clés, etc.)
3. Choix du thème
4. Génération HTML du CV
5. Puppeteer → Rendu PDF
6. Download automatique
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

## ✏️ Edition de CV

### Description

Mode édition pour modifier manuellement un CV existant.

### Fonctionnalités

**Édition de sections** :

- ✅ Header (nom, titre, contact)
- ✅ Summary (résumé professionnel)
- ✅ Skills (compétences techniques, soft skills, outils)
- ✅ Experience (expériences professionnelles)
- ✅ Education (formation)
- ✅ Languages (langues)
- ✅ Projects (projets)
- ✅ Extras (informations complémentaires)

**Options** :

- Édition en temps réel
- Validation automatique des champs
- Auto-sauvegarde (toutes les 2 secondes)
- Annulation/Rétablissement (Ctrl+Z / Ctrl+Y)
- Prévisualisation en direct

### UI

**Mode édition** :

- Bouton "✏️ Éditer" dans TopBar
- Champs de formulaire pour chaque section
- Toggle entre mode vue et mode édition
- Bouton "Sauvegarder" (sauvegarde immédiate)
- Bouton "Annuler" (restaure version précédente)

**Validation** :

- Email valide (regex)
- Téléphone valide (format international)
- Dates cohérentes (début < fin)
- Champs requis (nom, titre)

### Système de facturation (feature: edit_cv)

**Macro-feature d'abonnement** : Chaque session d'édition consomme 1 usage de la feature `edit_cv`.

#### Workflow de session d'édition

```
1. Clic sur "Mode édition"
   → Vérification préalable via GET /api/cv/can-edit
   → Si limite atteinte + pas de crédits : redirection vers /account/subscriptions
   → Si autorisé : activation du mode édition (aucun débit)

2. Première modification dans la session
   → Débit automatique via POST /api/cv/debit-edit
   → Débite 1 compteur d'abonnement OU 1 crédit (selon limite)
   → Flag hasDebitedEditSession = true (bloque débits suivants)

3. Modifications suivantes
   → Gratuites (même session d'édition)

4. Sortie du mode édition
   → Reset du flag hasDebitedEditSession
```

#### Règles de facturation

- **1 session d'édition = 1 usage** de `edit_cv` (peu importe le nombre de modifications)
- Le débit se fait à la **première modification effective**, pas à l'activation du mode
- Les utilisateurs peuvent activer le mode édition sans consommer de crédit (pour consulter)

#### Composants clés

- **AdminProvider** : Gère les states `editing` et `hasDebitedEditSession`, vérifie limites avant activation
- **useMutate** : Débite UNE SEULE FOIS par session à la première modification réussie

### API

```javascript
// Vérifier si l'utilisateur peut éditer (sans débiter)
GET /api/cv/can-edit?filename=cv_1234567890.json

// Débiter 1 usage edit_cv (une fois par session)
POST /api/cv/debit-edit
{
  "filename": "cv_1234567890.json"
}

// Sauvegarder les modifications (mutations)
POST /api/admin/mutate
{
  "filename": "cv_1234567890.json",
  "path": "header.name",
  "value": "John Doe"
}
```

### Code

**Routes API** :
- `app/api/cv/can-edit/route.js` - Vérification sans débit
- `app/api/cv/debit-edit/route.js` - Débit unique par session
- `app/api/admin/mutate/route.js` - Mutations du CV

**Composants** :
- `contexts/AdminProvider.jsx` - Gestion session d'édition
- `hooks/useMutate.js` - Logique de débit à la première modification

**Validation** : `lib/cv/validation.js`

---

## 📝 Création de CV

### Description

Crée un nouveau CV vierge manuellement, section par section.

### Processus

```
1. Utilisateur clique sur "Nouveau CV" (bouton +)
2. Formulaire de création étape par étape
3. Saisie manuelle de toutes les sections
4. Validation en temps réel
5. Génération du JSON
6. Chiffrement et sauvegarde
7. Métadonnées avec createdBy: 'create-manual-cv'
```

### Étapes de création

**Étape 1 - Informations personnelles** :

- Nom complet
- Titre professionnel
- Email, téléphone
- Adresse (optionnel)
- LinkedIn, GitHub, portfolio (optionnels)

**Étape 2 - Résumé professionnel** :

- Description courte (2-3 phrases)
- Domaines d'expertise

**Étape 3 - Compétences** :

- Hard skills (techniques)
- Soft skills (comportementales)
- Outils et technologies
- Méthodologies

**Étape 4 - Expériences** :

- Postes occupés
- Entreprises
- Dates (début - fin)
- Responsabilités
- Réalisations

**Étape 5 - Formation** :

- Diplômes
- Établissements
- Dates
- Spécialisations

**Étape 6 - Langues, Projets, Extras** (optionnels)

### UI

**Wizard multi-étapes** :

- Navigation étape par étape
- Barre de progression
- Boutons "Précédent" / "Suivant"
- Bouton "Sauvegarder le brouillon"
- Validation à chaque étape

**Preview en temps réel** :

- Aperçu du CV pendant la saisie
- Toggle entre formulaire et preview

### Système de facturation (feature: create_cv_manual)

**Macro-feature d'abonnement** : Chaque création manuelle de CV consomme 1 usage de la feature `create_cv_manual`.

#### Workflow de création

```
1. Utilisateur clique sur "Nouveau CV"
   → Vérification automatique via checkFeatureLimit('create_cv_manual')
   → Si limite atteinte + pas de crédits : affichage erreur + proposition upgrade
   → Si autorisé : ouverture du wizard de création

2. Remplissage du formulaire
   → Aucun débit pendant la saisie
   → Sauvegarde brouillon possible (gratuite)

3. Soumission finale
   → Débit 1 compteur d'abonnement OU 1 crédit (selon limite)
   → Création du CV chiffré
   → Enregistrement métadonnées avec createdBy: 'create-manual-cv'
```

#### Règles de facturation

- **1 CV créé manuellement = 1 usage** de `create_cv_manual`
- Le débit se fait uniquement à la **soumission finale**, pas pendant la saisie
- Les brouillons n'entraînent pas de débit

### API

```javascript
// POST /api/cv/create-manual
{
  "cvData": { /* CV JSON complet */ }
}

// Vérification des limites effectuée automatiquement dans la route
```

### Code

**Route** : `app/api/cv/create-manual/route.js`
**Composant** : `components/CreateCvWizard.jsx`
**Vérification limites** : `lib/subscription/featureUsage.js`

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

## 🔗 Liaison de comptes OAuth

### Description

Permet aux utilisateurs de lier plusieurs providers OAuth à leur compte existant. Un utilisateur peut ainsi se connecter via Google, GitHub ou Apple tout en conservant le même compte FitMyCV.

### Fonctionnalités

**Liaison de nouveaux providers** :

- Ajouter Google, GitHub ou Apple à un compte existant
- L'email OAuth doit correspondre à l'email du compte FitMyCV
- Protection reCAPTCHA v3 lors de l'initiation

**Déliaison de providers** :

- Supprimer un provider lié au compte
- **Règle de protection** : Impossible de délier si c'est le dernier moyen de connexion
- Un utilisateur doit toujours avoir au moins un moyen de se connecter

**Affichage des comptes liés** :

- Liste des providers actuellement liés
- Providers disponibles (configurés côté serveur)
- Indicateur de possibilité de déliaison

### Sécurité

| Mesure | Description |
|--------|-------------|
| **State token** | Généré avec `crypto.randomBytes(32)` |
| **Expiration** | 10 minutes maximum |
| **Stockage** | Cookie `oauth_link_state` (httpOnly, secure) |
| **CSRF** | Validation du state token au callback |
| **Email matching** | L'email OAuth doit correspondre à l'email FitMyCV |
| **Protection déliaison** | Minimum 1 provider lié obligatoire |

### Processus technique

```
1. Utilisateur clique "Lier Google/GitHub/Apple"
2. Vérification reCAPTCHA v3
3. Génération state token (exp: 10 min)
4. Stockage state dans cookie httpOnly
5. Redirection vers OAuth provider
6. Provider redirige vers /api/auth/callback/link/[provider]
7. Validation state token depuis cookie
8. Échange code → access token
9. Récupération profil OAuth (id, email)
10. Vérification email matching
11. Création lien dans table Account
12. Redirection vers /account avec succès/erreur
```

### Interface utilisateur

**Composant** : `components/account/LinkedAccountsSection.jsx`

**Affichage** :
- Providers liés avec icône et email associé
- Bouton "Lier" pour chaque provider disponible non lié
- Bouton "Délier" (désactivé si dernier provider)
- Messages de succès/erreur après les opérations

### API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/account/linked-accounts` | GET | Liste des comptes liés |
| `/api/account/link-oauth` | POST | Initier liaison OAuth |
| `/api/account/unlink-oauth` | DELETE | Délier un provider |
| `/api/auth/callback/link/[provider]` | GET | Callback OAuth |

### Code

**Routes API** : `app/api/account/link-oauth/`, `unlink-oauth/`, `linked-accounts/`
**Callback** : `app/api/auth/callback/link/[provider]/route.js`
**UI** : `components/account/LinkedAccountsSection.jsx`

---

## ℹ️ Page À propos

### Description

Page d'information sur FitMyCV, son objectif, ses fonctionnalités principales et l'équipe.

### Fonctionnalités

- **Contenu multilingue** : Disponible en français, anglais, espagnol et allemand
- **Design glassmorphism** : Cohérent avec le reste de l'application
- **Sections** : Mission, fonctionnalités clés, technologies utilisées

### Structure des fichiers

| Fichier | Description |
|---------|-------------|
| `app/about/page.jsx` | Page principale |
| `lib/about/fr.jsx` | Contenu français |
| `lib/about/en.jsx` | Contenu anglais |
| `lib/about/es.jsx` | Contenu espagnol |
| `lib/about/de.jsx` | Contenu allemand |

### Accès

**URL** : `/about`

La page est accessible publiquement (pas de session requise).

---

**11 fonctionnalités majeures** | Powered by OpenAI & Puppeteer
