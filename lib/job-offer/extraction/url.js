/**
 * Job Offer Extraction - URL functions
 *
 * Functions for extracting job offers from URLs.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getOpenAIClient, addTemperatureIfSupported, adjustTokensForReasoningModel } from '@/lib/openai-core/client.js';
import { loadPrompt, loadPromptWithVars } from '@/lib/openai-core/promptLoader.js';
import { loadSchema } from '@/lib/openai-core/schemaLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { htmlToMarkdown, extractJobOfferContent, shouldUsePuppeteerFirst, getSelectorsForUrl } from '@/lib/utils/htmlToMarkdown.js';
import { detectExpiredOrDeletedPage } from '@/lib/utils/htmlToMarkdown/detection';
import { normalizeJobUrl } from '@/lib/utils/normalizeJobUrl.js';
import prisma from '@/lib/prisma';
import { isJobOfferValid, storeJobOffer } from './helpers.js';
import { detectJobOfferLanguageWithOpenAI } from './languageDetection.js';

// Configure Puppeteer with stealth mode
puppeteer.use(StealthPlugin());

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
 * Fetch HTML from URL with intelligent strategy
 * Uses Puppeteer first for known protected/SPA sites
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - HTML content
 */
export async function fetchHtmlWithFallback(url) {
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
 * Load the Job Offer Extraction schema
 * @returns {Promise<Object>} - Job offer extraction schema
 */
async function loadJobOfferSchema() {
  return loadSchema('lib/job-offer/schemas/jobOfferExtractionSchema.json');
}

/**
 * Extract job offer from URL with Structured Outputs
 * @param {string} url - Job offer URL
 * @param {string} userId - User ID for telemetry
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, tokensUsed, model }
 */
export async function extractJobOfferFromUrl(url, userId, signal = null) {
  const client = getOpenAIClient();

  // 0. Normalize URL (remove tracking parameters)
  const normalizedUrl = normalizeJobUrl(url);
  if (normalizedUrl !== url) {
    console.log(`[extract] URL normalized: ${url} → ${normalizedUrl}`);
  }

  // 1. Fetch HTML
  const html = await fetchHtmlWithFallback(normalizedUrl);

  // 2. Convert to Markdown using Readability + Turndown
  const { content: markdown, title } = extractJobOfferContent(html, url);

  if (!markdown || markdown.length < 100) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.noJobOfferDetected',
      source: url
    }));
  }

  // Check for expired/deleted pages BEFORE calling OpenAI
  const expiredCheck = detectExpiredOrDeletedPage(markdown, html, url);
  if (expiredCheck.isExpiredPage) {
    console.log(`[extract] Expired page detected: ${expiredCheck.reason}`);
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.jobOfferExpired'
    }));
  }

  // 3. Extract with Structured Outputs
  const schema = await loadJobOfferSchema();
  const systemPrompt = await loadPrompt('lib/job-offer/prompts/system.md');
  const userPrompt = await loadPromptWithVars('lib/job-offer/prompts/user.md', {
    jobTitle: title || 'Non specifie (a extraire du contenu)',
    sourceContent: markdown
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

  // Detect language from extracted content (not from OpenAI's guess)
  const detectedLanguage = await detectJobOfferLanguageWithOpenAI({
    extraction,
    signal,
    userId,
    featureName: 'extract_job_offer_url',
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
    title: extraction.title || title || 'Job Offer',
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
 * Get job offer from cache or extract from URL
 * @param {string} userId - User ID
 * @param {string} url - Job offer URL
 * @param {AbortSignal} signal - Signal to cancel the request
 * @returns {Promise<Object>} - { extraction, jobOfferId, title, fromCache }
 */
export async function getOrExtractJobOfferFromUrl(userId, url, signal = null) {
  // 0. Normalize URL (remove tracking parameters)
  const normalizedUrl = normalizeJobUrl(url);

  // 1. Check if already extracted (by normalized URL)
  const existing = await prisma.jobOffer.findUnique({
    where: { userId_sourceValue: { userId, sourceValue: normalizedUrl } }
  });

  if (existing) {
    console.log(`[generateCv] JobOffer found in cache for URL: ${normalizedUrl}`);
    return {
      extraction: existing.content,
      jobOfferId: existing.id,
      title: existing.content?.title || 'Job Offer',
      fromCache: true,
      usageDetails: null, // Pas d'appel OpenAI
    };
  }

  // 2. Extract via OpenAI
  console.log(`[generateCv] Extracting job offer from URL: ${normalizedUrl}`);
  const { extraction, tokensUsed, model, title, usageDetails } = await extractJobOfferFromUrl(normalizedUrl, userId, signal);

  // 3. Store in DB (use normalized URL as sourceValue)
  const stored = await storeJobOffer(userId, 'url', normalizedUrl, extraction, model, tokensUsed);

  return {
    extraction,
    jobOfferId: stored.id,
    title,
    fromCache: false,
    usageDetails, // Propager les données de coûts
  };
}
