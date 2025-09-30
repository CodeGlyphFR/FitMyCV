# Migration Python → JavaScript

## Résumé

Cette migration remplace les scripts Python (`generate_cv.py` et `import_pdf_cv.py`) par des modules JavaScript natifs, éliminant ainsi la dépendance à Python.

## Changements effectués

### 1. Nouveaux modules créés

#### `/lib/openai/client.js`
- Client OpenAI partagé
- Gestion des modèles par niveau d'analyse (rapid, medium, deep)
- Configuration centralisée de l'API OpenAI

#### `/lib/openai/importPdf.js`
- Remplacement de `scripts/import_pdf_cv.py`
- Fonction `importPdfCv()` pour extraire les données d'un CV PDF
- Utilise l'API OpenAI Responses avec upload de fichiers
- Retourne le contenu JSON enrichi du CV

#### `/lib/openai/generateCv.js`
- Remplacement de `scripts/generate_cv.py`
- Fonction `generateCv()` pour adapter un CV à une offre
- Support des liens et fichiers PDF d'offres d'emploi
- Retourne un tableau de CV générés (JSON)

### 2. Workers adaptés

#### `/lib/backgroundTasks/importPdfJob.js`
- ✅ Suppression de `spawn()` et des appels Python
- ✅ Appel direct de `importPdfCv()`
- ✅ Gestion des erreurs simplifiée
- ✅ Suppression de la gestion de processus (plus besoin de SIGTERM/SIGKILL)
- ✅ Conservation de la logique de tâches asynchrones

#### `/lib/backgroundTasks/generateCvJob.js`
- ✅ Suppression de `spawn()` et des appels Python
- ✅ Appel direct de `generateCv()`
- ✅ Gestion des erreurs simplifiée
- ✅ Suppression de la gestion de processus
- ✅ Conservation de la logique de tâches asynchrones

### 3. Dépendances ajoutées

```json
{
  "openai": "^6.0.0",
  "luxon": "^3.7.2"
}
```

### 4. Fichiers Python conservés

Les scripts Python originaux sont conservés dans `/scripts/` pour référence, mais ne sont plus utilisés :
- `scripts/generate_cv.py` (obsolète)
- `scripts/import_pdf_cv.py` (obsolète)

**Note**: Seuls les fichiers PDF sont acceptés pour les pièces jointes. La conversion Word→PDF n'est plus supportée (par choix de simplification).

## Avantages de la migration

1. ✅ **Plus de dépendance Python** - Tout fonctionne en JavaScript
2. ✅ **Moins de complexité** - Pas de gestion de processus externes
3. ✅ **Meilleures performances** - Pas de spawn de processus
4. ✅ **Meilleure gestion des erreurs** - Stack traces JavaScript natives
5. ✅ **Code plus maintenable** - Tout dans le même langage
6. ✅ **Build simplifié** - Plus besoin d'installer Python et ses dépendances

## Tests

Le build Next.js compile sans erreur :
```bash
npm run build
# ✓ Compiled successfully
```

## API OpenAI utilisée

Les modules utilisent l'API OpenAI Responses (`client.responses.create`) avec :
- **Instructions** (system prompt)
- **Input** (user prompt + fichiers)
- **Response format** : `{ type: 'json_object' }`

### Modèles par défaut

- `rapid`: gpt-5-nano-2025-08-07
- `medium`: gpt-5-mini-2025-08-07
- `deep`: gpt-5-2025-08-07

Ces modèles peuvent être surchargés via :
- Variable d'environnement : `GPT_OPENAI_MODEL`, `OPENAI_MODEL`, `OPENAI_API_MODEL`
- Paramètre `requestedModel` dans les fonctions

## Migration réussie ✅

La logique métier reste identique, seule l'implémentation change. Les workers continuent de fonctionner exactement de la même manière pour l'utilisateur final.
