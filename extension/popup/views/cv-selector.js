/**
 * CV Selector View
 *
 * Dropdown matching the SaaS CvGeneratorModal behavior.
 */

import browser from 'webextension-polyfill';
import { fetchCvList } from '../../lib/api-client.js';

const LANGUAGE_FLAGS = {
  fr: '\uD83C\uDDEB\uD83C\uDDF7',
  en: '\uD83C\uDDEC\uD83C\uDDE7',
  es: '\uD83C\uDDEA\uD83C\uDDF8',
  de: '\uD83C\uDDE9\uD83C\uDDEA',
  it: '\uD83C\uDDEE\uD83C\uDDF9',
  pt: '\uD83C\uDDF5\uD83C\uDDF9',
  nl: '\uD83C\uDDF3\uD83C\uDDF1',
};

function getCvIcon(item) {
  if (item.isTranslated) return '\uD83C\uDF10'; // globe
  if (item.isGenerated) return '\u2728';         // sparkles
  if (item.isImported) return '\uD83D\uDCE5';    // inbox
  return '\uD83D\uDCC4';                          // page
}

const SELECTED_CV_KEY = 'fitmycv_selected_cv';
let selectedCv = null;
let onChangeCallback = null;

export function getSelectedCv() {
  return selectedCv;
}

export async function initCvSelector(container, onChange) {
  onChangeCallback = onChange;
  container.innerHTML = '<div class="loading-shimmer"></div>';

  try {
    const { items: allItems, current } = await fetchCvList();

    // Only show base CVs (imported, manual, translated) — not generated from job offers
    const items = (allItems || []).filter(i => i.isImported || i.isManual || i.isTranslated);

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          Aucun CV trouve. <a href="#" id="link-create-cv">Creez-en un sur FitMyCV</a>
        </div>
      `;
      container.querySelector('#link-create-cv')?.addEventListener('click', (e) => {
        e.preventDefault();
        const apiBase = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
        browser.tabs.create({ url: apiBase });
      });
      return;
    }

    // Build dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'cv-dropdown';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cv-dropdown-trigger';

    const list = document.createElement('div');
    list.className = 'cv-dropdown-list';

    // CV items
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'cv-item';
      el.dataset.file = item.file;

      const flag = item.language ? (LANGUAGE_FLAGS[item.language] || '') : '';

      el.innerHTML = `
        <span class="cv-item-icon">${getCvIcon(item)}</span>
        <span class="cv-item-label">${escapeHtml(item.label)}</span>
        ${flag ? `<span class="cv-item-flag">${flag}</span>` : ''}
      `;

      el.addEventListener('click', () => {
        selectCv(item, trigger, list);
      });

      list.appendChild(el);
    });

    dropdown.appendChild(trigger);
    dropdown.appendChild(list);
    container.innerHTML = '';
    container.appendChild(dropdown);

    // Pre-select: stored > current API > first
    const storedData = await browser.storage.local.get(SELECTED_CV_KEY);
    const storedCv = storedData[SELECTED_CV_KEY] || null;
    const defaultItem = items.find(i => i.file === storedCv) || items.find(i => i.file === current) || items[0];
    selectCv(defaultItem, trigger, list);

    // Toggle dropdown
    trigger.addEventListener('click', () => {
      list.classList.toggle('open');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        list.classList.remove('open');
      }
    });

  } catch (err) {
    container.innerHTML = `<div class="error-msg">Erreur chargement des CVs: ${escapeHtml(err.message)}</div>`;
  }
}

function selectCv(item, trigger, list) {
  selectedCv = item.file;
  browser.storage.local.set({ [SELECTED_CV_KEY]: item.file });
  trigger.textContent = item.label;

  // Update selected state
  list.querySelectorAll('.cv-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.file === item.file);
  });

  list.classList.remove('open');

  if (onChangeCallback) onChangeCallback(item.file);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
