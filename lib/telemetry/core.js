/**
 * Core telemetry functions
 */
import prisma from '@/lib/prisma';
import {
  getCategoryFromType,
  isFeatureEvent,
  getFeatureNameFromEventType,
} from './constants.js';

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
        metadata: null,
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
