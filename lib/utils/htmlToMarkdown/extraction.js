/**
 * Content extraction utilities for HTML to Markdown conversion
 * Provides multiple extraction strategies (Readability, CSS selectors, fallback)
 */

import { Readability } from '@mozilla/readability';
import { createTurndownService, cleanMarkdownContent } from './turndown.js';
import { createReadabilityConfig } from './config.js';
import { getSelectorsForUrl, getTitleSelectorsForUrl } from './selectors.js';
import { scoreJobOfferContent } from './scoring.js';

/**
 * Try extraction using Readability with optimized config
 * @param {Document} document - JSDOM document
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 */
export function tryReadabilityExtraction(document, url = '') {
  try {
    // Clone document for Readability (it modifies the DOM)
    const documentClone = document.cloneNode(true);
    const config = createReadabilityConfig(url);
    const reader = new Readability(documentClone, config);
    const article = reader.parse();

    if (!article || !article.content) {
      return { title: '', content: '', textLength: 0 };
    }

    const turndownService = createTurndownService();
    const markdown = turndownService.turndown(article.content);
    const cleanMarkdown = cleanMarkdownContent(markdown);

    return {
      title: article.title || '',
      content: cleanMarkdown,
      textLength: cleanMarkdown.length
    };
  } catch (error) {
    console.error('[htmlToMarkdown] Readability error:', error.message);
    return { title: '', content: '', textLength: 0 };
  }
}

/**
 * Try extraction using CSS selectors
 * @param {Document} document - JSDOM document
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 */
export function trySelectorExtraction(document, url = '') {
  const selectors = getSelectorsForUrl(url);
  const titleSelectors = getTitleSelectorsForUrl(url);
  let content = '';
  let title = '';

  // Try to get title using site-specific selectors
  for (const selector of titleSelectors) {
    try {
      const titleElement = document.querySelector(selector);
      if (titleElement && titleElement.textContent?.trim()) {
        title = titleElement.textContent.trim();
        // Clean up title (remove extra whitespace, newlines)
        title = title.replace(/\s+/g, ' ').trim();
        if (title.length > 0 && title.length < 200) {
          console.log(`[htmlToMarkdown] Title found with selector: ${selector}`);
          break;
        }
      }
    } catch (e) {
      // Selector might be invalid, continue
    }
  }

  // Try each selector until we find good content
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 200) {
        const turndownService = createTurndownService();
        content = turndownService.turndown(element.innerHTML);
        content = cleanMarkdownContent(content);

        // Score this extraction
        const score = scoreJobOfferContent(content);
        if (score.isValid && score.score >= 30) {
          break;
        }
      }
    } catch (e) {
      // Selector might be invalid, continue
    }
  }

  return {
    title,
    content,
    textLength: content.length
  };
}

/**
 * Fallback extraction when Readability fails
 * @param {string} html - Raw HTML content
 * @returns {Object} - { title, content, textLength }
 */
export function fallbackExtraction(html) {
  try {
    // Remove scripts, styles, navigation
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    const turndownService = createTurndownService();
    const markdown = turndownService.turndown(cleaned);
    const cleanedMarkdown = cleanMarkdownContent(markdown);

    // Try to extract title from h1
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = h1Match ? h1Match[1].trim() : '';

    return {
      title,
      content: cleanedMarkdown,
      textLength: cleanedMarkdown.length
    };
  } catch (error) {
    console.error('[htmlToMarkdown] Fallback error:', error.message);
    return {
      title: '',
      content: '',
      textLength: 0
    };
  }
}
