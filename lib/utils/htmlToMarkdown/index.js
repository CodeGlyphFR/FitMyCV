/**
 * HTML to Markdown conversion pipeline - Enhanced for Job Offers
 *
 * Pipeline:
 * HTML brut (Puppeteer/fetch)
 *     ↓
 * Login page detection (NEW)
 *     ↓
 * JSDOM (parsing)
 *     ↓
 * Page type detection (NEW)
 *     ↓
 * Readability (extraction contenu principal) - with optimized config
 *     ↓
 * Content scoring (NEW)
 *     ↓
 * Hybrid extraction (Readability vs CSS selectors)
 *     ↓
 * Turndown (HTML → Markdown)
 *     ↓
 * Smart truncation (NEW)
 *     ↓
 * Markdown propre
 */

import { JSDOM } from 'jsdom';

// Import from sub-modules
import { detectLoginPage, detectPageType } from './detection.js';
import { scoreJobOfferContent } from './scoring.js';
import { getSelectorsForUrl, getTitleSelectorsForUrl, shouldUsePuppeteerFirst, PUPPETEER_FIRST_DOMAINS } from './selectors.js';
import { smartTruncate } from './truncation.js';
import { tryReadabilityExtraction, trySelectorExtraction, fallbackExtraction } from './extraction.js';

/**
 * Convert raw HTML to clean Markdown
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL (for Readability context)
 * @returns {Object} - { title, content, textLength }
 */
export function htmlToMarkdown(html, url = '') {
  if (!html || typeof html !== 'string') {
    return {
      title: '',
      content: '',
      textLength: 0
    };
  }

  try {
    // 1. Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // 2. Use optimized Readability extraction
    const result = tryReadabilityExtraction(document, url);

    if (result.textLength > 0) {
      return result;
    }

    // 3. Fallback on error
    return fallbackExtraction(html);
  } catch (error) {
    console.error('[htmlToMarkdown] Error:', error.message);
    return fallbackExtraction(html);
  }
}

/**
 * Extract job offer content from HTML with optimizations
 * Enhanced with login detection, hybrid extraction, and smart truncation
 *
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 * @throws {Error} - If login page detected
 */
export function extractJobOfferContent(html, url = '') {
  if (!html || typeof html !== 'string') {
    return { title: '', content: '', textLength: 0 };
  }

  // Step 0: Detect login pages
  const loginCheck = detectLoginPage(html, url);
  if (loginCheck.isLoginPage) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.loginRequired',
      params: {
        url: url,
        reason: loginCheck.reason
      },
      suggestion: 'Téléchargez l\'offre en PDF depuis le site et uploadez-la.'
    }));
  }

  try {
    // Parse HTML
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Step 1: Detect page type
    const pageType = detectPageType(document, url);
    console.log(`[htmlToMarkdown] Page type: ${pageType.type} (confidence: ${(pageType.confidence * 100).toFixed(0)}%)`);

    // Step 1.5: Extract title using site-specific selectors FIRST
    // This is independent of which content extraction method we use
    let siteSpecificTitle = '';
    const titleSelectors = getTitleSelectorsForUrl(url);
    for (const selector of titleSelectors) {
      try {
        const titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent?.trim()) {
          const candidateTitle = titleElement.textContent.trim().replace(/\s+/g, ' ');
          if (candidateTitle.length > 0 && candidateTitle.length < 200) {
            siteSpecificTitle = candidateTitle;
            console.log(`[htmlToMarkdown] Site-specific title found: "${siteSpecificTitle}" (selector: ${selector})`);
            break;
          }
        }
      } catch (e) {
        // Selector might be invalid, continue
      }
    }

    // Step 2: Try Readability extraction first
    const readabilityResult = tryReadabilityExtraction(document, url);
    const readabilityScore = scoreJobOfferContent(readabilityResult.content);
    console.log(`[htmlToMarkdown] Readability score: ${readabilityScore.score}`);

    // If Readability gives a good result, use it
    if (readabilityScore.isValid && readabilityScore.score >= 50) {
      console.log(`[htmlToMarkdown] Using Readability extraction (score: ${readabilityScore.score})`);
      let content = readabilityResult.content;

      // Apply smart truncation if needed
      if (content.length > 10000) {
        content = smartTruncate(content, 10000);
      }

      // Prefer site-specific title over Readability title
      const finalTitle = siteSpecificTitle || readabilityResult.title;
      console.log(`[htmlToMarkdown] Final title: "${finalTitle}" (source: ${siteSpecificTitle ? 'site-specific' : 'readability'})`);

      return {
        title: finalTitle,
        content,
        textLength: content.length
      };
    }

    // Step 3: Fallback to CSS selector extraction
    const selectorResult = trySelectorExtraction(document, url);
    const selectorScore = scoreJobOfferContent(selectorResult.content);
    console.log(`[htmlToMarkdown] Selector score: ${selectorScore.score}`);

    // Choose the best result
    let bestResult;
    let bestScore;

    if (selectorScore.score > readabilityScore.score && selectorScore.isValid) {
      console.log(`[htmlToMarkdown] Using selector extraction (score: ${selectorScore.score})`);
      bestResult = selectorResult;
      bestScore = selectorScore;
    } else if (readabilityScore.isValid) {
      console.log(`[htmlToMarkdown] Using Readability extraction (score: ${readabilityScore.score})`);
      bestResult = readabilityResult;
      bestScore = readabilityScore;
    } else if (selectorScore.isValid) {
      console.log(`[htmlToMarkdown] Using selector extraction as fallback (score: ${selectorScore.score})`);
      bestResult = selectorResult;
      bestScore = selectorScore;
    } else {
      // Last resort: full fallback
      console.log('[htmlToMarkdown] All extractions failed, using fallback');
      bestResult = fallbackExtraction(html);
      bestScore = { score: 0 };
    }

    // Apply smart truncation
    let content = bestResult.content;
    if (content.length > 10000) {
      content = smartTruncate(content, 10000);
    }

    // Prefer site-specific title over extraction result title
    const finalTitle = siteSpecificTitle || bestResult.title;
    console.log(`[htmlToMarkdown] Final title: "${finalTitle}" (source: ${siteSpecificTitle ? 'site-specific' : 'extraction'})`);

    return {
      title: finalTitle,
      content,
      textLength: content.length
    };

  } catch (error) {
    // Re-throw login errors
    if (error.message.includes('translationKey')) {
      throw error;
    }

    console.error('[extractJobOfferContent] Error:', error.message);
    return fallbackExtraction(html);
  }
}

// Export utilities for external use
export {
  detectLoginPage,
  detectPageType,
  scoreJobOfferContent,
  getSelectorsForUrl,
  shouldUsePuppeteerFirst,
  PUPPETEER_FIRST_DOMAINS
};
