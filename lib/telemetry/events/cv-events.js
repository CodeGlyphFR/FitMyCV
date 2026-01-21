/**
 * CV-related telemetry events
 */
import { trackEvent } from '../core.js';
import { EventTypes } from '../constants.js';

/**
 * Track CV generation from URL (adapted CV with job offer from URL)
 */
export async function trackCvGenerationFromUrl({
  userId,
  deviceId,
  sourceCount = 1,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATED_URL,
    userId,
    deviceId,
    metadata: {
      sourceType: 'link',
      sourceCount,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV generation from PDF (adapted CV with job offer from PDF)
 */
export async function trackCvGenerationFromPdf({
  userId,
  deviceId,
  sourceCount = 1,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATED_PDF,
    userId,
    deviceId,
    metadata: {
      sourceType: 'pdf',
      sourceCount,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV generation from job title (template without reference CV)
 */
export async function trackCvGenerationFromJobTitle({
  userId,
  deviceId,
  sourceType = 'job-title',
  sourceCount = 1,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATED_FROM_JOB_TITLE,
    userId,
    deviceId,
    metadata: {
      sourceType,
      sourceCount,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV template creation from URL (template CV from job offer URL without reference CV)
 */
export async function trackCvTemplateCreationFromUrl({
  userId,
  deviceId,
  sourceCount = 1,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_TEMPLATE_CREATED_URL,
    userId,
    deviceId,
    metadata: {
      sourceType: 'link',
      sourceCount,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV template creation from PDF (template CV from job offer PDF without reference CV)
 */
export async function trackCvTemplateCreationFromPdf({
  userId,
  deviceId,
  sourceCount = 1,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_TEMPLATE_CREATED_PDF,
    userId,
    deviceId,
    metadata: {
      sourceType: 'pdf',
      sourceCount,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV import from PDF
 */
export async function trackCvImport({
  userId,
  deviceId,
  fileSize,
  duration,
  status = 'success',
  error = null,
  isFirstImport = false,
}) {
  return trackEvent({
    type: isFirstImport ? EventTypes.CV_FIRST_IMPORTED : EventTypes.CV_IMPORTED,
    userId,
    deviceId,
    metadata: {
      fileSize,
      isFirstImport,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV export
 */
export async function trackCvExport({
  userId,
  deviceId,
  language,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_EXPORTED,
    userId,
    deviceId,
    metadata: { language },
    duration,
    status,
    error,
  });
}

/**
 * Track manual CV creation
 */
export async function trackCvCreation({
  userId,
  deviceId,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_CREATED_MANUAL,
    userId,
    deviceId,
    status,
    error,
  });
}

/**
 * Track CV edit
 */
export async function trackCvEdit({
  userId,
  deviceId,
  operation, // set, push, insert, remove, move
  section, // header, skills, experience, etc.
  field,
}) {
  return trackEvent({
    type: EventTypes.CV_EDITED,
    userId,
    deviceId,
    metadata: {
      operation,
      section,
      field,
    },
    status: 'success',
  });
}

/**
 * Track match score calculation
 */
export async function trackMatchScore({
  userId,
  deviceId,
  score,
  isAutomatic = false,
  tokensUsed,
  tokensRemaining,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.MATCH_SCORE_CALCULATED,
    userId,
    deviceId,
    metadata: {
      score,
      isAutomatic,
      tokensUsed,
      tokensRemaining,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV optimization
 */
export async function trackCvOptimization({
  userId,
  deviceId,
  changesCount,
  sectionsModified,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_OPTIMIZED,
    userId,
    deviceId,
    metadata: {
      changesCount,
      sectionsModified,
    },
    duration,
    status,
    error,
  });
}

/**
 * Track CV changes reviewed (after AI generation review)
 *
 * @param {Object} params - Event parameters
 * @param {string} params.userId - User ID
 * @param {string} [params.deviceId] - Device ID
 * @param {string} params.taskId - Background task ID
 * @param {string} params.offerId - Job offer ID
 * @param {Object} params.stats - Review statistics
 * @param {number} params.stats.total - Total modifications
 * @param {number} params.stats.accepted - Accepted modifications
 * @param {number} params.stats.rejected - Rejected modifications
 * @param {number} [params.duration] - Time spent reviewing in ms
 * @param {string} [params.status] - Event status
 * @param {string} [params.error] - Error message if status=error
 */
export async function trackCvChangesReviewed({
  userId,
  deviceId,
  taskId,
  offerId,
  stats,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_CHANGES_REVIEWED,
    userId,
    deviceId,
    metadata: {
      taskId,
      offerId,
      totalChanges: stats?.total || 0,
      acceptedChanges: stats?.accepted || 0,
      rejectedChanges: stats?.rejected || 0,
      acceptRate: stats?.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0,
    },
    duration,
    status,
    error,
  });
}
