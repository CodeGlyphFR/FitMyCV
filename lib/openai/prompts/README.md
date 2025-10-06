# Prompts IA - CV Generator

Ce dossier contient tous les prompts utilisés par les différentes fonctionnalités IA du projet.

## 📂 Organisation

Chaque feature a son propre sous-dossier avec généralement 2 fichiers :
- `system.md` : Prompt système (rôle, contexte, règles générales)
- `user.md` : Prompt utilisateur (instructions spécifiques, format de sortie)

## 🗂️ Structure

```
prompts/
├── scoring/              # Calcul de score de match CV/offre
├── generate-cv/          # Génération CV adapté à une offre
├── improve-cv/           # Amélioration ciblée d'un CV
├── create-template/      # Création CV template depuis offre
├── import-pdf/           # Import et parsing de CV PDF
├── translate-cv/         # Traduction de CV
├── validate-job-title/   # Validation titre de poste
├── generate-from-title/  # Génération CV depuis titre seul
└── extract-job-offer/    # Extraction contenu offre (URL/PDF)
```

## 🔧 Utilisation

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

## 🔄 Scoring unifié

Toutes les fonctionnalités de scoring utilisent le même format :

- **Catégories** : 4 scores sur 100 (technical_skills, experience, education, soft_skills_languages)
- **Poids** : 35%, 30%, 20%, 15%
- **Formule** : `score_final = (tech × 0.35) + (exp × 0.30) + (edu × 0.20) + (soft × 0.15)`

Voir `scoring/format.md` pour les détails.

## 📊 Cache

- **Production** : Les prompts sont mis en cache en mémoire
- **Développement** : Pas de cache (hot-reload)
- Utiliser `clearPromptCache()` pour vider le cache si besoin

## 🐛 Debug

```javascript
import { getPromptCacheStats } from '@/lib/openai/promptLoader';

console.log(getPromptCacheStats());
// { entries: 5, prompts: ['scoring/system.md', ...] }
```

## 📅 Changelog

### 2025-01-10 - Migration initiale
- Création de la structure
- Migration des prompts depuis les fichiers JS
- Unification du format de scoring
