/**
 * Login View
 */

import browser from 'webextension-polyfill';
import { login } from '../../lib/api-client.js';

export function initLogin(onLoginSuccess) {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const btnLogin = document.getElementById('btn-login');
  const btnText = btnLogin.querySelector('.btn-text');
  const btnLoading = btnLogin.querySelector('.btn-loading');

  const API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : 'https://app.fitmycv.io';

  // Links — open SaaS in new tab
  document.getElementById('link-forgot').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: `${API_BASE}/auth?mode=forgot` });
  });

  document.getElementById('link-register').addEventListener('click', (e) => {
    e.preventDefault();
    browser.tabs.create({ url: `${API_BASE}/auth?mode=register` });
  });

  // OAuth buttons — open extension-auth page
  document.getElementById('btn-oauth-google').addEventListener('click', () => {
    browser.tabs.create({ url: `${API_BASE}/extension-auth` });
  });

  document.getElementById('btn-oauth-github').addEventListener('click', () => {
    browser.tabs.create({ url: `${API_BASE}/extension-auth` });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);

    try {
      const user = await login(email, password);
      onLoginSuccess(user);
    } catch (err) {
      const msg = err.message === 'Invalid credentials'
        ? 'Email ou mot de passe incorrect'
        : err.message === 'Service temporarily unavailable'
          ? 'Service temporairement indisponible (maintenance)'
          : 'Erreur de connexion. Verifiez votre connexion internet.';
      showError(msg);
    } finally {
      setLoading(false);
    }
  });

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  function setLoading(loading) {
    btnLogin.disabled = loading;
    btnText.style.display = loading ? 'none' : '';
    btnLoading.style.display = loading ? '' : 'none';
  }
}
