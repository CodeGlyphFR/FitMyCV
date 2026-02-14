/**
 * Popup Main Controller
 *
 * Manages view switching and initialization.
 */

import browser from 'webextension-polyfill';
import { isAuthenticated, getUser, logout, fetchCreditBalance } from '../lib/api-client.js';
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

  // Stop progress refresh when leaving main view
  if (name !== 'main') {
    stopProgressRefresh();
  }
}

// --- Initialization ---

async function init() {
  // Check auth state
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    showView('login');
    initLogin(onLoginSuccess);
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
      el.textContent = `${credits} crédits`;
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

  await initCvSelector(cvContainer, () => {
    // CV changed — re-render credits
  });

  // Inline progress (auto-hides when no session tasks)
  initProgress(progressContainer);

  await initOfferList(offerContainer, creditsContainer);
}

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
    initLogin(onLoginSuccess);
  }
});

// --- Start ---

init();
