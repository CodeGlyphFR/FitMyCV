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
import pdfParse from 'pdf-parse';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getOpenAIClient, getCvModel, checkOpenAICredits, addTemperatureIfSupported, addCacheRetentionIfSupported } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { loadJobOfferSchema } from './schemaLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { htmlToMarkdown, extractJobOfferContent, shouldUsePuppeteerFirst, getSelectorsForUrl } from '@/lib/utils/htmlToMarkdown.js';
import { applyModifications, sanitizeCvSkills } from '@/lib/cv/applyModifications.js';
import prisma from '@/lib/prisma';
import { detectCvLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';

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
 * Extract text from PDF file using pdf-parse (based on Mozilla's pdf.js)
 * Better handling of custom fonts (Type3) compared to pdf2json
 * @param {string} filePath - Path to PDF
 * @returns {Promise<Object>} - { name, text, source_path }
 */
async function extractTextFromPdf(filePath) {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdfParse(dataBuffer);

  return {
    name: path.basename(filePath),
    text: data.text.trim(),
    source_path: filePath
  };
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
 * Auto-scroll page to load lazy content
 * @param {Page} page - Puppeteer page
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const maxScroll = 3000; // Max scroll distance

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight || totalHeight > maxScroll) {
          clearInterval(timer);
          // Scroll back to top
          window.scrollTo(0, 0);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Fetch HTML from URL with intelligent strategy
 * Uses Puppeteer first for known protected/SPA sites
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - HTML content
 */
async function fetchHtmlWithFallback(url) {
  // Check if this URL should use Puppeteer first (protected/SPA sites)
  const usePuppeteerFirst = shouldUsePuppeteerFirst(url);

  if (usePuppeteerFirst) {
    console.log(`[fetchHtmlWithFallback] Using Puppeteer first for protected/SPA site: ${url}`);
    return fetchWithPuppeteer(url, { waitForContent: true, autoScroll: true });
  }

  // Try simple fetch first for other sites
  let html = await trySimpleFetch(url);

  if (html) {
    console.log(`[fetchHtmlWithFallback] Simple fetch success for ${url}`);
    return html;
  }

  // Fallback to Puppeteer
  console.log(`[fetchHtmlWithFallback] Simple fetch failed, using Puppeteer for ${url}`);
  return fetchWithPuppeteer(url, { waitForContent: false, autoScroll: false });
}

/**
 * Fetch HTML using Puppeteer with options
 * @param {string} url - URL to fetch
 * @param {Object} options - { waitForContent: boolean, autoScroll: boolean }
 * @returns {Promise<string>} - HTML content
 */
async function fetchWithPuppeteer(url, options = {}) {
  const { waitForContent = false, autoScroll: shouldScroll = false } = options;

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

    // Use networkidle2 for SPA sites that need JS to render
    const waitUntil = waitForContent ? 'networkidle2' : 'domcontentloaded';

    await page.goto(url, {
      waitUntil,
      timeout: 30000
    });

    // Wait for body
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch (e) {
      // Ignore
    }

    // Try to wait for site-specific selectors
    if (waitForContent) {
      const selectors = getSelectorsForUrl(url);
      for (const selector of selectors.slice(0, 3)) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          console.log(`[fetchWithPuppeteer] Found selector: ${selector}`);
          break;
        } catch (e) {
          // Continue with next selector
        }
      }
    }

    // Auto-scroll for lazy-loaded content
    if (shouldScroll) {
      await autoScroll(page);
    }

    // Additional wait for JS execution
    await new Promise(resolve => setTimeout(resolve, waitForContent ? 2000 : 3000));

    const html = await page.content();
    await browser.close();

    return html;
  } catch (error) {
    try {
      await browser.close();
    } catch (closeError) {
      console.error('[fetchWithPuppeteer] Error closing browser:', closeError);
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
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, tokensUsed, model }
 */
async function extractJobOfferFromUrl(url, userId, signal = null) {
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
  const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
    jobTitle: title || 'Non spécifié (à extraire du contenu)',
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
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, tokensUsed, model }
 */
async function extractJobOfferFromPdf(pdfPath, userId, signal = null) {
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
  const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
    jobTitle: 'Non spécifié (à extraire du contenu)',
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
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, jobOfferId, title, fromCache }
 */
async function getOrExtractJobOfferFromUrl(userId, url, signal = null) {
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
  const { extraction, tokensUsed, model, title } = await extractJobOfferFromUrl(url, userId, signal);

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
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, jobOfferId, title, fromCache }
 */
async function getOrExtractJobOfferFromPdf(userId, pdfPath, displayName, signal = null) {
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
  const { extraction, tokensUsed, model, title } = await extractJobOfferFromPdfText(pdfData.text, userId, signal);

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
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, tokensUsed, model, title }
 */
async function extractJobOfferFromPdfText(pdfText, userId, signal = null) {
  const client = getOpenAIClient();

  // Extract with Structured Outputs
  const schema = await loadJobOfferSchema();
  const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
    jobTitle: 'Non spécifié (à extraire du contenu)',
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

  return {
    extraction,
    tokensUsed: (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0),
    model: extractModel,
    title: extraction.title
  };
}

/**
 * Warmup OpenAI prompt cache
 * Uses Promise-based deduplication to prevent concurrent warmups
 *
 * The warmup always sends the same prompt structure (system + schema + minimal job offer)
 * to maximize cache hit rate. One warmup per user session (5 min TTL).
 *
 * @param {Object} params
 * @param {string} params.userId - User ID for telemetry and cache key
 * @param {AbortSignal} params.signal - Abort signal
 * @returns {Promise<{ success: boolean, promptTokens: number, cachedTokens: number, skipped: boolean }>}
 */
async function performWarmup({ userId, signal }) {
  // Single cache key per user - shared between template and CV generation
  const cacheKey = `warmup_${userId}`;

  const { promise, isNew } = getOrCreateWarmupPromise(cacheKey, async () => {
    return await executeWarmup({ userId, signal });
  });

  if (!isNew) {
    console.log(`[warmup] Cache warmup deduped (waiting for existing): key=${cacheKey}`);
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
 * Load CV schema template (for warmup)
 * @returns {Promise<string>} - CV schema JSON string
 */
async function getCvSchemaForWarmup() {
  const projectRoot = process.cwd();
  const templatePath = path.join(projectRoot, 'data', 'template.json');

  try {
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    // Fallback: minimal schema
    return JSON.stringify({
      header: { full_name: '', current_title: '' },
      summary: { headline: '', description: '' },
      skills: { hard_skills: [], soft_skills: [] },
      experience: [],
      education: [],
      languages: []
    }, null, 2);
  }
}

/**
 * Execute the actual warmup call to OpenAI
 * This is called only once per unique cache key due to Promise deduplication
 *
 * Always uses the same prompt structure (generate-cv prompts with schema)
 * to maximize cache hit rate across both template and CV generation.
 *
 * @param {Object} params
 * @param {string} params.userId - User ID for telemetry
 * @param {AbortSignal} params.signal - Abort signal
 * @returns {Promise<{ success: boolean, promptTokens: number, cachedTokens: number }>}
 */
async function executeWarmup({ userId, signal }) {
  const client = getOpenAIClient();
  const model = await getCvModel();

  // Load CV schema (stable content for cache)
  const cvSchema = await getCvSchemaForWarmup();

  // Load ONLY the shared base prompt (the cacheable prefix)
  // This is the common prefix used by both createTemplateCv and generateCv
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/_shared/system-base.md', {
    cvSchema
  });

  // Minimal user prompt for warmup
  const warmupUserPrompt = 'Warmup - confirme que tu es pret.';

  let requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: warmupUserPrompt }
    ],
    response_format: { type: 'json_object' },
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

    console.log(`[warmup] Cache warmup executed:`, {
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
      console.warn(`[warmup] Cache warmup failed (non-blocking):`, error.message);
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
 * @param {string} jobOfferLanguage - Language code of the job offer (fr, en, es, de)
 * @returns {Promise<Object>} - { modifications, reasoning, tokensUsed }
 */
async function generateCvModifications(sourceCv, jobOffer, userId, signal, jobOfferLanguage) {
  const client = getOpenAIClient();
  const model = await getCvModel();

  // Load CV schema for system prompt (cache prefix)
  const cvSchema = await getCvSchemaForWarmup();

  // Resolve language name for prompts (default to français if not specified)
  const languageName = getLanguageName(jobOfferLanguage) || 'français';

  // System prompt with cvSchema and language injected (same prefix as warmup)
  // V2: Refactored prompts with Chain-of-Thought and simplified rules
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv/system-v2-proposal.md', {
    cvSchema,
    jobOfferLanguage: languageName
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv/user-v2-proposal.md', {
    mainCvContent: JSON.stringify(sourceCv, null, 2),
    jobOfferContent: JSON.stringify(jobOffer, null, 2),
    jobOfferLanguage: languageName
  });

  // Use json_object instead of json_schema to allow omitting unchanged sections
  // This reduces output tokens by 70-97% for simple modifications
  let requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_object'
    },
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

  // Log cache performance and output tokens
  console.log(`[generateCv] Modifications call:`, {
    model,
    promptTokens,
    cachedTokens,
    cacheHitRate: `${cacheHitRate}%`,
    completionTokens,  // <-- OUTPUT TOKENS (objectif: réduire de ~1600 à ~50-200)
    duration: `${duration}ms`,
  });

  // DEBUG: Log raw response content for token optimization analysis
  const rawContent = response.choices?.[0]?.message?.content;
  const reasoningTokens = response.usage?.completion_tokens_details?.reasoning_tokens || 0;
  console.log(`[generateCv] OUTPUT TOKENS DEBUG:`, {
    completionTokens,
    reasoningTokens,
    outputTokens: completionTokens - reasoningTokens,
    contentLength: rawContent?.length || 0,
  });
  console.log(`[generateCv] FULL RESPONSE:\n${rawContent}`);

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
 * Generate complete adapted CV (for cross-language scenarios)
 * When the source CV and job offer are in different languages,
 * we need to generate the complete CV to ensure proper translation.
 *
 * @param {Object} sourceCv - Source CV JSON
 * @param {Object} jobOffer - Extracted job offer
 * @param {string} userId - User ID for telemetry
 * @param {AbortSignal} signal - Abort signal
 * @param {string} jobOfferLanguage - Target language code (fr, en, es, de)
 * @returns {Promise<Object>} - { cvContent, reasoning, tokensUsed, model }
 */
async function generateCompleteCv(sourceCv, jobOffer, userId, signal, jobOfferLanguage) {
  const client = getOpenAIClient();
  const model = await getCvModel();
  const cvSchema = await getCvSchemaForWarmup();
  const languageName = getLanguageName(jobOfferLanguage) || 'français';

  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv-complete/system.md', {
    cvSchema,
    jobOfferLanguage: languageName
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv-complete/user.md', {
    mainCvContent: JSON.stringify(sourceCv, null, 2),
    jobOfferContent: JSON.stringify(jobOffer, null, 2),
    jobOfferLanguage: languageName
  });

  let requestOptions = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: { type: 'json_object' },
  };

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

  console.log(`[generateCv] Complete CV generation (cross-language):`, {
    model,
    targetLanguage: languageName,
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
      featureName: 'generate_cv_complete',
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

  const adaptedCv = JSON.parse(content);

  // Sanitize skill names (remove special chars, limit to 3 words)
  sanitizeCvSkills(adaptedCv);

  // Ensure the language field is set correctly
  adaptedCv.language = jobOfferLanguage;

  return {
    cvContent: adaptedCv,
    reasoning: `CV adapté et traduit en ${languageName}`,
    tokensUsed: promptTokens + completionTokens,
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

  // Detect source CV language for hybrid generation approach
  const sourceCvLanguage = sourceCv.language || detectCvLanguage(sourceCv);
  console.log(`[generateCv] Source CV language: ${sourceCvLanguage}`);

  const results = [];

  // Process URLs
  if (links?.length > 0) {
    const firstUrl = links[0];

    try {
      // Extract job offer from first URL
      const firstJobOffer = await getOrExtractJobOfferFromUrl(userId, firstUrl, signal);

      if (firstJobOffer.fromCache) {
        console.log(`[generateCv] Skipped OpenAI extraction for URL (cached): ${firstUrl}`);
      }

      // Determine if cross-language generation is needed
      const jobOfferLang = firstJobOffer.extraction?.language || 'fr';
      const needsFullGeneration = sourceCvLanguage !== jobOfferLang;

      let adaptedCv, reasoning;

      if (needsFullGeneration) {
        // Cross-language: generate complete CV with translation
        console.log(`[generateCv] Cross-language detected: CV=${sourceCvLanguage}, JobOffer=${jobOfferLang} - using complete generation`);
        const result = await generateCompleteCv(sourceCv, firstJobOffer.extraction, userId, signal, jobOfferLang);
        adaptedCv = result.cvContent;
        reasoning = result.reasoning;
      } else {
        // Same language: use efficient diff approach
        const { modifications, reasoning: diffReasoning } = await generateCvModifications(
          sourceCv,
          firstJobOffer.extraction,
          userId,
          signal,
          jobOfferLang
        );
        adaptedCv = applyModifications(sourceCv, { modifications, reasoning: diffReasoning });
        reasoning = diffReasoning;
      }

      results.push({
        cvContent: JSON.stringify(adaptedCv, null, 2),
        source: firstUrl,
        jobOfferId: firstJobOffer.jobOfferId,
        jobOfferTitle: firstJobOffer.title,
        jobOfferLanguage: jobOfferLang,
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
        const { extraction, jobOfferId, title, fromCache } = await getOrExtractJobOfferFromUrl(userId, url, signal);

        if (fromCache) {
          console.log(`[generateCv] Skipped OpenAI extraction for URL (cached): ${url}`);
        }

        // Determine if cross-language generation is needed
        const jobOfferLang = extraction?.language || 'fr';
        const needsFullGeneration = sourceCvLanguage !== jobOfferLang;

        let adaptedCv, reasoning;

        if (needsFullGeneration) {
          // Cross-language: generate complete CV with translation
          console.log(`[generateCv] Cross-language detected: CV=${sourceCvLanguage}, JobOffer=${jobOfferLang} - using complete generation`);
          const result = await generateCompleteCv(sourceCv, extraction, userId, signal, jobOfferLang);
          adaptedCv = result.cvContent;
          reasoning = result.reasoning;
        } else {
          // Same language: use efficient diff approach
          const { modifications, reasoning: diffReasoning } = await generateCvModifications(
            sourceCv,
            extraction,
            userId,
            signal,
            jobOfferLang
          );
          adaptedCv = applyModifications(sourceCv, { modifications, reasoning: diffReasoning });
          reasoning = diffReasoning;
        }

        results.push({
          cvContent: JSON.stringify(adaptedCv, null, 2),
          source: url,
          jobOfferId,
          jobOfferTitle: title,
          jobOfferLanguage: jobOfferLang,
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
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.path) continue;

      try {
        await fs.access(file.path);
        const displayName = file.name || path.basename(file.path);

        // Extract job offer from PDF
        const { extraction, jobOfferId, title, fromCache } = await getOrExtractJobOfferFromPdf(userId, file.path, displayName, signal);

        if (fromCache) {
          console.log(`[generateCv] Skipped OpenAI extraction for PDF (cached by hash): ${displayName}`);
        }

        // Determine if cross-language generation is needed
        const jobOfferLang = extraction?.language || 'fr';
        const needsFullGeneration = sourceCvLanguage !== jobOfferLang;

        let adaptedCv, reasoning;

        if (needsFullGeneration) {
          // Cross-language: generate complete CV with translation
          console.log(`[generateCv] Cross-language detected: CV=${sourceCvLanguage}, JobOffer=${jobOfferLang} - using complete generation`);
          const result = await generateCompleteCv(sourceCv, extraction, userId, signal, jobOfferLang);
          adaptedCv = result.cvContent;
          reasoning = result.reasoning;
        } else {
          // Same language: use efficient diff approach
          const { modifications, reasoning: diffReasoning } = await generateCvModifications(
            sourceCv,
            extraction,
            userId,
            signal,
            jobOfferLang
          );
          adaptedCv = applyModifications(sourceCv, { modifications, reasoning: diffReasoning });
          reasoning = diffReasoning;
        }

        results.push({
          cvContent: JSON.stringify(adaptedCv, null, 2),
          source: displayName,
          jobOfferId,
          jobOfferTitle: title,
          jobOfferLanguage: jobOfferLang,
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
export {
  extractJobOfferFromUrl,
  extractJobOfferFromPdf,
  storeJobOffer,
  getOrExtractJobOfferFromUrl,
  getOrExtractJobOfferFromPdf,
  fetchHtmlWithFallback,
};
