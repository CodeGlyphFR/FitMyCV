# Correction de l'erreur 404 (pdf-parse module loading issue)

## Problème

La route `/api/background-tasks/import-pdf` retournait systématiquement un **404 Not Found**, même après redémarrage du serveur.

### Erreur dans les logs :
```
[import-pdf/route] Erreur lors de l'import de scheduleImportPdfJob:
Error: ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'
```

## Cause

Le package **`pdf-parse`** contient un bug : il essaie de charger un fichier de test (`./test/data/05-versions-space.pdf`) **au moment de l'import du module**, avant même son utilisation.

Cela fait échouer le chargement du module dans Next.js, provoquant une erreur 404 pour toutes les routes qui importent ce module (directement ou indirectement).

## Solution

**Remplacement de `pdf-parse` par `pdf2json`**, une alternative plus stable qui ne charge pas de fichiers au moment de l'import.

### Étapes :

```bash
npm uninstall pdf-parse
npm install pdf2json
```

### Fichiers modifiés

#### `/lib/openai/importPdf.js`

**Avant :**
```javascript
import pdfParse from 'pdf-parse';

async function extractTextFromPdf(pdfPath) {
  const dataBuffer = await fs.readFile(pdfPath);
  const data = await pdfParse(dataBuffer);  // ❌ Module qui fait crasher à l'import
  return data.text;
}
```

**Après :**
```javascript
import PDFParser from 'pdf2json';

async function extractTextFromPdf(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      let text = '';
      pdfData.Pages.forEach(page => {
        page.Texts.forEach(textItem => {
          textItem.R.forEach(r => {
            text += decodeURIComponent(r.T) + ' ';
          });
        });
        text += '\n';
      });
      resolve(text.trim());
    });

    pdfParser.loadPDF(pdfPath);  // ✅ Pas de chargement de fichier au module-level
  });
}
```

#### `/lib/openai/generateCv.js`

Même modification : remplacement de `pdf-parse` par `pdf2json`.

## Test

Après les modifications :

```bash
curl -X POST http://localhost:3001/api/background-tasks/import-pdf

# Avant : 404 Not Found
# Après : 401 Unauthorized (la route fonctionne, mais pas authentifié)
```

✅ **La route est maintenant accessible !**

## Alternatives testées (qui n'ont PAS fonctionné)

1. ❌ **Import dynamique** : `const pdfParse = (await import('pdf-parse')).default`
   - Ne fonctionne pas car Webpack analyse quand même le module au build

2. ❌ **Lazy import** : Import conditionnel
   - Même problème, le module est analysé statiquement

## Conclusion

`pdf2json` est une alternative stable à `pdf-parse` qui :
- ✅ Ne charge pas de fichiers de test au moment de l'import
- ✅ Fonctionne correctement avec Next.js et Webpack
- ✅ Extrait le texte des PDF de manière fiable
- ⚠️ Peut avoir une qualité d'extraction légèrement différente

**Note** : Si la qualité d'extraction n'est pas satisfaisante avec `pdf2json`, il faudra envisager d'autres solutions comme l'utilisation de l'API Vision d'OpenAI pour analyser directement les PDFs sans extraction de texte.
