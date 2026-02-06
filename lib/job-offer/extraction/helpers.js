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
 *
 * A valid job offer must have:
 * - A title (mandatory)
 * - AND either responsibilities OR skills OR substantial description with company/location
 *
 * This prevents accepting pages with just a title like "Offer expired" or "Page not found"
 *
 * Format skills v2 (4 catégories):
 * - hard_skills: { required: [], nice_to_have: [] }
 * - tools: { required: [], nice_to_have: [] }
 * - methodologies: { required: [], nice_to_have: [] }
 * - soft_skills: []
 *
 * @param {Object} extraction - Extracted job offer
 * @returns {boolean} - true if valid, false if empty or insufficient content
 */
export function isJobOfferValid(extraction) {
  if (!extraction) return false;

  // Must have a title
  const hasTitle = extraction.title && extraction.title.trim().length > 0;
  if (!hasTitle) return false;

  // Check responsibilities
  const hasResponsibilities = extraction.responsibilities?.length > 0;

  // Check skills (including soft_skills)
  const skills = extraction.skills || {};
  const hasSkills =
    (skills.hard_skills?.required?.length > 0) ||
    (skills.hard_skills?.nice_to_have?.length > 0) ||
    (skills.tools?.required?.length > 0) ||
    (skills.tools?.nice_to_have?.length > 0) ||
    (skills.methodologies?.required?.length > 0) ||
    (skills.methodologies?.nice_to_have?.length > 0) ||
    (skills.soft_skills?.length > 0);

  // Check other meaningful content (ensure values are strings before calling .trim())
  const hasCompany = typeof extraction.company === 'string' && extraction.company.trim().length > 0;
  const hasLocation = typeof extraction.location === 'string' && extraction.location.trim().length > 0;
  const hasDescription = typeof extraction.description === 'string' && extraction.description.trim().length > 50;

  // Accept if: title + (responsibilities OR skills OR substantial description + company/location)
  return hasResponsibilities || hasSkills || (hasDescription && (hasCompany || hasLocation));
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
