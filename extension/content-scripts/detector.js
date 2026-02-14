/**
 * Job Offer Detector — Content Script
 *
 * Injected on known job sites. Detects the presence of a job offer
 * on the current page and notifies the service worker to update the badge.
 * Does NOT extract content — that happens on demand via extractor.js.
 *
 * Also injects a "FitMyCV +" button next to the job title for quick add.
 */

import browser from 'webextension-polyfill';
import { isKnownJobSite, getSelectorsForHostname, getTitleSelectorsForHostname } from '../lib/site-selectors.js';

const PICKLIST_KEY = 'fitmycv_picklist';
const TOKEN_KEY = 'fitmycv_token';
const BTN_ID = 'fitmycv-add-btn';

let lastDetectedUrl = null;
let detectionTimeout = null;
let buttonRetryTimeout = null;
let buttonObserver = null;

// ─── Button: find anchor element ─────────────────────────────────────

// Site-specific selectors for the button anchor point (inserted afterend)
const BUTTON_ANCHOR_SELECTORS = {
  'linkedin.com': [
    'button.jobs-save-button',                    // Save button (next to Easy Apply)
    '.jobs-s-apply button[id*="apply"]',          // Easy Apply button fallback
  ],
  'welcometothejungle.com': [
    '[data-testid="job-header-title"]',           // Job title header
  ],
  'indeed.com': [
    '.jobsearch-JobInfoHeader-title-container',   // Title container
  ],
  'indeed.fr': [
    '.jobsearch-JobInfoHeader-title-container',   // Title container
  ],
};

function findAnchorElement() {
  const host = location.hostname.replace(/^www\./, '');

  // Try site-specific anchors first
  for (const [domain, selectors] of Object.entries(BUTTON_ANCHOR_SELECTORS)) {
    if (host.includes(domain)) {
      for (const selector of selectors) {
        try {
          const el = document.querySelector(selector);
          if (el) return el;
        } catch { /* skip */ }
      }
    }
  }

  // Fallback: insert after the title element
  const titleSelectors = getTitleSelectorsForHostname(location.hostname);
  for (const selector of titleSelectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 3) return el;
    } catch { /* skip */ }
  }

  return null;
}

// ─── Button: create DOM element ──────────────────────────────────────

function createButton() {
  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = 'FitMyCV +';
  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    margin: '0 0 0 8px',
    padding: '4px 10px',
    border: 'none',
    borderRadius: '9999px',
    background: '#10b981',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    cursor: 'pointer',
    lineHeight: '1.4',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    position: 'relative',
    zIndex: '1000',
  });

  btn.addEventListener('mouseenter', () => {
    if (!btn.disabled) btn.style.background = '#34d399';
  });
  btn.addEventListener('mouseleave', () => {
    if (!btn.disabled) btn.style.background = '#10b981';
  });
  btn.addEventListener('click', handleButtonClick);
  return btn;
}

// ─── Button: state management ────────────────────────────────────────

const LANG_KEY = 'fitmycv_language';

const BUTTON_TEXT = {
  fr: { success: '\u2713 Ajoute',       duplicate: 'Deja ajoute',       error: '\u2715 Erreur' },
  en: { success: '\u2713 Added',        duplicate: 'Already added',     error: '\u2715 Error' },
  es: { success: '\u2713 Agregado',     duplicate: 'Ya agregado',       error: '\u2715 Error' },
  de: { success: '\u2713 Hinzugefugt',  duplicate: 'Bereits hinzugefugt', error: '\u2715 Fehler' },
};

function getButtonText(state) {
  // Read synchronously from the last cached language; async lookup happens on click
  const lang = _cachedLang || 'en';
  return BUTTON_TEXT[lang]?.[state] || BUTTON_TEXT.en[state] || state;
}

let _cachedLang = 'en';
// Pre-load cached language
browser.storage.local.get(LANG_KEY).then(d => {
  _cachedLang = d[LANG_KEY] || 'en';
}).catch(() => {});

const BUTTON_STATES = {
  default:   { text: 'FitMyCV +',                    bg: '#10b981', disabled: false },
  loading:   { text: '\u23F3',                        bg: '#9ca3af', disabled: true  },
  success:   { text: () => getButtonText('success'),  bg: '#059669', disabled: true  },
  duplicate: { text: () => getButtonText('duplicate'), bg: '#f59e0b', disabled: true  },
  error:     { text: () => getButtonText('error'),    bg: '#ef4444', disabled: true  },
};

function setButtonState(btn, state) {
  const s = BUTTON_STATES[state] || BUTTON_STATES.default;
  btn.textContent = typeof s.text === 'function' ? s.text() : s.text;
  btn.style.background = s.bg;
  btn.style.color = '#fff';
  btn.disabled = s.disabled;
  btn.style.cursor = s.disabled ? 'not-allowed' : 'pointer';

  // Auto-reset transient states after 2s
  if (['success', 'duplicate', 'error'].includes(state)) {
    setTimeout(() => setButtonState(btn, 'default'), 2000);
  }
}

// ─── Button: click handler ───────────────────────────────────────────

async function handleButtonClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = document.getElementById(BTN_ID);
  if (!btn || btn.disabled) return;

  // Refresh cached language before showing localized states
  try {
    const d = await browser.storage.local.get(LANG_KEY);
    _cachedLang = d[LANG_KEY] || 'en';
  } catch { /* use cached */ }

  setButtonState(btn, 'loading');

  try {
    const { extractJobOffer } = await import('./extractor.js');
    const result = extractJobOffer();

    if (!result?.content) {
      setButtonState(btn, 'error');
      return;
    }

    // Read current picklist
    const data = await browser.storage.local.get(PICKLIST_KEY);
    const picklist = data[PICKLIST_KEY] || [];

    // Duplicate check by sourceUrl
    if (picklist.some(o => o.sourceUrl === result.sourceUrl)) {
      setButtonState(btn, 'duplicate');
      return;
    }

    // Add to picklist (same shape as offer-list.js addOffer)
    picklist.push({
      title: result.title,
      content: result.content,
      sourceUrl: result.sourceUrl,
      score: result.score,
      isValid: result.isValid,
      hostname: new URL(result.sourceUrl).hostname.replace('www.', ''),
      addedAt: Date.now(),
    });

    await browser.storage.local.set({ [PICKLIST_KEY]: picklist });
    setButtonState(btn, 'success');

  } catch (err) {
    console.error('[FitMyCV] Button extraction error:', err);
    setButtonState(btn, 'error');
  }
}

// ─── Button: inject / remove ─────────────────────────────────────────

function removeButton() {
  if (buttonRetryTimeout) {
    clearTimeout(buttonRetryTimeout);
    buttonRetryTimeout = null;
  }
  if (buttonObserver) {
    buttonObserver.disconnect();
    buttonObserver = null;
  }
  const existing = document.getElementById(BTN_ID);
  if (existing) existing.remove();
}

function watchButtonPresence() {
  // Watch for SPA frameworks (React, etc.) removing our injected button
  // If the button disappears from the DOM, re-inject it
  if (buttonObserver) {
    buttonObserver.disconnect();
    buttonObserver = null;
  }

  const btn = document.getElementById(BTN_ID);
  if (!btn?.parentNode) return;

  buttonObserver = new MutationObserver(() => {
    // If our button was removed from the DOM, re-inject
    if (!document.getElementById(BTN_ID)) {
      buttonObserver.disconnect();
      buttonObserver = null;
      injectButton(3);
    }
  });

  buttonObserver.observe(btn.parentNode, { childList: true });
}

async function injectButton(retries = 8) {
  // Don't remove + re-observe if button already exists in DOM
  if (document.getElementById(BTN_ID)) return;

  if (buttonRetryTimeout) {
    clearTimeout(buttonRetryTimeout);
    buttonRetryTimeout = null;
  }

  // Only show button if user is authenticated
  const tokenData = await browser.storage.local.get(TOKEN_KEY);
  if (!tokenData[TOKEN_KEY]) return;

  const anchor = findAnchorElement();
  if (!anchor) {
    // Anchor might not be in DOM yet (SPA loading) — retry with progressive backoff
    if (retries > 0) {
      const delay = Math.min(500 * Math.pow(1.3, 8 - retries), 3000);
      buttonRetryTimeout = setTimeout(() => injectButton(retries - 1), delay);
    }
    return;
  }

  const btn = createButton();
  anchor.insertAdjacentElement('afterend', btn);

  // Watch for the SPA removing our button
  watchButtonPresence();
}

// ─── Detection ───────────────────────────────────────────────────────

let lastDetectedContent = null;

function detectJobOffer(force = false) {
  const hostname = location.hostname;
  const url = location.href;

  // Skip if we already detected on this exact URL (unless forced)
  if (!force && url === lastDetectedUrl) return;

  const selectors = getSelectorsForHostname(hostname);
  let found = false;

  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 200) {
        found = true;
        break;
      }
    } catch {
      // Invalid selector, skip
    }
  }

  lastDetectedUrl = url;

  browser.runtime.sendMessage({
    type: found ? 'JOB_OFFER_DETECTED' : 'JOB_OFFER_NOT_DETECTED',
    url,
    hostname,
  }).catch(() => {
    // Extension context invalidated (e.g. during update)
  });

  // Inject or remove the quick-add button
  if (found) {
    injectButton();
  } else {
    removeButton();
  }
}

function debouncedDetect() {
  if (detectionTimeout) clearTimeout(detectionTimeout);
  detectionTimeout = setTimeout(detectJobOffer, 500);
}

// Selectors for containers that change content when a new job is selected
// in a side-panel layout (URL stays the same).
const SIDE_PANEL_SELECTORS = [
  '#jobDescriptionText',                     // Indeed
  '.jobsearch-JobComponent-description',     // Indeed alt
  '.jobsearch-RightPane',                    // Indeed right pane
];

let sidePanelObserver = null;
let sidePanelRetries = 0;
const MAX_SIDE_PANEL_RETRIES = 20; // 20 × 1s = 20s max

function setupSidePanelObserver() {
  const host = location.hostname.replace(/^www\./, '');
  if (!host.includes('indeed.')) return;

  // Try to find the side-panel container
  let container = null;
  for (const sel of SIDE_PANEL_SELECTORS) {
    container = document.querySelector(sel);
    if (container) break;
  }

  if (!container) {
    // Container might not be in the DOM yet — retry
    if (sidePanelRetries < MAX_SIDE_PANEL_RETRIES) {
      sidePanelRetries++;
      setTimeout(setupSidePanelObserver, 1000);
    }
    return;
  }

  if (sidePanelObserver) sidePanelObserver.disconnect();

  // Snapshot the current content to detect real changes
  lastDetectedContent = container.textContent.trim().slice(0, 200);

  sidePanelObserver = new MutationObserver(() => {
    const current = container.textContent.trim().slice(0, 200);
    if (current !== lastDetectedContent && current.length > 50) {
      lastDetectedContent = current;
      // Content changed → new job selected, force re-detection
      lastDetectedUrl = null;
      debouncedDetect();
    }
  });

  sidePanelObserver.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

// ─── Initial detection ───────────────────────────────────────────────
if (isKnownJobSite(location.hostname)) {
  // Wait for DOM to be ready, then detect
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectJobOffer);
  } else {
    detectJobOffer();
  }

  // --- SPA navigation detection ---
  // Listen for URL changes (pushState/replaceState/popstate)
  let currentUrl = location.href;

  const urlObserver = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      lastDetectedUrl = null; // Reset so we re-detect
      debouncedDetect();
    }
  });

  urlObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('popstate', () => {
    lastDetectedUrl = null;
    debouncedDetect();
  });

  // --- Side-panel detection (Indeed, etc.) ---
  // On sites like Indeed, clicking a different job changes the content
  // in a side panel WITHOUT changing the URL. We observe the job
  // description container for content swaps.
  setupSidePanelObserver();
}

// ─── Listen for extraction requests from the popup/service worker ────
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'EXTRACT_OFFER') {
    return handleExtraction();
  }
});

async function handleExtraction() {
  // Dynamically import the extractor to keep detector lightweight
  const { extractJobOffer } = await import('./extractor.js');
  return extractJobOffer();
}
