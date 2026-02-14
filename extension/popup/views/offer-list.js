/**
 * Offer List View — Picklist + Credits + Generate button
 */

import browser from 'webextension-polyfill';
import { fetchCreditBalance, fetchCreditCosts, submitOffers } from '../../lib/api-client.js';
import { getSelectedCv } from './cv-selector.js';
import { t, getLang } from '../../lib/i18n.js';

const STORAGE_KEY = 'fitmycv_picklist';
let offers = [];
let creditBalance = null;
let costPerOffer = 2;
let isSubmitting = false;

let generateContainer = null;

export async function initOfferList(container, creditsContainer, genContainer) {
  generateContainer = genContainer;

  // Load persisted picklist
  const data = await browser.storage.local.get(STORAGE_KEY);
  offers = data[STORAGE_KEY] || [];

  // Load credits in parallel
  try {
    const [balance, costs] = await Promise.all([
      fetchCreditBalance(),
      fetchCreditCosts(),
    ]);
    creditBalance = balance;
    if (costs.showCosts && costs.costs?.gpt_cv_generation) {
      costPerOffer = costs.costs.gpt_cv_generation;
    }
  } catch {
    // Credits will show as unknown
  }

  render(container, creditsContainer);
}

async function persistOffers() {
  await browser.storage.local.set({ [STORAGE_KEY]: offers });
}

export async function addOffer(offerData) {
  // Check for duplicate by sourceUrl
  if (offers.some(o => o.sourceUrl === offerData.sourceUrl)) {
    return { duplicate: true };
  }

  offers.push({
    title: offerData.title,
    content: offerData.content,
    sourceUrl: offerData.sourceUrl,
    score: offerData.score,
    isValid: offerData.isValid,
    hostname: new URL(offerData.sourceUrl).hostname.replace('www.', ''),
    addedAt: Date.now(),
  });

  await persistOffers();
  return { duplicate: false };
}

function removeOffer(index) {
  offers.splice(index, 1);
  persistOffers();
}

function reRender() {
  render(
    document.getElementById('offer-list-container'),
    document.getElementById('credits-container'),
  );
}

function getScoreClass(score) {
  if (score >= 50) return 'good';
  if (score >= 25) return 'medium';
  return 'low';
}

function render(container, creditsContainer) {
  // Offer list
  container.innerHTML = '';

  // Add button
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-offer';
  addBtn.textContent = t('offers.addButton');
  addBtn.id = 'btn-add-offer';
  addBtn.addEventListener('click', handleAddOffer);
  container.appendChild(addBtn);

  if (offers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = t('offers.emptyState');
    container.appendChild(empty);
  } else {
    const scrollWrapper = document.createElement('div');
    scrollWrapper.className = 'offer-items-scroll';

    offers.forEach((offer, index) => {
      const el = document.createElement('div');
      el.className = 'offer-item';
      el.innerHTML = `
        <div style="flex:1; min-width:0">
          <div class="offer-title">${escapeHtml(offer.title || t('offers.noTitle'))}</div>
          <div class="offer-host">${escapeHtml(offer.hostname)}</div>
        </div>
        <span class="offer-score ${getScoreClass(offer.score)}">${offer.score}</span>
        <button class="offer-remove" data-index="${index}" title="${escapeHtml(t('offers.removeTitle'))}">&times;</button>
      `;
      el.querySelector('.offer-remove').addEventListener('click', () => {
        removeOffer(index);
        render(container, creditsContainer);
      });
      scrollWrapper.appendChild(el);
    });

    container.appendChild(scrollWrapper);
  }

  // Credits bar
  renderCredits(creditsContainer);
}

function renderCredits(creditsContainer) {
  const totalCost = offers.length * costPerOffer;
  const availableCredits = creditBalance?.credits ?? creditBalance?.balance ?? null;
  const hasEnough = availableCredits === null || availableCredits >= totalCost;
  const selectedCv = getSelectedCv();
  const canGenerate = offers.length > 0 && selectedCv && hasEnough && !isSubmitting;

  creditsContainer.innerHTML = '';

  if (offers.length > 0) {
    const bar = document.createElement('div');
    bar.className = 'credits-bar';

    const balanceText = availableCredits !== null
      ? `${availableCredits} credits`
      : 'Credits: --';

    const costClass = hasEnough ? 'credits-cost' : 'credits-insufficient';

    bar.innerHTML = `
      <span class="credits-balance">${escapeHtml(t('offers.creditsBalance', { balance: balanceText }))}</span>
      <span class="${costClass}">${escapeHtml(t('offers.creditsCost', { total: totalCost, count: offers.length, cost: costPerOffer }))}</span>
    `;
    creditsContainer.appendChild(bar);

    if (!hasEnough) {
      const warning = document.createElement('div');
      warning.className = 'warning-msg';
      warning.textContent = t('offers.creditsInsufficient', { missing: totalCost - availableCredits });
      creditsContainer.appendChild(warning);
    }
  }

  // Generate button — pinned at bottom
  if (generateContainer) {
    generateContainer.innerHTML = '';
    const genBtn = document.createElement('button');
    genBtn.className = 'btn btn-primary';
    genBtn.disabled = !canGenerate;
    genBtn.textContent = offers.length > 0
      ? t('offers.generateButton', { count: offers.length })
      : t('offers.generateButtonDefault');
    genBtn.addEventListener('click', handleGenerate);
    generateContainer.appendChild(genBtn);
    generateContainer.style.display = '';
  }
}

async function handleAddOffer() {
  const addBtn = document.getElementById('btn-add-offer');
  if (!addBtn) return;

  addBtn.disabled = true;
  addBtn.textContent = t('offers.extracting');

  try {
    const result = await browser.runtime.sendMessage({ type: 'EXTRACT_OFFER' });

    if (result?.error) {
      addBtn.textContent = result.error;
      setTimeout(() => {
        addBtn.textContent = t('offers.addButton');
        addBtn.disabled = false;
      }, 2000);
      return;
    }

    if (!result?.content) {
      addBtn.textContent = t('offers.noContent');
      setTimeout(() => {
        addBtn.textContent = t('offers.addButton');
        addBtn.disabled = false;
      }, 2000);
      return;
    }

    const { duplicate } = await addOffer(result);

    if (duplicate) {
      addBtn.textContent = t('offers.alreadyAdded');
      setTimeout(() => {
        addBtn.textContent = t('offers.addButton');
        addBtn.disabled = false;
      }, 1500);
      return;
    }

    // Re-render
    reRender();

  } catch (err) {
    addBtn.textContent = t('offers.extractError');
    setTimeout(() => {
      addBtn.textContent = t('offers.addButton');
      addBtn.disabled = false;
    }, 2000);
  }
}

async function handleGenerate() {
  const selectedCv = getSelectedCv();
  if (!selectedCv || offers.length === 0 || isSubmitting) return;

  isSubmitting = true;

  // Snapshot the offers being submitted
  const submittedOffers = [...offers];
  const offersPayload = submittedOffers.map(o => ({
    title: o.title,
    content: o.content,
    sourceUrl: o.sourceUrl,
  }));

  // Create placeholder tasks immediately (before API call) so progress view shows them
  const now = Date.now();
  const tempTasks = submittedOffers.map((o, i) => ({
    id: `temp-${now}-${i}`,
    type: 'cv_generation',
    title: o.title || t('progress.defaultTitle'),
    status: 'analyzing',
    createdAt: now + i,
    sourceUrl: o.sourceUrl,
  }));
  const tempIds = tempTasks.map(t => t.id);

  const existing = await browser.storage.local.get(['fitmycv_active_tasks', 'fitmycv_session_task_ids']);
  // Remove submitted offers from picklist immediately and re-render
  const submittedUrls = new Set(submittedOffers.map(o => o.sourceUrl));
  offers = offers.filter(o => !submittedUrls.has(o.sourceUrl));

  await Promise.all([
    persistOffers(),
    browser.storage.local.set({
      'fitmycv_active_tasks': [...(existing['fitmycv_active_tasks'] || []), ...tempTasks],
      'fitmycv_session_task_ids': [...(existing['fitmycv_session_task_ids'] || []), ...tempIds],
    }),
  ]);

  // Re-render list without the submitted offers
  reRender();

  try {
    const result = await submitOffers(selectedCv, offersPayload, getLang());

    // Replace temp tasks with real task IDs from server response
    const storageData = await browser.storage.local.get(['fitmycv_active_tasks', 'fitmycv_session_task_ids']);
    let allTasks = storageData['fitmycv_active_tasks'] || [];
    let sessionIds = storageData['fitmycv_session_task_ids'] || [];
    const tempIdSet = new Set(tempIds);

    if (result?.tasks?.length) {
      // Build sourceUrl → real task mapping
      const realTaskByUrl = new Map(result.tasks.map(t => [t.sourceUrl, t]));

      // Replace each temp task with the real one (matched by sourceUrl)
      const replacedIds = [];
      allTasks = allTasks.map(task => {
        if (tempIdSet.has(task.id)) {
          const real = realTaskByUrl.get(task.sourceUrl);
          if (real) {
            replacedIds.push({ tempId: task.id, realId: real.taskId });
            return { ...task, id: real.taskId, title: real.title || task.title, status: 'queued' };
          }
        }
        return task;
      });

      // Update session IDs: swap temp → real
      for (const { tempId, realId } of replacedIds) {
        const idx = sessionIds.indexOf(tempId);
        if (idx !== -1) sessionIds[idx] = realId;
      }
    }

    // Mark failed offers so they don't stay stuck as "analyzing"
    if (result?.failedOffers?.length) {
      const failedUrls = new Set(result.failedOffers.map(f => f.sourceUrl));
      allTasks = allTasks.map(task => {
        if (tempIdSet.has(task.id) && failedUrls.has(task.sourceUrl)) {
          return { ...task, status: 'failed', error: 'Extraction failed' };
        }
        return task;
      });
    }

    await browser.storage.local.set({
      'fitmycv_active_tasks': allTasks,
      'fitmycv_session_task_ids': sessionIds,
    });

    // Start polling (will update task statuses from the API)
    browser.runtime.sendMessage({ type: 'START_POLLING' });

  } catch (err) {
    // Remove temp tasks on error
    const storageData = await browser.storage.local.get(['fitmycv_active_tasks', 'fitmycv_session_task_ids']);
    const tempIdSet = new Set(tempIds);
    await browser.storage.local.set({
      'fitmycv_active_tasks': (storageData['fitmycv_active_tasks'] || []).filter(t => !tempIdSet.has(t.id)),
      'fitmycv_session_task_ids': (storageData['fitmycv_session_task_ids'] || []).filter(id => !tempIdSet.has(id)),
    });

    // Restore offers back to picklist on error
    offers.push(...submittedOffers);
    await persistOffers();

    const errEl = document.createElement('div');
    errEl.className = 'error-msg';
    errEl.textContent = err.message || t('offers.submitError');
    document.getElementById('credits-container').prepend(errEl);
    setTimeout(() => errEl.remove(), 3000);

    // Re-render to restore offers + button state
    reRender();
  } finally {
    isSubmitting = false;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
