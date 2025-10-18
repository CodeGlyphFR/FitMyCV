import prisma from '@/lib/prisma';

/**
 * Event types for telemetry tracking
 */
export const EventTypes = {
  // CV Management
  CV_GENERATED: 'CV_GENERATED',
  CV_IMPORTED: 'CV_IMPORTED',
  CV_EXPORTED: 'CV_EXPORTED',
  CV_CREATED_MANUAL: 'CV_CREATED_MANUAL',
  CV_EDITED: 'CV_EDITED',
  CV_DELETED: 'CV_DELETED',
  CV_TRANSLATED: 'CV_TRANSLATED',

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
 * @param {string} [params.sessionId] - Session ID
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
  sessionId = null,
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
        sessionId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        duration,
        status,
        error,
      },
    });

    // Update session activity if sessionId provided
    if (sessionId) {
      await updateSessionActivity(sessionId);
    }

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
    'CV_GENERATED', 'CV_IMPORTED', 'CV_EXPORTED',
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
    'CV_EXPORTED': 'export_pdf',
    'CV_CREATED_MANUAL': 'create_cv_manual',
    'CV_EDITED': 'edit_cv',
    'MATCH_SCORE_CALCULATED': 'calculate_match_score',
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

  // For generation/import/optimization, track analysisLevel
  if (['CV_GENERATED', 'CV_IMPORTED', 'CV_OPTIMIZED'].includes(type) && metadata.analysisLevel) {
    return { analysisLevel: metadata.analysisLevel };
  }

  return null;
}

/**
 * Track CV generation
 */
export async function trackCvGeneration({
  userId,
  deviceId,
  sessionId,
  analysisLevel,
  sourceType, // 'link' or 'pdf'
  sourceCount = 1,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_GENERATED,
    userId,
    deviceId,
    sessionId,
    metadata: {
      analysisLevel,
      sourceType,
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
  sessionId,
  analysisLevel,
  fileSize,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_IMPORTED,
    userId,
    deviceId,
    sessionId,
    metadata: {
      analysisLevel,
      fileSize,
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
  sessionId,
  language,
  duration,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_EXPORTED,
    userId,
    deviceId,
    sessionId,
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
  sessionId,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.CV_CREATED_MANUAL,
    userId,
    deviceId,
    sessionId,
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
  sessionId,
  operation, // set, push, insert, remove, move
  section, // header, skills, experience, etc.
  field,
}) {
  return trackEvent({
    type: EventTypes.CV_EDITED,
    userId,
    deviceId,
    sessionId,
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
  sessionId,
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
    sessionId,
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
  sessionId,
  analysisLevel,
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
    sessionId,
    metadata: {
      analysisLevel,
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
  sessionId,
  provider,
  status = 'success',
  error = null,
}) {
  return trackEvent({
    type: EventTypes.USER_LOGIN,
    userId,
    deviceId,
    sessionId,
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
  sessionId,
}) {
  return trackEvent({
    type: EventTypes.USER_LOGOUT,
    userId,
    deviceId,
    sessionId,
    status: 'success',
  });
}

/**
 * Start a new user session
 */
export async function startSession({
  userId,
  deviceId,
  userAgent,
  ip,
}) {
  try {
    const session = await prisma.userSession.create({
      data: {
        userId,
        deviceId,
        userAgent,
        ip,
        startedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    return session;
  } catch (err) {
    console.error('[Telemetry] Failed to start session:', err);
    return null;
  }
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionId) {
  try {
    // Check if session exists first
    const session = await prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      // Session doesn't exist, skip update silently
      return;
    }

    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: new Date(),
        eventsCount: {
          increment: 1,
        },
      },
    });
  } catch (err) {
    // Ignore errors silently - session tracking shouldn't break the app
    console.debug('[Telemetry] Could not update session activity:', err.message);
  }
}

/**
 * End a user session
 */
export async function endSession(sessionId) {
  try {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
      },
    });
  } catch (err) {
    console.error('[Telemetry] Failed to end session:', err);
  }
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

      // Merge analysis level counts if provided
      if (metadata?.analysisLevel) {
        newMetadata[metadata.analysisLevel] = (newMetadata[metadata.analysisLevel] || 0) + 1;
      }

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
      const initialMetadata = {};
      if (metadata?.analysisLevel) {
        initialMetadata[metadata.analysisLevel] = 1;
      }

      await prisma.featureUsage.create({
        data: {
          userId,
          featureName,
          usageCount: 1,
          lastUsedAt: new Date(),
          totalDuration: duration || 0,
          metadata: Object.keys(initialMetadata).length > 0 ? JSON.stringify(initialMetadata) : null,
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
