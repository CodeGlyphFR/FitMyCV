/**
 * Job Offer Extraction module - Centralizes all job offer extraction functions
 *
 * This module provides functions for:
 * - Extracting job offers from URLs (with intelligent fetch strategy)
 * - Extracting job offers from PDF files
 * - Warming up OpenAI prompt cache
 * - Caching extracted job offers in database
 */

// Helper functions
export {
  computeContentHash,
  isJobOfferValid,
  storeJobOffer
} from './helpers.js';

// URL extraction functions
export {
  fetchHtmlWithFallback,
  extractJobOfferFromUrl,
  getOrExtractJobOfferFromUrl
} from './url.js';

// PDF extraction functions
export {
  extractTextFromPdf,
  extractJobOfferFromPdf,
  extractJobOfferFromPdfText,
  getOrExtractJobOfferFromPdf
} from './pdf.js';

// Warmup functions
export {
  getCvSchemaForWarmup,
  performWarmup
} from './warmup.js';
