/**
 * Job Offer Extraction - Helper functions
 *
 * Utility functions for extraction operations.
 */

import { createHash } from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Compute SHA256 hash of text content
 * Used to identify PDF content for caching
 * @param {string} text - Text content to hash
 * @returns {string} - SHA256 hash hex string
 */
export function computeContentHash(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Validate job offer extraction (check if not empty)
 * @param {Object} extraction - Extracted job offer
 * @returns {boolean} - true if valid, false if empty
 */
export function isJobOfferValid(extraction) {
  if (!extraction) return false;

  // Must have title and at least some skills
  const hasTitle = extraction.title && extraction.title.trim().length > 0;
  const hasSkills = extraction.skills &&
    ((extraction.skills.required && extraction.skills.required.length > 0) ||
     (extraction.skills.nice_to_have && extraction.skills.nice_to_have.length > 0));

  return hasTitle || hasSkills;
}

/**
 * Store job offer in database
 * @param {string} userId - User ID
 * @param {string} sourceType - 'url' or 'pdf'
 * @param {string} sourceValue - URL or filename
 * @param {Object} extraction - Structured extraction
 * @param {string} model - Model used for extraction
 * @param {number} tokensUsed - Tokens consumed
 * @param {string|null} contentHash - SHA256 hash of content (for PDFs)
 * @returns {Promise<Object>} - Stored JobOffer record
 */
export async function storeJobOffer(userId, sourceType, sourceValue, extraction, model, tokensUsed, contentHash = null) {
  return prisma.jobOffer.upsert({
    where: {
      userId_sourceValue: { userId, sourceValue }
    },
    update: {
      content: extraction,
      contentHash,
      extractedAt: new Date(),
      extractionModel: model,
      tokensUsed,
    },
    create: {
      userId,
      sourceType,
      sourceValue,
      contentHash,
      content: extraction,
      extractionModel: model,
      tokensUsed,
    },
  });
}
