import prisma from '@/lib/prisma';

/**
 * Event types for telemetry tracking
 */
export const EventTypes = {
  // CV Management
  CV_GENERATED_URL: 'CV_GENERATED_URL',
  CV_GENERATED_PDF: 'CV_GENERATED_PDF',
  CV_TEMPLATE_CREATED_URL: 'CV_TEMPLATE_CREATED_URL',
  CV_TEMPLATE_CREATED_PDF: 'CV_TEMPLATE_CREATED_PDF',
  CV_GENERATED_FROM_JOB_TITLE: 'CV_GENERATED_FROM_JOB_TITLE',
  CV_IMPORTED: 'CV_IMPORTED',
  CV_FIRST_IMPORTED: 'CV_FIRST_IMPORTED',
  CV_EXPORTED: 'CV_EXPORTED',
  CV_CREATED_MANUAL: 'CV_CREATED_MANUAL',
  CV_EDITED: 'CV_EDITED',
  CV_DELETED: 'CV_DELETED',
  CV_TRANSLATED: 'CV_TRANSLATED',
  CV_RESTORED: 'CV_RESTORED',

  // Match Score & Optimization
  MATCH_SCORE_CALCULATED: 'MATCH_SCORE_CALCULATED',
  CV_OPTIMIZED: 'CV_OPTIMIZED',

  // Job Processing
  JOB_QUEUED: 'JOB_QUEUED',
  JOB_STARTED: 'JOB_STARTED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_FAILED: 'JOB_FAILED',
  JOB_CANCELLED: 'JOB_CANCELLED',

  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // Navigation & Interaction (Frontend)
  PAGE_VIEW: 'PAGE_VIEW',
  BUTTON_CLICK: 'BUTTON_CLICK',
  MODAL_OPENED: 'MODAL_OPENED',
  MODAL_CLOSED: 'MODAL_CLOSED',
  FORM_SUBMITTED: 'FORM_SUBMITTED',
};

/**
 * Event categories for grouping
 */
export const EventCategories = {
  CV_MANAGEMENT: 'cv_management',
  AUTH: 'auth',
  JOB_PROCESSING: 'job_processing',
  NAVIGATION: 'navigation',
  INTERACTION: 'interaction',
};

/**
 * Get category from event type
 */
function getCategoryFromType(type) {
  if (type.startsWith('CV_')) return EventCategories.CV_MANAGEMENT;
  if (type.startsWith('USER_') || type.includes('LOGIN') || type.includes('LOGOUT') || type.includes('EMAIL') || type.includes('PASSWORD')) {
    return EventCategories.AUTH;
  }
  if (type.startsWith('JOB_') || type.includes('MATCH_SCORE') || type.includes('OPTIMIZED')) {
    return EventCategories.JOB_PROCESSING;
  }
  if (type === 'PAGE_VIEW') return EventCategories.NAVIGATION;
  return EventCategories.INTERACTION;
}

/**
 * Track a telemetry event
 *
 * @param {Object} params - Event parameters
 * @param {string} params.type - Event type (use EventTypes constants)
 * @param {string} [params.userId] - User ID (optional for anonymous events)
 * @param {string} [params.deviceId] - Device ID for cross-device tracking
 * @param {Object} [params.metadata] - Additional event data (will be JSON stringified)
 * @param {number} [params.duration] - Duration in milliseconds
 * @param {string} [params.status] - Event status (success, error, cancelled)
 * @param {string} [params.error] - Error message if status=error
 * @returns {Promise<TelemetryEvent>}
 */
export async function trackEvent({
  type,
  userId = null,
  deviceId = null,
  metadata = null,
  duration = null,
  status = 'success',
  error = null,
}) {
  try {
    const category = getCategoryFromType(type);

    const event = await prisma.telemetryEvent.create({
      data: {
        type,
        category,
        userId,
        deviceId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        duration,
        status,
        error,
      },
    });

    // Update feature usage if this is a feature event
    if (userId && isFeatureEvent(type)) {
      await incrementFeatureUsage({
        userId,
        featureName: getFeatureNameFromEventType(type),
        duration,
        metadata: getFeatureMetadata(type, metadata),
      });
    }

    return event;
  } catch (err) {
    console.error('[Telemetry] Failed to track event:', err);
    // Don't throw - telemetry failures shouldn't break the app
    return null;
  }
}

/**
 * Check if event type represents a feature usage
 */
function isFeatureEvent(type) {
  const featureEvents = [
    'CV_GENERATED', 'CV_IMPORTED', 'CV_FIRST_IMPORTED', 'CV_EXPORTED',
    'CV_CREATED_MANUAL', 'CV_EDITED', 'MATCH_SCORE_CALCULATED',
    'CV_OPTIMIZED', 'CV_TRANSLATED'
  ];
  return featureEvents.includes(type);
}

/**
 * Get feature name from event type
 */
function getFeatureNameFromEventType(type) {
  const mapping = {
    'CV_GENERATED': 'generate_cv',
    'CV_IMPORTED': 'import_pdf',
    'CV_FIRST_IMPORTED': 'first_import_pdf',
    'CV_EXPORTED': 'export_cv',
    'CV_CREATED_MANUAL': 'create_cv_manual',
    'CV_EDITED': 'edit_cv',
    'MATCH_SCORE_CALCULATED': 'match_score',
    'CV_OPTIMIZED': 'optimize_cv',
    'CV_TRANSLATED': 'translate_cv',
  };
  return mapping[type] || type.toLowerCase();
}

/**
 * Extract feature-specific metadata
 */
function getFeatureMetadata(type, metadata) {
  if (!metadata) return null;

  return null;
}

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
 * Track user registration
 */
export async function trackUserRegistration({
  userId,
  deviceId,
  provider, // 'credentials', 'google', 'github', 'apple'
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.USER_REGISTERED,
    userId,
    deviceId,
    metadata: { provider },
    status,
    error,
  });
}

/**
 * Track user login
 */
export async function trackUserLogin({
  userId,
  deviceId,
  provider,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.USER_LOGIN,
    userId,
    deviceId,
    metadata: { provider },
    status,
    error,
  });
}

/**
 * Track user logout
 */
export async function trackUserLogout({
  userId,
  deviceId,
}) {
  return trackEvent({
    type: EventTypes.USER_LOGOUT,
    userId,
    deviceId,
    status: 'success',
  });
}

/**
 * Increment feature usage counter
 */
export async function incrementFeatureUsage({
  userId,
  featureName,
  duration = 0,
  metadata = null,
}) {
  try {
    // Check if record exists
    const existing = await prisma.featureUsage.findUnique({
      where: {
        userId_featureName: {
          userId,
          featureName,
        },
      },
    });

    if (existing) {
      // Update existing record
      const currentMetadata = existing.metadata ? JSON.parse(existing.metadata) : {};
      const newMetadata = { ...currentMetadata };

      await prisma.featureUsage.update({
        where: {
          userId_featureName: {
            userId,
            featureName,
          },
        },
        data: {
          usageCount: {
            increment: 1,
          },
          lastUsedAt: new Date(),
          totalDuration: {
            increment: duration || 0,
          },
          metadata: JSON.stringify(newMetadata),
        },
      });
    } else {
      // Create new record
      await prisma.featureUsage.create({
        data: {
          userId,
          featureName,
          usageCount: 1,
          lastUsedAt: new Date(),
          totalDuration: duration || 0,
        },
      });
    }
  } catch (err) {
    console.error('[Telemetry] Failed to increment feature usage:', err);
  }
}

/**
 * Get user's last used feature
 */
export async function getLastUsedFeature(userId) {
  try {
    const lastFeature = await prisma.featureUsage.findFirst({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
    });

    return lastFeature?.featureName || null;
  } catch (err) {
    console.error('[Telemetry] Failed to get last used feature:', err);
    return null;
  }
}

