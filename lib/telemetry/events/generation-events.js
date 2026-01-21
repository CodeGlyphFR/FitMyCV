/**
 * CV Generation pipeline telemetry events
 */
import { trackEvent } from '../core.js';
import { EventTypes } from '../constants.js';

/**
 * Track CV Generation v2 pipeline started
 *
 * @param {Object} params - Event parameters
 * @param {string} params.userId - User ID
 * @param {string} [params.deviceId] - Device ID
 * @param {string} params.taskId - CvGenerationTask ID
 * @param {number} params.totalOffers - Number of offers to process
 * @param {string} params.mode - Generation mode (adapt, template)
 */
export async function trackCvGenerationStarted({
  userId,
  deviceId,
  taskId,
  totalOffers,
  mode,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATION_STARTED,
    userId,
    deviceId,
    metadata: {
      featureName: 'cv_generation',
      taskId,
      totalOffers,
      mode,
    },
    status: 'success',
  });
}

/**
 * Track CV Generation v2 pipeline completed (per offer)
 *
 * @param {Object} params - Event parameters
 * @param {string} params.userId - User ID
 * @param {string} [params.deviceId] - Device ID
 * @param {string} params.taskId - CvGenerationTask ID
 * @param {string} params.offerId - CvGenerationOffer ID
 * @param {number} params.durationMs - Total duration in milliseconds
 * @param {Object} [params.phaseDurations] - Duration per phase {classify, experiences, projects, extras, skills, summary, recompose}
 */
export async function trackCvGenerationCompleted({
  userId,
  deviceId,
  taskId,
  offerId,
  durationMs,
  phaseDurations,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATION_COMPLETED,
    userId,
    deviceId,
    metadata: {
      featureName: 'cv_generation',
      taskId,
      offerId,
      phaseDurations,
    },
    duration: durationMs,
    status: 'success',
  });
}

/**
 * Track CV Generation v2 pipeline failed (per offer)
 *
 * @param {Object} params - Event parameters
 * @param {string} params.userId - User ID
 * @param {string} [params.deviceId] - Device ID
 * @param {string} params.taskId - CvGenerationTask ID
 * @param {string} params.offerId - CvGenerationOffer ID
 * @param {string} params.failedPhase - Phase that failed (classify, batches, recompose)
 * @param {string} [params.failedStep] - Specific step that failed (experiences, projects, etc.)
 * @param {string} params.error - Error message
 * @param {number} params.retryCount - Number of retries attempted
 */
export async function trackCvGenerationFailed({
  userId,
  deviceId,
  taskId,
  offerId,
  failedPhase,
  failedStep,
  error,
  retryCount,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATION_FAILED,
    userId,
    deviceId,
    metadata: {
      featureName: 'cv_generation',
      taskId,
      offerId,
      failedPhase,
      failedStep,
      retryCount,
    },
    status: 'error',
    error,
  });
}
