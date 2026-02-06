/**
 * Readability configuration for HTML to Markdown conversion
 * Creates optimized configuration for job offer extraction
 */

/**
 * Create optimized Readability configuration for job offers
 * @param {string} url - Source URL for context
 * @returns {Object} - Readability options
 */
export function createReadabilityConfig(url = '') {
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
