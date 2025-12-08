import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { loadPromptWithVars } from './promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { getPdfPageCount, convertPdfToImages, getPdfImageConfig } from './pdfToImages.js';
import { reconstructCv } from './cvReconstructor.js';
import { detectPdfLanguage } from './detectPdfLanguage.js';

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
 * @param {string} detectedLanguage - Langue detectee du PDF (fr, en, es, de)
 * @param {AbortSignal} signal - Signal pour annuler la requete
 * @returns {Promise<Object>} - Contenu et métadonnées de la réponse
 */
async function callChatGPTWithVision(client, model, imageBase64Array, visionDetail = 'high', detectedLanguage = 'fr', signal = null) {
  try {
    // Charger le schéma d'extraction optimisé (contenu pur)
    const extractionSchema = await loadExtractionSchema();

    // Charger le schéma CV pour le prompt
    const cvSchemaPath = path.join(__dirname, '..', '..', 'data', 'template.json');
    let cvSchema = '{}';
    try {
      cvSchema = await fs.readFile(cvSchemaPath, 'utf-8');
    } catch (e) {
      console.warn('[importPdf] template.json non trouvé, utilisation schéma vide');
    }

    // Charger les prompts avec variables injectées
    const systemPrompt = await loadPromptWithVars('lib/openai/prompts/import-pdf/system.md', {
      detectedLanguage,
      cvSchema
    });
    const userTextPrompt = await loadPromptWithVars('lib/openai/prompts/import-pdf/user.md', {});

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

    const fetchOptions = signal ? { signal } : {};
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
    }, fetchOptions);
    const duration = Date.now() - startTime;

    // Check if cancelled after API call
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

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
 * @param {AbortSignal} signal - Signal pour annuler la tache
 * @returns {Promise<{content: string, language: string}>} - CV JSON et langue détectée
 */
export async function importPdfCv({ pdfFilePath, userId = null, isFirstImport = false, signal = null }) {
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

  // Check if cancelled after PDF conversion
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // 5. Préparer le client et le modèle
  const client = getOpenAIClient();
  const modelSetting = isFirstImport ? 'model_first_import_pdf' : 'model_import_pdf';
  const model = await getAiModelSetting(modelSetting);
  console.log(`[importPdf] Modèle GPT utilisé : ${model} (premier import: ${isFirstImport})`);

  // 5bis. Detecter la langue du PDF AVANT extraction
  console.log('[importPdf] Détection de la langue du PDF...');
  const detectedLanguage = await detectPdfLanguage(imageBase64Array[0], client, model, userId, signal);
  console.log(`[importPdf] Langue du PDF détectée : ${detectedLanguage}`);

  // Check if cancelled after language detection
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // 6. Appeler GPT-4o Vision avec schéma d'extraction optimisé et langue forcée
  console.log('[importPdf] Analyse du CV par Vision API (schéma optimisé)...');
  const result = await callChatGPTWithVision(client, model, imageBase64Array, pdfConfig.detail, detectedLanguage, signal);

  // Check if cancelled after Vision API call
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  if (!result.content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptExtractionFailed' }));
  }

  const preview = result.content.replace(/\n/g, ' ').substring(0, 200);
  console.log(`[importPdf] Réponse brute : ${preview}...`);

  // 7. Parser le contenu extrait
  const extracted = JSON.parse(result.content.trim());

  // 8. Utiliser la langue detectee precedemment (plus fiable que heuristique)
  const language = detectedLanguage;
  console.log(`[importPdf] Langue utilisée pour le CV : ${language}`);

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
