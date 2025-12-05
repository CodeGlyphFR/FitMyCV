import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { loadPrompt } from './promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { getPdfPageCount, convertPdfToImages, PDF_CONFIG } from './pdfToImages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Charge le schéma JSON Schema pour Structured Outputs
 * @returns {Promise<Object>} - Schéma JSON Schema pour OpenAI
 */
async function loadCvJsonSchema() {
  const schemaPath = path.join(__dirname, 'schemas', 'cvJsonSchema.json');
  const content = await fs.readFile(schemaPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Appelle GPT-4o Vision avec les images du CV (Structured Outputs)
 * @param {Object} client - Client OpenAI
 * @param {string} model - Modèle à utiliser
 * @param {string[]} imageBase64Array - Tableau d'images en base64
 * @param {string} userId - ID utilisateur (pour télémétrie)
 * @returns {Promise<Object>} - Contenu et métadonnées de la réponse
 */
async function callChatGPTWithVision(client, model, imageBase64Array, userId = null) {
  try {
    // Charger le schéma JSON Schema pour Structured Outputs
    const cvJsonSchema = await loadCvJsonSchema();

    // Charger les prompts depuis les fichiers .md (plus de variable {cvSchema})
    const systemPrompt = await loadPrompt('lib/openai/prompts/import-pdf/system.md');
    const userTextPrompt = await loadPrompt('lib/openai/prompts/import-pdf/user.md');

    // Construire le tableau de contenu avec texte + images
    const contentArray = [
      { type: 'text', text: userTextPrompt }
    ];

    // Ajouter chaque page comme image
    for (let i = 0; i < imageBase64Array.length; i++) {
      contentArray.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64Array[i]}`,
          detail: 'high' // Haute résolution pour meilleure extraction de texte
        }
      });
    }

    console.log(`[importPdf] Envoi de ${imageBase64Array.length} image(s) à GPT-4o Vision (Structured Outputs)...`);

    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: contentArray
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: cvJsonSchema
      },
      max_tokens: 4096 // Suffisant pour un CV structuré
    });
    const duration = Date.now() - startTime;

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
    }

    return {
      content: content.trim(),
      usage: response.usage,
      duration,
    };
  } catch (error) {
    console.error('[importPdf] Erreur lors de l\'appel ChatGPT Vision:', error);
    throw error;
  }
}

function normalizeJsonPayload(raw) {
  // Structured Outputs garantit un JSON valide sans markdown
  const data = JSON.parse(raw.trim());
  return JSON.stringify(data, null, 2);
}

/**
 * Import d'un CV PDF via OpenAI Vision API
 * @param {string} pdfFilePath - Chemin vers le fichier PDF
 * @param {string} userId - ID de l'utilisateur (pour la télémétrie)
 * @param {boolean} isFirstImport - Si true, utilise le modèle dédié au premier import
 * @returns {Promise<string>} - Contenu JSON du CV extrait
 */
export async function importPdfCv({ pdfFilePath, userId = null, isFirstImport = false }) {
  console.log(`[importPdf] Traitement du fichier PDF : ${path.basename(pdfFilePath)}`);

  // 1. Vérifier les crédits OpenAI avant l'appel
  console.log('[importPdf] Vérification des crédits OpenAI...');
  try {
    await checkOpenAICredits();
    console.log('[importPdf] ✅ Crédits OpenAI disponibles');
  } catch (error) {
    console.error('[importPdf] ❌ Erreur crédits OpenAI:', error.message);
    throw error;
  }

  // 2. Vérifier le nombre de pages AVANT la conversion
  console.log('[importPdf] Vérification du nombre de pages...');
  const pageCount = await getPdfPageCount(pdfFilePath);
  console.log(`[importPdf] PDF contient ${pageCount} page(s)`);

  if (pageCount > PDF_CONFIG.MAX_PAGES) {
    throw new Error(JSON.stringify({
      translationKey: 'errors.api.openai.pdfTooManyPages',
      params: { pageCount, maxPages: PDF_CONFIG.MAX_PAGES }
    }));
  }

  // 3. Convertir le PDF en images
  console.log('[importPdf] Conversion du PDF en images...');
  const imageBase64Array = await convertPdfToImages(pdfFilePath, {
    maxWidth: PDF_CONFIG.MAX_WIDTH,
    density: PDF_CONFIG.DENSITY
  });
  console.log(`[importPdf] ${imageBase64Array.length} image(s) générée(s)`);

  // 4. Préparer le client et le modèle
  const client = getOpenAIClient();
  const modelSetting = isFirstImport ? 'model_first_import_pdf' : 'model_import_pdf';
  const model = await getAiModelSetting(modelSetting);
  console.log(`[importPdf] Modèle GPT utilisé : ${model} (premier import: ${isFirstImport})`);

  // 5. Appeler GPT-4o Vision avec Structured Outputs
  console.log('[importPdf] Analyse du CV par GPT-4o Vision (Structured Outputs)...');
  const result = await callChatGPTWithVision(client, model, imageBase64Array, userId);

  if (!result.content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptExtractionFailed' }));
  }

  const preview = result.content.replace(/\n/g, ' ').substring(0, 200);
  console.log(`[importPdf] Réponse brute de ChatGPT : ${preview}...`);

  // 6. Normalisation et validation JSON
  const formattedText = normalizeJsonPayload(result.content);

  // 7. Enrichissement avec métadonnées
  const parsed = JSON.parse(formattedText);
  const isoNow = new Date().toISOString();

  if (!parsed.generated_at) {
    parsed.generated_at = isoNow.substring(0, 10); // Format YYYY-MM-DD
  }

  const meta = {
    created_at: isoNow,
    updated_at: isoNow,
    generator: 'pdf-import-vision',
    source: 'pdf-import'
  };

  if (parsed.meta) {
    parsed.meta = { ...parsed.meta, ...meta };
  } else {
    parsed.meta = meta;
  }

  const enrichedContent = JSON.stringify(parsed, null, 2);
  console.log('[importPdf] CV importé avec succès via Vision API');

  // 8. Tracking OpenAI usage
  if (userId && result.usage) {
    try {
      await trackOpenAIUsage({
        userId,
        featureName: isFirstImport ? 'first_import_pdf' : 'import_pdf',
        model,
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        cachedTokens: result.usage.prompt_tokens_details?.cached_tokens || 0,
        duration: result.duration,
      });
    } catch (trackError) {
      console.error('[importPdf] Failed to track OpenAI usage:', trackError);
    }
  }

  return enrichedContent;
}
