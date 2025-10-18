# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Next.js
```bash
npm run dev              # Démarre le serveur de développement
npm run build            # Build de production
npm start                # Démarre le serveur de production
```

### Prisma
```bash
npx prisma migrate deploy    # Applique les migrations (DATABASE_URL depuis .env.local)
npx prisma migrate dev       # Créer une migration en dev
npx prisma studio            # Interface graphique pour la base de données
npx prisma generate          # Génère le client Prisma
```

**IMPORTANT - Base de données** :
- La base SQLite est dans `prisma/dev.db`
- Le chemin dans `.env.local` est `DATABASE_URL="file:./dev.db"` (relatif au dossier `prisma/`)
- **NE JAMAIS** modifier ce chemin en `file:./prisma/dev.db` car Prisma lit depuis le dossier `prisma/`

## Architecture

### Vue d'ensemble
Application Next.js 14 (App Router) pour créer des CV personnalisés par offre d'emploi avec IA.
- **Frontend**: React 18 + Tailwind CSS
- **Backend**: Next.js API Routes + NextAuth
- **Database**: Prisma + SQLite (par défaut)
- **IA**: OpenAI API pour génération et optimisation ATS des CV
- **Sécurité**: CV chiffrés en AES-256-GCM côté serveur

### Structure des données CV
Les CV sont stockés au format JSON validé par le template dans `data/template.json`. Structure principale:
- `header`: nom, titre, contact
- `summary`: description, domaines
- `skills`: hard_skills, soft_skills, tools, methodologies
- `experience`: expériences professionnelles
- `education`, `languages`, `extras`, `projects`
- `order_hint`: ordre d'affichage des sections
- `section_titles`: titres personnalisés

### Chiffrement des CV
Les fichiers CV sont chiffrés avant stockage avec AES-256-GCM (`lib/cv/crypto.js`):
- Clé: `CV_ENCRYPTION_KEY` (32 octets base64 dans .env.local)
- Format: `cv1` prefix + IV (12 bytes) + authTag (16 bytes) + ciphertext
- Fonctions: `encryptString()`, `decryptString()`

### Système de tâches en arrière-plan
Architecture de job queue pour les opérations longues (génération IA, import PDF, traductions). Il existe un job queue pour un affichage sur mobile et un job queue pour un affichage sur desktop:

**Job Queue** (`lib/backgroundTasks/jobQueue.js`):
- Max 3 jobs concurrents (`MAX_CONCURRENT_JOBS`)
- `enqueueJob(jobRunner)`: ajoute un job
- `getQueueSnapshot()`: état de la queue

**Types de tâches** (stockées dans `BackgroundTask` model):
- `generate-cv`: Génère un CV à partir d'une offre (lien/PDF)
- `import-pdf`: Import d'un CV depuis PDF
- `translate-cv`: Traduction d'un CV
- `create-template-cv`: Création d'un CV template
- `generate-cv-from-job-title`: Génération depuis un titre de poste
- `calculate-match-score`: Calcul du score de correspondance

**Processus de job**:
1. Route API (`app/api/background-tasks/{type}/route.js`) reçoit la requête
2. Job spécifique (`lib/backgroundTasks/{type}Job.js`) est enqueué
3. Fonction OpenAI (`lib/openai/{type}.js`) exécute la logique métier
4. État synchronisé via polling (`app/api/background-tasks/sync/route.js`)

**État des tâches**:
- `queued`: en attente
- `running`: en cours
- `completed`: terminée
- `failed`: échouée
- `cancelled`: annulée

### Génération de CV par IA
Flux principal dans `lib/openai/generateCv.js`:
1. Extraction du contenu de l'offre (URL scraping avec Puppeteer stealth ou PDF parsing)
2. Récupération du CV de référence de l'utilisateur
3. **Appel OpenAI** qui génère un CV adapté à l'offre
4. Validation du JSON retourné contre `data/template.json`
5. Stockage chiffré du nouveau CV avec métadonnées enrichies

**Niveaux d'analyse** (`analysisLevel`):
- `rapid`: modèle rapide (économique) - `gpt-5-nano-2025-08-07`
- `medium`: modèle standard - `gpt-5-mini-2025-08-07`
- `deep`: modèle avancé (plus de contexte) - `gpt-5-2025-08-07`

**Extraction web optimisée**:
- Puppeteer + Stealth plugin pour contourner blocages (Indeed, etc.)
- Détection automatique du titre d'offre (H/F patterns)
- Optimisation HTML (réduction contexte inutile)
- Cache de l'extraction dans `CvFile.extractedJobOffer`

### Auth & User Management
**NextAuth** (`lib/auth/options.js`):
- Providers: credentials (email/password), Google, GitHub, Apple
- Adapter Prisma pour persistence
- Session strategy: JWT

**Models Prisma clés**:
- `User`: utilisateurs avec relations (cvs, accounts, sessions, feedbacks)
- `CvFile`: métadonnées des CV (sourceType, createdBy, matchScore, isTranslated)
- `BackgroundTask`: suivi des jobs asynchrones
- `LinkHistory`: historique des URLs utilisées
- `Feedback`: retours utilisateurs

### Match Score
Score de correspondance (0-100) entre CV et offre d'emploi:
- Calculé via OpenAI (`lib/openai/calculateMatchScoreWithAnalysis.js`)
- Stocké dans `CvFile.matchScore`
- Rate limiting: `User.matchScoreRefreshCount` et `matchScoreFirstRefreshAt`
- États: `idle`, `inprogress`, `failed` (`matchScoreStatus`)
- Retourne aussi: scoreBreakdown, suggestions, missingSkills, matchingSkills

### CV Optimization
Optimisation automatique des CV basée sur les suggestions d'amélioration:
- Route: `/api/cv/improve` (POST)
- Fonction OpenAI: `lib/openai/improveCv.js`
- États: `idle`, `inprogress`, `failed` (`optimiseStatus`)
- Workflow:
  1. Vérification de `matchScoreStatus === 'idle'` et suggestions disponibles
  2. Lancement: `optimiseStatus → 'inprogress'`
  3. Amélioration en arrière-plan (remplace le CV existant)
  4. Fin: `optimiseStatus → 'idle'` et rechargement automatique de la page
- Anti-spam: Bouton désactivé pendant l'optimisation
- Le bouton "Optimiser" est grisé si `matchScoreStatus === 'inprogress'` OU `optimiseStatus === 'inprogress'`

### Validation & Sanitization
- **Validation**: AJV avec `data/schema.json` (`lib/cv/validation.js`)
- **Sanitization**: Nettoyage des entrées (`lib/sanitize.js`)
- Correction automatique de structure avant rendu

### Export PDF
Une méthodes:
- `export-pdf`: Export complet avec Puppeteer

### Internationalisation
- Labels traduits dans `lib/i18n/cvLabels.js`
- LanguageSwitcher pour changer la langue d'affichage

## Variables d'environnement essentielles

```bash
# OpenAI
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4.1-mini"

# Database (chemin dans .env.local pour Prisma)
DATABASE_URL="file:./prisma/dev.db"

# NextAuth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# Chiffrement CV (32 octets base64: openssl rand -base64 32)
CV_ENCRYPTION_KEY="..."

# OAuth providers (optionnels)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."
```

## Organisation des fichiers

```
app/
├── api/                    # API Routes
│   ├── background-tasks/   # Endpoints pour jobs asynchrones
│   ├── cv/                 # CRUD des CV
│   ├── cvs/                # Liste et gestion des CV
│   ├── auth/               # NextAuth endpoints
│   └── feedback/           # Système de feedback
├── account/                # Pages compte utilisateur
└── page.jsx                # Page d'accueil (viewer CV)

components/
├── TopBar.jsx              # Barre de navigation principale
├── EmptyState.jsx          # État vide avec onboarding
├── TaskQueueModal.jsx      # Modal de suivi des tâches
├── Header.jsx              # En-tête du CV
├── Summary.jsx, Skills.jsx, Experience.jsx, etc.
├── feedback/               # Composants feedback
└── ui/                     # Composants UI réutilisables

lib/
├── auth/                   # NextAuth config et session
├── backgroundTasks/        # Job queue et jobs
├── cv/                     # Crypto, storage, validation, source
├── openai/                 # Intégrations OpenAI
├── i18n/                   # Traductions
└── prisma.js               # Client Prisma singleton

prisma/
├── schema.prisma           # Modèles de données
└── dev.db                  # Base SQLite (dev)

data/
└── schema.json             # Schéma JSON validation CV
└── template.json           # Schéma JSON validation CV
```

## Patterns importants

### Accès aux CV chiffrés
```javascript
import { readCv, writeCv } from '@/lib/cv/storage';

const cvData = await readCv(userId, filename);  // Déchiffre automatiquement
await writeCv(userId, filename, cvData);        // Chiffre automatiquement
```

### Enqueuer un job
```javascript
import { enqueueJob } from '@/lib/backgroundTasks/jobQueue';
import { runGenerateCvJob } from '@/lib/backgroundTasks/generateCvJob';

enqueueJob(() => runGenerateCvJob(task));
```

### Validation de CV
```javascript
import { validateCvData } from '@/lib/cv/validation';

const { valid, data, errors } = validateCvData(cvJson);
```

### Session utilisateur
```javascript
import { getSession } from '@/lib/auth/session';

const session = await getSession();
const userId = session?.user?.id;
```
## Project Rules
- Ne merge jamais sans une demande explicite. Si un merge est demandé il faudra merge avec main avec l'option `--no-ff`
- Ne commit jamais sans une demande explicite
- Si tu dois utiliser npm, utilise le port 3001
- Pour les migrations Prisma, le chemin DATABASE_URL se trouve dans .env.local
- Quand je veux créer ou ajouter une feature, créer une branche feature/name_of_the_feature
- Quand je veux ajouter ou modifier une feature, créer une branche
  improvement/name_of_the_feature, si elle existe déjà incrémente là
- Quand je veux corriger un gros bug, créer une branche
  bug/name_of_the_feature, si elle existe déjà incrémente là
- Quand je veux corriger un petit bug, créer une branche
  hotfix/name_of_the_feature, si elle existe déjà incrémente là
- N'utilise jamais "🤖 Generated with" dans un commit, ne fait aucune mention de Claude Code