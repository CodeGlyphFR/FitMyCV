/**
 * Credit Manager for CV Adaptation Pipeline
 *
 * Handles credit refunds when CV generation fails after max retries.
 * Ensures users are not charged for failed generations.
 */

import prisma from '@/lib/prisma';
import { grantCredits } from '@/lib/subscription/credits';
import { getCreditCostForFeature } from '@/lib/subscription/creditCost';

/**
 * Refund credit for a failed offer
 *
 * @param {string} taskId - Task ID
 * @param {string} offerId - Offer ID
 * @param {string} userId - User ID
 * @param {string} reason - Reason for refund
 * @returns {Promise<{success: boolean, amount?: number, alreadyRefunded?: boolean, error?: string}>}
 */
export async function refundCreditForOffer(taskId, offerId, userId, reason = 'Generation failed after max retries') {
  try {
    // Check if the offer has already been refunded
    const offer = await prisma.cvGenerationOffer.findUnique({
      where: { id: offerId },
      select: { creditsRefunded: true },
    });

    if (offer?.creditsRefunded) {
      console.log(`[refund] Offer ${offerId} already refunded, skipping`);
      return { success: true, amount: 0, alreadyRefunded: true };
    }

    // Get the actual credit cost from settings
    const { cost: creditCost } = await getCreditCostForFeature('gpt_cv_generation');

    console.log(`[refund] Offer ${offerId}: creditCost=${creditCost} (from settings)`);

    if (creditCost <= 0) {
      console.log(`[refund] No credits to refund for offer ${offerId} (creditCost=${creditCost})`);
      return { success: true, amount: 0 };
    }

    // Use grantCredits with type 'refund' for the refund
    const result = await grantCredits(userId, creditCost, 'refund', {
      source: 'cv_generation_v2_failure',
      taskId,
      offerId,
      reason,
    });

    if (result.success) {
      // Update the counters
      await prisma.$transaction([
        prisma.cvGenerationOffer.update({
          where: { id: offerId },
          data: { creditsRefunded: true },
        }),
        prisma.cvGenerationTask.update({
          where: { id: taskId },
          data: { creditsRefunded: { increment: creditCost } },
        }),
      ]);

      console.log(`[refund] Refunded ${creditCost} credit(s) for offer ${offerId}`);
    }

    return { success: result.success, amount: creditCost };
  } catch (error) {
    console.error(`[orchestrator] Refund failed for offer ${offerId}:`, error.message);
    return { success: false, error: error.message };
  }
}
