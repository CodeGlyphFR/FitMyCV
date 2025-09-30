# Correction de l'erreur 400 (Missing required parameter: 'file')

## Problème

Lors de l'import de CV PDF et de la génération de CV, l'erreur suivante se produisait :
```
400 Missing required parameter: 'messages[1].content[1].file'.
```

## Cause

L'API OpenAI **Chat Completions** standard (`client.chat.completions.create()`) ne supporte pas directement le type `file` avec un `file_id` dans le contenu des messages.

Les scripts Python utilisaient probablement une API différente (Responses ou Assistants) qui n'est pas la même que l'API Chat Completions standard.

## Solution

**Extraction du texte des PDF côté serveur** au lieu d'uploader les fichiers à l'API OpenAI.

### Étapes :

1. ✅ Installation de `pdf-parse` pour extraire le texte des PDF
2. ✅ Remplacement de l'upload de fichier par une extraction de texte
3. ✅ Inclusion du texte extrait directement dans le prompt utilisateur

### Fichiers modifiés

#### Installation de la dépendance
```bash
npm install pdf-parse
```

#### `/lib/openai/importPdf.js`

**Avant :**
```javascript
// Upload du PDF vers OpenAI
const uploadedFile = await uploadPdfFile(client, pdfFilePath);

// Appel avec file_id
const response = await client.chat.completions.create({
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: userPrompt },
      { type: 'file', file_id: pdfFile.id }  // ❌ Non supporté
    ]
  }]
});
```

**Après :**
```javascript
// Extraction du texte du PDF
const pdfText = await extractTextFromPdf(pdfFilePath);

// Appel avec texte extrait
const fullUserPrompt = `${userPrompt}\n\nCONTENU DU CV EXTRAIT DU PDF:\n\`\`\`\n${pdfText}\n\`\`\``;
const response = await client.chat.completions.create({
  messages: [{
    role: 'user',
    content: fullUserPrompt  // ✅ Texte simple
  }]
});
```

#### `/lib/openai/generateCv.js`

Même approche : extraction du texte des PDFs d'offres d'emploi au lieu de les uploader.

## Avantages

1. ✅ **Compatible avec l'API standard** - Utilise l'API Chat Completions sans extensions
2. ✅ **Plus simple** - Pas besoin de gérer les uploads de fichiers
3. ✅ **Moins cher** - Pas de coûts d'upload/storage OpenAI
4. ✅ **Plus rapide** - Extraction locale vs upload réseau

## Limitations

- Les PDF scannés (images) ne seront pas extraits correctement
- La mise en forme du PDF est perdue (seul le texte brut est extrait)
- Pour les CV avec beaucoup d'images/graphiques, le résultat peut être moins bon

## Alternative (si nécessaire)

Si l'extraction de texte ne suffit pas, il faudrait :
1. Convertir les PDF en images
2. Utiliser l'API Vision de OpenAI avec les images
3. Ou utiliser l'API Assistants (plus complexe)
