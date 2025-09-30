# Correction de l'erreur 413 (Request Entity Too Large)

## Problème

Lors de l'import de CV PDF via `importPdfCv()`, l'erreur suivante se produisait :
```
413 The data value transmitted exceeds the capacity limit.
```

## Cause

Les fonctions `uploadPdfFile()` et `uploadFileForResponses()` utilisaient `fs.readFile()` qui charge **tout le fichier en mémoire** avant de l'envoyer à l'API OpenAI. Pour les PDF volumineux, cela dépassait la limite de taille de la requête HTTP.

## Solution

Remplacement de `fs.readFile()` par `fs.createReadStream()` pour utiliser un **stream** au lieu de charger tout le fichier en mémoire.

### Fichiers modifiés

#### `/lib/openai/importPdf.js`
```diff
- import { promises as fs } from 'fs';
+ import { promises as fs, createReadStream } from 'fs';

async function uploadPdfFile(client, pdfPath) {
  try {
-   const fileStream = await fs.readFile(pdfPath);
+   const fileStream = createReadStream(pdfPath);
    const file = await client.files.create({
      file: fileStream,
      purpose: 'assistants'
    });
    ...
  }
}
```

#### `/lib/openai/generateCv.js`
```diff
- import { promises as fs } from 'fs';
+ import { promises as fs, createReadStream } from 'fs';

async function uploadFileForResponses(client, filePath, alias = null) {
  ...
  try {
-   const fileStream = await fs.readFile(filePath);
+   const fileStream = createReadStream(filePath);
    const file = await client.files.create({
      file: fileStream,
      purpose: 'assistants'
    });
    ...
  }
}
```

## Avantages

1. ✅ **Pas de limite de taille** - Les fichiers sont streamés au lieu d'être chargés en mémoire
2. ✅ **Meilleures performances** - Moins de consommation mémoire
3. ✅ **Supporte les gros PDF** - Fonctionne avec des CV de plusieurs Mo

## Test

Pour tester, essaie d'importer un CV PDF de quelques Mo. L'erreur 413 ne devrait plus apparaître.
