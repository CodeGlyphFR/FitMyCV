/**
 * HTML to Markdown conversion pipeline - Enhanced for Job Offers
 *
 * This file re-exports from the modularized htmlToMarkdown directory.
 * See ./htmlToMarkdown/index.js for the main implementation.
 */

export {
  htmlToMarkdown,
  extractJobOfferContent,
  detectLoginPage,
  detectPageType,
  scoreJobOfferContent,
  getSelectorsForUrl,
  shouldUsePuppeteerFirst,
  PUPPETEER_FIRST_DOMAINS
} from './htmlToMarkdown/index.js';
