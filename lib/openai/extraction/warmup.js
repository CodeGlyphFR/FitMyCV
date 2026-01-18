/**
 * Job Offer Extraction - Warmup functions
 *
 * Functions for warming up OpenAI prompt cache.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getOpenAIClient, getCvModel, addCacheRetentionIfSupported } from '../client.js';
import { loadPromptWithVars } from '../promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

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

/**
 * Load CV schema template (for warmup)
 * @returns {Promise<string>} - CV schema JSON string
 */
export async function getCvSchemaForWarmup() {
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
export async function performWarmup({ userId, signal }) {
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
