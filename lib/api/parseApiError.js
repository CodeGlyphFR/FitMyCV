/**
 * Parse API error response and return translated message
 * @param {Object} data - API response data
 * @param {Function} t - Translation function from useLanguage()
 * @returns {Object} - { message, actionRequired, redirectUrl }
 */
export function parseApiError(data, t) {
  if (!data) {
    return {
      message: t('errors.api.common.serverError'),
      actionRequired: false,
      redirectUrl: null
    };
  }

  const error = data.error || data.message;
  const params = data.params || {};

  // Check if error is a translation key (starts with 'errors.')
  let message;
  if (typeof error === 'string' && error.startsWith('errors.')) {
    // Try to translate
    const translated = t(error, params);
    // If translation fails (returns key), use fallback or key
    message = translated !== error ? translated : error;
  } else if (typeof error === 'string' && error.includes('.') && !error.includes(' ')) {
    // Legacy format - looks like a translation key without 'errors.' prefix
    const translated = t(error, params);
    message = translated !== error ? translated : error;
  } else {
    // Direct message string or unknown format
    message = error || t('errors.api.common.serverError');
  }

  return {
    message,
    actionRequired: Boolean(data.actionRequired),
    redirectUrl: data.redirectUrl || null
  };
}

/**
 * Parse background task error with JSON translation keys
 * Compatible with existing taskQueue.errors.* pattern
 * @param {string} errorMessage - Error message (may be JSON string)
 * @param {Function} t - Translation function from useLanguage()
 * @returns {string} - Translated error message
 */
export function parseTaskError(errorMessage, t) {
  if (!errorMessage) return t('errors.api.common.serverError');

  // Try to parse as JSON (existing pattern from generateCv.js)
  try {
    const errorData = JSON.parse(errorMessage);
    if (errorData.translationKey) {
      return t(errorData.translationKey, errorData);
    }
  } catch {
    // Not JSON, continue
  }

  // Try direct translation if it looks like a key
  if (typeof errorMessage === 'string' && errorMessage.startsWith('errors.')) {
    const translated = t(errorMessage);
    if (translated !== errorMessage) return translated;
  }

  // Try taskQueue.errors.* pattern (legacy)
  if (typeof errorMessage === 'string' && errorMessage.startsWith('taskQueue.')) {
    const translated = t(errorMessage);
    if (translated !== errorMessage) return translated;
  }

  // Return as-is
  return errorMessage;
}

/**
 * Simple helper to extract error message from fetch response
 * @param {Response} response - Fetch response object
 * @param {Function} t - Translation function from useLanguage()
 * @returns {Promise<string>} - Translated error message
 */
export async function getErrorFromResponse(response, t) {
  try {
    const data = await response.json();
    const { message } = parseApiError(data, t);
    return message;
  } catch {
    return t('errors.api.common.serverError');
  }
}
