/**
 * Job Offer Extraction - PDF functions
 *
 * Functions for extracting job offers from PDF files.
 */

import { promises as fs } from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { getOpenAIClient, addTemperatureIfSupported, adjustTokensForReasoningModel } from '@/lib/openai-core/client.js';
import { loadPrompt, loadPromptWithVars } from '@/lib/openai-core/promptLoader.js';
import { loadSchema } from '@/lib/openai-core/schemaLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import prisma from '@/lib/prisma';
import { computeContentHash, isJobOfferValid, storeJobOffer } from './helpers.js';
import { detectJobOfferLanguageWithOpenAI } from './languageDetection.js';

/**
 * Load the Job Offer Extraction schema
 * @returns {Promise<Object>} - Job offer extraction schema
 */
async function loadJobOfferSchema() {
  return loadSchema('lib/job-offer/schemas/jobOfferExtractionSchema.json');
}

/**
 * Extract text from PDF file using pdf-parse (based on Mozilla's pdf.js)
 * Better handling of custom fonts (Type3) compared to pdf2json
 * @param {string} filePath - Path to PDF
 * @returns {Promise<Object>} - { name, text, source_path }
 */
export async function extractTextFromPdf(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  return {
    name: path.basename(filePath),
    text: data.text.trim(),
    source_path: filePath
  };
}

/**
 * Extract job offer from PDF with Structured Outputs
 * @param {string} pdfPath - Path to PDF file
 * @param {string} userId - User ID for telemetry
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, tokensUsed, model }
 */
export async function extractJobOfferFromPdf(pdfPath, userId, signal = null) {
  const client = getOpenAIClient();

  // 1. Extract text from PDF
  const pdfData = await extractTextFromPdf(pdfPath);

  if (!pdfData.text || pdfData.text.length < 100) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.noJobOfferDetected',
      source: pdfPath
    }));
  }

  // 2. Extract with Structured Outputs
  const schema = await loadJobOfferSchema();
  const systemPrompt = await loadPrompt('lib/job-offer/prompts/system.md');
  const userPrompt = await loadPromptWithVars('lib/job-offer/prompts/user.md', {
    jobTitle: 'Non specifie (a extraire du contenu)',
    sourceContent: pdfData.text
  });

  const extractModel = await getAiModelSetting('model_extract_job_offer');

  let requestOptions = addTemperatureIfSupported({
    model: extractModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
  }, 0.1);
  requestOptions = adjustTokensForReasoningModel(requestOptions, 2000, 16000);

  const startTime = Date.now();
  const response = await client.chat.completions.create(requestOptions);
  const duration = Date.now() - startTime;

  // Track usage
  if (userId && response.usage) {
    await trackOpenAIUsage({
      userId,
      featureName: 'extract_job_offer_pdf',
      model: extractModel,
      promptTokens: response.usage.prompt_tokens || 0,
      completionTokens: response.usage.completion_tokens || 0,
      duration,
    });
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
  }

  const extraction = JSON.parse(content);

  // Validate extraction
  if (!isJobOfferValid(extraction)) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.noJobOfferDetected',
      source: pdfPath
    }));
  }

  // Detect language from extracted content
  const detectedLanguage = await detectJobOfferLanguageWithOpenAI({
    extraction,
    signal,
    userId,
    featureName: 'extract_job_offer_pdf',
  });
  extraction.language = detectedLanguage;

  // Extraire les tokens de la réponse
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    extraction,
    tokensUsed: promptTokens + completionTokens,
    model: extractModel,
    name: pdfData.name,
    title: extraction.title || pdfData.name,
    usageDetails: {
      modelUsed: extractModel,
      promptTokens,
      completionTokens,
      cachedTokens,
      durationMs: duration,
    },
  };
}

/**
 * Extract job offer from PDF text (internal helper - text already extracted)
 * @param {string} pdfText - Extracted text from PDF
 * @param {string} userId - User ID for telemetry
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, tokensUsed, model, title }
 */
export async function extractJobOfferFromPdfText(pdfText, userId, signal = null) {
  const client = getOpenAIClient();

  // Extract with Structured Outputs
  const schema = await loadJobOfferSchema();
  const systemPrompt = await loadPrompt('lib/job-offer/prompts/system.md');
  const userPrompt = await loadPromptWithVars('lib/job-offer/prompts/user.md', {
    jobTitle: 'Non specifie (a extraire du contenu)',
    sourceContent: pdfText
  });

  const extractModel = await getAiModelSetting('model_extract_job_offer');

  let requestOptions = addTemperatureIfSupported({
    model: extractModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
  }, 0.1);
  requestOptions = adjustTokensForReasoningModel(requestOptions, 2000, 16000);

  const fetchOptions = signal ? { signal } : {};
  const startTime = Date.now();
  const response = await client.chat.completions.create(requestOptions, fetchOptions);
  const duration = Date.now() - startTime;

  // Check if cancelled after API call
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // Track usage
  if (userId && response.usage) {
    await trackOpenAIUsage({
      userId,
      featureName: 'extract_job_offer_pdf',
      model: extractModel,
      promptTokens: response.usage.prompt_tokens || 0,
      completionTokens: response.usage.completion_tokens || 0,
      duration,
    });
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
  }

  const extraction = JSON.parse(content);

  // Validate extraction
  if (!isJobOfferValid(extraction)) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.noJobOfferDetected',
      source: 'PDF'
    }));
  }

  // Detect language from extracted content
  const detectedLanguage = await detectJobOfferLanguageWithOpenAI({
    extraction,
    signal,
    userId,
    featureName: 'extract_job_offer_pdf',
  });
  extraction.language = detectedLanguage;

  // Extraire les tokens de la réponse
  const promptTokens = response.usage?.prompt_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    extraction,
    tokensUsed: promptTokens + completionTokens,
    model: extractModel,
    title: extraction.title,
    usageDetails: {
      modelUsed: extractModel,
      promptTokens,
      completionTokens,
      cachedTokens,
      durationMs: duration,
    },
  };
}

/**
 * Get job offer from cache or extract from PDF
 * Uses content hash to identify identical PDFs (even with different names)
 * @param {string} userId - User ID
 * @param {string} pdfPath - Path to PDF file
 * @param {string} displayName - Display name for the PDF
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, jobOfferId, title, fromCache }
 */
export async function getOrExtractJobOfferFromPdf(userId, pdfPath, displayName, signal = null) {
  // 1. Extract text from PDF (needed for hash calculation)
  const pdfData = await extractTextFromPdf(pdfPath);

  if (!pdfData.text || pdfData.text.length < 100) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.noJobOfferDetected',
      source: displayName
    }));
  }

  // 2. Compute content hash
  const contentHash = computeContentHash(pdfData.text);

  // 3. Check if already extracted (by hash)
  const existing = await prisma.jobOffer.findFirst({
    where: { userId, contentHash }
  });

  if (existing) {
    console.log(`[generateCv] JobOffer found in cache for PDF hash: ${contentHash.substring(0, 8)}...`);
    return {
      extraction: existing.content,
      jobOfferId: existing.id,
      title: existing.content?.title || displayName,
      fromCache: true,
      usageDetails: null, // Pas d'appel OpenAI
    };
  }

  // 4. Extract via OpenAI (we already have the text)
  console.log(`[generateCv] Extracting job offer from PDF: ${displayName}`);
  const { extraction, tokensUsed, model, title, usageDetails } = await extractJobOfferFromPdfText(pdfData.text, userId, signal);

  // 5. Store in DB with hash
  const stored = await storeJobOffer(userId, 'pdf', displayName, extraction, model, tokensUsed, contentHash);

  return {
    extraction,
    jobOfferId: stored.id,
    title: title || displayName,
    fromCache: false,
    usageDetails, // Propager les données de coûts
  };
}
