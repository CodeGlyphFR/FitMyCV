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

const ALARM_NAME = 'fitmycv-poll-tasks';
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

async function setBadgeDetected(tabId) {
  // Only show per-tab "!" if the picklist is empty (picklist badge takes priority)
  const data = await browser.storage.local.get(PICKLIST_KEY);
  const picklist = data[PICKLIST_KEY] || [];
  if (picklist.length > 0) return;

  browser.action.setBadgeText({ text: '!', tabId });
  browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR, tabId });
}

function clearBadge(tabId) {
  browser.action.setBadgeText({ text: '', tabId });
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

async function pollTasks() {
  const token = await getToken();
  if (!token) {
    await stopPolling();
    return;
  }

  try {
    const deviceId = await getDeviceId();
    const syncData = await browser.storage.local.get(STORAGE_KEYS.LAST_SYNC);
    const since = syncData[STORAGE_KEYS.LAST_SYNC] || null;

    const API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
    const params = new URLSearchParams({ deviceId });
    if (since) params.set('since', String(since));

    const response = await fetch(`${API_BASE}/api/ext/background-tasks/sync?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (response.status === 401) {
      // Token expired — clear credentials and notify popup
      await browser.storage.local.remove([STORAGE_KEYS.TOKEN, 'fitmycv_user']);
      await stopPolling();
      // Notify popup to show login view
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
        setBadgeDetected(sender.tab.id);
      }
      return;

    case 'JOB_OFFER_NOT_DETECTED':
      if (sender.tab?.id) {
        clearBadge(sender.tab.id);
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

// Handle alarms (polling)
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    pollTasks();
  }
});

// Clear badge when navigating away
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    clearBadge(tabId);
  }
});

// On install, generate device ID + update badge
browser.runtime.onInstalled.addListener(async () => {
  await getDeviceId();
  await updatePicklistBadge();
});

// On startup, update picklist badge
browser.runtime.onStartup.addListener(async () => {
  await updatePicklistBadge();
});

// Update badge when picklist changes in storage
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[PICKLIST_KEY]) {
    updatePicklistBadge();
  }
});
