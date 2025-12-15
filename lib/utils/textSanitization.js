/**
 * Text Sanitization Utilities
 *
 * Utilities for cleaning text data before database storage.
 * PostgreSQL doesn't support certain Unicode characters in text/json columns.
 */

/**
 * Removes null bytes (\u0000) from a string or recursively from an object.
 * PostgreSQL doesn't support null bytes in text/json columns.
 *
 * @param {any} input - String, array, object, or primitive to sanitize
 * @returns {any} - Sanitized input with null bytes removed from all strings
 *
 * @example
 * removeNullBytes("hello\u0000world") // "helloworld"
 * removeNullBytes({ name: "test\u0000" }) // { name: "test" }
 */
export function removeNullBytes(input) {
  if (typeof input === 'string') {
    return input.replace(/\u0000/g, '');
  }

  if (Array.isArray(input)) {
    return input.map(removeNullBytes);
  }

  if (input && typeof input === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = removeNullBytes(value);
    }
    return result;
  }

  return input;
}
