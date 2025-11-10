/**
 * Helper utilities for handling API error responses with actionRequired and redirectUrl
 */

/**
 * Parses an API error response and extracts error details
 * @param {Response} response - The fetch Response object
 * @param {Object} data - The parsed JSON response data
 * @returns {Object} - { message, actionRequired, redirectUrl }
 */
export function parseApiError(response, data) {
  const error = {
    message: data?.error || data?.message || "Une erreur est survenue",
    actionRequired: data?.actionRequired || false,
    redirectUrl: data?.redirectUrl || null,
  };

  return error;
}

/**
 * Formats an error message for display with optional action link
 * @param {string} message - The error message
 * @param {string|null} redirectUrl - Optional redirect URL
 * @param {string} linkText - Text for the action link
 * @returns {Object} - { message, redirectUrl, linkText }
 */
export function formatErrorWithAction(message, redirectUrl, linkText = "Voir les options") {
  return {
    message,
    redirectUrl,
    linkText,
  };
}

/**
 * Checks if an error response requires user action
 * @param {Object} errorData - The parsed error response
 * @returns {boolean}
 */
export function requiresUserAction(errorData) {
  return Boolean(errorData?.actionRequired && errorData?.redirectUrl);
}
