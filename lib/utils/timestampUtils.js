/**
 * Timestamp Utilities
 *
 * Shared helpers for parsing, normalizing, and formatting timestamps
 * used across CV file listing routes.
 */

/**
 * Parse a numeric string as a millisecond timestamp.
 * - 13-digit strings → treated as epoch milliseconds
 * - 14+ digit strings → treated as custom format YYYYMMDDHHmmssSSS
 */
export function parseNumericTimestamp(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  if (str.length === 13) {
    const num = Number(str);
    return Number.isNaN(num) ? null : num;
  }
  if (str.length >= 14) {
    const year = Number(str.slice(0, 4));
    const month = Number(str.slice(4, 6)) - 1;
    const day = Number(str.slice(6, 8));
    const hours = Number(str.slice(8, 10) || '0');
    const minutes = Number(str.slice(10, 12) || '0');
    const seconds = Number(str.slice(12, 14) || '0');
    const millis = Number(str.slice(14, 17) || '0');
    if ([year, month, day, hours, minutes, seconds, millis].some((n) => Number.isNaN(n))) return null;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const ts = Date.UTC(year, month, day, hours, minutes, seconds, millis);
    return Number.isNaN(ts) ? null : ts;
  }
  return null;
}

/**
 * Normalize any value (number, ISO string, numeric string) into a ms timestamp.
 */
export function toTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = parseNumericTimestamp(trimmed);
    if (numeric) return numeric;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Extract a timestamp from a CV filename (e.g. "202401.1.3.000000.json" → ms timestamp).
 */
export function timestampFromFilename(name) {
  if (!name) return null;
  const base = name.replace(/\.json$/i, '');
  return parseNumericTimestamp(base);
}

/**
 * Format a ms timestamp into a human-readable label: dd/MM/yyyy HH:mm
 */
export function formatDateLabel(timestamp) {
  if (timestamp == null) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
