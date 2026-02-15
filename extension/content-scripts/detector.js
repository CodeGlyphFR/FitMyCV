/**
 * Job Offer Detector — Content Script
 *
 * Universal detection of job offers on ANY website using a 2-phase approach:
 * Phase 1: Quick structural signals (JSON-LD, H1 gender markers, URL patterns)
 * Phase 2: DOM scoring (Apply buttons, section headings, keywords)
 *
 * Injects a "FitMyCV +" button after the H1 when a job offer is detected.
 * Handles SPA navigation and DOM re-renders via MutationObserver.
 */

import browser from 'webextension-polyfill';
import {
  getTitleSelectorsForHostname,
  getDetailPanelForHostname,
  isSplitPanelSite,
  isKnownJobSite,
} from '../lib/site-selectors.js';

const PICKLIST_KEY = 'fitmycv_picklist';
const TOKEN_KEY = 'fitmycv_token';
const BTN_ID = 'fitmycv-add-btn';
const LANG_KEY = 'fitmycv_language';

let lastDetectedUrl = null;
let detectionTimeout = null;
let buttonRetryTimeout = null;
let buttonObserver = null;
let contentObserver = null;
let lastContentSnapshot = null;

// ─── Phase 1: Quick pre-detection (~1ms) ─────────────────────────────

/**
 * Gender/diversity markers regex — matches patterns like:
 * (F/H), (H/F), (M/F), (m/w/d), (H/M), (H/F/X), etc.
 * In parentheses, brackets, or at end of string.
 */
const GENDER_MARKER_RE = /[(\[]\s*[fhmw]\s*[/\\]\s*[fhmw](?:\s*[/\\]\s*[dxn])?\s*[)\]]|\b[fhmw]\s*\/\s*[fhmw](?:\s*\/\s*[dxn])?\s*$/im;

/**
 * URL path patterns indicating a job-related page (FR/EN/DE/ES)
 */
const JOB_URL_RE = /\/(jobs?|careers?|emplois?|offres?(?:-d-?emploi)?|vacanc(?:y|ies)|stellenangebote?|empleo|ofertas?|vacantes?|trabajo|oportunidad(?:es)?|recrutement|recruitment|hiring|postes?|bewerbung)\b/i;

function checkJsonLdJobPosting() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item['@type'] === 'JobPosting') return true;
        if (item['@graph']) {
          for (const node of item['@graph']) {
            if (node['@type'] === 'JobPosting') return true;
          }
        }
      }
    } catch { /* invalid JSON, skip */ }
  }
  return false;
}

function checkH1GenderMarker() {
  const h1s = document.querySelectorAll('h1');
  for (const h1 of h1s) {
    if (GENDER_MARKER_RE.test(h1.textContent)) return true;
  }
  return false;
}

function checkUrlPattern() {
  return JOB_URL_RE.test(location.pathname);
}

function detectPhase1() {
  return checkJsonLdJobPosting() || checkH1GenderMarker() || checkUrlPattern();
}

// ─── Phase 2: DOM scoring (~5-10ms) ──────────────────────────────────

const APPLY_BUTTON_TEXTS = [
  // FR
  'postuler', 'candidater', 'envoyer ma candidature', 'je postule',
  'déposer ma candidature',
  // EN
  'apply', 'apply now', 'apply for this job', 'submit application',
  'easy apply', 'quick apply',
  // DE
  'bewerben', 'jetzt bewerben', 'bewerbung senden', 'online bewerben',
  // ES
  'postularse', 'aplicar', 'enviar candidatura', 'inscribirse',
  'postular', 'aplicar ahora', 'enviar solicitud',
];

const SECTION_HEADING_PATTERNS = [
  // FR
  'missions', 'profil recherché', 'profil souhaité', 'compétences requises',
  'description du poste', 'responsabilités', 'votre profil', 'vos missions',
  'formation requise', 'ce que nous offrons', 'pourquoi nous rejoindre',
  // EN
  'requirements', 'responsibilities', 'qualifications', 'about the role',
  'what you\'ll do', 'what we\'re looking for', 'job description',
  'about the job', 'key responsibilities', 'desired skills',
  // DE
  'aufgaben', 'anforderungen', 'qualifikationen', 'stellenbeschreibung',
  'ihr profil', 'ihre aufgaben', 'was wir bieten', 'das erwartet sie',
  // ES
  'requisitos', 'responsabilidades', 'funciones', 'perfil buscado',
  'descripción del puesto', 'ofrecemos', 'lo que buscamos',
  'sobre el puesto', 'competencias', 'qué buscamos',
];

const CONTENT_KEYWORDS = [
  // FR
  'cdi', 'cdd', 'intérim', 'freelance', 'temps plein', 'temps partiel',
  'télétravail', 'salaire', 'rémunération', 'recrutement', 'embauche',
  // EN
  'full-time', 'part-time', 'remote', 'salary', 'benefits',
  'permanent', 'temporary', 'hybrid',
  // DE
  'vollzeit', 'teilzeit', 'homeoffice', 'gehalt', 'festanstellung',
  'befristet', 'unbefristet',
  // ES
  'contrato indefinido', 'jornada completa', 'media jornada', 'teletrabajo',
  'salario', 'incorporación', 'vacante', 'presencial',
];

function detectPhase2() {
  let score = 0;

  // 1. Apply/Postuler button (+30)
  const clickables = document.querySelectorAll(
    'button, a[role="button"], input[type="submit"], ' +
    'a[class*="apply"], a[class*="postul"], a[class*="candid"], a[class*="bewerb"], a[class*="inscri"]'
  );
  for (const el of clickables) {
    const text = el.textContent.toLowerCase().trim();
    if (text.length > 50) continue;
    if (APPLY_BUTTON_TEXTS.some(p => text.includes(p))) {
      score += 30;
      break;
    }
  }

  // 2. Section headings with job-related terms (+15 each, max 30)
  const headings = document.querySelectorAll('h1, h2, h3, h4, strong, b, dt');
  let headingMatches = 0;
  for (const heading of headings) {
    const text = heading.textContent.toLowerCase().trim();
    if (text.length > 100) continue;
    if (SECTION_HEADING_PATTERNS.some(p => text.includes(p))) {
      headingMatches++;
      if (headingMatches >= 2) break;
    }
  }
  score += headingMatches * 15;

  // 3. Keywords in body (+2 each, max 20)
  const mainEl = document.querySelector('main, article, [role="main"]');
  const searchRoot = mainEl || document.body;
  const bodyText = (searchRoot?.textContent || '').toLowerCase();
  let kwCount = 0;
  for (const kw of CONTENT_KEYWORDS) {
    if (bodyText.includes(kw)) kwCount++;
  }
  score += Math.min(kwCount * 2, 20);

  // 4. Structured content > 500 chars in main content area (+10)
  if (mainEl && mainEl.textContent.trim().length > 500) {
    score += 10;
  }

  return score >= 40;
}

// ─── Button anchor for placement ────────────────────────────────────

/**
 * Find the best anchor element for the FitMyCV button.
 * 1. Split-panel sites: search in detail panel only
 * 2. Known full-page sites: use site-specific selectors
 * 3. Unknown sites: return null (no button injected)
 */
function findButtonAnchor() {
  const hostname = location.hostname;

  if (!isKnownJobSite(hostname)) return null;

  const titleSelectors = getTitleSelectorsForHostname(hostname);
  const detailPanel = getDetailPanelForHostname(hostname);
  const searchRoot = detailPanel || document;

  for (const selector of titleSelectors) {
    try {
      const el = searchRoot.querySelector(selector);
      if (el && el.textContent.trim().length > 3) return el;
    } catch { /* invalid selector, skip */ }
  }

  if (detailPanel || isSplitPanelSite(hostname)) return null;

  const mainContent = document.querySelector('main, article, [role="main"]');
  if (mainContent) {
    const h1 = mainContent.querySelector('h1');
    if (h1 && h1.textContent.trim().length > 3) return h1;
  }
  const h1 = document.querySelector('h1');
  if (h1 && h1.textContent.trim().length > 3) return h1;

  return null;
}

// ─── Button: site-specific styles ───────────────────────────────────

const SITE_BUTTON_STYLES = {
  'linkedin.com': {
    fontSize: '14px', padding: '6px 14px', margin: '8px 0 0 0', display: 'block', width: 'fit-content',
  },
  'indeed.com': {
    fontSize: '12px', padding: '4px 10px', margin: '4px 0 0 0', display: 'inline-flex',
  },
  'indeed.fr': {
    fontSize: '12px', padding: '4px 10px', margin: '4px 0 0 0', display: 'inline-flex',
  },
  'glassdoor.com': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'block', width: 'fit-content',
  },
  'glassdoor.fr': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'block', width: 'fit-content',
  },
  'welcometothejungle.com': {
    fontSize: '13px', padding: '6px 14px', margin: '12px 0 0 0', display: 'block', width: 'fit-content',
  },
  'francetravail.fr': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'block', width: 'fit-content',
  },
  'apec.fr': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'inline-flex',
  },
  'hellowork.com': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'block', width: 'fit-content',
  },
  'meteojob.com': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'inline-flex',
  },
  'cadremploi.fr': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'inline-flex',
  },
  'monster.fr': {
    fontSize: '13px', padding: '5px 12px', margin: '8px 0 0 0', display: 'inline-flex',
  },
};

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

  // Site-specific style overrides
  const host = location.hostname.replace(/^www\./, '');
  for (const [domain, styles] of Object.entries(SITE_BUTTON_STYLES)) {
    if (host.includes(domain)) {
      Object.assign(btn.style, styles);
      break;
    }
  }

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

const BUTTON_TEXT = {
  fr: { success: '\u2713 Ajouté',       duplicate: 'Déjà ajouté',       error: '\u2715 Erreur' },
  en: { success: '\u2713 Added',        duplicate: 'Already added',     error: '\u2715 Error' },
  es: { success: '\u2713 Agregado',     duplicate: 'Ya agregado',       error: '\u2715 Error' },
  de: { success: '\u2713 Hinzugefügt',  duplicate: 'Bereits hinzugefügt', error: '\u2715 Fehler' },
};

function getButtonText(state) {
  const lang = _cachedLang || 'en';
  return BUTTON_TEXT[lang]?.[state] || BUTTON_TEXT.en[state] || state;
}

let _cachedLang = 'en';
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

    const data = await browser.storage.local.get(PICKLIST_KEY);
    const picklist = data[PICKLIST_KEY] || [];

    if (picklist.some(o => o.sourceUrl === result.sourceUrl)) {
      setButtonState(btn, 'duplicate');
      return;
    }

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
  if (buttonObserver) {
    buttonObserver.disconnect();
    buttonObserver = null;
  }

  const btn = document.getElementById(BTN_ID);
  if (!btn?.parentNode) return;

  buttonObserver = new MutationObserver(() => {
    if (!document.getElementById(BTN_ID)) {
      buttonObserver.disconnect();
      buttonObserver = null;
      // DOM re-rendered — re-inject after a short delay to let the SPA settle
      setTimeout(() => injectButton(5), 300);
    }
  });

  buttonObserver.observe(btn.parentNode, { childList: true, subtree: true });
}

async function injectButton(retries = 8) {
  const existing = document.getElementById(BTN_ID);
  if (existing) {
    const anchor = findButtonAnchor();
    if (anchor && anchor.nextElementSibling === existing) return;
    existing.remove();
  }

  if (buttonRetryTimeout) {
    clearTimeout(buttonRetryTimeout);
    buttonRetryTimeout = null;
  }

  // Only show button if user is authenticated
  const tokenData = await browser.storage.local.get(TOKEN_KEY);
  if (!tokenData[TOKEN_KEY]) return;

  const anchor = findButtonAnchor();
  if (!anchor) {
    if (retries > 0) {
      const delay = Math.min(500 * Math.pow(1.3, 8 - retries), 3000);
      buttonRetryTimeout = setTimeout(() => injectButton(retries - 1), delay);
    }
    return;
  }

  // Final guard after async operations
  if (document.getElementById(BTN_ID)) return;

  const btn = createButton();
  anchor.insertAdjacentElement('afterend', btn);

  watchButtonPresence();
}

// ─── Detection ───────────────────────────────────────────────────────

function detectJobOffer(force = false) {
  const url = location.href;

  if (!force && url === lastDetectedUrl) return;

  const found = detectPhase1() || detectPhase2();

  lastDetectedUrl = url;

  browser.runtime.sendMessage({
    type: found ? 'JOB_OFFER_DETECTED' : 'JOB_OFFER_NOT_DETECTED',
    url,
    hostname: location.hostname,
  }).catch(() => {
    // Extension context invalidated (e.g. during update)
  });

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

// ─── Content observer (side panels, SPAs) ────────────────────────────

/**
 * Generic content observer: watches the main content area for significant
 * changes, which indicates a new job was loaded without URL change
 * (e.g. Indeed side panel, LinkedIn job list, Glassdoor, etc.)
 */
let contentObserverRetries = 0;
const MAX_CONTENT_RETRIES = 15;

function setupContentObserver() {
  const detailPanel = getDetailPanelForHostname(location.hostname);
  const container = detailPanel || document.querySelector(
    'main, article, [role="main"], #root, #app, #__next'
  );

  if (!container) {
    if (contentObserverRetries < MAX_CONTENT_RETRIES) {
      contentObserverRetries++;
      setTimeout(setupContentObserver, 1000);
    }
    return;
  }

  if (contentObserver) contentObserver.disconnect();

  lastContentSnapshot = container.textContent.trim().slice(0, 300);

  contentObserver = new MutationObserver(() => {
    const current = container.textContent.trim().slice(0, 300);
    if (current !== lastContentSnapshot && current.length > 50) {
      lastContentSnapshot = current;
      lastDetectedUrl = null;
      removeButton();
      debouncedDetect();
    }
  });

  contentObserver.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

// ─── Initial detection ───────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectJobOffer);
} else {
  detectJobOffer();
}

// --- SPA navigation detection ---
let currentUrl = location.href;

const urlObserver = new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    lastDetectedUrl = null;
    contentObserverRetries = 0;
    setupContentObserver();
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

// --- Content observer for side-panel layouts ---
setupContentObserver();

// ─── Listen for extraction requests from the popup/service worker ────
browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'EXTRACT_OFFER') {
    return handleExtraction();
  }
});

async function handleExtraction() {
  const { extractJobOffer } = await import('./extractor.js');
  return extractJobOffer();
}
