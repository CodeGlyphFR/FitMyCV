/**
 * CV Generation with AI - Refactored V2
 *
 * Flow:
 * 1. Fetch URL/PDF
 * 2. htmlToMarkdown() → Markdown propre
 * 3. extractJobOfferStructured() → JSON offre (Structured Outputs)
 * 4. prisma.jobOffer.upsert() → Stockage DB
 * 5. generateCvModifications() → DIFF JSON (Structured Outputs)
 * 6. applyModifications() → CV adapte
 * 7. Return { cvContent, jobOfferId, reasoning }
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import PDFParser from 'pdf2json';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getOpenAIClient, getCvModel, checkOpenAICredits, addTemperatureIfSupported, addCacheRetentionIfSupported } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { loadJobOfferSchema, loadCvModificationsSchema } from './schemaLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { htmlToMarkdown, extractJobOfferContent } from '@/lib/utils/htmlToMarkdown.js';
import { applyModifications } from '@/lib/cv/applyModifications.js';
import prisma from '@/lib/prisma';

/**
 * Compute SHA256 hash of text content
 * Used to identify PDF content for caching
 * @param {string} text - Text content to hash
 * @returns {string} - SHA256 hash hex string
 */
function computeContentHash(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * In-memory cache for warmup Promises (deduplication)
 * Key: `${userId}_${cvHash}`
 * Value: { promise: Promise, timestamp: number }
 * TTL: 5 minutes (OpenAI cache lasts 5-10 min for GPT-4.x)
 *
 * This stores Promises instead of results to prevent race conditions:
 * when multiple tasks check concurrently, they all get the same Promise
 * instead of each starting their own warmup call.
 */
const warmupPromises = new Map();
const WARMUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cleanup expired warmup promises
 */
function cleanupExpiredWarmups() {
  const now = Date.now();
  for (const [key, entry] of warmupPromises.entries()) {
    if (now - entry.timestamp > WARMUP_TTL_MS) {
      warmupPromises.delete(key);
    }
  }
}

/**
 * Get or create warmup promise for deduplication
 * Returns existing promise if warmup is in progress or recently completed
 * @param {string} key - Cache key
 * @param {Function} warmupFn - Function that returns a Promise for the warmup
 * @returns {{ promise: Promise, isNew: boolean }}
 */
function getOrCreateWarmupPromise(key, warmupFn) {
  // Cleanup expired entries
  cleanupExpiredWarmups();

  const existing = warmupPromises.get(key);
  if (existing) {
    // Return existing promise (either in progress or recently completed)
    return { promise: existing.promise, isNew: false };
  }

  // Create new promise and store it immediately (before awaiting)
  const promise = warmupFn();
  warmupPromises.set(key, { promise, timestamp: Date.now() });

  return { promise, isNew: true };
}

// Configure Puppeteer with stealth mode
puppeteer.use(StealthPlugin());

/**
 * Extract text from PDF file
 * @param {string} filePath - Path to PDF
 * @returns {Promise<Object>} - { name, text, source_path }
 */
async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let text = '';
        if (pdfData.Pages) {
          pdfData.Pages.forEach(page => {
            if (page.Texts) {
              page.Texts.forEach(textItem => {
                if (textItem.R) {
                  textItem.R.forEach(r => {
                    if (r.T) {
                      text += decodeURIComponent(r.T) + ' ';
                    }
                  });
                }
              });
              text += '\n';
            }
          });
        }

        resolve({
          name: path.basename(filePath),
          text: text.trim(),
          source_path: filePath
        });
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.loadPDF(filePath);
  });
}

/**
 * Try simple HTTP fetch to detect antibot protection
 * @param {string} url - URL to fetch
 * @returns {Promise<string|null>} - HTML if success, null if antibot detected
 */
async function trySimpleFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    if (response.status === 403 || response.status === 401 || response.status === 503) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Detect antibot protection patterns
    const antibotPatterns = [
      /cloudflare/i,
      /please complete the security check/i,
      /enable javascript and cookies to continue/i,
      /checking your browser/i,
      /just a moment/i,
      /ddos-guard/i,
      /captcha/i,
      /recaptcha/i,
      /bot protection/i,
      /access denied/i,
    ];

    const hasAntibot = antibotPatterns.some(pattern => pattern.test(html));

    if (hasAntibot) {
      return null;
    }

    return html;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch HTML from URL with fallback to Puppeteer
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - HTML content
 */
async function fetchHtmlWithFallback(url) {
  // Try simple fetch first
  let html = await trySimpleFetch(url);

  if (html) {
    console.log(`[fetchHtmlWithFallback] Simple fetch success for ${url}`);
    return html;
  }

  // Fallback to Puppeteer
  console.log(`[fetchHtmlWithFallback] Using Puppeteer for ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
    timeout: 60000,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for dynamic content
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch (e) {
      // Ignore
    }
    await new Promise(resolve => setTimeout(resolve, 3000));

    html = await page.content();
    await browser.close();

    return html;
  } catch (error) {
    try {
      await browser.close();
    } catch (closeError) {
      console.error('[fetchHtmlWithFallback] Error closing browser:', closeError);
    }
    throw error;
  }
}

/**
 * Validate job offer extraction (check if not empty)
 * @param {Object} extraction - Extracted job offer
 * @returns {boolean} - true if valid, false if empty
 */
function isJobOfferValid(extraction) {
  if (!extraction) return false;

  // Must have title and at least some skills
  const hasTitle = extraction.title && extraction.title.trim().length > 0;
  const hasSkills = extraction.skills &&
    ((extraction.skills.required && extraction.skills.required.length > 0) ||
     (extraction.skills.nice_to_have && extraction.skills.nice_to_have.length > 0));

  return hasTitle || hasSkills;
}

/**
 * Extract job offer from URL with Structured Outputs
 * @param {string} url - Job offer URL
 * @param {string} userId - User ID for telemetry
 * @returns {Promise<Object>} - { extraction, tokensUsed, model }
 */
async function extractJobOfferFromUrl(url, userId) {
  const client = getOpenAIClient();

  // 1. Fetch HTML
  const html = await fetchHtmlWithFallback(url);

  // 2. Convert to Markdown using Readability + Turndown
  const { content: markdown, title } = extractJobOfferContent(html, url);

  if (!markdown || markdown.length < 100) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.noJobOfferDetected',
      source: url
    }));
  }

  // 3. Extract with Structured Outputs
  const schema = await loadJobOfferSchema();
  const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer-v2/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer-v2/user.md', {
    sourceContent: markdown
  });

  const extractModel = await getAiModelSetting('model_extract_job_offer');

  const requestOptions = addTemperatureIfSupported({
    model: extractModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
    max_completion_tokens: 2000,
  }, 0.1);

  const startTime = Date.now();
  const response = await client.chat.completions.create(requestOptions);
  const duration = Date.now() - startTime;

  // Track usage
  if (userId && response.usage) {
    await trackOpenAIUsage({
      userId,
      featureName: 'extract_job_offer_url',
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
      source: url
    }));
  }

  return {
    extraction,
    tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    model: extractModel,
    title: extraction.title || title || 'Job Offer'
  };
}

/**
 * Extract job offer from PDF with Structured Outputs
 * @param {string} pdfPath - Path to PDF file
 * @param {string} userId - User ID for telemetry
 * @returns {Promise<Object>} - { extraction, tokensUsed, model }
 */
async function extractJobOfferFromPdf(pdfPath, userId) {
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
  const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer-v2/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer-v2/user.md', {
    sourceContent: pdfData.text
  });

  const extractModel = await getAiModelSetting('model_extract_job_offer');

  const requestOptions = addTemperatureIfSupported({
    model: extractModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
    max_completion_tokens: 2000,
  }, 0.1);

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

  return {
    extraction,
    tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    model: extractModel,
    name: pdfData.name,
    title: extraction.title || pdfData.name
  };
}

/**
 * Store job offer in database
 * @param {string} userId - User ID
 * @param {string} sourceType - 'url' or 'pdf'
 * @param {string} sourceValue - URL or filename
 * @param {Object} extraction - Structured extraction
 * @param {string} model - Model used for extraction
 * @param {number} tokensUsed - Tokens consumed
 * @param {string|null} contentHash - SHA256 hash of content (for PDFs)
 * @returns {Promise<Object>} - Stored JobOffer record
 */
async function storeJobOffer(userId, sourceType, sourceValue, extraction, model, tokensUsed, contentHash = null) {
  return prisma.jobOffer.upsert({
    where: {
      userId_sourceValue: { userId, sourceValue }
    },
    update: {
      content: extraction,
      contentHash,
      extractedAt: new Date(),
      extractionModel: model,
      tokensUsed,
    },
    create: {
      userId,
      sourceType,
      sourceValue,
      contentHash,
      content: extraction,
      extractionModel: model,
      tokensUsed,
    },
  });
}

/**
 * Get job offer from cache or extract from URL
 * @param {string} userId - User ID
 * @param {string} url - Job offer URL
 * @returns {Promise<Object>} - { extraction, jobOfferId, title, fromCache }
 */
async function getOrExtractJobOfferFromUrl(userId, url) {
  // 1. Check if already extracted (by URL)
  const existing = await prisma.jobOffer.findUnique({
    where: { userId_sourceValue: { userId, sourceValue: url } }
  });

  if (existing) {
    console.log(`[generateCv] JobOffer found in cache for URL: ${url}`);
    return {
      extraction: existing.content,
      jobOfferId: existing.id,
      title: existing.content?.title || 'Job Offer',
      fromCache: true,
    };
  }

  // 2. Extract via OpenAI
  console.log(`[generateCv] Extracting job offer from URL: ${url}`);
  const { extraction, tokensUsed, model, title } = await extractJobOfferFromUrl(url, userId);

  // 3. Store in DB
  const stored = await storeJobOffer(userId, 'url', url, extraction, model, tokensUsed);

  return {
    extraction,
    jobOfferId: stored.id,
    title,
    fromCache: false,
  };
}

/**
 * Get job offer from cache or extract from PDF
 * Uses content hash to identify identical PDFs (even with different names)
 * @param {string} userId - User ID
 * @param {string} pdfPath - Path to PDF file
 * @param {string} displayName - Display name for the PDF
 * @returns {Promise<Object>} - { extraction, jobOfferId, title, fromCache }
 */
async function getOrExtractJobOfferFromPdf(userId, pdfPath, displayName) {
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
    };
  }

  // 4. Extract via OpenAI (we already have the text)
  console.log(`[generateCv] Extracting job offer from PDF: ${displayName}`);
  const { extraction, tokensUsed, model, title } = await extractJobOfferFromPdfText(pdfData.text, userId);

  // 5. Store in DB with hash
  const stored = await storeJobOffer(userId, 'pdf', displayName, extraction, model, tokensUsed, contentHash);

  return {
    extraction,
    jobOfferId: stored.id,
    title: title || displayName,
    fromCache: false,
  };
}

/**
 * Extract job offer from PDF text (internal helper - text already extracted)
 * @param {string} pdfText - Extracted text from PDF
 * @param {string} userId - User ID for telemetry
 * @returns {Promise<Object>} - { extraction, tokensUsed, model, title }
 */
async function extractJobOfferFromPdfText(pdfText, userId) {
  const client = getOpenAIClient();

  // Extract with Structured Outputs
  const schema = await loadJobOfferSchema();
  const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer-v2/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer-v2/user.md', {
    sourceContent: pdfText
  });

  const extractModel = await getAiModelSetting('model_extract_job_offer');

  const requestOptions = addTemperatureIfSupported({
    model: extractModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
    max_completion_tokens: 2000,
  }, 0.1);

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
      source: 'PDF'
    }));
  }

  return {
    extraction,
    tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    model: extractModel,
    title: extraction.title
  };
}

/**
 * Warmup OpenAI prompt cache with CV prefix
 * Uses Promise-based deduplication to prevent concurrent warmups
 * @param {Object} params
 * @param {Object} params.sourceCv - Parsed source CV JSON
 * @param {string} params.userId - User ID for telemetry
 * @param {AbortSignal} params.signal - Abort signal
 * @returns {Promise<{ success: boolean, promptTokens: number, cachedTokens: number, skipped: boolean }>}
 */
async function performWarmup({ sourceCv, userId, signal }) {
  const cvString = JSON.stringify(sourceCv);
  const cvHash = computeContentHash(cvString).substring(0, 16);
  const cacheKey = `${userId}_${cvHash}`;

  const { promise, isNew } = getOrCreateWarmupPromise(cacheKey, async () => {
    return await executeWarmup({ sourceCv, userId, signal });
  });

  if (!isNew) {
    console.log(`[generateCv] Cache warmup deduped (waiting for existing): key=${cacheKey}`);
  }

  try {
    const result = await promise;
    return { ...result, skipped: !isNew };
  } catch (error) {
    // If warmup fails, remove from cache so next attempt can retry
    warmupPromises.delete(cacheKey);
    // Re-throw only if it's an abort error, otherwise return failure
    if (error.name === 'AbortError') {
      throw error;
    }
    return { success: false, promptTokens: 0, cachedTokens: 0, skipped: false };
  }
}

/**
 * Execute the actual warmup call to OpenAI
 * This is called only once per unique cache key due to Promise deduplication
 * @param {Object} params
 * @param {Object} params.sourceCv - Parsed source CV JSON
 * @param {string} params.userId - User ID for telemetry
 * @param {AbortSignal} params.signal - Abort signal
 * @returns {Promise<{ success: boolean, promptTokens: number, cachedTokens: number }>}
 */
async function executeWarmup({ sourceCv, userId, signal }) {
  const client = getOpenAIClient();
  const model = await getCvModel();
  const schema = await loadCvModificationsSchema();

  const systemPrompt = await loadPrompt('lib/openai/prompts/generate-cv-v2/system.md');
  const warmupUserPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv-v2/user.md', {
    mainCvContent: JSON.stringify(sourceCv, null, 2),
    jobOfferContent: JSON.stringify({
      title: 'Warmup',
      company: 'N/A',
      skills: { required: [], nice_to_have: [] }
    }, null, 2)
  });

  let requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: warmupUserPrompt }
    ],
    response_format: { type: 'json_schema', json_schema: schema },
    max_completion_tokens: 50,
  };

  requestOptions = addCacheRetentionIfSupported(requestOptions);

  const fetchOptions = signal ? { signal } : {};
  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create(requestOptions, fetchOptions);
    const duration = Date.now() - startTime;

    const promptTokens = response.usage?.prompt_tokens || 0;
    const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;
    const cacheHitRate = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : '0';

    console.log(`[generateCv] Cache warmup executed:`, {
      model,
      promptTokens,
      cachedTokens,
      cacheHitRate: `${cacheHitRate}%`,
      duration: `${duration}ms`,
    });

    // Track warmup call
    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cache_warmup',
        model,
        promptTokens,
        completionTokens: response.usage?.completion_tokens || 0,
        cachedTokens,
        duration,
      });
    }

    return { success: true, promptTokens, cachedTokens };
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.warn(`[generateCv] Cache warmup failed (non-blocking):`, error.message);
    }
    return { success: false, promptTokens: 0, cachedTokens: 0 };
  }
}

/**
 * Generate CV modifications with Structured Outputs
 * @param {Object} sourceCv - Source CV JSON
 * @param {Object} jobOffer - Extracted job offer
 * @param {string} userId - User ID for telemetry
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<Object>} - { modifications, reasoning, tokensUsed }
 */
async function generateCvModifications(sourceCv, jobOffer, userId, signal) {
  const client = getOpenAIClient();
  const model = await getCvModel();
  const schema = await loadCvModificationsSchema();

  const systemPrompt = await loadPrompt('lib/openai/prompts/generate-cv-v2/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv-v2/user.md', {
    mainCvContent: JSON.stringify(sourceCv, null, 2),
    jobOfferContent: JSON.stringify(jobOffer, null, 2)
  });

  let requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
    max_completion_tokens: 2000,
  };

  // Add 24h cache retention for GPT-5 models
  requestOptions = addCacheRetentionIfSupported(requestOptions);

  const fetchOptions = signal ? { signal } : {};
  const startTime = Date.now();
  const response = await client.chat.completions.create(requestOptions, fetchOptions);
  const duration = Date.now() - startTime;

  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // Extract cache stats for logging
  const promptTokens = response.usage?.prompt_tokens || 0;
  const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;
  const completionTokens = response.usage?.completion_tokens || 0;
  const cacheHitRate = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : '0';

  // Log cache performance
  console.log(`[generateCv] Modifications call:`, {
    model,
    promptTokens,
    cachedTokens,
    cacheHitRate: `${cacheHitRate}%`,
    completionTokens,
    duration: `${duration}ms`,
  });

  // Track usage
  if (userId && response.usage) {
    await trackOpenAIUsage({
      userId,
      featureName: 'generate_cv_modifications',
      model,
      promptTokens,
      completionTokens,
      cachedTokens,
      duration,
    });
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noAiResponse' }));
  }

  const result = JSON.parse(content);

  return {
    modifications: result.modifications,
    reasoning: result.reasoning,
    tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    model,
  };
}

/**
 * Main CV generation function
 * @param {Object} params
 * @param {string} params.mainCvContent - JSON string of source CV
 * @param {string} params.referenceFile - Source filename
 * @param {Array<string>} params.links - Job offer URLs
 * @param {Array<Object>} params.files - PDF files with path
 * @param {AbortSignal} params.signal - Abort signal
 * @param {string} params.userId - User ID for telemetry
 * @returns {Promise<Array>} - Array of results with cvContent, jobOfferId, reasoning
 */
export async function generateCv({
  mainCvContent,
  referenceFile = 'main.json',
  links = [],
  files = [],
  signal = null,
  userId = null
}) {
  if (!mainCvContent) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.cvContentMissing' }));
  }

  // Check OpenAI credits
  await checkOpenAICredits();

  // Parse source CV
  const sourceCv = typeof mainCvContent === 'string' ? JSON.parse(mainCvContent) : mainCvContent;

  const results = [];
  const totalSources = (links?.length || 0) + (files?.length || 0);
  let warmupCompleted = false;

  // Process URLs
  if (links?.length > 0) {
    // First URL: run warmup in parallel with extraction (always warmup for cache benefit)
    const firstUrl = links[0];

    try {
      // Launch warmup and first extraction in parallel
      const [warmupResult, firstJobOffer] = await Promise.all([
        !signal?.aborted
          ? performWarmup({ sourceCv, userId, signal })
          : Promise.resolve(null),
        getOrExtractJobOfferFromUrl(userId, firstUrl)
      ]);

      warmupCompleted = warmupResult?.success || false;

      if (firstJobOffer.fromCache) {
        console.log(`[generateCv] Skipped OpenAI extraction for URL (cached): ${firstUrl}`);
      }

      // Generate modifications for first URL
      const { modifications, reasoning } = await generateCvModifications(
        sourceCv,
        firstJobOffer.extraction,
        userId,
        signal
      );

      const adaptedCv = applyModifications(sourceCv, { modifications, reasoning });
      results.push({
        cvContent: JSON.stringify(adaptedCv, null, 2),
        source: firstUrl,
        jobOfferId: firstJobOffer.jobOfferId,
        jobOfferTitle: firstJobOffer.title,
        reasoning,
      });
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        throw new Error('Task cancelled');
      }
      throw error;
    }

    // Process remaining URLs (benefit from cache)
    for (let i = 1; i < links.length; i++) {
      const url = links[i];
      try {
        const { extraction, jobOfferId, title, fromCache } = await getOrExtractJobOfferFromUrl(userId, url);

        if (fromCache) {
          console.log(`[generateCv] Skipped OpenAI extraction for URL (cached): ${url}`);
        }

        const { modifications, reasoning } = await generateCvModifications(
          sourceCv,
          extraction,
          userId,
          signal
        );

        const adaptedCv = applyModifications(sourceCv, { modifications, reasoning });
        results.push({
          cvContent: JSON.stringify(adaptedCv, null, 2),
          source: url,
          jobOfferId,
          jobOfferTitle: title,
          reasoning,
        });
      } catch (error) {
        if (error.name === 'AbortError' || signal?.aborted) {
          throw new Error('Task cancelled');
        }
        throw error;
      }
    }
  }

  // Process PDFs
  if (files?.length > 0) {
    // If we have PDFs and no URLs were processed, warmup with first PDF
    const shouldWarmupForPdf = !warmupCompleted && links?.length === 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.path) continue;

      try {
        await fs.access(file.path);
        const displayName = file.name || path.basename(file.path);

        // First PDF: warmup in parallel if needed
        if (i === 0 && shouldWarmupForPdf) {
          const [warmupResult, firstJobOffer] = await Promise.all([
            !signal?.aborted
              ? performWarmup({ sourceCv, userId, signal })
              : Promise.resolve(null),
            getOrExtractJobOfferFromPdf(userId, file.path, displayName)
          ]);

          warmupCompleted = warmupResult?.success || false;

          if (firstJobOffer.fromCache) {
            console.log(`[generateCv] Skipped OpenAI extraction for PDF (cached by hash): ${displayName}`);
          }

          const { modifications, reasoning } = await generateCvModifications(
            sourceCv,
            firstJobOffer.extraction,
            userId,
            signal
          );

          const adaptedCv = applyModifications(sourceCv, { modifications, reasoning });
          results.push({
            cvContent: JSON.stringify(adaptedCv, null, 2),
            source: displayName,
            jobOfferId: firstJobOffer.jobOfferId,
            jobOfferTitle: firstJobOffer.title,
            reasoning,
          });
          continue;
        }

        // Regular PDF processing
        const { extraction, jobOfferId, title, fromCache } = await getOrExtractJobOfferFromPdf(userId, file.path, displayName);

        if (fromCache) {
          console.log(`[generateCv] Skipped OpenAI extraction for PDF (cached by hash): ${displayName}`);
        }

        const { modifications, reasoning } = await generateCvModifications(
          sourceCv,
          extraction,
          userId,
          signal
        );

        const adaptedCv = applyModifications(sourceCv, { modifications, reasoning });
        results.push({
          cvContent: JSON.stringify(adaptedCv, null, 2),
          source: displayName,
          jobOfferId,
          jobOfferTitle: title,
          reasoning,
        });
      } catch (error) {
        if (error.name === 'AbortError' || signal?.aborted) {
          throw new Error('Task cancelled');
        }
        if (error.code === 'ENOENT') {
          console.error(`[generateCv] File not found: ${file.path}`);
          continue;
        }
        throw error;
      }
    }
  }

  // If no sources provided, return error
  if (results.length === 0 && (links?.length > 0 || files?.length > 0)) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noSourceProcessed' }));
  }

  return results;
}

// Export for backward compatibility (used by other modules)
export { extractJobOfferFromUrl, extractJobOfferFromPdf, storeJobOffer };
