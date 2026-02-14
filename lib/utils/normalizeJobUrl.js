/**
 * Normalize job board URLs by removing tracking parameters
 * that can interfere with content fetching and cache matching
 *
 * @param {string} url - Original URL
 * @returns {string} - Normalized URL
 */
export function normalizeJobUrl(url) {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();

    // Common tracking params present on many job boards
    const commonTrackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    for (const param of commonTrackingParams) {
      urlObj.searchParams.delete(param);
    }

    // Indeed: remove tracking parameters, keep jk (job key)
    if (host.includes('indeed.')) {
      urlObj.searchParams.delete('from');
      urlObj.searchParams.delete('advn');
      urlObj.searchParams.delete('vjk');
      urlObj.searchParams.delete('cf-turnstile-response');
    }

    // LinkedIn: remove tracking parameters
    if (host.includes('linkedin.com')) {
      urlObj.searchParams.delete('trk');
      urlObj.searchParams.delete('trackingId');
      urlObj.searchParams.delete('refId');
    }

    // APEC: remove tracking parameters
    if (host.includes('apec.fr')) {
      urlObj.searchParams.delete('xtor');
      urlObj.searchParams.delete('context');
    }

    // France Travail / Pole Emploi: remove tracking parameters
    if (host.includes('francetravail.fr') || host.includes('pole-emploi.fr')) {
      urlObj.searchParams.delete('at_medium');
      urlObj.searchParams.delete('at_campaign');
    }

    // Glassdoor: remove tracking parameters
    if (host.includes('glassdoor.')) {
      urlObj.searchParams.delete('clickSource');
      urlObj.searchParams.delete('src');
    }

    // Welcome to the Jungle: remove tracking parameters
    if (host.includes('welcometothejungle.com')) {
      urlObj.searchParams.delete('q');
      urlObj.searchParams.delete('refinementList');
    }

    // Monster: remove tracking parameters
    if (host.includes('monster.')) {
      urlObj.searchParams.delete('stpage');
      urlObj.searchParams.delete('from');
    }

    // CadreEmploi: remove tracking parameters
    if (host.includes('cadremploi.fr')) {
      urlObj.searchParams.delete('xtor');
    }

    // HelloWork: remove tracking parameters
    if (host.includes('hellowork.com')) {
      urlObj.searchParams.delete('source');
    }

    // LesJeudis: remove tracking parameters
    if (host.includes('lesjeudis.com')) {
      urlObj.searchParams.delete('source');
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}
