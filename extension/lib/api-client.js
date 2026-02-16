/**
 * API Client for FitMyCV SaaS
 *
 * Handles authenticated requests to the SaaS backend from the extension.
 * Token is stored in chrome.storage.local.
 */

import browser from 'webextension-polyfill';
import { shouldRefreshToken } from './token-utils.js';

// Base URL — configurable via build env
const API_BASE = typeof __API_BASE__ !== 'undefined'
  ? __API_BASE__
  : 'https://app.fitmycv.io';

const STORAGE_KEYS = {
  TOKEN: 'fitmycv_token',
  USER: 'fitmycv_user',
  DEVICE_ID: 'fitmycv_device_id',
};

// --- Storage helpers ---

async function getToken() {
  const data = await browser.storage.local.get(STORAGE_KEYS.TOKEN);
  return data[STORAGE_KEYS.TOKEN] || null;
}

async function setToken(token) {
  await browser.storage.local.set({ [STORAGE_KEYS.TOKEN]: token });
}

async function clearToken() {
  await browser.storage.local.remove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.USER]);
}

async function setUser(user) {
  await browser.storage.local.set({ [STORAGE_KEYS.USER]: user });
}

export async function getUser() {
  const data = await browser.storage.local.get(STORAGE_KEYS.USER);
  return data[STORAGE_KEYS.USER] || null;
}

export async function getDeviceId() {
  const data = await browser.storage.local.get(STORAGE_KEYS.DEVICE_ID);
  if (data[STORAGE_KEYS.DEVICE_ID]) return data[STORAGE_KEYS.DEVICE_ID];

  const id = `ext-${crypto.randomUUID()}`;
  await browser.storage.local.set({ [STORAGE_KEYS.DEVICE_ID]: id });
  return id;
}

export async function isAuthenticated() {
  const token = await getToken();
  return !!token;
}

import { t } from './i18n.js';

// --- Error key mapping (server i18n keys → extension i18n keys) ---

const ERROR_KEY_MAP = {
  'errors.api.auth.invalidCredentials': 'errors.invalidCredentials',
  'errors.api.auth.emailNotVerified': 'errors.emailNotVerified',
  'errors.api.auth.emailAndPasswordRequired': 'errors.emailAndPasswordRequired',
  'errors.api.auth.tokenRequired': 'errors.tokenRequired',
  'errors.api.auth.tokenExpired': 'errors.tokenExpired',
  'errors.api.auth.tokenInvalid': 'errors.tokenInvalid',
  'errors.api.extension.serviceUnavailable': 'errors.serviceUnavailable',
  'errors.api.extension.baseFileRequired': 'errors.baseFileRequired',
  'errors.api.extension.offersRequired': 'errors.offersRequired',
  'errors.api.extension.offerContentInsufficient': 'errors.offerContentInsufficient',
  'errors.api.extension.sourceCvNotFound': 'errors.sourceCvNotFound',
  'errors.api.extension.cancelParamsMissing': 'errors.cancelParamsMissing',
  'errors.api.extension.taskNotFound': 'errors.taskNotFound',
  'errors.api.common.notAuthenticated': 'errors.notAuthenticated',
  'errors.api.common.serverError': 'errors.serverError',
  'errors.api.subscription.limitReached': 'errors.limitReached',
};

function resolveErrorMessage(errorKey) {
  const i18nKey = ERROR_KEY_MAP[errorKey];
  if (i18nKey) {
    const translated = t(i18nKey);
    if (translated !== i18nKey) return translated;
  }
  return errorKey;
}

// --- Token refresh ---

let refreshInProgress = null;

async function refreshToken() {
  const token = await getToken();
  if (!token) return false;

  try {
    const response = await fetch(`${API_BASE}/api/auth/extension-token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data.success && data.token) {
      await setToken(data.token);
      if (data.user) await setUser(data.user);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function ensureTokenFresh() {
  const token = await getToken();
  if (!token || !shouldRefreshToken(token)) return;

  // Mutex: avoid concurrent refresh calls
  if (!refreshInProgress) {
    refreshInProgress = refreshToken().finally(() => { refreshInProgress = null; });
  }
  await refreshInProgress;
}

// --- API helpers ---

async function apiFetch(path, options = {}) {
  // Proactive refresh: renew if token expires in < 24h
  await ensureTokenFresh();

  const token = await getToken();
  const url = `${API_BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Reactive refresh: on 401, try refresh once then retry
  if (response.status === 401 && token) {
    const refreshed = await refreshToken();
    if (refreshed) {
      const newToken = await getToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  // Still 401 after retry — clear credentials and throw
  if (response.status === 401) {
    await clearToken();
    throw new AuthError(t('errors.sessionExpired'));
  }

  return response;
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

// --- Public API ---

/**
 * Login with email/password
 * @returns {{ name: string, email: string }}
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE}/api/auth/extension-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(resolveErrorMessage(data.error || 'Login failed'));
  }

  await setToken(data.token);
  await setUser(data.user);

  return data.user;
}

/**
 * Logout — clear stored credentials
 */
export async function logout() {
  await clearToken();
}

/**
 * Fetch the user's CV list
 * @returns {{ items: Array, current: string|null }}
 */
export async function fetchCvList() {
  const response = await apiFetch('/api/ext/cvs');
  if (!response.ok) throw new Error('Failed to fetch CV list');
  return response.json();
}

/**
 * Fetch the user's credit balance
 */
export async function fetchCreditBalance() {
  const response = await apiFetch('/api/ext/credits/balance');
  if (!response.ok) throw new Error('Failed to fetch credit balance');
  return response.json();
}

/**
 * Fetch feature costs
 */
export async function fetchCreditCosts() {
  const response = await apiFetch('/api/ext/credits/costs');
  if (!response.ok) throw new Error('Failed to fetch costs');
  return response.json();
}

/**
 * Submit extracted offers for CV generation
 * @param {string} baseFile - source CV filename
 * @param {Array<{title: string, content: string, sourceUrl: string}>} offers
 * @param {string} language - user interface language
 * @returns {{ success: boolean, tasks: Array, totalTasks: number }}
 */
export async function submitOffers(baseFile, offers, language = 'fr') {
  const deviceId = await getDeviceId();

  const response = await apiFetch('/api/ext/background-tasks/generate-cv-from-content', {
    method: 'POST',
    body: JSON.stringify({
      baseFile,
      offers,
      deviceId,
      userInterfaceLanguage: language,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(resolveErrorMessage(data.error || 'Failed to submit offers'));
  }

  return data;
}

/**
 * Cancel a running/queued task
 * @param {string} taskId
 * @returns {{ success: boolean, cancelled: boolean, refunded: boolean }}
 */
export async function cancelTask(taskId) {
  const response = await apiFetch(
    `/api/ext/background-tasks/sync?taskId=${encodeURIComponent(taskId)}&action=cancel`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Failed to cancel task');
  return response.json();
}

/**
 * Poll task progress
 * @param {string|null} since - timestamp for incremental sync
 * @returns {{ tasks: Array, timestamp: number }}
 */
export async function pollTaskSync(since = null) {
  const deviceId = await getDeviceId();
  const params = new URLSearchParams({ deviceId });
  if (since) params.set('since', String(since));

  const response = await apiFetch(`/api/ext/background-tasks/sync?${params}`);
  if (!response.ok) throw new Error('Failed to poll tasks');
  return response.json();
}
