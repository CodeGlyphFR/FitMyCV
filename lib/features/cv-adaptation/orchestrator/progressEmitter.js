/**
 * Progress Emitter for CV Adaptation Pipeline
 *
 * Emits SSE events for real-time progress tracking during CV generation.
 * Used to update the UI with current phase and step information.
 */

import dbEmitter from '@/lib/events/dbEmitter';

/**
 * Emit an SSE progress event for an offer
 *
 * @param {string} userId - User ID
 * @param {Object} context - Progress context
 * @param {string} context.taskId - Task ID
 * @param {string} context.offerId - Offer ID
 * @param {number} context.offerIndex - Offer index (0-based)
 * @param {number} context.totalOffers - Total number of offers
 * @param {string} context.sourceUrl - Source URL of the offer (optional)
 * @param {string} context.jobTitle - Extracted job title (optional)
 * @param {string} phase - Current phase (extraction, classify, batches, recompose)
 * @param {string} step - Current step (extraction, classify, experiences, projects, extras, skills, summary, recompose)
 * @param {string} status - Status (running, completed)
 * @param {Object} [extra] - Additional data (currentItem, totalItems)
 */
export function emitProgress(userId, context, phase, step, status, extra = {}) {
  dbEmitter.emitCvGenerationProgress(userId, {
    taskId: context.taskId,
    offerId: context.offerId,
    offerIndex: context.offerIndex,
    totalOffers: context.totalOffers,
    sourceUrl: context.sourceUrl || null,
    jobTitle: context.jobTitle || null,
    phase,
    step,
    status,
    // Enriched fields for granularity
    currentItem: extra.currentItem ?? null,
    totalItems: extra.totalItems ?? null,
  });
}
