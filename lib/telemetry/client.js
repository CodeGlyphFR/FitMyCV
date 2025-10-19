'use client';

/**
 * Client-side telemetry tracking
 * Sends events to the backend via API
 */

// Event queue to batch requests
let eventQueue = [];
let flushTimeout = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 10;

// Generate a device ID (stored in localStorage)
function getDeviceId() {
  if (typeof window === 'undefined') return null;

  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Get or create session ID (stored in sessionStorage)
function getSessionId() {
  if (typeof window === 'undefined') return null;

  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    // Generate a temporary session ID
    sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

// Get backend session ID if available
function getBackendSessionId() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('backendSessionId');
}

// Set backend session ID
function setBackendSessionId(id) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('backendSessionId', id);
}

/**
 * Flush event queue to backend
 */
async function flushEventQueue() {
  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    await fetch('/api/telemetry/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events: eventsToSend }),
    });
  } catch (error) {
    console.error('[Telemetry] Failed to send events:', error);
  }
}

/**
 * Queue an event for sending
 */
function queueEvent(event) {
  eventQueue.push({
    ...event,
    deviceId: getDeviceId(),
    sessionId: getBackendSessionId() || null, // Use backend session ID if available
    timestamp: new Date().toISOString(),
  });

  // Flush immediately if queue is full
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    if (flushTimeout) clearTimeout(flushTimeout);
    flushEventQueue();
    return;
  }

  // Schedule flush
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushEventQueue, FLUSH_INTERVAL);
}

/**
 * Track a generic event
 */
export function trackEvent(type, metadata = {}) {
  queueEvent({
    type,
    metadata,
  });
}

/**
 * Track page view
 */
export function trackPageView(path, metadata = {}) {
  queueEvent({
    type: 'PAGE_VIEW',
    metadata: {
      path,
      ...metadata,
    },
  });
}

/**
 * Track button click
 */
export function trackButtonClick(buttonName, metadata = {}) {
  queueEvent({
    type: 'BUTTON_CLICK',
    metadata: {
      buttonName,
      ...metadata,
    },
  });
}

/**
 * Track modal opened
 */
export function trackModalOpened(modalName, metadata = {}) {
  queueEvent({
    type: 'MODAL_OPENED',
    metadata: {
      modalName,
      ...metadata,
    },
  });
}

/**
 * Track modal closed
 */
export function trackModalClosed(modalName, metadata = {}) {
  queueEvent({
    type: 'MODAL_CLOSED',
    metadata: {
      modalName,
      ...metadata,
    },
  });
}

/**
 * Track form submission
 */
export function trackFormSubmitted(formName, metadata = {}) {
  queueEvent({
    type: 'FORM_SUBMITTED',
    metadata: {
      formName,
      ...metadata,
    },
  });
}

/**
 * Track time spent on page
 */
let pageStartTime = null;
let currentPath = null;

export function startPageTimer(path) {
  // Send previous page duration if exists
  if (pageStartTime && currentPath) {
    const duration = Date.now() - pageStartTime;
    queueEvent({
      type: 'PAGE_VIEW',
      metadata: {
        path: currentPath,
      },
      duration,
    });
  }

  // Start new timer
  pageStartTime = Date.now();
  currentPath = path;
}

export function stopPageTimer() {
  if (pageStartTime && currentPath) {
    const duration = Date.now() - pageStartTime;
    queueEvent({
      type: 'PAGE_VIEW',
      metadata: {
        path: currentPath,
      },
      duration,
    });
    pageStartTime = null;
    currentPath = null;
  }
}

// Session heartbeat to keep session alive
let heartbeatInterval = null;
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

function startHeartbeat() {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(() => {
    const backendSessionId = getBackendSessionId();
    if (backendSessionId) {
      // Send a heartbeat event to update lastActivityAt
      queueEvent({
        type: 'HEARTBEAT',
        metadata: {},
      });
      flushEventQueue(); // Flush immediately
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Flush queue and end session
function flushAndEndSession() {
  stopPageTimer();
  stopHeartbeat();

  // End the backend session
  const backendSessionId = getBackendSessionId();
  if (backendSessionId) {
    const sessionData = JSON.stringify({ sessionId: backendSessionId });
    const blob = new Blob([sessionData], { type: 'application/json' });
    navigator.sendBeacon('/api/telemetry/session/end', blob);
  }

  // Flush any pending events
  if (eventQueue.length > 0) {
    // Use sendBeacon for more reliable sending on unload
    const data = JSON.stringify({ events: eventQueue });
    const blob = new Blob([data], { type: 'application/json' });
    navigator.sendBeacon('/api/telemetry/track', blob);
    eventQueue = [];
  }
}

// Better detection using visibilitychange (more reliable than beforeunload)
if (typeof window !== 'undefined') {
  // Track when user switches tabs or minimizes window
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Tab is hidden - end session
      flushAndEndSession();
    } else if (document.visibilityState === 'visible') {
      // Tab is visible again - restart heartbeat
      startHeartbeat();
    }
  });

  // Fallback for page unload (in case visibilitychange doesn't fire)
  window.addEventListener('beforeunload', () => {
    flushAndEndSession();
  });

  // Also handle pagehide for mobile Safari
  window.addEventListener('pagehide', () => {
    flushAndEndSession();
  });
}

// Start session on load
if (typeof window !== 'undefined') {
  fetch('/api/telemetry/session/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      sessionId: getSessionId(),
      userAgent: navigator.userAgent,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.sessionId) {
        // Store the backend session ID
        setBackendSessionId(data.sessionId);
        // Start heartbeat to keep session alive
        startHeartbeat();
      }
    })
    .catch(err => console.debug('[Telemetry] Session start failed (this is normal for anonymous users):', err.message));
}
