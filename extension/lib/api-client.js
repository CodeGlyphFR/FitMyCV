/**
 * API Client for FitMyCV SaaS
 *
 * Handles authenticated requests to the SaaS backend from the extension.
 * Token is stored in chrome.storage.local.
 */

import browser from 'webextension-polyfill';

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

// --- API helpers ---

async function apiFetch(path, options = {}) {
  const token = await getToken();
  const url = `${API_BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    await clearToken();
    throw new AuthError('Session expired');
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
    throw new Error(data.error || 'Login failed');
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
    throw new Error(data.error || 'Failed to submit offers');
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
