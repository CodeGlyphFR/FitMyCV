/**
 * Site-specific CSS selectors for job content extraction
 * Ported from FitMyCV-App/lib/utils/siteSelectors.js
 */

export const SITE_SELECTORS = {
  'indeed.com': [
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '[data-testid="jobDescriptionText"]',
    '.jobsearch-BodyContainer',
  ],
  'indeed.fr': [
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '[data-testid="jobDescriptionText"]',
  ],
  'linkedin.com': [
    '.description__text',
    '.show-more-less-html__markup',
    '[class*="job-view-layout"]',
    '.jobs-description',
    '.jobs-description__content',
  ],
  'welcometothejungle.com': [
    '[data-testid="job-section-description"]',
    '[class*="sc-"][class*="description"]',
    '.ais-JobContent',
    'main article',
    '[data-testid="job-section"]',
  ],
  'monster.fr': [
    '.job-description',
    '#JobDescription',
    '.details-content',
    '.job-details',
  ],
  'monster.com': [
    '.job-description',
    '#JobDescription',
    '.details-content',
    '.job-details',
  ],
  'glassdoor.fr': [
    '.desc',
    '[class*="jobDescription"]',
    '.jobDescriptionContent',
    '[data-test="jobDescription"]',
  ],
  'glassdoor.com': [
    '.desc',
    '[class*="jobDescription"]',
    '.jobDescriptionContent',
    '[data-test="jobDescription"]',
  ],
  'pole-emploi.fr': [
    '.description-offre',
    '[class*="offer-description"]',
    '.contenu-offre',
    '#TexteAnnonce',
  ],
  'francetravail.fr': [
    '.description-offre',
    '[class*="offer-description"]',
    '.contenu-offre',
    '#TexteAnnonce',
  ],
  'apec.fr': [
    '.details-offre',
    '.offer-description',
    '[class*="jobOffer"]',
    '.job-description-content',
  ],
  'cadremploi.fr': [
    '.c-jobOffer__description',
    '[class*="job-description"]',
    '.job-content',
  ],
  'hellowork.com': [
    '.tw-description',
    '[class*="description"]',
    '.job-description',
  ],
  'lesjeudis.com': [
    '.job-description',
    '.offer-description',
  ],
  'meteojob.com': [
    '.offer-main-content',
    '.job-offer-details',
    '.cc-job-offer',
  ],
  'myworkdayjobs.com': [
    '[data-automation-id="jobPostingDescription"]',
    '[data-automation-id="job-posting-details"]',
    '[data-automation-id="jobPostingPage"]',
  ],
};

export const SITE_TITLE_SELECTORS = {
  'indeed.com': [
    'h1[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1.jobTitle',
    '[data-testid="job-title"]',
  ],
  'indeed.fr': [
    'h1[data-testid="jobsearch-JobInfoHeader-title"]',
    '.jobsearch-JobInfoHeader-title',
    'h1.jobTitle',
    '[data-testid="job-title"]',
  ],
  'linkedin.com': [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    'h1[class*="job-title"]',
    '.t-24.t-bold',
  ],
  'welcometothejungle.com': [
    '[data-testid="job-metadata-block"] + h2',
    'h2.wui-text',
    '[data-testid="job-header-title"]',
    'h1[class*="Title"]',
  ],
  'pole-emploi.fr': [
    '#detailOffreVolet h1.title',
    'h1.t2.title',
    'h1.title',
    '.intitule-offre',
  ],
  'francetravail.fr': [
    '#detailOffreVolet h1.title',
    'h1.t2.title',
    'h1.title',
    '.intitule-offre',
  ],
  'apec.fr': ['h1.offer-title', '.job-title', 'h1[class*="title"]'],
  'monster.fr': ['h1[class*="title"]', '.job-header h1'],
  'monster.com': ['h1[class*="title"]', '.job-header h1'],
  'glassdoor.fr': [
    'h1[id^="jd-job-title"]',
    '[data-test="job-title"]',
    'h1[class*="heading_Level1"]',
  ],
  'glassdoor.com': [
    'h1[id^="jd-job-title"]',
    '[data-test="job-title"]',
    'h1[class*="heading_Level1"]',
  ],
  'cadremploi.fr': [
    'h1.job__title',
    '.c-jobOffer__title h1',
    'h1[class*="title"]',
  ],
  'hellowork.com': ['h1[class*="title"]', '.tw-title h1'],
  'lesjeudis.com': ['h1.job-title', 'h1[class*="title"]'],
  'meteojob.com': [
    'h1 .cc-job-offer-title',
    'h1.cc-font-size-base',
  ],
  'myworkdayjobs.com': [
    'h2[data-automation-id="jobPostingHeader"]',
    '[data-automation-id="jobPostingHeader"]',
  ],
};

export const SITE_DETAIL_PANEL_SELECTORS = {
  'indeed.com': [
    '.jobsearch-RightPane',
    '.jobsearch-ViewjobPaneWrapper',
    '.jobsearch-ViewJobLayout--embedded',
  ],
  'indeed.fr': [
    '.jobsearch-RightPane',
    '.jobsearch-ViewjobPaneWrapper',
    '.jobsearch-ViewJobLayout--embedded',
  ],
  'linkedin.com': [
    '.jobs-search__job-details',
    '.scaffold-layout__detail',
    '.job-view-layout',
    '[class*="job-view-layout"]',
  ],
  'glassdoor.com': [
    '[class*="TwoColumnLayout_columnRight"]',
    '[class*="JobDetails_jobDetailsContainer"]',
  ],
  'glassdoor.fr': [
    '[class*="TwoColumnLayout_columnRight"]',
    '[class*="JobDetails_jobDetailsContainer"]',
  ],
};

export const GENERIC_TITLE_SELECTORS = [
  'h1[class*="job-title"]',
  'h1[class*="jobTitle"]',
  'h1[class*="title"]',
  '[class*="job-title"] h1',
  '[class*="jobTitle"]',
  '[data-testid*="title"]',
  'h1',
];

export const GENERIC_SELECTORS = [
  '[class*="job-description"]',
  '[class*="jobDescription"]',
  '[class*="job-content"]',
  '[class*="job-details"]',
  '[class*="offer-description"]',
  '[class*="vacancy-description"]',
  '[id*="job-description"]',
  '[id*="jobDescription"]',
  '[data-testid*="description"]',
  '[data-automation*="description"]',
  '[data-test*="description"]',
  'article[class*="job"]',
  'main article',
  '[role="main"] article',
  'main section:not([class*="nav"]):not([class*="header"]):not([class*="footer"])',
  'article',
  'main',
  '[role="main"]',
];

export const AUTH_REQUIRED_DOMAINS = [
  'apec.fr/candidat',
  'linkedin.com/jobs/view',
];

/**
 * Get content selectors for a hostname
 * @param {string} hostname - e.g. "www.linkedin.com"
 * @returns {string[]} ordered selectors
 */
export function getSelectorsForHostname(hostname) {
  const host = hostname.replace(/^www\./, '');
  for (const [domain, selectors] of Object.entries(SITE_SELECTORS)) {
    if (host.includes(domain)) return selectors;
  }
  return GENERIC_SELECTORS;
}

/**
 * Get title selectors for a hostname
 * @param {string} hostname
 * @returns {string[]} ordered selectors
 */
export function getTitleSelectorsForHostname(hostname) {
  const host = hostname.replace(/^www\./, '');
  for (const [domain, selectors] of Object.entries(SITE_TITLE_SELECTORS)) {
    if (host.includes(domain)) return selectors;
  }
  return GENERIC_TITLE_SELECTORS;
}

/**
 * Get detail panel element for split-panel sites
 * @param {string} hostname
 * @returns {Element|null}
 */
export function getDetailPanelForHostname(hostname) {
  const host = hostname.replace(/^www\./, '');
  for (const [domain, selectors] of Object.entries(SITE_DETAIL_PANEL_SELECTORS)) {
    if (host.includes(domain)) {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return el;
      }
      return null;
    }
  }
  return null;
}

/**
 * Check if hostname is a known split-panel site
 * @param {string} hostname
 * @returns {boolean}
 */
export function isSplitPanelSite(hostname) {
  const host = hostname.replace(/^www\./, '');
  return Object.keys(SITE_DETAIL_PANEL_SELECTORS).some(d => host.includes(d));
}

/**
 * Check if a hostname is a known job site
 * @param {string} hostname
 * @returns {boolean}
 */
export function isKnownJobSite(hostname) {
  const host = hostname.replace(/^www\./, '');
  return Object.keys(SITE_SELECTORS).some(domain => host.includes(domain));
}
