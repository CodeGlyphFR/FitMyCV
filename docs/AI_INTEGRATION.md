# Intégration OpenAI - FitMyCV.io

Documentation complète de l'intégration OpenAI dans FitMyCV.io.

---

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Configuration](#configuration)
- [Modèles IA](#modèles-ia)
- [Fonctions IA](#fonctions-ia)
- [Système de prompts](#système-de-prompts)
- [Gestion des coûts](#gestion-des-coûts)
- [Telemetry OpenAI](#telemetry-openai)

---

## Vue d'ensemble

FitMyCV.io utilise l'**OpenAI API** pour toutes les opérations d'intelligence artificielle.

### SDK

- **Package** : `openai` v6.0.0
- **Client** : `lib/openai/client.js`
- **Modèles** : GPT-5 family (nano, mini, full)

### Architecture

```
Feature Request
     │
     ├→ Background Job
     │       │
     │       ├→ OpenAI Function (lib/openai/[function].js)
     │       │       │
     │       │       ├→ Prompt Loader (lib/openai/promptLoader.js)
     │       │       │       │
     │       │       │       └→ Prompts (lib/openai/prompts/[feature]/)
     │       │       │
     │       │       ├→ OpenAI Client (lib/openai/client.js)
     │       │       │       │
     │       │       │       └→ OpenAI API
     │       │       │
     │       │       └→ Response Processing & Validation
     │       │
     │       └→ Telemetry Tracking
     │
     └→ Result
```

---

## Configuration

### Variables d'environnement

```bash
# .env.local
OPENAI_API_KEY="sk-proj-..." # OBLIGATOIRE
```

### Client OpenAI

**Fichier** : `lib/openai/client.js`

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 120000, // 2 minutes
});

export default openai;
```

**Features** :

- **Retry automatique** : 3 tentatives en cas d'erreur
- **Timeout** : 2 minutes max par requête
- **Error handling** : Gestion des erreurs réseau, rate limits, etc.

---

## Modèles IA

### Configuration dynamique

Les modèles sont configurés via **Settings** dans la base de données :

```sql
SELECT * FROM Setting WHERE category = 'ai_models';
```

| settingName | value (modèle) | Usage |
|------------|----------------|-------|
| `model_analysis_rapid` | gpt-5-nano-2025-08-07 | Analyse rapide, tests |
| `model_analysis_medium` | gpt-5-mini-2025-08-07 | Usage quotidien |
| `model_analysis_deep` | gpt-5-2025-08-07 | Analyses approfondies |

### Caractéristiques des modèles

#### GPT-5-nano (rapid)

- **Context window** : 8K tokens
- **Coût estimé** : ~$0.01 par génération CV
- **Vitesse** : ~5-10 secondes
- **Usage** : Tests, prototypage, usage fréquent

#### GPT-5-mini (medium)

- **Context window** : 16K tokens
- **Coût estimé** : ~$0.05 par génération CV
- **Vitesse** : ~10-20 secondes
- **Usage** : Production standard, candidatures normales

#### GPT-5 (deep)

- **Context window** : 32K tokens
- **Coût estimé** : ~$0.20 par génération CV
- **Vitesse** : ~15-30 secondes
- **Usage** : Candidatures importantes, analyses détaillées

### Sélection du modèle

```javascript
// lib/settings/aiModels.js
import { getSetting } from '@/lib/settings/settingsUtils';

export async function getModelForAnalysisLevel(level) {
  const settingMap = {
    rapid: 'model_analysis_rapid',
    medium: 'model_analysis_medium',
    deep: 'model_analysis_deep',
  };

  const settingName = settingMap[level] || settingMap.medium;
  const model = await getSetting(settingName);

  return model || 'gpt-5-mini-2025-08-07'; // Fallback
}
```

---

## Fonctions IA

### 1. generateCv.js

Génère un CV personnalisé depuis une offre d'emploi.

**Fichier** : `lib/openai/generateCv.js`

**Inputs** :

- URL de l'offre ou contenu PDF
- CV de référence de l'utilisateur
- Niveau d'analyse (rapid/medium/deep)

**Process** :

```
1. Extract job offer (Puppeteer ou PDF parsing)
2. Load reference CV (encrypted)
3. Load prompts (system, user, examples)
4. Call OpenAI API
5. Parse JSON response
6. Validate with AJV
7. Return structured CV
```

**Output** : CV JSON structuré

---

### 2. importPdf.js

Convertit un PDF en JSON structuré via Vision API (multi-images).

**Fichier** : `lib/openai/importPdf.js`

**Inputs** :

- Chemin du fichier PDF
- Signal d'annulation (AbortController)
- userId (pour télémétrie)
- isFirstImport (pour sélection modèle)

**Process** :

```
1. Charger configuration Vision depuis Settings (lib/openai/pdfToImages.js)
2. Convertir PDF en images JPEG base64 (pdf2pic + sharp)
3. Charger prompts (import-pdf/system.md, user.md)
4. Appeler Vision API avec images + schema d'extraction
5. Parser la réponse (Structured Outputs)
6. Détecter langue du CV depuis le contenu
7. Reconstruire CV complet via cvReconstructor.js
8. Retourner { content: JSON, language: string }
```

**Modules associés** :

| Module | Rôle |
|--------|------|
| `pdfToImages.js` | Conversion PDF → images base64 (configurable via Settings) |
| `cvExtractionSchema.json` | Schéma d'extraction contenu pur (8 sections) |
| `cvReconstructor.js` | Reconstruction CV complet depuis extraction + métadonnées |
| `cvConstants.js` | Constantes (section_titles, order, helpers) |

**Output** : `{ content: string, language: string }`

---

### 2.1 Optimisation tokens PDF Import

**Problème** : Le schéma CV complet contient des métadonnées redondantes (~135 tokens/réponse).

**Solution** : Schéma d'extraction "content-only" + reconstruction serveur.

#### Métadonnées supprimées du schéma

| Champ supprimé | Tokens économisés | Reconstitution |
|----------------|-------------------|----------------|
| `order_hint` | ~30 | Setting `cv_section_order` |
| `section_titles` | ~50 | Dérivé de `language` |
| `meta` object | ~40 | CvFile (createdBy, sourceType...) |
| `generated_at` | ~10 | `createdAt.toISOString()` |
| `language` | ~5 | Stocké en colonne CvFile.language |

**Total économisé** : ~235-335 tokens par import (16% de réduction).

#### Fichiers clés

```
lib/openai/
├── schemas/
│   └── cvExtractionSchema.json    # Schéma contenu pur (8 sections)
├── cvReconstructor.js             # Reconstruction CV complet
├── cvConstants.js                 # section_titles, getSectionOrder()
└── pdfToImages.js                 # Conversion PDF → images (configurable)
```

#### Exemple de reconstruction

```javascript
import { reconstructCv } from '@/lib/openai/cvReconstructor';

// Extraction brute depuis OpenAI
const extracted = {
  header: { full_name: "John Doe", current_title: "Developer" },
  skills: { hard_skills: [...], tools: [...] },
  experience: [...],
  // ... 8 sections contenu pur
};

// Métadonnées depuis DB
const dbMeta = {
  createdAt: new Date(),
  createdBy: 'pdf-import-vision',
  sourceType: 'pdf-import',
};

// Reconstruction CV complet
const fullCv = await reconstructCv(extracted, dbMeta);
// fullCv contient: language, section_titles, order_hint, meta, etc.
```

---

### 2.2 Configuration Vision API (Settings)

Les paramètres de conversion PDF → images sont configurables via Admin → Settings.

**Catégorie** : `pdf_import`

| Setting | Défaut | Range | Description |
|---------|--------|-------|-------------|
| `pdf_image_max_width` | 1000 | 500-1500 px | Largeur max des images |
| `pdf_image_density` | 100 | 72-150 DPI | Densité de conversion |
| `pdf_image_quality` | 75 | 50-100% | Qualité JPEG |
| `pdf_vision_detail` | high | low/auto/high | Mode Vision API |

**Impact sur les coûts** :

| Mode | Tokens/image (~) | Recommandation |
|------|------------------|----------------|
| `low` | ~85 | Documents simples |
| `auto` | ~85-1000 | Décision OpenAI |
| `high` | ~1000+ | CVs complexes (défaut) |

**Accès configuration** :

```javascript
import { getPdfImageConfig, invalidatePdfConfigCache } from '@/lib/openai/pdfToImages';

const config = await getPdfImageConfig();
// { maxWidth: 1000, density: 100, quality: 75, detail: 'high' }

// Après modification admin
invalidatePdfConfigCache();
```

---

### 3. translateCv.js

Traduit un CV vers une langue cible.

**Fichier** : `lib/openai/translateCv.js`

**Inputs** :

- CV source (JSON)
- Langue cible (en, fr)

**Process** :

```
1. Detect source language
2. Load translation prompts
3. Call OpenAI API
4. Preserve JSON structure
5. Translate all text fields
6. Return translated CV
```

---

### 4. calculateMatchScoreWithAnalysis.js

Calcule le score de correspondance avec analyse détaillée.

**Fichier** : `lib/openai/calculateMatchScoreWithAnalysis.js`

**Inputs** :

- CV (JSON)
- `cvFile.extractedJobOffer` (texte extrait stocké en DB lors de la création/génération du CV)

**Process** :

```
1. Load CV content
2. Get extractedJobOffer from DB (REQUIRED - no scraping)
3. Detect languages (CV and job offer) for translation if needed
4. Load scoring prompts
5. Call OpenAI API
6. Parse score (0-100)
7. Extract breakdown (technical_skills, experience, education, soft_skills_languages)
8. Extract suggestions (array)
9. Extract missing/matching skills
10. Recalculate weighted score (35% tech, 30% exp, 20% edu, 15% soft)
11. Return analysis object
```

**Note** : Le score ne peut être calculé que si le CV a un `extractedJobOffer` en base (stocké lors de la génération/création).

**Output** :

```json
{
  "score": 85,
  "breakdown": {
    "technical_skills": 28,
    "experience": 22,
    "education": 15,
    "projects": 12,
    "soft_skills": 8
  },
  "suggestions": [
    {
      "priority": "high",
      "suggestion": "...",
      "impact": "+8"
    }
  ],
  "missingSkills": ["Kubernetes"],
  "matchingSkills": ["React", "Node.js"]
}
```

---

### 5. improveCv.js

Améliore un CV basé sur les suggestions.

**Fichier** : `lib/openai/improveCv.js`

**Inputs** :

- CV actuel (JSON)
- Suggestions d'amélioration

**Process** :

```
1. Load CV + suggestions
2. Load improvement prompts
3. Call OpenAI API
4. Parse improved CV
5. Validate structure
6. Return improved CV JSON
```

---

### 6. createTemplateCv.js

Crée un CV modèle fictif réaliste à partir d'une offre d'emploi (URL ou PDF).

**Fichier** : `lib/openai/createTemplateCv.js`

**Inputs** :

- URL(s) d'offre(s) d'emploi ou PDF(s)
- Niveau d'analyse (rapid/medium/deep)

**Process** :

```
1. Extract job offer content via extractJobOfferWithGPT (from generateCv.js)
   - Multi-strategy HTML extraction (semantic tags, job classes, H/F pattern)
   - Antibot detection (HTTP first, Puppeteer fallback)
2. Load template structure from data/template.json
3. Load create-template prompts
4. Call OpenAI API to generate realistic CV matching job requirements
5. Validate CV structure (full_name + current_title required)
6. Enrich with metadata (generator, source, timestamps)
7. Return CV JSON + extractedJobOffer text
```

**Note** : L'extraction d'offre (`extractJobOfferWithGPT`) est partagée avec `generateCv.js` pour éviter la duplication de code.

---

### 7. generateCvFromJobTitle.js

Génère un CV depuis un titre de poste (sans offre).

**Fichier** : `lib/openai/generateCvFromJobTitle.js`

**Inputs** :

- Titre de poste
- CV de référence

**Process** :

```
1. Validate job title
2. Load reference CV
3. Load prompts
4. Call OpenAI API with job title
5. Parse & validate CV
6. Return CV JSON
```

---

## Système de prompts

### Organisation

Les prompts sont organisés par feature dans `lib/openai/prompts/` :

```
lib/openai/prompts/
├── README.md
├── _shared/
│   ├── cv-structure.md
│   ├── validation-rules.md
│   └── output-format.md
├── generate-cv/
│   ├── system.md
│   ├── user.md
│   └── examples.md
├── import-pdf/
│   ├── system.md
│   └── user.md
├── translate-cv/
│   ├── system.md
│   └── user.md
├── improve-cv/
│   ├── system.md
│   └── user.md
├── scoring/
│   ├── system.md
│   └── user.md
└── [autres features]/
```

### Prompt Loader

**Fichier** : `lib/openai/promptLoader.js`

```javascript
import fs from 'fs/promises';
import path from 'path';

export async function loadPrompt(feature, promptType) {
  const promptPath = path.join(
    process.cwd(),
    'lib/openai/prompts',
    feature,
    `${promptType}.md`
  );

  const content = await fs.readFile(promptPath, 'utf-8');
  return content;
}
```

**Usage** :

```javascript
const systemPrompt = await loadPrompt('generate-cv', 'system');
const userPrompt = await loadPrompt('generate-cv', 'user');
```

### Structure d'un prompt

**Exemple** : `lib/openai/prompts/generate-cv/system.md`

```markdown
# Role
You are an expert CV writer specialized in ATS optimization and job matching.

# Task
Generate a personalized CV based on a job offer and a reference CV.

# Rules
1. Preserve the JSON structure exactly
2. Adapt content to match job requirements
3. Optimize for ATS keywords
4. Keep professional tone
5. Include quantifiable metrics

# Output Format
Return ONLY valid JSON following the schema in _shared/cv-structure.md
```

---

## Gestion des coûts

### Tarification OpenAI

Configuration dans la base de données (`OpenAIPricing`) :

```sql
SELECT * FROM OpenAIPricing;
```

| Model | Input ($/M tokens) | Output ($/M tokens) | Cache ($/M tokens) |
|-------|-------------------|---------------------|-------------------|
| gpt-5-nano | 0.10 | 0.40 | 0.05 |
| gpt-5-mini | 0.50 | 2.00 | 0.25 |
| gpt-5 | 2.00 | 8.00 | 1.00 |

### Calcul des coûts

```javascript
// Tracking après chaque appel OpenAI
const {
  usage: {
    prompt_tokens,
    completion_tokens,
    prompt_tokens_details: { cached_tokens = 0 } = {}
  }
} = response;

const pricing = await getPricingForModel(model);

const cost = (
  (prompt_tokens - cached_tokens) * pricing.inputPricePerMToken / 1_000_000 +
  cached_tokens * pricing.cachePricePerMToken / 1_000_000 +
  completion_tokens * pricing.outputPricePerMToken / 1_000_000
);
```

### Optimisations de coûts

1. **Prompt caching** : Les prompts système sont cachés (réduction ~50%)
2. **Extraction HTML optimisée** : Suppression des balises inutiles (réduction ~30%)
3. **Cache d'extraction** : Sauvegarde de l'offre extraite (évite re-scraping)
4. **Sélection du modèle** : Rapid pour tests, Deep pour candidatures importantes

### Monitoring

- **Dashboard admin** : OpenAICostsTab affiche les coûts en temps réel
- **Graphiques** : Évolution quotidienne, répartition par modèle/feature
- **Alertes** : Configurable via `OpenAIAlert`

---

## Telemetry OpenAI

### Tracking des appels

Chaque appel OpenAI est tracké dans deux tables :

1. **OpenAICall** : Logs individuels détaillés
2. **OpenAIUsage** : Agrégation quotidienne par utilisateur/feature/modèle

### Exemple de tracking

```javascript
// lib/telemetry/openai.js
export async function trackOpenAICall({
  userId,
  featureName,
  model,
  promptTokens,
  cachedTokens,
  completionTokens,
  totalTokens,
  estimatedCost,
  duration,
  metadata,
}) {
  // 1. Log individuel
  await prisma.openAICall.create({
    data: {
      userId,
      featureName,
      model,
      promptTokens,
      cachedTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      duration,
      metadata: JSON.stringify(metadata),
    }
  });

  // 2. Agrégation quotidienne
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.openAIUsage.upsert({
    where: {
      userId_featureName_model_date: {
        userId,
        featureName,
        model,
        date: today,
      }
    },
    update: {
      promptTokens: { increment: promptTokens },
      cachedTokens: { increment: cachedTokens },
      completionTokens: { increment: completionTokens },
      totalTokens: { increment: totalTokens },
      estimatedCost: { increment: estimatedCost },
      callsCount: { increment: 1 },
    },
    create: {
      userId,
      featureName,
      model,
      date: today,
      promptTokens,
      cachedTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      callsCount: 1,
    }
  });
}
```

### Dashboards

- **OpenAICostsTab** : Vue détaillée des coûts
- **Analytics/OpenAI Usage** : Graphiques et tendances
- **Balance OpenAI** : Solde du compte OpenAI

---

**Intégration OpenAI complète** | GPT-5 models, prompts optimisés, tracking détaillé
