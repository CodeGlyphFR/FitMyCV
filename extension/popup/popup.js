/**
 * Popup Main Controller
 *
 * Manages view switching and initialization.
 */

import browser from 'webextension-polyfill';
import { isAuthenticated, getUser, logout, fetchCreditBalance } from '../lib/api-client.js';
import { initI18n, t, getLang, setLang, onLangChange } from '../lib/i18n.js';
import { initLogin } from './views/login.js';
import { initCvSelector } from './views/cv-selector.js';
import { initOfferList } from './views/offer-list.js';
import { initProgress, stopProgressRefresh } from './views/progress.js';

// --- View management ---

const views = {
  login: document.getElementById('view-login'),
  main: document.getElementById('view-main'),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.style.display = key === name ? '' : 'none';
  });

  // Hide generate button when not on main view
  const genContainer = document.getElementById('generate-container');
  if (genContainer) genContainer.style.display = name === 'main' ? '' : 'none';

  // Stop progress refresh when leaving main view
  if (name !== 'main') {
    stopProgressRefresh();
  }
}

// --- i18n helpers ---

function translateStaticElements() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (translated !== key) el.textContent = translated;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = t(key);
    if (translated !== key) el.placeholder = translated;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const translated = t(key);
    if (translated !== key) el.title = translated;
  });
}

function initLangSelector() {
  const flags = document.querySelectorAll('.lang-flag');
  const currentLang = getLang();

  flags.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
    });
  });
}

function updateLangSelectorActive() {
  const currentLang = getLang();
  document.querySelectorAll('.lang-flag').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

// --- Initialization ---

async function init() {
  // Initialize i18n first
  await initI18n();
  translateStaticElements();
  initLangSelector();

  // Update <html lang>
  document.documentElement.lang = getLang();

  // React to language changes
  onLangChange(async (lang) => {
    document.documentElement.lang = lang;
    translateStaticElements();
    updateLangSelectorActive();

    // Re-render dynamic views
    const authenticated = await isAuthenticated();
    if (authenticated) {
      loadHeaderCredits();
      showMainView();
    }
  });

  // Always initialize login form listeners (idempotent, safe to call once)
  initLogin(onLoginSuccess);

  // Check auth state
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    showView('login');
    return;
  }

  // Show user info in header
  const user = await getUser();
  showUserHeader(user);
  showMainView();
}

function showUserHeader(user) {
  const headerUser = document.getElementById('header-user');
  const userName = document.getElementById('user-name');
  headerUser.style.display = 'flex';
  userName.textContent = user?.name || user?.email || '';

  // Load credit balance in header
  loadHeaderCredits();
}

async function loadHeaderCredits() {
  try {
    const balance = await fetchCreditBalance();
    const credits = balance?.credits ?? balance?.balance ?? null;
    if (credits !== null) {
      const el = document.getElementById('credits-display');
      const container = document.getElementById('header-credits');
      el.textContent = t('header.credits', { credits });
      container.style.display = '';
    }
  } catch { /* silent */ }
}

async function onLoginSuccess(user) {
  showUserHeader(user);
  showMainView();
}

async function showMainView() {
  showView('main');

  const cvContainer = document.getElementById('cv-selector-container');
  const progressContainer = document.getElementById('progress-inline-container');
  const offerContainer = document.getElementById('offer-list-container');
  const creditsContainer = document.getElementById('credits-container');
  const generateContainer = document.getElementById('generate-container');

  await initCvSelector(cvContainer, () => {
    // CV changed — re-render credits
  });

  // Inline progress (auto-hides when no session tasks)
  initProgress(progressContainer);

  await initOfferList(offerContainer, creditsContainer, generateContainer);
}

// --- Logo link ---

const API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';
document.getElementById('logo-link').addEventListener('click', (e) => {
  e.preventDefault();
  browser.tabs.create({ url: API_BASE });
});

// --- Logout ---

document.getElementById('btn-logout').addEventListener('click', async () => {
  await logout();
  stopProgressRefresh();
  document.getElementById('header-user').style.display = 'none';
  showView('login');
});

// --- Listen for auth expiration from service worker ---

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'AUTH_EXPIRED') {
    stopProgressRefresh();
    document.getElementById('header-user').style.display = 'none';
    showView('login');
  }
});

// --- Start ---

init();
