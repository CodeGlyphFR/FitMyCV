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
