/**
 * HTML to Markdown conversion pipeline
 *
 * Pipeline:
 * HTML brut (Puppeteer/fetch)
 *     ↓
 * JSDOM (parsing)
 *     ↓
 * Readability (extraction contenu principal)
 *     ↓
 * Turndown (HTML → Markdown)
 *     ↓
 * Markdown propre (~5k chars au lieu de 60k)
 */

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

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

    // 2. Extract main content with Readability
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article || !article.content) {
      // Fallback: return cleaned body
      return fallbackExtraction(html);
    }

    // 3. Convert to Markdown with Turndown
    const turndownService = createTurndownService();
    const markdown = turndownService.turndown(article.content);

    // 4. Clean up markdown
    const cleanMarkdown = cleanMarkdownContent(markdown);

    return {
      title: article.title || '',
      content: cleanMarkdown,
      textLength: cleanMarkdown.length
    };
  } catch (error) {
    console.error('[htmlToMarkdown] Error:', error.message);
    // Fallback on any error
    return fallbackExtraction(html);
  }
}

/**
 * Create configured Turndown service
 */
function createTurndownService() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // Remove images, scripts, styles, svg, iframe from output
  turndownService.remove(['img', 'script', 'style', 'svg', 'iframe', 'noscript', 'canvas', 'video', 'audio']);

  // Ignore navigation elements
  turndownService.addRule('removeNav', {
    filter: ['nav', 'header', 'footer', 'aside'],
    replacement: () => ''
  });

  // Ignore hidden elements
  turndownService.addRule('removeHidden', {
    filter: (node) => {
      if (node.nodeType !== 1) return false;
      const style = node.getAttribute('style') || '';
      const className = node.getAttribute('class') || '';
      return (
        style.includes('display: none') ||
        style.includes('display:none') ||
        style.includes('visibility: hidden') ||
        className.includes('hidden') ||
        className.includes('sr-only')
      );
    },
    replacement: () => ''
  });

  // Simplify links (keep text, remove URL noise)
  turndownService.addRule('simplifyLinks', {
    filter: 'a',
    replacement: (content) => content
  });

  return turndownService;
}

/**
 * Fallback extraction when Readability fails
 * @param {string} html - Raw HTML content
 * @returns {Object} - { title, content, textLength }
 */
function fallbackExtraction(html) {
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

/**
 * Clean markdown content
 * @param {string} markdown - Raw markdown
 * @returns {string} - Cleaned markdown
 */
function cleanMarkdownContent(markdown) {
  if (!markdown) return '';

  return markdown
    // Remove excessive newlines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove empty list items
    .replace(/^-\s*$/gm, '')
    // Remove lines that are just whitespace
    .replace(/^\s+$/gm, '')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove excessive newlines again after line processing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract job offer content from HTML with optimizations for job sites
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 */
export function extractJobOfferContent(html, url = '') {
  // First try standard extraction
  const result = htmlToMarkdown(html, url);

  // If content is too short, the extraction might have failed
  if (result.textLength < 200) {
    console.log('[extractJobOfferContent] Content too short, trying job-specific extraction');
    return tryJobSpecificExtraction(html, url);
  }

  // Limit content length to avoid excessive tokens
  if (result.content.length > 10000) {
    result.content = result.content.substring(0, 10000) + '\n\n[Content truncated]';
    result.textLength = result.content.length;
  }

  return result;
}

/**
 * Try job-specific extraction patterns when Readability fails
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 */
function tryJobSpecificExtraction(html, url) {
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  // Common job site selectors
  const jobSelectors = [
    // Generic
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[class*="job-content"]',
    '[class*="job-details"]',
    '[id*="job-description"]',
    '[id*="jobDescription"]',
    // Indeed
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    // LinkedIn
    '.description__text',
    '.show-more-less-html__markup',
    // Welcome to the Jungle
    '[class*="sc-"]', // Styled components
    // Monster
    '.job-description',
    // Glassdoor
    '.desc',
    // Generic article/main
    'article',
    'main',
    '[role="main"]'
  ];

  let content = '';
  let title = '';

  // Try to get title
  const titleElement = document.querySelector('h1') || document.querySelector('[class*="title"]');
  if (titleElement) {
    title = titleElement.textContent?.trim() || '';
  }

  // Try each selector until we find content
  for (const selector of jobSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 200) {
        const turndownService = createTurndownService();
        content = turndownService.turndown(element.innerHTML);
        content = cleanMarkdownContent(content);
        break;
      }
    } catch (e) {
      // Selector might be invalid, continue
    }
  }

  // If still no content, fall back to body text
  if (!content || content.length < 200) {
    return fallbackExtraction(html);
  }

  // Limit content length
  if (content.length > 10000) {
    content = content.substring(0, 10000) + '\n\n[Content truncated]';
  }

  return {
    title,
    content,
    textLength: content.length
  };
}
