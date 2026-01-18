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
import { getOpenAIClient, getCvModel, checkOpenAICredits, addCacheRetentionIfSupported } from './client.js';
import { loadPromptWithVars } from './promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
import { applyModifications, sanitizeCvSkills } from '@/lib/cv/applyModifications.js';
import { detectCvLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';

// Import extraction functions from dedicated module
import {
  extractJobOfferFromUrl,
  extractJobOfferFromPdf,
  storeJobOffer,
  getOrExtractJobOfferFromUrl,
  getOrExtractJobOfferFromPdf,
  fetchHtmlWithFallback,
  getCvSchemaForWarmup,
} from './extraction';

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
