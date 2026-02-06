/**
 * CSS selector utilities for HTML to Markdown conversion
 * Provides site-specific and generic selectors for content extraction
 */

import {
  SITE_SELECTORS,
  SITE_TITLE_SELECTORS,
  GENERIC_TITLE_SELECTORS,
  GENERIC_SELECTORS,
  PUPPETEER_FIRST_DOMAINS
} from '../siteSelectors';

/**
 * Get prioritized CSS selectors for a given URL
 * @param {string} url - Source URL
 * @returns {string[]} - Array of CSS selectors
 */
export function getSelectorsForUrl(url = '') {
  if (!url) return GENERIC_SELECTORS;

  const lowerUrl = url.toLowerCase();

  // Try to match site-specific selectors
  for (const [domain, selectors] of Object.entries(SITE_SELECTORS)) {
    if (lowerUrl.includes(domain)) {
      return [...selectors, ...GENERIC_SELECTORS];
    }
  }

  return GENERIC_SELECTORS;
}

/**
 * Get CSS selectors for job TITLE based on URL
 * @param {string} url - Source URL
 * @returns {string[]} - Array of CSS selectors for title
 */
export function getTitleSelectorsForUrl(url = '') {
  if (!url) return GENERIC_TITLE_SELECTORS;

  const lowerUrl = url.toLowerCase();

  // Try to match site-specific title selectors
  for (const [domain, selectors] of Object.entries(SITE_TITLE_SELECTORS)) {
    if (lowerUrl.includes(domain)) {
      return [...selectors, ...GENERIC_TITLE_SELECTORS];
    }
  }

  return GENERIC_TITLE_SELECTORS;
}

/**
 * Check if URL should use Puppeteer first
 * @param {string} url - Source URL
 * @returns {boolean}
 */
export function shouldUsePuppeteerFirst(url = '') {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return PUPPETEER_FIRST_DOMAINS.some(domain => lowerUrl.includes(domain));
}

// Re-export for convenience
export { PUPPETEER_FIRST_DOMAINS };
