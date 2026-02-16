/**
 * i18n Module — Lightweight internationalization for the extension popup
 */

import browser from 'webextension-polyfill';

const STORAGE_KEY = 'fitmycv_language';
const SUPPORTED_LANGS = ['fr', 'en', 'es', 'de'];
const DEFAULT_LANG = 'en';

let currentLang = DEFAULT_LANG;
let translations = {};
let listeners = [];

/**
 * Initialize i18n: load saved language or detect from browser, then load translations.
 */
export async function initI18n() {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY] && SUPPORTED_LANGS.includes(stored[STORAGE_KEY])) {
    currentLang = stored[STORAGE_KEY];
  } else {
    const browserLang = (navigator.language || '').slice(0, 2).toLowerCase();
    currentLang = SUPPORTED_LANGS.includes(browserLang) ? browserLang : DEFAULT_LANG;
  }
  await loadTranslations(currentLang);
}

async function loadTranslations(lang) {
  try {
    const url = browser.runtime.getURL(`locales/${lang}.json`);
    const response = await fetch(url);
    translations = await response.json();
  } catch {
    translations = {};
  }
}

/**
 * Resolve a dot-notation key from the translations, with optional {placeholder} substitution.
 * @param {string} key - e.g. 'header.credits'
 * @param {Object} [params] - e.g. { credits: 5 }
 * @returns {string}
 */
export function t(key, params) {
  let value = key.split('.').reduce((obj, k) => obj?.[k], translations);
  if (typeof value !== 'string') return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return value;
}

/**
 * Get current language code.
 */
export function getLang() {
  return currentLang;
}

/**
 * Change language, save to storage, reload translations, and notify listeners.
 */
export async function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  await browser.storage.local.set({ [STORAGE_KEY]: lang });
  await loadTranslations(lang);
  for (const fn of listeners) fn(lang);
}

/**
 * Register a callback for language changes.
 */
export function onLangChange(fn) {
  listeners.push(fn);
}

/**
 * List of supported languages.
 */
export const LANGS = SUPPORTED_LANGS;
