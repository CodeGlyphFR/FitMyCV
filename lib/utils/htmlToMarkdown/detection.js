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

/**
 * Detect if the page is an expired, deleted, or error page
 * @param {string} markdown - Extracted markdown content
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { isExpiredPage, confidence, reason }
 */
export function detectExpiredOrDeletedPage(markdown, html, url = '') {
  if (!markdown && !html) return { isExpiredPage: false, confidence: 0, reason: null };

  const lowerMarkdown = (markdown || '').toLowerCase();
  const lowerHtml = (html || '').toLowerCase();
  let signals = 0;
  let reasons = [];

  // 1. Check for explicit expired/deleted indicators
  const expiredPatterns = [
    // French - flexible patterns with optional words in between
    /n'est\s+plus\s+disponible/i,  // "n'est plus disponible" - most common
    /offre.*n'est\s+plus\s+disponible/i,  // "offre ... n'est plus disponible"
    /offre\s+(expir[ée]e?|pourvue|clotur[ée]e?|supprim[ée]e?|retir[ée]e?)/i,
    /cette\s+offre.*n'est\s+plus/i,  // "cette offre ... n'est plus" (flexible)
    /poste\s+(pourvu|clotur[ée])/i,
    /annonce\s+(expir[ée]e?|retir[ée]e?)/i,
    /emploi.*n'est\s+plus\s+(disponible|actif)/i,
    // English
    /no\s+longer\s+(available|active)/i,  // "no longer available"
    /job\s+(expired|closed|filled|removed|no longer available)/i,
    /position\s+(filled|closed|no longer)/i,
    /this\s+(job|position|offer)\s+(has been|is no longer|was)/i,
    /offer\s+(expired|closed|removed)/i,
  ];

  for (const pattern of expiredPatterns) {
    if (pattern.test(lowerMarkdown) || pattern.test(lowerHtml)) {
      signals += 0.5;
      reasons.push(`Expired pattern: ${pattern.source.substring(0, 30)}...`);
      break; // One match is enough
    }
  }

  // 2. Check for 404/error page indicators
  const errorPatterns = [
    /page\s+(not\s+found|introuvable|inexistante)/i,
    /404|erreur\s+404/i,
    /cette\s+page\s+n'existe\s+(pas|plus)/i,
    /this\s+page\s+(doesn't|does not)\s+exist/i,
    /contenu\s+(indisponible|supprim[ée])/i,
    /content\s+(unavailable|removed|deleted)/i,
  ];

  for (const pattern of errorPatterns) {
    if (pattern.test(lowerMarkdown) || pattern.test(lowerHtml)) {
      signals += 0.4;
      reasons.push(`Error page pattern: ${pattern.source.substring(0, 30)}...`);
      break;
    }
  }

  // 3. Check for very short markdown with no job content
  const jobKeywords = [
    'mission', 'responsabilit', 'compétence', 'skill', 'experience',
    'expérience', 'profil', 'qualification', 'salaire', 'salary',
    'avantage', 'benefit', 'remote', 'télétravail', 'postuler', 'apply'
  ];

  const jobKeywordCount = jobKeywords.filter(k => lowerMarkdown.includes(k)).length;

  // If markdown is short (< 500 chars) AND has very few job keywords
  // Reduced weight to avoid false positives on legitimate short pages
  if (markdown && markdown.length < 500 && jobKeywordCount <= 1) {
    signals += 0.15;
    reasons.push(`Low content: ${markdown.length} chars, ${jobKeywordCount} job keywords`);
  }

  // 4. CONTRE-SIGNAL: Si le markdown a beaucoup de contenu d'offre valide,
  // c'est probablement un faux positif (patterns matchés dans le HTML/JS brut)
  if (markdown && markdown.length > 1500 && jobKeywordCount >= 3) {
    const reduction = 0.6;
    signals = Math.max(0, signals - reduction);
    if (reasons.length > 0) {
      reasons.push(`Valid job content override: ${markdown.length} chars, ${jobKeywordCount} keywords (-${reduction})`);
    }
  }

  const confidence = Math.min(signals, 1);
  // Threshold at 0.5 to catch expired patterns (which score exactly 0.5)
  const isExpiredPage = confidence >= 0.5;

  if (isExpiredPage) {
    console.log(`[htmlToMarkdown] Expired/deleted page detected (confidence: ${(confidence * 100).toFixed(0)}%): ${reasons.join(', ')}`);
  }

  return {
    isExpiredPage,
    confidence,
    reason: reasons.length > 0 ? reasons.join('; ') : null
  };
}
