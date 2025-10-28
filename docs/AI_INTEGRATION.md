# Intégration OpenAI - FitMyCv.ai

Documentation complète de l'intégration OpenAI dans FitMyCv.ai.

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

FitMyCv.ai utilise l'**OpenAI API** pour toutes les opérations d'intelligence artificielle.

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

Convertit un PDF en JSON structuré.

**Fichier** : `lib/openai/importPdf.js`

**Inputs** :

- PDF Base64

**Process** :

```
1. Parse PDF with pdf2json
2. Extract raw text
3. Load prompts
4. Call OpenAI API with extracted text
5. Parse JSON response
6. Validate structure
7. Return CV JSON
```

---

### 3. translateCv.js

Traduit un CV vers une langue cible.

**Fichier** : `lib/openai/translateCv.js`

**Inputs** :

- CV source (JSON)
- Langue cible (en, fr, es, de, it, pt)

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
- Offre d'emploi (texte extrait)

**Process** :

```
1. Load CV + job offer
2. Load scoring prompts
3. Call OpenAI API
4. Parse score (0-100)
5. Extract breakdown (technical_skills, experience, etc.)
6. Extract suggestions (high/medium/low priority)
7. Extract missing/matching skills
8. Return analysis object
```

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

Crée un CV template vide.

**Fichier** : `lib/openai/createTemplateCv.js`

**Process** :

```
1. Load template structure from data/template.json
2. Return template (optionally with AI-generated placeholders)
```

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
