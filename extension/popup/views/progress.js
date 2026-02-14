/**
 * Progress View — Inline task generation tracking
 */

import browser from 'webextension-polyfill';
import { pollTaskSync, cancelTask } from '../../lib/api-client.js';

const STORAGE_KEY = 'fitmycv_active_tasks';
let pollInterval = null;
const MAX_POLL_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
let pollStartTime = null;

const STEP_LABELS = {
  classify: 'Classification\u2026',
  batch_experience: 'Adaptation des exp\u00e9riences\u2026',
  batch_project: 'Adaptation des projets\u2026',
  batch_extras: 'Adaptation des extras\u2026',
  batch_education: 'Adaptation des formations\u2026',
  batch_languages: 'Adaptation des langues\u2026',
  batch_skills: 'Adaptation des comp\u00e9tences\u2026',
  batch_summary: 'R\u00e9daction du r\u00e9sum\u00e9\u2026',
  recompose: 'Assemblage du CV\u2026',
};

function getStatusDisplay(task) {
  if (task.status === 'completed') return 'CV g\u00e9n\u00e9r\u00e9 \u2713';
  if (task.status === 'failed') return '\u00c9chou\u00e9';
  if (task.status === 'cancelled') return 'Annul\u00e9';
  if (task.status === 'analyzing') return 'Analyse de l\'offre\u2026';

  if (task.currentStep) {
    return STEP_LABELS[task.currentStep] || 'Traitement en cours\u2026';
  }

  if (task.currentPhase === 'extracting') return 'Extraction de l\'offre\u2026';

  if (task.status === 'queued') return 'En file d\'attente\u2026';
  if (task.status === 'running') return 'Traitement en cours\u2026';
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

async function renderTasks(container) {
  const data = await browser.storage.local.get([STORAGE_KEY, 'fitmycv_session_task_ids']);
  const allTasks = data[STORAGE_KEY] || [];
  const sessionTaskIds = data['fitmycv_session_task_ids'] || [];

  // Show only tasks from this extension session (not full history)
  const tasks = allTasks
    .filter(t => t.type === 'cv_generation' && sessionTaskIds.includes(t.id))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);

  // Hide container entirely when no tasks
  if (tasks.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  container.innerHTML = '';

  for (const task of tasks) {
    const el = document.createElement('div');
    el.className = 'progress-item';

    const statusLabel = getStatusDisplay(task);
    const dotClass = task.status;

    let sourceHtml = '';
    if (task.sourceUrl) {
      try {
        const hostname = new URL(task.sourceUrl).hostname.replace('www.', '');
        sourceHtml = `<div class="progress-source"><a href="${escapeHtml(task.sourceUrl)}" target="_blank">${escapeHtml(hostname)}</a></div>`;
      } catch { /* invalid URL — skip */ }
    }

    const isCancellable = ['queued', 'running', 'analyzing'].includes(task.status);
    let cancelHtml = '';
    if (isCancellable) {
      cancelHtml = `
        <button class="btn-cancel-task" data-action="cancel-task" data-task-id="${escapeHtml(task.id)}">Annuler</button>
      `;
    }

    let actionHtml = '';
    if (task.status === 'completed') {
      actionHtml = `
        <div class="progress-action">
          <a href="#" data-action="view-cv">Voir le CV sur FitMyCV &rarr;</a>
        </div>
      `;
    }

    let errorHtml = '';
    if (task.status === 'failed' && task.error) {
      errorHtml = `<div class="progress-error">${escapeHtml(task.error)}</div>`;
    }

    el.innerHTML = `
      <div class="progress-header">
        <div class="progress-title">${escapeHtml(task.title || 'Generation CV')}</div>
        ${cancelHtml}
      </div>
      ${sourceHtml}
      <div class="progress-status">
        <span class="dot ${dotClass}"></span>
        ${statusLabel}
      </div>
      ${errorHtml}
      ${actionHtml}
    `;

    // Handle "View CV" click
    const viewLink = el.querySelector('[data-action="view-cv"]');
    if (viewLink) {
      viewLink.addEventListener('click', (e) => {
        e.preventDefault();
        const apiBase = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
        browser.tabs.create({ url: apiBase });
      });
    }

    // Handle "Cancel" click
    const cancelBtn = el.querySelector('[data-action="cancel-task"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        const tid = cancelBtn.dataset.taskId;
        cancelBtn.textContent = 'Annulation\u2026';
        cancelBtn.disabled = true;

        // Timeout to prevent infinite "Annulation..." state
        const cancelTimeout = setTimeout(() => {
          cancelBtn.textContent = 'Erreur (timeout)';
          setTimeout(() => {
            cancelBtn.textContent = 'Annuler';
            cancelBtn.disabled = false;
          }, 2000);
        }, 10000);

        try {
          const response = await cancelTask(tid);
          clearTimeout(cancelTimeout);
          // Update local storage immediately
          const stored = await browser.storage.local.get(STORAGE_KEY);
          const tasks = stored[STORAGE_KEY] || [];
          const updated = tasks.map(t => t.id === tid ? { ...t, status: 'cancelled' } : t);
          await browser.storage.local.set({ [STORAGE_KEY]: updated });
          await renderTasks(container);
        } catch {
          clearTimeout(cancelTimeout);
          cancelBtn.textContent = 'Erreur';
          setTimeout(() => {
            cancelBtn.textContent = 'Annuler';
            cancelBtn.disabled = false;
          }, 2000);
        }
      });
    }

    container.appendChild(el);
  }

  // "Clear" link when all tasks are finished
  const allDone = tasks.every(t => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled');
  if (allDone) {
    const clearLink = document.createElement('button');
    clearLink.className = 'btn-clear-tasks';
    clearLink.textContent = 'Effacer';
    clearLink.addEventListener('click', async () => {
      await browser.storage.local.remove('fitmycv_session_task_ids');
      container.innerHTML = '';
      container.style.display = 'none';
    });
    container.appendChild(clearLink);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
