import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { loadPrompt } from './promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { getPdfPageCount, convertPdfToImages, getPdfImageConfig } from './pdfToImages.js';
import { reconstructCv } from './cvReconstructor.js';
import { detectLanguage } from './cvConstants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Charge le schéma d'extraction optimisé (contenu pur, sans métadonnées)
 * @returns {Promise<Object>} - Schéma JSON Schema pour OpenAI
 */
async function loadExtractionSchema() {
  const schemaPath = path.join(__dirname, 'schemas', 'cvExtractionSchema.json');
  const content = await fs.readFile(schemaPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Appelle GPT-4o Vision avec les images du CV (Structured Outputs)
 * @param {Object} client - Client OpenAI
 * @param {string} model - Modèle à utiliser
 * @param {string[]} imageBase64Array - Tableau d'images en base64
 * @param {string} visionDetail - Niveau de détail Vision API (low, auto, high)
 * @returns {Promise<Object>} - Contenu et métadonnées de la réponse
 */
async function callChatGPTWithVision(client, model, imageBase64Array, visionDetail = 'high') {
  try {
    // Charger le schéma d'extraction optimisé (contenu pur)
    const extractionSchema = await loadExtractionSchema();

    // Charger les prompts depuis les fichiers .md
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
          detail: visionDetail // Configurable depuis Settings
        }
      });
    }

    console.log(`[importPdf] Envoi de ${imageBase64Array.length} image(s) à Vision (detail: ${visionDetail})...`);

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
        json_schema: extractionSchema
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
 *
 * Optimisé pour réduire les tokens :
 * - Schéma d'extraction allégé (contenu pur, sans métadonnées)
 * - Reconstruction côté serveur avec métadonnées DB
 * - Paramètres Vision configurables depuis Settings
 *
 * @param {string} pdfFilePath - Chemin vers le fichier PDF
 * @param {string} userId - ID de l'utilisateur (pour la télémétrie)
 * @param {boolean} isFirstImport - Si true, utilise le modèle dédié au premier import
 * @returns {Promise<{content: string, language: string}>} - CV JSON et langue détectée
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

  // 2. Charger les paramètres PDF depuis Settings
  const pdfConfig = await getPdfImageConfig();
  console.log(`[importPdf] Config PDF: ${pdfConfig.maxWidth}px, ${pdfConfig.density}DPI, Q${pdfConfig.quality}, detail:${pdfConfig.detail}`);

  // 3. Vérifier le nombre de pages AVANT la conversion
  console.log('[importPdf] Vérification du nombre de pages...');
  const pageCount = await getPdfPageCount(pdfFilePath);
  console.log(`[importPdf] PDF contient ${pageCount} page(s)`);

  if (pageCount > pdfConfig.maxPages) {
    throw new Error(JSON.stringify({
      translationKey: 'errors.api.openai.pdfTooManyPages',
      params: { pageCount, maxPages: pdfConfig.maxPages }
    }));
  }

  // 4. Convertir le PDF en images avec paramètres configurables
  console.log('[importPdf] Conversion du PDF en images...');
  const imageBase64Array = await convertPdfToImages(pdfFilePath, {
    maxWidth: pdfConfig.maxWidth,
    density: pdfConfig.density,
    quality: pdfConfig.quality
  });
  console.log(`[importPdf] ${imageBase64Array.length} image(s) générée(s)`);

  // 5. Préparer le client et le modèle
  const client = getOpenAIClient();
  const modelSetting = isFirstImport ? 'model_first_import_pdf' : 'model_import_pdf';
  const model = await getAiModelSetting(modelSetting);
  console.log(`[importPdf] Modèle GPT utilisé : ${model} (premier import: ${isFirstImport})`);

  // 6. Appeler GPT-4o Vision avec schéma d'extraction optimisé
  console.log('[importPdf] Analyse du CV par Vision API (schéma optimisé)...');
  const result = await callChatGPTWithVision(client, model, imageBase64Array, pdfConfig.detail);

  if (!result.content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptExtractionFailed' }));
  }

  const preview = result.content.replace(/\n/g, ' ').substring(0, 200);
  console.log(`[importPdf] Réponse brute : ${preview}...`);

  // 7. Parser le contenu extrait
  const extracted = JSON.parse(result.content.trim());

  // 8. Détecter la langue du CV (heuristique basée sur le contenu)
  // Note: L'IA normalise déjà le contenu dans une langue unique via le prompt
  const language = detectLanguage(extracted);
  console.log(`[importPdf] Langue détectée : ${language}`);

  // 9. Reconstruire le CV (contenu uniquement, métadonnées en DB)
  const fullCv = await reconstructCv(extracted);

  const enrichedContent = JSON.stringify(fullCv, null, 2);
  console.log('[importPdf] CV importé et reconstruit avec succès');

  // 10. Tracking OpenAI usage
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

  // Retourner le CV et la langue pour stockage en DB
  return {
    content: enrichedContent,
    language
  };
}
