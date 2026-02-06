/**
 * Authentication-related telemetry events
 */
import { trackEvent } from '../core.js';
import { EventTypes } from '../constants.js';

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
