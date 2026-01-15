# Pipeline CV v2 - Test & Debug

Ce dossier contient l'API de test pour debugger et optimiser le pipeline de generation de CV v2.

## API Endpoint

```
GET /api/test/pipeline-v2
```

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| `preset` | string | Preset de test predifini (`tech-ia`, `csm-architect`) |
| `cvId` | string | ID du CV source (override le preset) |
| `jobOfferUrl` | string | URL de l'offre d'emploi (override le preset) |
| `phase` | string | Filtre par phase (`classify`, `batch_experience`, `batch_skills`, etc.) |

### Presets Disponibles

| Preset | CV | Offre |
|--------|-----|-------|
| `tech-ia` | Tech & Produit end-to-end, IA, SaaS | Expert LLM & Agentic AI @ AOSIS |
| `csm-architect` | Customer Success Manager | Head of Customer Architect @ Inqom |

### Exemples

```bash
# Test complet avec preset par defaut
curl http://localhost:3001/api/test/pipeline-v2

# Test avec preset specifique
curl "http://localhost:3001/api/test/pipeline-v2?preset=csm-architect"

# Test phase classification uniquement
curl "http://localhost:3001/api/test/pipeline-v2?phase=classify"

# Test avec CV et offre personnalises
curl "http://localhost:3001/api/test/pipeline-v2?cvId=xxx&jobOfferUrl=https://..."
```

## Script de Test

Un script bash est disponible pour faciliter les tests :

```bash
# Rendre le script executable (une seule fois)
chmod +x scripts/test-pipeline-v2.sh

# Afficher l'aide
./scripts/test-pipeline-v2.sh help

# Tester la classification
./scripts/test-pipeline-v2.sh classify tech-ia
./scripts/test-pipeline-v2.sh classify csm-architect

# Tester les experiences
./scripts/test-pipeline-v2.sh experiences tech-ia

# Tester les skills
./scripts/test-pipeline-v2.sh skills tech-ia

# Tester le summary
./scripts/test-pipeline-v2.sh summary tech-ia

# Test complet du pipeline
./scripts/test-pipeline-v2.sh full tech-ia

# Tester l'extraction d'une offre
./scripts/test-pipeline-v2.sh extraction "https://indeed.com/viewjob?jk=xxx"

# Lister les CVs disponibles
./scripts/test-pipeline-v2.sh list-cvs

# Lister les presets
./scripts/test-pipeline-v2.sh list-presets
```

## Structure de la Reponse

```json
{
  "success": true,
  "duration": "45.2s",
  "params": {
    "cvId": "xxx",
    "jobOfferUrl": "https://...",
    "phaseFilter": "all",
    "availablePresets": ["tech-ia", "csm-architect"]
  },
  "sourceCv": {
    "filename": "...",
    "header": {...},
    "summary": {...},
    "experienceCount": 7,
    "projectCount": 0,
    "skills": {...},
    "education": [...]
  },
  "jobOffer": {
    "title": "...",
    "company": "...",
    "experience": {...},
    "skills": {...},
    "responsibilities": [...]
  },
  "phases": [
    {
      "type": "classify",
      "status": "completed",
      "durationMs": 2345,
      "tokens": {"prompt": 3500, "completion": 400, "total": 3900},
      "output": {...},
      "modifications": null,
      "error": null
    },
    // ... autres phases
  ],
  "generatedCv": {
    "filename": "...",
    "header": {...},
    "summary": {...},
    "experience": [...],
    "projects": [...],
    "skills": {...}
  }
}
```

## Phases du Pipeline

| Phase | Type | Description |
|-------|------|-------------|
| 0.5 | `classify` | Classification KEEP/REMOVE/MOVE_TO_PROJECTS |
| 1a | `batch_experience` | Adaptation de chaque experience (parallelise) |
| 1b | `batch_project` | Adaptation de chaque projet (parallelise) |
| 1c | `batch_extras` | Adaptation des extras |
| 1d | `batch_skills` | Adaptation des skills (sequentiel) |
| 1e | `batch_summary` | Generation du summary (sequentiel) |
| 2 | `recompose` | Assemblage final du CV |

## Workflow de Debug

1. **Identifier la phase problematique**
   ```bash
   ./scripts/test-pipeline-v2.sh full tech-ia
   # Regarder les status des phases
   ```

2. **Analyser l'input/output de la phase**
   ```bash
   curl "http://localhost:3001/api/test/pipeline-v2?phase=classify" | jq '.phases[0]'
   ```

3. **Modifier le prompt**
   - Prompts: `lib/cv-pipeline-v2/prompts/`
   - Schemas: `lib/cv-pipeline-v2/schemas/`

4. **Relancer le test**
   ```bash
   ./scripts/test-pipeline-v2.sh classify tech-ia
   ```

5. **Valider avec un autre preset**
   ```bash
   ./scripts/test-pipeline-v2.sh classify csm-architect
   ```

## Ajouter un Nouveau Preset

Editer `app/api/test/pipeline-v2/route.js` :

```javascript
const TEST_PRESETS = {
  'tech-ia': { ... },
  'csm-architect': { ... },
  // Ajouter ici
  'nouveau-preset': {
    cvId: 'xxx',
    cvName: 'Nom du CV',
    jobOfferUrl: 'https://...',
    jobOfferName: 'Titre du poste @ Entreprise',
  },
};
```

## Prompts a Optimiser

| Phase | Fichiers |
|-------|----------|
| Extraction Offre | `lib/openai/prompts/extract-job-offer/system.md` |
| Classification | `lib/cv-pipeline-v2/prompts/classify-system.md` |
| Batch Experiences | `lib/cv-pipeline-v2/prompts/batch-experience-system.md` |
| Batch Skills | `lib/cv-pipeline-v2/prompts/batch-skills-system.md` |
| Batch Summary | `lib/cv-pipeline-v2/prompts/batch-summary-system.md` |
