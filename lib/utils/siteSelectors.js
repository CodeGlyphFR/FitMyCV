/**
 * Site-specific CSS selectors for job content extraction
 *
 * This module centralizes all CSS selectors used for extracting
 * job offer content from various job board websites.
 */

/**
 * Site-specific CSS selectors for job content extraction
 * Ordered by priority (most specific first)
 */
export const SITE_SELECTORS = {
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
 * Site-specific CSS selectors for job TITLE extraction
 * Ordered by priority (most specific first)
 */
export const SITE_TITLE_SELECTORS = {
  'indeed.com': [
    'h1[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1.jobTitle',
    '[data-testid="job-title"]',
    '.icl-u-xs-mb--xs.icl-u-xs-mt--none h1'
  ],
  'indeed.fr': [
    'h1[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1.jobTitle',
    '[data-testid="job-title"]',
    '.icl-u-xs-mb--xs.icl-u-xs-mt--none h1'
  ],
  'linkedin.com': [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    'h1[class*="job-title"]',
    '.t-24.t-bold'
  ],
  'welcometothejungle.com': [
    '[data-testid="job-header-title"]',
    'h1[class*="Title"]',
    'h2[data-testid="job-section-title"]'
  ],
  'pole-emploi.fr': [
    'h1.title',
    '.intitule-offre',
    'h1[class*="title"]'
  ],
  'francetravail.fr': [
    'h1.title',
    '.intitule-offre',
    'h1[class*="title"]'
  ],
  'apec.fr': [
    'h1.offer-title',
    '.job-title',
    'h1[class*="title"]'
  ]
};

/**
 * Generic CSS selectors for job TITLE (fallback)
 */
export const GENERIC_TITLE_SELECTORS = [
  'h1[class*="job-title"]',
  'h1[class*="jobTitle"]',
  'h1[class*="title"]',
  '[class*="job-title"] h1',
  '[class*="jobTitle"]',
  '[data-testid*="title"]',
  'h1'
];

/**
 * Generic CSS selectors for job content (fallback)
 */
export const GENERIC_SELECTORS = [
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
export const AUTH_REQUIRED_DOMAINS = [
  'apec.fr/candidat',
  'linkedin.com/jobs/view'
];

/**
 * Domains that should use Puppeteer first (always protected or SPA)
 */
export const PUPPETEER_FIRST_DOMAINS = [
  'indeed.com',
  'indeed.fr',
  'glassdoor.',
  'welcometothejungle.com'
];
