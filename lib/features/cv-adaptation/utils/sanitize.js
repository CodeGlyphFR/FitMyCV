/**
 * Utilitaires de sanitization pour le pipeline CV v2
 */

/**
 * Nettoie un objet JSON pour supprimer les caracteres \u0000 non supportes par PostgreSQL
 * @param {any} obj - Objet a nettoyer
 * @returns {any} - Objet nettoye
 */
export function sanitizeForPostgres(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return obj.replace(/\u0000/g, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForPostgres);
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = sanitizeForPostgres(value);
    }
    return cleaned;
  }
  return obj;
}
