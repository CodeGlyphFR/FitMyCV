# Migration Python → JavaScript : Terminée ✅

## Résumé

Migration complète des scripts Python vers JavaScript pour éliminer la dépendance à Python.

---

## 📦 Dépendances ajoutées

```bash
npm install openai luxon pdf2json
```

- **openai** (^6.0.0) : SDK OpenAI pour Node.js
- **luxon** (^3.7.2) : Gestion des dates/timestamps
- **pdf2json** (^3.2.2) : Extraction de texte des PDF

---

## 🗂️ Fichiers créés

### Modules OpenAI
- `lib/openai/client.js` - Client OpenAI centralisé avec gestion des modèles
- `lib/openai/importPdf.js` - Import et extraction de CV PDF
- `lib/openai/generateCv.js` - Génération de CV adaptés aux offres

### Autres
- `lib/backgroundTasks/testJob.js` - Worker de test pour la route `/api/background-tasks/test`

---

## 📝 Fichiers modifiés

### Workers (background tasks)
- `lib/backgroundTasks/importPdfJob.js` - Utilise maintenant `importPdfCv()`
- `lib/backgroundTasks/generateCvJob.js` - Utilise maintenant `generateCv()`

### Interface utilisateur
- `components/BackgroundTasksProvider.jsx` - Ajout de logs console pour le debugging
- `app/layout.jsx` - Correction export viewport (Next.js 14+)

---

## 🐛 Problèmes rencontrés et résolus

### 1. Erreur 413 (Request Entity Too Large)
**Cause** : Chargement complet des fichiers en mémoire avec `fs.readFile()`
**Solution** : Utilisation de `createReadStream()` (puis abandonné car approche changée)

### 2. Erreur 400 (Missing required parameter: 'file')
**Cause** : L'API Chat Completions ne supporte pas `file_id` dans les messages
**Solution** : Extraction du texte des PDF localement au lieu d'upload à OpenAI

### 3. Erreur 404 (Route non trouvée)
**Cause** : Le package `pdf-parse` charge un fichier de test au moment de l'import, faisant crasher le module
**Solution** : Remplacement par `pdf2json` qui ne charge pas de fichiers à l'import

---

## ✅ Fonctionnalités

### Import de CV PDF
1. Upload du PDF par l'utilisateur
2. Extraction du texte avec `pdf2json`
3. Envoi du texte à l'API OpenAI Chat Completions
4. Parsing du JSON retourné selon le template
5. Sauvegarde du CV dans la base de données

### Génération de CV
1. Lecture du CV de référence (main.json)
2. Extraction du texte des PDFs d'offres d'emploi (si fournis)
3. Ou utilisation des liens d'offres (analysés par GPT)
4. Adaptation du CV via l'API OpenAI
5. Sauvegarde des CV générés

---

## 🔧 Configuration

### Modèles GPT par défaut

```javascript
const ANALYSIS_MODEL_MAP = {
  rapid: "gpt-5-nano-2025-08-07",
  medium: "gpt-5-mini-2025-08-07",
  deep: "gpt-5-2025-08-07",
};
```

Modifiables via variables d'environnement :
- `GPT_OPENAI_MODEL`
- `OPENAI_MODEL`
- `OPENAI_API_MODEL`

### Variables d'environnement requises

```bash
OPENAI_API_KEY=sk-...
```

Optionnelles :
```bash
GPT_SYSTEM_PROMPT="..."  # Personnaliser le prompt système
GPT_BASE_PROMPT="..."     # Personnaliser le prompt utilisateur
```

---

## 📊 Logs et Debugging

### Console navigateur
```javascript
// Changements de statut
[BackgroundTask] Tâche abc123 (import): queued → running

// Erreurs
[BackgroundTask] Tâche abc123 (import) a échoué: <message>
[BackgroundTask] Détails de la tâche: {...}
```

### Console serveur
```javascript
// Extraction PDF
[importPdf] PDF extrait: 2 pages, 1234 caractères
[generateCv] PDF extrait: offre.pdf - 3 pages, 5678 caractères

// Erreurs
[importPdfJob] Erreur lors de l'import PDF pour la tâche abc123: ...
[importPdfJob] Stack trace: ...
```

---

## 🚀 Avantages de la migration

1. ✅ **Plus de dépendance Python** - Stack 100% JavaScript
2. ✅ **Moins de complexité** - Pas de gestion de processus externes (spawn, SIGTERM, SIGKILL)
3. ✅ **Meilleures performances** - Pas de création de processus
4. ✅ **Meilleure gestion des erreurs** - Stack traces JavaScript natives
5. ✅ **Code plus maintenable** - Tout dans le même langage
6. ✅ **Build simplifié** - Plus besoin d'environnement Python

---

## 📋 Fichiers Python obsolètes

Ces fichiers peuvent être supprimés ou conservés pour référence :
- `scripts/generate_cv.py`
- `scripts/import_pdf_cv.py`

---

## ⚠️ Limitations connues

### Extraction de texte PDF
- Les PDF scannés (images) ne sont pas supportés
- La mise en forme est perdue (seul le texte brut est extrait)
- Pour les CV très graphiques, le résultat peut être de moindre qualité

### Alternative future
Si la qualité d'extraction n'est pas satisfaisante :
- Utiliser l'API Vision d'OpenAI pour analyser les PDF comme des images
- Ou convertir les PDF en images et les envoyer à GPT-4 Vision

---

## ✅ Tests réussis

- [x] Build Next.js sans erreurs
- [x] Route `/api/background-tasks/import-pdf` accessible (401 si non auth)
- [x] Route `/api/background-tasks/generate-cv` accessible
- [x] Import des modules sans crash
- [x] Pas de fichiers de test chargés au démarrage

---

## 🎯 Prochaines étapes

1. Tester l'import d'un CV PDF réel
2. Tester la génération de CV avec une offre
3. Vérifier la qualité de l'extraction PDF
4. Si nécessaire, améliorer l'extraction ou passer à Vision API

---

**Migration terminée avec succès !** 🎉
