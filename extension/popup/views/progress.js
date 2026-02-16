/**
 * Progress View — Inline task generation tracking
 */

import browser from 'webextension-polyfill';
import { pollTaskSync, cancelTask } from '../../lib/api-client.js';
import { t } from '../../lib/i18n.js';

const STORAGE_KEY = 'fitmycv_active_tasks';
let pollInterval = null;
const MAX_POLL_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
let pollStartTime = null;

function getStatusDisplay(task) {
  if (task.status === 'completed') return t('progress.status.completed');
  if (task.status === 'failed') return t('progress.status.failed');
  if (task.status === 'cancelled') return t('progress.status.cancelled');
  if (task.status === 'analyzing') return t('progress.status.analyzing');

  if (task.currentStep) {
    const stepKey = `progress.steps.${task.currentStep}`;
    const stepLabel = t(stepKey);
    return stepLabel !== stepKey ? stepLabel : t('progress.status.running');
  }

  if (task.currentPhase === 'extracting') return t('progress.status.extracting');

  if (task.status === 'queued') return t('progress.status.queued');
  if (task.status === 'running') return t('progress.status.running');
  return task.status;
}

async function pollAndUpdate() {
  try {
    const stored = await browser.storage.local.get('fitmycv_last_sync');
    const since = stored.fitmycv_last_sync || null;
    const data = await pollTaskSync(since);
    if (data?.tasks?.length) {
      const existing = await browser.storage.local.get(STORAGE_KEY);
      const taskMap = new Map((existing[STORAGE_KEY] || []).map(t => [t.id, t]));
      for (const task of data.tasks) {
        taskMap.set(task.id, task);
      }
      await browser.storage.local.set({
        [STORAGE_KEY]: Array.from(taskMap.values()),
        fitmycv_last_sync: data.timestamp,
      });
    }
  } catch { /* silent — popup poll failure is non-critical */ }
}

export async function initProgress(listContainer) {
  await renderTasks(listContainer);

  // Poll directly from popup every 5s (faster than SW alarm at 30s)
  if (pollInterval) clearInterval(pollInterval);
  pollStartTime = Date.now();
  pollInterval = setInterval(async () => {
    // Stop polling after max duration or when all tasks are done
    if (Date.now() - pollStartTime > MAX_POLL_DURATION_MS) {
      stopProgressRefresh();
      return;
    }
    await pollAndUpdate();
    await renderTasks(listContainer);

    // Auto-stop polling when all tasks are terminal
    const data = await browser.storage.local.get([STORAGE_KEY, 'fitmycv_session_task_ids']);
    const allTasks = data[STORAGE_KEY] || [];
    const sessionTaskIds = data['fitmycv_session_task_ids'] || [];
    const sessionTasks = allTasks.filter(t => sessionTaskIds.includes(t.id));
    const allDone = sessionTasks.length > 0 && sessionTasks.every(t =>
      ['completed', 'failed', 'cancelled'].includes(t.status)
    );
    if (allDone) stopProgressRefresh();
  }, 5000);
  // Immediate first poll
  pollAndUpdate();
}

export function stopProgressRefresh() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/** Re-render progress tasks immediately (called after temp tasks are stored) */
export async function refreshProgress() {
  const container = document.getElementById('progress-inline-container');
  if (container) await renderTasks(container);
}

async function renderTasks(container) {
  const data = await browser.storage.local.get([STORAGE_KEY, 'fitmycv_session_task_ids']);
  const allTasks = data[STORAGE_KEY] || [];
  const sessionTaskIds = data['fitmycv_session_task_ids'] || [];

  // Show only tasks from this extension session, sorted like the SaaS task manager:
  // active tasks first (running/queued/analyzing), then the rest by date desc
  const ACTIVE_STATUSES = { running: 0, queued: 1, analyzing: 1 };
  const tasks = allTasks
    .filter(t => t.type === 'cv_generation' && sessionTaskIds.includes(t.id))
    .sort((a, b) => {
      const pa = ACTIVE_STATUSES[a.status] ?? 2;
      const pb = ACTIVE_STATUSES[b.status] ?? 2;
      if (pa !== pb) return pa - pb;
      return (b.createdAt || 0) - (a.createdAt || 0);
    })
    .slice(0, 20);

  // Hide container entirely when no tasks
  if (tasks.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  container.innerHTML = '';

  const apiBase = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
  const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];
  const hasTerminalTasks = tasks.some(t => TERMINAL_STATUSES.includes(t.status));

  // Scrollable wrapper for task items
  const scrollWrapper = document.createElement('div');
  scrollWrapper.className = 'progress-tasks-scroll';

  for (const task of tasks) {
    const el = document.createElement('div');
    el.className = 'progress-item';
    if (task.status === 'completed') el.classList.add('clickable');

    const statusLabel = getStatusDisplay(task);
    const dotClass = task.status;

    // Line 2 left: hostname link
    let hostnameHtml = '';
    if (task.sourceUrl) {
      try {
        const hostname = new URL(task.sourceUrl).hostname.replace('www.', '');
        hostnameHtml = `<a class="progress-source-link" href="${escapeHtml(task.sourceUrl)}" target="_blank">${escapeHtml(hostname)}</a>`;
      } catch { /* invalid URL — skip */ }
    }

    const isCancellable = ['queued', 'running', 'analyzing'].includes(task.status);
    let cancelHtml = '';
    if (isCancellable) {
      cancelHtml = `<button class="task-remove" data-action="cancel-task" data-task-id="${escapeHtml(task.id)}" title="${escapeHtml(t('progress.cancelTitle'))}">&times;</button>`;
    }

    el.innerHTML = `
      <div class="progress-header">
        <div class="progress-title">${escapeHtml(task.title || t('progress.defaultTitle'))}</div>
        ${cancelHtml}
      </div>
      <div class="progress-meta">
        ${hostnameHtml}
        <div class="progress-status">
          <span class="dot ${dotClass}"></span>
          ${statusLabel}
        </div>
      </div>
    `;

    // Completed card → clickable, sets cvFile cookie then opens SaaS
    if (task.status === 'completed') {
      el.addEventListener('click', async (e) => {
        if (e.target.closest('a')) return; // don't intercept hostname link
        let targetUrl = apiBase;
        if (task.cvFile) {
          try {
            const url = new URL(apiBase);
            await browser.cookies.set({
              url: apiBase,
              name: 'cvFile',
              value: task.cvFile,
              path: '/',
              domain: url.hostname,
              expirationDate: Math.floor(Date.now() / 1000) + 31536000,
            });
          } catch {
            // Fallback: pass cvFile as URL parameter if cookies API unavailable
            targetUrl = `${apiBase}?cvFile=${encodeURIComponent(task.cvFile)}`;
          }
        }
        browser.tabs.create({ url: targetUrl });
      });
    }

    // Handle "Cancel" click
    const cancelBtn = el.querySelector('[data-action="cancel-task"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tid = cancelBtn.dataset.taskId;
        cancelBtn.disabled = true;

        const cancelTimeout = setTimeout(() => {
          cancelBtn.disabled = false;
        }, 10000);

        try {
          await cancelTask(tid);
          clearTimeout(cancelTimeout);
          const stored = await browser.storage.local.get(STORAGE_KEY);
          const tasks = stored[STORAGE_KEY] || [];
          const updated = tasks.map(t => t.id === tid ? { ...t, status: 'cancelled' } : t);
          await browser.storage.local.set({ [STORAGE_KEY]: updated });
          await renderTasks(container);
        } catch {
          clearTimeout(cancelTimeout);
          cancelBtn.disabled = false;
        }
      });
    }

    scrollWrapper.appendChild(el);
  }

  container.appendChild(scrollWrapper);

  // "Clear" button — outside scroll, only removes terminal tasks
  if (hasTerminalTasks) {
    const clearLink = document.createElement('button');
    clearLink.className = 'btn-clear-tasks';
    clearLink.textContent = t('progress.clearButton');
    clearLink.addEventListener('click', async () => {
      const stored = await browser.storage.local.get([STORAGE_KEY, 'fitmycv_session_task_ids']);
      const storedTasks = stored[STORAGE_KEY] || [];
      const sessionIds = stored['fitmycv_session_task_ids'] || [];

      // Keep only in-progress task IDs in the session
      const remainingIds = sessionIds.filter(id => {
        const task = storedTasks.find(t => t.id === id);
        return task && !TERMINAL_STATUSES.includes(task.status);
      });

      if (remainingIds.length > 0) {
        await browser.storage.local.set({ 'fitmycv_session_task_ids': remainingIds });
      } else {
        await browser.storage.local.remove('fitmycv_session_task_ids');
      }
      await renderTasks(container);
    });
    container.appendChild(clearLink);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
