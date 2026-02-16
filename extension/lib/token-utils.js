/**
 * Token Utilities
 *
 * Shared JWT helpers for the extension (api-client + service-worker).
 * Decodes JWT payload client-side (no verification — only for reading `exp`).
 */

/**
 * Decode the payload section of a JWT without signature verification.
 * @param {string} token
 * @returns {object|null} decoded payload or null if malformed
 */
export function decodeTokenPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

/**
 * Check if a token should be proactively refreshed (expires in < 24h).
 * @param {string} token
 * @returns {boolean}
 */
export function shouldRefreshToken(token) {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return false;
  const expiresAt = payload.exp * 1000;
  const oneDayMs = 24 * 60 * 60 * 1000;
  return expiresAt - Date.now() < oneDayMs;
}

/**
 * Check if a token is already expired.
 * @param {string} token
 * @returns {boolean}
 */
export function isTokenExpired(token) {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}
