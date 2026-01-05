# Prompts IA - CV Generator

Ce dossier contient tous les prompts utilisés par les différentes fonctionnalités IA du projet.

## 📂 Organisation

### Structure principale
- **`_shared/`** : Composants réutilisables utilisés par plusieurs features
- **`[feature]/`** : Chaque feature a son dossier avec généralement :
  - `system.md` : Prompt système (rôle, contexte, règles générales)
  - `user.md` : Prompt utilisateur (instructions spécifiques, format de sortie)

### Fichiers partagés (_shared/)

Ces fichiers sont inclus automatiquement dans les prompts via la directive `{INCLUDE:...}` :

| Fichier | Description |
|---------|-------------|
| `system-base.md` | Prefixe commun (role expert + schema CV + regles d'adaptation) |
| `cv-adaptation-rules.md` | Regles unifiees d'adaptation CV (competences, experiences, resume, style) |
| `json-instructions.md` | Instructions detaillees pour remplir le template CV JSON |
| `scoring-rules.md` | Format de scoring unifie (4 categories, poids, formule) |
| `language-policy.md` | Politique de langue pour generation et traduction |
| `response-format.md` | Format de reponse JSON standard |

## 🗂️ Structure complète

```
prompts/
├── _shared/                  # 📦 COMPOSANTS RÉUTILISABLES
│   ├── system-base.md        # Prefixe commun (role + schema + regles)
│   ├── cv-adaptation-rules.md # Regles unifiees d'adaptation CV
│   ├── json-instructions.md  # Instructions template CV
│   ├── scoring-rules.md      # Format scoring unifié
│   ├── language-policy.md    # Politique de langue
│   └── response-format.md    # Format réponse JSON
│
├── scoring/                  # Calcul score de match CV/offre
├── generate-cv/              # Génération CV adapté à une offre
├── improve-cv/               # Amélioration ciblée d'un CV
├── create-template/          # Création CV template depuis offre
├── import-pdf/               # Import et parsing de CV PDF
├── translate-cv/             # Traduction de CV
├── validate-job-title/       # Validation titre de poste
├── generate-from-job-title/  # Génération CV depuis titre seul
└── extract-job-offer/        # Extraction contenu offre (URL/PDF)
```

## 🔧 Utilisation

### Chargement simple

```javascript
import { loadPrompt, loadPromptWithVars } from '@/lib/openai/promptLoader';

// Chargement simple
const systemPrompt = await loadPrompt('scoring/system.md');

// Chargement avec variables
const userPrompt = await loadPromptWithVars('scoring/user.md', {
  cvContent: JSON.stringify(cvData, null, 2),
  jobOfferContent: extractedOffer
});
```

### Inclusion de fichiers partagés

Les prompts peuvent inclure des fichiers partagés avec la directive `{INCLUDE:...}` :

```markdown
{INCLUDE:_shared/system-base.md}

## FORMAT DE RÉPONSE

{INCLUDE:_shared/response-format.md}
```

**Avantages** :
- ✅ Pas de duplication de code
- ✅ Maintenance centralisée
- ✅ Cohérence garantie entre features
- ✅ Support des inclusions imbriquées

## 📝 Format des variables

Les fichiers `.md` peuvent contenir des placeholders `{nomVariable}` qui seront remplacés par `loadPromptWithVars()`.

**Exemple** :
```markdown
CV ACTUEL:
{cvContent}

OFFRE D'EMPLOI:
{jobOfferContent}
```

## 🎯 Règles d'écriture

1. **Clarté** : Sois explicite et précis dans les instructions
2. **Structure** : Utilise des titres Markdown pour organiser
3. **Exemples** : Ajoute des exemples de sortie JSON quand pertinent
4. **Variables** : Utilise `{variable}` pour les contenus dynamiques
5. **Format** : Spécifie toujours le format de sortie attendu (JSON, etc.)
6. **Réutilisation** : Utilise `{INCLUDE:_shared/xxx.md}` au lieu de dupliquer

## 🔄 Scoring unifié

Toutes les fonctionnalités de scoring utilisent le même format défini dans `_shared/scoring-rules.md` :

- **Catégories** : 4 scores sur 100 (technical_skills, experience, education, soft_skills_languages)
- **Poids** : 35%, 30%, 20%, 15%
- **Formule** : `score_final = (tech × 0.35) + (exp × 0.30) + (edu × 0.20) + (soft × 0.15)`
- **Champs standardisés** : `suggestions`, `missing_skills`, `matching_skills`

## 📊 Cache

- **Production** : Les prompts (et leurs inclusions) sont mis en cache en mémoire
- **Développement** : Pas de cache (hot-reload)
- Utiliser `clearPromptCache()` pour vider le cache si besoin

## 🐛 Debug

```javascript
import { getPromptCacheStats } from '@/lib/openai/promptLoader';

console.log(getPromptCacheStats());
// { entries: 12, prompts: ['scoring/system.md', '_shared/scoring-rules.md', ...] }
```

## 📅 Changelog

### 2025-12-19 - Simplification radicale des prompts
- 🔥 Suppression de `anti-detection-rules.md` (412 lignes de banned words)
- 🔥 Suppression de `cv-improvement-rules.md` (fusionné)
- ✨ Création de `cv-adaptation-rules.md` (~80 lignes, regles unifiees)
- ✨ Refonte de `system-base.md` (prefixe simplifie)
- 📉 Reduction de ~87% des lignes de regles
- 📉 Reduction de ~73% des tokens par prompt
- 🎯 Regles claires : competences, experiences, resume, header, style
- ✅ Harmonisation de `cvExtractionSchema.json` (descriptions simplifiees)

### 2025-01-10 - Refactorisation majeure
- ✨ Ajout du dossier `_shared/` avec composants réutilisables
- ✨ Support des directives `{INCLUDE:...}` dans promptLoader
- 🔄 Standardisation des noms de champs JSON (`suggestions`, `missing_skills`)
- 📦 Factorisation de 60% du contenu dupliqué
- 🗑️ Suppression de `scoring/format.md` (remplacé par `_shared/scoring-rules.md`)
- ✅ Uniformisation de la politique de langue
- ✅ Centralisation des règles d'amélioration CV

### 2025-01-10 - Migration initiale
- Création de la structure
- Migration des prompts depuis les fichiers JS
- Unification du format de scoring
