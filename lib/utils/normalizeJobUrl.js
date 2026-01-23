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

    // Indeed: remove tracking parameters
    if (urlObj.hostname.includes('indeed.')) {
      urlObj.searchParams.delete('from');
      urlObj.searchParams.delete('advn');
      urlObj.searchParams.delete('vjk');
    }

    // LinkedIn: remove tracking parameters
    if (urlObj.hostname.includes('linkedin.com')) {
      urlObj.searchParams.delete('trk');
      urlObj.searchParams.delete('trackingId');
      urlObj.searchParams.delete('refId');
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}
