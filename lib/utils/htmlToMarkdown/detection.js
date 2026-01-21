/**
 * Page detection utilities for HTML to Markdown conversion
 * Detects login pages and page types (job offer, article, form, etc.)
 */

import { AUTH_REQUIRED_DOMAINS } from '../siteSelectors';

/**
 * Detect if the page is a login/authentication page
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { isLoginPage, confidence, reason }
 */
export function detectLoginPage(html, url = '') {
  if (!html) return { isLoginPage: false, confidence: 0, reason: null };

  const lowerHtml = html.toLowerCase();
  const lowerUrl = url.toLowerCase();
  let signals = 0;
  let reasons = [];

  // Check for known auth-required URL patterns
  for (const pattern of AUTH_REQUIRED_DOMAINS) {
    if (lowerUrl.includes(pattern)) {
      signals += 0.3;
      reasons.push(`URL pattern: ${pattern}`);
    }
  }

  // Check for login form indicators
  const hasPasswordField = /<input[^>]*type\s*=\s*["']password["'][^>]*>/i.test(html);
  const hasLoginForm = /<form[^>]*(?:login|signin|connexion|auth)[^>]*>/i.test(html);
  const hasEmailField = /<input[^>]*(?:type\s*=\s*["']email["']|name\s*=\s*["'](?:email|mail|username)["'])[^>]*>/i.test(html);

  if (hasPasswordField) {
    signals += 0.25;
    reasons.push('Password field detected');
  }
  if (hasLoginForm) {
    signals += 0.2;
    reasons.push('Login form detected');
  }
  if (hasEmailField && hasPasswordField) {
    signals += 0.1;
    reasons.push('Email + password combination');
  }

  // Check for login-related keywords (high frequency = likely login page)
  const loginKeywords = [
    'se connecter', 'connexion', 'login', 'sign in', 'authentification',
    'mot de passe', 'password', 'identifiant', 'créer un compte',
    'create account', 'forgot password', 'mot de passe oublié'
  ];

  let keywordCount = 0;
  for (const keyword of loginKeywords) {
    const matches = (lowerHtml.match(new RegExp(keyword, 'g')) || []).length;
    keywordCount += matches;
  }

  if (keywordCount >= 5) {
    signals += 0.2;
    reasons.push(`High login keyword density (${keywordCount})`);
  } else if (keywordCount >= 2) {
    signals += 0.1;
    reasons.push(`Login keywords found (${keywordCount})`);
  }

  // Check for ABSENCE of job offer content (negative signal)
  const jobKeywords = [
    'description du poste', 'job description', 'missions', 'responsabilités',
    'compétences requises', 'required skills', 'profil recherché', 'qualifications',
    'expérience', 'experience', 'avantages', 'benefits', 'salaire', 'salary',
    'postuler', 'apply', 'candidature'
  ];

  let jobKeywordCount = 0;
  for (const keyword of jobKeywords) {
    if (lowerHtml.includes(keyword)) jobKeywordCount++;
  }

  // If very few job keywords and some login signals, likely a login page
  if (jobKeywordCount <= 2 && signals > 0.2) {
    signals += 0.15;
    reasons.push(`Low job content (${jobKeywordCount} keywords)`);
  }

  // Check page title for login indicators
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].toLowerCase() : '';
  if (pageTitle.includes('connexion') || pageTitle.includes('login') || pageTitle.includes('sign in')) {
    signals += 0.15;
    reasons.push('Login-related page title');
  }

  const confidence = Math.min(signals, 1);
  const isLoginPage = confidence >= 0.5;

  if (isLoginPage) {
    console.log(`[htmlToMarkdown] Login page detected (confidence: ${(confidence * 100).toFixed(0)}%): ${reasons.join(', ')}`);
  }

  return {
    isLoginPage,
    confidence,
    reason: reasons.length > 0 ? reasons.join('; ') : null
  };
}

/**
 * Detect the type of page (job offer, article, form, etc.)
 * @param {Document} document - JSDOM document
 * @param {string} url - Source URL
 * @returns {Object} - { type, confidence, signals }
 */
export function detectPageType(document, url = '') {
  const signals = {
    job_offer: 0,
    article: 0,
    form: 0
  };

  const lowerUrl = url.toLowerCase();

  // URL pattern analysis
  const jobUrlPatterns = [
    /indeed\.com\/job/i,
    /indeed\.fr\/job/i,
    /linkedin\.com\/jobs/i,
    /welcometothejungle\.com\/.*\/jobs/i,
    /monster\./i,
    /glassdoor\./i,
    /pole-emploi\.fr/i,
    /francetravail\.fr/i,
    /apec\.fr/i,
    /cadremploi\.fr/i,
    /hellowork\.com/i,
    /lesjeudis\.com/i,
    /job|emploi|career|vacancy|poste|offre/i
  ];

  if (jobUrlPatterns.some(p => p.test(lowerUrl))) {
    signals.job_offer += 0.4;
  }

  // Content analysis
  const bodyText = document.body?.textContent?.toLowerCase() || '';

  // Job-specific keywords
  const jobKeywords = [
    'postuler', 'apply', 'candidature', 'profil recherché',
    'missions', 'responsabilités', 'compétences requises',
    'required skills', 'avantages', 'benefits', 'salaire',
    'télétravail', 'remote', 'cdi', 'cdd', 'contrat'
  ];

  const jobKeywordCount = jobKeywords.filter(k => bodyText.includes(k)).length;
  signals.job_offer += Math.min(jobKeywordCount * 0.05, 0.4);

  // Article indicators
  const articleElements = document.querySelectorAll('article, [class*="article"], [class*="post"], [class*="blog"]');
  if (articleElements.length > 0) {
    signals.article += 0.2;
  }

  // Form indicators
  const forms = document.querySelectorAll('form');
  const applyButtons = document.querySelectorAll('[class*="apply"], [id*="apply"], button[type="submit"]');
  if (forms.length > 2) {
    signals.form += 0.3;
  }
  if (applyButtons.length > 0 && signals.job_offer > 0.2) {
    signals.job_offer += 0.1; // Apply button + job signals = more likely job page
  }

  // Determine dominant type
  const maxSignal = Math.max(signals.job_offer, signals.article, signals.form);
  const type = Object.keys(signals).find(k => signals[k] === maxSignal) || 'unknown';

  return { type, confidence: maxSignal, signals };
}
