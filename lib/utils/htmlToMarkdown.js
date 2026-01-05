/**
 * HTML to Markdown conversion pipeline - Enhanced for Job Offers
 *
 * Pipeline:
 * HTML brut (Puppeteer/fetch)
 *     ↓
 * Login page detection (NEW)
 *     ↓
 * JSDOM (parsing)
 *     ↓
 * Page type detection (NEW)
 *     ↓
 * Readability (extraction contenu principal) - with optimized config
 *     ↓
 * Content scoring (NEW)
 *     ↓
 * Hybrid extraction (Readability vs CSS selectors)
 *     ↓
 * Turndown (HTML → Markdown)
 *     ↓
 * Smart truncation (NEW)
 *     ↓
 * Markdown propre
 */

import { Readability, isProbablyReaderable } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';

// ============================================================================
// CONSTANTS - Site-specific selectors
// ============================================================================

/**
 * Site-specific CSS selectors for job content extraction
 * Ordered by priority (most specific first)
 */
const SITE_SELECTORS = {
  'indeed.com': [
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '[data-testid="jobDescriptionText"]',
    '.jobsearch-BodyContainer'
  ],
  'indeed.fr': [
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '[data-testid="jobDescriptionText"]'
  ],
  'linkedin.com': [
    '.description__text',
    '.show-more-less-html__markup',
    '[class*="job-view-layout"]',
    '.jobs-description',
    '.jobs-description__content'
  ],
  'welcometothejungle.com': [
    '[data-testid="job-section-description"]',
    '[class*="sc-"][class*="description"]',
    '.ais-JobContent',
    'main article',
    '[data-testid="job-section"]'
  ],
  'monster.': [
    '.job-description',
    '#JobDescription',
    '.details-content',
    '.job-details'
  ],
  'glassdoor.': [
    '.desc',
    '[class*="jobDescription"]',
    '.jobDescriptionContent',
    '[data-test="jobDescription"]'
  ],
  'pole-emploi.fr': [
    '.description-offre',
    '[class*="offer-description"]',
    '.contenu-offre',
    '#TexteAnnonce'
  ],
  'francetravail.fr': [
    '.description-offre',
    '[class*="offer-description"]',
    '.contenu-offre',
    '#TexteAnnonce'
  ],
  'apec.fr': [
    '.details-offre',
    '.offer-description',
    '[class*="jobOffer"]',
    '.job-description-content'
  ],
  'cadremploi.fr': [
    '.c-jobOffer__description',
    '[class*="job-description"]',
    '.job-content'
  ],
  'hellowork.com': [
    '.tw-description',
    '[class*="description"]',
    '.job-description'
  ],
  'lesjeudis.com': [
    '.job-description',
    '.offer-description'
  ]
};

/**
 * Generic CSS selectors for job content (fallback)
 */
const GENERIC_SELECTORS = [
  // Semantic job selectors
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[class*="job-content"]',
  '[class*="job-details"]',
  '[class*="offer-description"]',
  '[class*="vacancy-description"]',
  '[id*="job-description"]',
  '[id*="jobDescription"]',
  // Data attributes
  '[data-testid*="description"]',
  '[data-automation*="description"]',
  '[data-test*="description"]',
  // Structural selectors
  'article[class*="job"]',
  'main article',
  '[role="main"] article',
  'main section:not([class*="nav"]):not([class*="header"]):not([class*="footer"])',
  // Fallback
  'article',
  'main',
  '[role="main"]'
];

/**
 * Domains known to require authentication
 */
const AUTH_REQUIRED_DOMAINS = [
  'apec.fr/candidat',
  'linkedin.com/jobs/view'
];

/**
 * Domains that should use Puppeteer first (always protected or SPA)
 */
const PUPPETEER_FIRST_DOMAINS = [
  'indeed.com',
  'indeed.fr',
  'glassdoor.',
  'welcometothejungle.com'
];

// ============================================================================
// LOGIN PAGE DETECTION (Étape 0)
// ============================================================================

/**
 * Detect if the page is a login/authentication page
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { isLoginPage, confidence, reason }
 */
function detectLoginPage(html, url = '') {
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

// ============================================================================
// PAGE TYPE DETECTION (Étape 2)
// ============================================================================

/**
 * Detect the type of page (job offer, article, form, etc.)
 * @param {Document} document - JSDOM document
 * @param {string} url - Source URL
 * @returns {Object} - { type, confidence, signals }
 */
function detectPageType(document, url = '') {
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

// ============================================================================
// READABILITY CONFIGURATION (Étape 1)
// ============================================================================

/**
 * Create optimized Readability configuration for job offers
 * @param {string} url - Source URL for context
 * @returns {Object} - Readability options
 */
function createReadabilityConfig(url = '') {
  return {
    // Lower threshold to capture shorter job descriptions
    charThreshold: 300,

    // More candidates for better content selection
    nbTopCandidates: 7,

    // Preserve job-related classes
    classesToPreserve: [
      'job-description',
      'description',
      'requirements',
      'qualifications',
      'skills',
      'responsibilities',
      'benefits',
      'salary',
      'location',
      'company'
    ],

    // Don't keep classes in output (cleaner HTML)
    keepClasses: false,

    // Disable JSON-LD (not useful for job extraction)
    disableJSONLD: true,

    // Allow video elements (some job pages have intro videos)
    allowedVideoRegex: /youtube|vimeo|dailymotion/i,
  };
}

// ============================================================================
// CONTENT SCORING (Étape 4)
// ============================================================================

/**
 * Score the quality of extracted job offer content
 * @param {string} content - Markdown content
 * @returns {Object} - { score, breakdown, isValid }
 */
function scoreJobOfferContent(content) {
  if (!content || content.length < 100) {
    return { score: 0, breakdown: {}, isValid: false };
  }

  const text = content.toLowerCase();
  const breakdown = {
    length: 0,      // 0-20 points
    keywords: 0,    // 0-30 points
    structure: 0,   // 0-25 points
    noise: 0        // 0 to -25 points (penalty)
  };

  // Length scoring (ideal: 1500-8000 chars)
  const len = content.length;
  if (len >= 500 && len <= 1000) breakdown.length = 10;
  else if (len > 1000 && len <= 1500) breakdown.length = 15;
  else if (len > 1500 && len <= 8000) breakdown.length = 20;
  else if (len > 8000 && len <= 15000) breakdown.length = 15;
  else if (len > 15000) breakdown.length = 10;
  else breakdown.length = 5;

  // Keyword scoring
  const mustHaveKeywords = [
    'description', 'mission', 'profil', 'compétence', 'competence',
    'experience', 'expérience', 'formation', 'poste', 'job',
    'responsabilité', 'responsibility', 'qualification'
  ];
  const niceToHaveKeywords = [
    'salaire', 'salary', 'rémunération', 'remuneration',
    'avantages', 'benefits', 'télétravail', 'remote',
    'cdi', 'cdd', 'contrat', 'contract', 'équipe', 'team'
  ];

  const mustHaveFound = mustHaveKeywords.filter(k => text.includes(k)).length;
  const niceToHaveFound = niceToHaveKeywords.filter(k => text.includes(k)).length;

  breakdown.keywords = Math.min(mustHaveFound * 3 + niceToHaveFound * 1.5, 30);

  // Structure scoring (lists, headings, paragraphs)
  const hasList = /^[-*•]\s/m.test(content) || /^\d+[.)]\s/m.test(content);
  const hasHeadings = /^#{1,3}\s/m.test(content) || /^[A-Z][A-Za-zÀ-ÿ\s]+:$/m.test(content);
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
  const hasParagraphs = paragraphs.length >= 3;

  if (hasList) breakdown.structure += 10;
  if (hasHeadings) breakdown.structure += 10;
  if (hasParagraphs) breakdown.structure += 5;

  // Noise penalty
  const noisePatterns = [
    /cookie/gi,
    /privacy policy/gi,
    /politique de confidentialité/gi,
    /subscribe|newsletter/gi,
    /login|sign in|se connecter/gi,
    /copyright|©|tous droits réservés/gi,
    /all rights reserved/gi,
    /accept.*terms/gi
  ];

  let noiseCount = 0;
  for (const pattern of noisePatterns) {
    const matches = content.match(pattern);
    if (matches) noiseCount += matches.length;
  }
  breakdown.noise = -Math.min(noiseCount * 3, 25);

  const score = Math.max(0, Math.min(100,
    breakdown.length + breakdown.keywords + breakdown.structure + breakdown.noise
  ));

  return {
    score,
    breakdown,
    isValid: score >= 25 && len >= 200
  };
}

// ============================================================================
// SELECTORS HELPER (Étape 3)
// ============================================================================

/**
 * Get prioritized CSS selectors for a given URL
 * @param {string} url - Source URL
 * @returns {string[]} - Array of CSS selectors
 */
function getSelectorsForUrl(url = '') {
  if (!url) return GENERIC_SELECTORS;

  const lowerUrl = url.toLowerCase();

  // Try to match site-specific selectors
  for (const [domain, selectors] of Object.entries(SITE_SELECTORS)) {
    if (lowerUrl.includes(domain)) {
      return [...selectors, ...GENERIC_SELECTORS];
    }
  }

  return GENERIC_SELECTORS;
}

/**
 * Check if URL should use Puppeteer first
 * @param {string} url - Source URL
 * @returns {boolean}
 */
export function shouldUsePuppeteerFirst(url = '') {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return PUPPETEER_FIRST_DOMAINS.some(domain => lowerUrl.includes(domain));
}

// ============================================================================
// SMART TRUNCATION (Étape 6)
// ============================================================================

/**
 * Smart truncation that preserves important sections
 * @param {string} content - Markdown content
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated content
 */
function smartTruncate(content, maxLength = 10000) {
  if (content.length <= maxLength) return content;

  // Important section patterns to preserve
  const importantPatterns = [
    /#{1,3}\s*(compétences?|skills?|technologies?)/gi,
    /#{1,3}\s*(profil|profile|requirements?|requis)/gi,
    /#{1,3}\s*(avantages?|benefits?|perks?)/gi,
    /#{1,3}\s*(salaire|salary|rémunération|compensation)/gi,
    /#{1,3}\s*(formation|education|diplôme)/gi,
    /\*\*(compétences?|skills?|profil|avantages?)\*\*/gi
  ];

  const lines = content.split('\n');
  const importantIndices = new Set();

  // Identify important lines and their following content
  lines.forEach((line, i) => {
    for (const pattern of importantPatterns) {
      if (pattern.test(line)) {
        // Mark this line and next 15 lines as important
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          importantIndices.add(j);
        }
        break;
      }
    }
  });

  // If no important sections found, just truncate normally
  if (importantIndices.size === 0) {
    return content.substring(0, maxLength) + '\n\n[...]';
  }

  // Reserve space for important content
  const reservedLength = 3000;
  const mainPartLength = maxLength - reservedLength;

  const result = [];
  let currentLength = 0;
  let addedSeparator = false;

  // Add main content (non-important lines first)
  for (let i = 0; i < lines.length && currentLength < mainPartLength; i++) {
    if (!importantIndices.has(i)) {
      result.push(lines[i]);
      currentLength += lines[i].length + 1;
    }
  }

  // Add important sections at the end
  if (importantIndices.size > 0 && currentLength < maxLength) {
    if (!addedSeparator) {
      result.push('');
      result.push('---');
      result.push('');
      addedSeparator = true;
    }

    const sortedIndices = Array.from(importantIndices).sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      if (currentLength < maxLength - 100 && lines[idx]) {
        result.push(lines[idx]);
        currentLength += lines[idx].length + 1;
      }
    }
  }

  return result.join('\n').trim() + '\n\n[...]';
}

// ============================================================================
// TURNDOWN SERVICE
// ============================================================================

/**
 * Create configured Turndown service
 * @returns {TurndownService}
 */
function createTurndownService() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // Remove images, scripts, styles, svg, iframe from output
  turndownService.remove(['img', 'script', 'style', 'svg', 'iframe', 'noscript', 'canvas', 'video', 'audio']);

  // Ignore navigation elements
  turndownService.addRule('removeNav', {
    filter: ['nav', 'header', 'footer', 'aside'],
    replacement: () => ''
  });

  // Ignore hidden elements
  turndownService.addRule('removeHidden', {
    filter: (node) => {
      if (node.nodeType !== 1) return false;
      const style = node.getAttribute('style') || '';
      const className = node.getAttribute('class') || '';
      return (
        style.includes('display: none') ||
        style.includes('display:none') ||
        style.includes('visibility: hidden') ||
        className.includes('hidden') ||
        className.includes('sr-only') ||
        className.includes('visually-hidden')
      );
    },
    replacement: () => ''
  });

  // Simplify links (keep text, remove URL noise)
  turndownService.addRule('simplifyLinks', {
    filter: 'a',
    replacement: (content) => content
  });

  return turndownService;
}

// ============================================================================
// MARKDOWN CLEANUP
// ============================================================================

/**
 * Clean markdown content
 * @param {string} markdown - Raw markdown
 * @returns {string} - Cleaned markdown
 */
function cleanMarkdownContent(markdown) {
  if (!markdown) return '';

  return markdown
    // Remove excessive newlines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove empty list items
    .replace(/^-\s*$/gm, '')
    // Remove lines that are just whitespace
    .replace(/^\s+$/gm, '')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove excessive newlines again after line processing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// FALLBACK EXTRACTION
// ============================================================================

/**
 * Fallback extraction when Readability fails
 * @param {string} html - Raw HTML content
 * @returns {Object} - { title, content, textLength }
 */
function fallbackExtraction(html) {
  try {
    // Remove scripts, styles, navigation
    let cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    const turndownService = createTurndownService();
    const markdown = turndownService.turndown(cleaned);
    const cleanedMarkdown = cleanMarkdownContent(markdown);

    // Try to extract title from h1
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = h1Match ? h1Match[1].trim() : '';

    return {
      title,
      content: cleanedMarkdown,
      textLength: cleanedMarkdown.length
    };
  } catch (error) {
    console.error('[htmlToMarkdown] Fallback error:', error.message);
    return {
      title: '',
      content: '',
      textLength: 0
    };
  }
}

// ============================================================================
// SELECTOR-BASED EXTRACTION
// ============================================================================

/**
 * Try extraction using CSS selectors
 * @param {Document} document - JSDOM document
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 */
function trySelectorExtraction(document, url = '') {
  const selectors = getSelectorsForUrl(url);
  let content = '';
  let title = '';

  // Try to get title
  const titleElement = document.querySelector('h1') || document.querySelector('[class*="title"]');
  if (titleElement) {
    title = titleElement.textContent?.trim() || '';
  }

  // Try each selector until we find good content
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.trim().length > 200) {
        const turndownService = createTurndownService();
        content = turndownService.turndown(element.innerHTML);
        content = cleanMarkdownContent(content);

        // Score this extraction
        const score = scoreJobOfferContent(content);
        if (score.isValid && score.score >= 30) {
          break;
        }
      }
    } catch (e) {
      // Selector might be invalid, continue
    }
  }

  return {
    title,
    content,
    textLength: content.length
  };
}

// ============================================================================
// READABILITY-BASED EXTRACTION
// ============================================================================

/**
 * Try extraction using Readability with optimized config
 * @param {Document} document - JSDOM document
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 */
function tryReadabilityExtraction(document, url = '') {
  try {
    // Clone document for Readability (it modifies the DOM)
    const documentClone = document.cloneNode(true);
    const config = createReadabilityConfig(url);
    const reader = new Readability(documentClone, config);
    const article = reader.parse();

    if (!article || !article.content) {
      return { title: '', content: '', textLength: 0 };
    }

    const turndownService = createTurndownService();
    const markdown = turndownService.turndown(article.content);
    const cleanMarkdown = cleanMarkdownContent(markdown);

    return {
      title: article.title || '',
      content: cleanMarkdown,
      textLength: cleanMarkdown.length
    };
  } catch (error) {
    console.error('[htmlToMarkdown] Readability error:', error.message);
    return { title: '', content: '', textLength: 0 };
  }
}

// ============================================================================
// MAIN FUNCTIONS (Public API)
// ============================================================================

/**
 * Convert raw HTML to clean Markdown
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL (for Readability context)
 * @returns {Object} - { title, content, textLength }
 */
export function htmlToMarkdown(html, url = '') {
  if (!html || typeof html !== 'string') {
    return {
      title: '',
      content: '',
      textLength: 0
    };
  }

  try {
    // 1. Parse HTML with JSDOM
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // 2. Use optimized Readability extraction
    const result = tryReadabilityExtraction(document, url);

    if (result.textLength > 0) {
      return result;
    }

    // 3. Fallback on error
    return fallbackExtraction(html);
  } catch (error) {
    console.error('[htmlToMarkdown] Error:', error.message);
    return fallbackExtraction(html);
  }
}

/**
 * Extract job offer content from HTML with optimizations
 * Enhanced with login detection, hybrid extraction, and smart truncation
 *
 * @param {string} html - Raw HTML content
 * @param {string} url - Source URL
 * @returns {Object} - { title, content, textLength }
 * @throws {Error} - If login page detected
 */
export function extractJobOfferContent(html, url = '') {
  if (!html || typeof html !== 'string') {
    return { title: '', content: '', textLength: 0 };
  }

  // Step 0: Detect login pages
  const loginCheck = detectLoginPage(html, url);
  if (loginCheck.isLoginPage) {
    throw new Error(JSON.stringify({
      translationKey: 'taskQueue.errors.loginRequired',
      params: {
        url: url,
        reason: loginCheck.reason
      },
      suggestion: 'Téléchargez l\'offre en PDF depuis le site et uploadez-la.'
    }));
  }

  try {
    // Parse HTML
    const dom = new JSDOM(html, { url });
    const document = dom.window.document;

    // Step 1: Detect page type
    const pageType = detectPageType(document, url);
    console.log(`[htmlToMarkdown] Page type: ${pageType.type} (confidence: ${(pageType.confidence * 100).toFixed(0)}%)`);

    // Step 2: Try Readability extraction first
    const readabilityResult = tryReadabilityExtraction(document, url);
    const readabilityScore = scoreJobOfferContent(readabilityResult.content);
    console.log(`[htmlToMarkdown] Readability score: ${readabilityScore.score}`);

    // If Readability gives a good result, use it
    if (readabilityScore.isValid && readabilityScore.score >= 50) {
      console.log(`[htmlToMarkdown] Using Readability extraction (score: ${readabilityScore.score})`);
      let content = readabilityResult.content;

      // Apply smart truncation if needed
      if (content.length > 10000) {
        content = smartTruncate(content, 10000);
      }

      return {
        title: readabilityResult.title,
        content,
        textLength: content.length
      };
    }

    // Step 3: Fallback to CSS selector extraction
    const selectorResult = trySelectorExtraction(document, url);
    const selectorScore = scoreJobOfferContent(selectorResult.content);
    console.log(`[htmlToMarkdown] Selector score: ${selectorScore.score}`);

    // Choose the best result
    let bestResult;
    let bestScore;

    if (selectorScore.score > readabilityScore.score && selectorScore.isValid) {
      console.log(`[htmlToMarkdown] Using selector extraction (score: ${selectorScore.score})`);
      bestResult = selectorResult;
      bestScore = selectorScore;
    } else if (readabilityScore.isValid) {
      console.log(`[htmlToMarkdown] Using Readability extraction (score: ${readabilityScore.score})`);
      bestResult = readabilityResult;
      bestScore = readabilityScore;
    } else if (selectorScore.isValid) {
      console.log(`[htmlToMarkdown] Using selector extraction as fallback (score: ${selectorScore.score})`);
      bestResult = selectorResult;
      bestScore = selectorScore;
    } else {
      // Last resort: full fallback
      console.log('[htmlToMarkdown] All extractions failed, using fallback');
      bestResult = fallbackExtraction(html);
      bestScore = { score: 0 };
    }

    // Apply smart truncation
    let content = bestResult.content;
    if (content.length > 10000) {
      content = smartTruncate(content, 10000);
    }

    return {
      title: bestResult.title,
      content,
      textLength: content.length
    };

  } catch (error) {
    // Re-throw login errors
    if (error.message.includes('translationKey')) {
      throw error;
    }

    console.error('[extractJobOfferContent] Error:', error.message);
    return fallbackExtraction(html);
  }
}

// Export utilities for external use
export {
  detectLoginPage,
  detectPageType,
  scoreJobOfferContent,
  getSelectorsForUrl,
  PUPPETEER_FIRST_DOMAINS
};
