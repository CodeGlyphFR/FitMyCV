/**
 * Retry Handler for CV Adaptation Pipeline
 *
 * Provides retry logic with exponential backoff for robust error handling.
 * Used across all phases to handle transient failures gracefully.
 */

export const MAX_RETRIES = 3;
export const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s

/**
 * Wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate backoff delay based on retry count
 * @param {number} retryCount - Current retry attempt (0-indexed)
 * @returns {number} - Delay in milliseconds
 */
export function getBackoffDelay(retryCount) {
  return BACKOFF_BASE_MS * Math.pow(2, retryCount);
}

/**
 * Execute a function with retry and exponential backoff
 *
 * @param {Function} fn - Function to execute (receives attempt number)
 * @param {number} maxRetries - Maximum number of retries
 * @param {string} context - Context for logging
 * @param {Function} [onRetry] - Optional callback before each retry (receives attempt number)
 * @returns {Promise<any>} - Result of the function
 * @throws {Error} - Last error if all retries fail
 */
export async function withRetry(fn, maxRetries = MAX_RETRIES, context = 'operation', onRetry = null) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = getBackoffDelay(attempt);
        console.log(`[orchestrator] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);

        // Call the retry callback if provided
        if (onRetry) {
          await onRetry(attempt + 1);
        }

        await sleep(delay);
      }
    }
  }

  throw lastError;
}
