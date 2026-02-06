/**
 * Job Offer Service
 *
 * Main entry point for job offer extraction functionality.
 * Provides functions for extracting job offers from URLs and PDFs.
 */

// Re-export extraction functions
export {
  // Helper functions
  computeContentHash,
  isJobOfferValid,
  storeJobOffer,
  // URL extraction
  fetchHtmlWithFallback,
  extractJobOfferFromUrl,
  getOrExtractJobOfferFromUrl,
  // PDF extraction
  extractTextFromPdf,
  extractJobOfferFromPdf,
  extractJobOfferFromPdfText,
  getOrExtractJobOfferFromPdf,
  // Warmup
  getCvSchemaForWarmup,
  performWarmup
} from './extraction/index.js';
