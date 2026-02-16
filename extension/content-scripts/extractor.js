/**
 * Job Offer Extractor — Content Script
 *
 * Extracts job offer content from the current page using:
 * 1. @mozilla/readability (best overall)
 * 2. Site-specific CSS selectors (targeted)
 * 3. Generic CSS selectors (fallback)
 *
 * Converts HTML to Markdown via Turndown, then scores the result.
 */

import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { getSelectorsForHostname, getTitleSelectorsForHostname } from '../lib/site-selectors.js';
import { scoreJobOfferContent } from '../lib/scoring.js';

function createTurndown() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  // Remove images and scripts
  td.remove(['img', 'script', 'style', 'noscript', 'iframe', 'svg']);
  return td;
}

function cleanMarkdown(md) {
  return md
    .replace(/\n{3,}/g, '\n\n')          // collapse multiple blank lines
    .replace(/^\s+|\s+$/g, '')            // trim
    .replace(/\[([^\]]+)\]\(javascript:[^)]*\)/g, '$1') // remove JS links
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // remove images
    .trim();
}

/**
 * Try extraction using Readability
 */
function tryReadabilityExtraction() {
  try {
    const clone = document.cloneNode(true);
    const reader = new Readability(clone, {
      charThreshold: 200,
    });
    const article = reader.parse();

    if (!article || !article.content) return null;

    const td = createTurndown();
    const markdown = cleanMarkdown(td.turndown(article.content));

    if (markdown.length < 100) return null;

    return {
      title: article.title || '',
      content: markdown,
      method: 'readability',
    };
  } catch {
    return null;
  }
}

/**
 * Try extraction using site-specific or generic CSS selectors
 */
function trySelectorExtraction() {
  const hostname = location.hostname;
  const selectors = getSelectorsForHostname(hostname);
  const td = createTurndown();

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (!el) continue;

      const html = el.innerHTML;
      if (!html || html.length < 200) continue;

      const markdown = cleanMarkdown(td.turndown(html));
      if (markdown.length < 100) continue;

      const { score, isValid } = scoreJobOfferContent(markdown);
      if (score >= 15 || markdown.length > 500) {
        return {
          title: '',
          content: markdown,
          method: 'selector',
          selector,
        };
      }
    } catch {
      // Invalid selector or other error, continue
    }
  }

  return null;
}

/**
 * Extract the job title from the page
 */
function extractTitle() {
  const hostname = location.hostname;
  const selectors = getTitleSelectorsForHostname(hostname);

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        if (text.length > 3 && text.length < 200) return text;
      }
    } catch {
      // Invalid selector, continue
    }
  }

  // Fallback to document title, cleaned up
  const docTitle = document.title
    .replace(/\s*[-|·]\s*(LinkedIn|Indeed|APEC|Glassdoor|Monster|Welcome to the Jungle|CadreEmploi|Cadremploi|HelloWork|LesJeudis|France Travail|Pôle Emploi).*$/i, '')
    .trim();

  return docTitle || '';
}

/**
 * Extract the canonical job URL (clean, without tracking params).
 * On LinkedIn, the H1 title contains an <a href="/jobs/view/XXXXX/..."> — use that.
 * Falls back to location.href.
 */
function extractCanonicalJobUrl() {
  const host = location.hostname.replace(/^www\./, '');

  if (host.includes('linkedin.com')) {
    const titleSelectors = getTitleSelectorsForHostname(location.hostname);
    for (const selector of titleSelectors) {
      try {
        const el = document.querySelector(selector);
        if (!el) continue;
        const link = el.closest('a') || el.querySelector('a');
        if (link?.href) {
          const url = new URL(link.href, location.origin);
          const match = url.pathname.match(/\/jobs\/view\/\d+/);
          if (match) {
            return `https://www.linkedin.com${match[0]}/`;
          }
        }
      } catch { /* skip */ }
    }
  }

  // Indeed: extract the job key to build a stable per-offer URL
  if (host.includes('indeed.')) {
    const jk = extractIndeedJobKey();
    if (jk) {
      return `https://${location.hostname}/viewjob?jk=${jk}`;
    }
  }

  return location.href;
}

/**
 * Extract the Indeed job key (jk) from URL params or DOM.
 * Indeed search pages show offers in a side panel without changing the URL,
 * so we need to find the job key from the selected card or the detail pane.
 */
function extractIndeedJobKey() {
  // 1. Check vjk param in URL (Indeed adds this when clicking a job in search results)
  const urlParams = new URLSearchParams(location.search);
  const vjk = urlParams.get('vjk');
  if (vjk) return vjk;

  // 2. Look for the selected/active job card with data-jk attribute
  const selectedCard = document.querySelector('.jobCard_mainContent .jcs-JobTitle[data-jk]')
    || document.querySelector('.job_selected [data-jk]')
    || document.querySelector('[data-jk].selected')
    || document.querySelector('.jobsearch-LeftPane .result.clicked [data-jk]');
  if (selectedCard) return selectedCard.getAttribute('data-jk');

  // 3. Look for data-jk on any highlighted/active result
  const activeResult = document.querySelector('.jobsearch-ResultsList .css-5lfssm [data-jk]')
    || document.querySelector('[class*="selectedJob"] [data-jk]')
    || document.querySelector('.tapItem.selected[data-jk]')
    || document.querySelector('.tapItem.clicked[data-jk]');
  if (activeResult) return activeResult.getAttribute('data-jk');

  // 4. Look for a viewjob link in the job detail pane
  const viewJobLink = document.querySelector('a[href*="/viewjob?jk="]')
    || document.querySelector('a[href*="&jk="]');
  if (viewJobLink) {
    try {
      const url = new URL(viewJobLink.href, location.origin);
      const jk = url.searchParams.get('jk');
      if (jk) return jk;
    } catch { /* skip */ }
  }

  // 5. Check for jk in the current URL path (for /viewjob pages)
  const jkFromUrl = urlParams.get('jk');
  if (jkFromUrl) return jkFromUrl;

  return null;
}

/**
 * Main extraction function — called on demand
 * @returns {{ title: string, content: string, sourceUrl: string, score: number, isValid: boolean }}
 */
export function extractJobOffer() {
  // Try methods in order of quality
  let result = tryReadabilityExtraction();

  if (!result || result.content.length < 200) {
    const selectorResult = trySelectorExtraction();
    if (selectorResult) {
      // Use selector result if it's better
      if (!result || selectorResult.content.length > result.content.length) {
        result = selectorResult;
      }
    }
  }

  if (!result) {
    return {
      title: extractTitle(),
      content: '',
      sourceUrl: extractCanonicalJobUrl(),
      score: 0,
      isValid: false,
      error: 'Could not extract job offer content from this page',
    };
  }

  // Extract title if not already found
  const title = extractTitle() || result.title;
  const { score, isValid, breakdown } = scoreJobOfferContent(result.content);

  return {
    title,
    content: result.content,
    sourceUrl: extractCanonicalJobUrl(),
    score,
    isValid,
    breakdown,
    method: result.method,
  };
}
