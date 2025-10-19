/**
 * Utility functions to filter admin pages from analytics
 */

/**
 * Check if an event is a PAGE_VIEW on an admin page
 * @param {Object} event - TelemetryEvent object
 * @returns {boolean}
 */
export function isAdminPageEvent(event) {
  if (event.type !== 'PAGE_VIEW') return false;
  if (!event.metadata) return false;

  try {
    const meta = typeof event.metadata === 'string'
      ? JSON.parse(event.metadata)
      : event.metadata;
    return meta.path && meta.path.startsWith('/admin');
  } catch {
    return false;
  }
}

/**
 * Filter out admin page events from an array of events
 * @param {Array} events - Array of TelemetryEvent objects
 * @returns {Array} - Filtered events
 */
export function filterAdminEvents(events) {
  return events.filter(e => !isAdminPageEvent(e));
}

/**
 * Check if a session has visited any admin pages
 * @param {string} sessionId - Session ID
 * @param {Object} prisma - Prisma client
 * @returns {Promise<boolean>}
 */
export async function sessionHasAdminPages(sessionId, prisma) {
  const adminEvents = await prisma.telemetryEvent.findFirst({
    where: {
      sessionId,
      type: 'PAGE_VIEW',
    },
    select: {
      metadata: true,
    },
  });

  if (!adminEvents) return false;

  const allSessionEvents = await prisma.telemetryEvent.findMany({
    where: {
      sessionId,
      type: 'PAGE_VIEW',
    },
    select: {
      metadata: true,
    },
  });

  return allSessionEvents.some(e => isAdminPageEvent(e));
}

/**
 * Get session IDs that have visited admin pages
 * @param {Object} whereClause - Base where clause for sessions
 * @param {Object} prisma - Prisma client
 * @returns {Promise<Set<string>>} - Set of session IDs to exclude
 */
export async function getAdminSessionIds(whereClause, prisma) {
  // Get all PAGE_VIEW events for the period
  const pageViews = await prisma.telemetryEvent.findMany({
    where: {
      type: 'PAGE_VIEW',
      sessionId: { not: null },
      ...(whereClause.startedAt ? {
        timestamp: { gte: whereClause.startedAt.gte }
      } : {}),
    },
    select: {
      type: true,
      sessionId: true,
      metadata: true,
    },
  });

  // Filter to admin pages
  const adminSessionIds = new Set();
  pageViews.forEach(event => {
    if (isAdminPageEvent(event)) {
      adminSessionIds.add(event.sessionId);
    }
  });

  // Get sessions that actually exist in UserSession table
  const existingSessions = await prisma.userSession.findMany({
    where: {
      id: { in: Array.from(adminSessionIds) },
      ...whereClause,
    },
    select: {
      id: true,
    },
  });

  // Return only session IDs that still exist
  const existingAdminSessionIds = new Set(existingSessions.map(s => s.id));
  return existingAdminSessionIds;
}
