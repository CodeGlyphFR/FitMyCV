/**
 * Auth Receiver — Content Script
 *
 * Injected on fitmycv.io/extension-auth pages.
 * Listens for postMessage from the page containing the extension JWT token
 * after OAuth login, and stores it in extension storage.
 */

import browser from 'webextension-polyfill';

const TOKEN_KEY = 'fitmycv_token';
const USER_KEY = 'fitmycv_user';

window.addEventListener('message', async (event) => {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || data.type !== 'FITMYCV_EXTENSION_AUTH') return;

  if (!data.token) return;

  // Basic JWT format validation (3 base64url parts separated by dots)
  const jwtParts = data.token.split('.');
  if (jwtParts.length !== 3 || jwtParts.some(p => p.length === 0)) {
    console.warn('[FitMyCV] Invalid token format received, ignoring');
    return;
  }

  try {
    // Store token and user in extension storage
    await browser.storage.local.set({
      [TOKEN_KEY]: data.token,
      [USER_KEY]: data.user || null,
    });

    // Notify the service worker
    await browser.runtime.sendMessage({ type: 'OAUTH_LOGIN_SUCCESS' });
  } catch (err) {
    console.error('[FitMyCV] Auth receiver error:', err);
  }
});
