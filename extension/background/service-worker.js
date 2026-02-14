/**
 * Service Worker — Background Script (Manifest V3)
 *
 * Responsibilities:
 * 1. Badge management (green when job offer detected)
 * 2. Task polling (when generation tasks are in progress)
 * 3. Message routing between content scripts and popup
 * 4. Device ID generation
 */

import browser from 'webextension-polyfill';
import { shouldRefreshToken } from '../lib/token-utils.js';

const ALARM_NAME = 'fitmycv-poll-tasks';
const ALARM_TOKEN_REFRESH = 'fitmycv-token-refresh';
const TOKEN_REFRESH_INTERVAL_MINUTES = 720; // 12 hours
const POLL_INTERVAL_MINUTES = 0.5; // 30 seconds (minimum for MV3 alarms)
const BADGE_COLOR = '#10b981'; // emerald-500
const PICKLIST_KEY = 'fitmycv_picklist';
const STORAGE_KEYS = {
  TOKEN: 'fitmycv_token',
  ACTIVE_TASKS: 'fitmycv_active_tasks',
  LAST_SYNC: 'fitmycv_last_sync',
  DEVICE_ID: 'fitmycv_device_id',
  POLLING_ACTIVE: 'fitmycv_polling_active',
};

// --- Badge Management ---

async function updatePicklistBadge() {
  const data = await browser.storage.local.get(PICKLIST_KEY);
  const picklist = data[PICKLIST_KEY] || [];
  const count = picklist.length;
  if (count > 0) {
    browser.action.setBadgeText({ text: String(count) });
    browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  } else {
    browser.action.setBadgeText({ text: '' });
  }
}

// --- Icon Management (active = colored, inactive = greyscale) ---

const ICON_SIZES = [16, 48];
let greyIconCache = null; // { 16: ImageData, 48: ImageData }

async function generateGreyIcons() {
  if (greyIconCache) return greyIconCache;
  const cache = {};
  for (const size of ICON_SIZES) {
    const url = browser.runtime.getURL(`icons/icon-${size}.png`);
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const grey = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
      pixels[i] = grey;
      pixels[i + 1] = grey;
      pixels[i + 2] = grey;
    }
    cache[size] = imageData;
  }
  greyIconCache = cache;
  return cache;
}

async function setIconActive(tabId) {
  const path = {};
  for (const size of ICON_SIZES) path[size] = `icons/icon-${size}.png`;
  browser.action.setIcon({ path, tabId });
}

async function setIconInactive(tabId) {
  try {
    const cache = await generateGreyIcons();
    const imageData = {};
    for (const size of ICON_SIZES) imageData[size] = cache[size];
    browser.action.setIcon({ imageData, tabId });
  } catch {
    // Fallback: keep default icon if OffscreenCanvas fails
  }
}

// --- Polling ---

async function getToken() {
  const data = await browser.storage.local.get(STORAGE_KEYS.TOKEN);
  return data[STORAGE_KEYS.TOKEN] || null;
}

async function getDeviceId() {
  const data = await browser.storage.local.get(STORAGE_KEYS.DEVICE_ID);
  if (data[STORAGE_KEYS.DEVICE_ID]) return data[STORAGE_KEYS.DEVICE_ID];

  const id = `ext-${crypto.randomUUID()}`;
  await browser.storage.local.set({ [STORAGE_KEYS.DEVICE_ID]: id });
  return id;
}

async function attemptTokenRefresh() {
  const token = await getToken();
  if (!token || !shouldRefreshToken(token)) return false;

  try {
    const API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
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
      await browser.storage.local.set({
        [STORAGE_KEYS.TOKEN]: data.token,
        ...(data.user && { 'fitmycv_user': data.user }),
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function pollTasks() {
  let token = await getToken();
  if (!token) {
    await stopPolling();
    return;
  }

  // Proactive refresh before polling
  if (shouldRefreshToken(token)) {
    await attemptTokenRefresh();
    token = await getToken();
  }

  try {
    const deviceId = await getDeviceId();
    const syncData = await browser.storage.local.get(STORAGE_KEYS.LAST_SYNC);
    const since = syncData[STORAGE_KEYS.LAST_SYNC] || null;

    const API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
    const params = new URLSearchParams({ deviceId });
    if (since) params.set('since', String(since));

    let response = await fetch(`${API_BASE}/api/ext/background-tasks/sync?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    // Reactive retry on 401
    if (response.status === 401) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        const newToken = await getToken();
        response = await fetch(`${API_BASE}/api/ext/background-tasks/sync?${params}`, {
          headers: { 'Authorization': `Bearer ${newToken}` },
        });
      }
    }

    if (response.status === 401) {
      // Token expired and refresh failed — clear credentials and notify popup
      await browser.storage.local.remove([STORAGE_KEYS.TOKEN, 'fitmycv_user']);
      await stopPolling();
      try {
        await browser.runtime.sendMessage({ type: 'AUTH_EXPIRED' });
      } catch { /* popup may not be open */ }
      return;
    }

    if (!response.ok) return;

    const data = await response.json();

    // Merge: update existing tasks with new data, keep unmatched ones
    const existingData = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_TASKS);
    const existingTasks = existingData[STORAGE_KEYS.ACTIVE_TASKS] || [];
    const taskMap = new Map(existingTasks.map(t => [t.id, t]));
    for (const task of (data.tasks || [])) {
      taskMap.set(task.id, task);
    }
    const mergedTasks = Array.from(taskMap.values());

    await browser.storage.local.set({
      [STORAGE_KEYS.ACTIVE_TASKS]: mergedTasks,
      [STORAGE_KEYS.LAST_SYNC]: data.timestamp,
    });

    // Check if any tasks are still in progress
    const activeTasks = mergedTasks.filter(t =>
      t.status === 'queued' || t.status === 'running'
    );

    if (activeTasks.length === 0) {
      await stopPolling();
    }
  } catch (error) {
    console.error('[SW] Poll error:', error);
  }
}

async function startPolling() {
  const isPolling = (await browser.storage.local.get(STORAGE_KEYS.POLLING_ACTIVE))[STORAGE_KEYS.POLLING_ACTIVE];
  if (isPolling) return;

  await browser.storage.local.set({ [STORAGE_KEYS.POLLING_ACTIVE]: true });
  browser.alarms.create(ALARM_NAME, {
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
  // Poll immediately
  await pollTasks();
}

async function stopPolling() {
  await browser.storage.local.set({ [STORAGE_KEYS.POLLING_ACTIVE]: false });
  await browser.alarms.clear(ALARM_NAME);
}

// --- Event Listeners ---

// Handle messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case 'JOB_OFFER_DETECTED':
      if (sender.tab?.id) {
        setIconActive(sender.tab.id);
      }
      return;

    case 'JOB_OFFER_NOT_DETECTED':
      if (sender.tab?.id) {
        setIconInactive(sender.tab.id);
      }
      return;

    case 'EXTRACT_OFFER': {
      // Forward to the content script of the active tab
      return browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab?.id) return { error: 'No active tab' };
        return browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_OFFER' });
      });
    }

    case 'START_POLLING':
      startPolling();
      return;

    case 'STOP_POLLING':
      stopPolling();
      return;

    case 'OAUTH_LOGIN_SUCCESS':
      // Token was stored by auth-receiver content script
      // Nothing else needed — popup will read from storage on next open
      return;

    case 'GET_STATE':
      return browser.storage.local.get([
        STORAGE_KEYS.TOKEN,
        STORAGE_KEYS.ACTIVE_TASKS,
        STORAGE_KEYS.POLLING_ACTIVE,
        'fitmycv_user',
      ]).then(data => ({
        isAuthenticated: !!data[STORAGE_KEYS.TOKEN],
        user: data['fitmycv_user'] || null,
        tasks: data[STORAGE_KEYS.ACTIVE_TASKS] || [],
        isPolling: !!data[STORAGE_KEYS.POLLING_ACTIVE],
      }));
  }
});

// Handle alarms (polling + token refresh)
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollTasks();
  } else if (alarm.name === ALARM_TOKEN_REFRESH) {
    attemptTokenRefresh();
  }
});

// Reset icon to inactive when navigating away
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    setIconInactive(tabId);
  }
});

// On install, generate device ID + update badge + setup token refresh alarm
browser.runtime.onInstalled.addListener(async () => {
  await getDeviceId();
  await updatePicklistBadge();
  browser.alarms.create(ALARM_TOKEN_REFRESH, {
    periodInMinutes: TOKEN_REFRESH_INTERVAL_MINUTES,
  });
});

// On startup, update picklist badge + ensure token refresh alarm exists
browser.runtime.onStartup.addListener(async () => {
  await updatePicklistBadge();
  browser.alarms.create(ALARM_TOKEN_REFRESH, {
    periodInMinutes: TOKEN_REFRESH_INTERVAL_MINUTES,
  });
});

// Update badge when picklist changes in storage
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[PICKLIST_KEY]) {
    updatePicklistBadge();
  }
});
