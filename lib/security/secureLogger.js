/**
 * Logger sécurisé qui masque automatiquement les données sensibles
 * Utiliser à la place de console.log pour éviter d'exposer des informations sensibles
 */

import crypto from 'crypto';

// Patterns à masquer
const SENSITIVE_PATTERNS = {
  email: /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  apiKey: /(sk-[a-zA-Z0-9-_]{20,}|sk-proj-[a-zA-Z0-9-_]{20,}|sk-ant-[a-zA-Z0-9-_]{20,})/g,
  token: /bearer\s+[a-zA-Z0-9-_.]+/gi,
  password: /"password"\s*:\s*"[^"]+"/g,
  authToken: /"token"\s*:\s*"[^"]+"/g,
};

/**
 * Génère un hash court et opaque pour les IDs utilisateur
 * @param {string} userId - ID utilisateur à masquer
 * @returns {string} - Hash opaque (ex: "usr_a1b2c3")
 */
function hashUserId(userId) {
  if (!userId || typeof userId !== 'string') return 'usr_unknown';

  const hash = crypto
    .createHash('sha256')
    .update(userId)
    .digest('hex')
    .substring(0, 6);

  return `usr_${hash}`;
}

/**
 * Masque un email partiellement
 * @param {string} email - Email à masquer
 * @returns {string} - Email masqué (ex: "j***@domain.com")
 */
function maskEmail(email) {
  return email.replace(SENSITIVE_PATTERNS.email, (match, username, domain) => {
    if (username.length <= 2) {
      return `${username[0]}***@${domain}`;
    }
    return `${username[0]}***${username[username.length - 1]}@${domain}`;
  });
}

/**
 * Masque les données sensibles dans un objet
 * @param {any} data - Données à nettoyer
 * @returns {any} - Données nettoyées
 */
function sanitizeData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let sanitized = data;

    // Masquer les emails
    sanitized = maskEmail(sanitized);

    // Masquer les clés API
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.apiKey, '[API_KEY_HIDDEN]');

    // Masquer les tokens Bearer
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.token, 'bearer [TOKEN_HIDDEN]');

    // Masquer les mots de passe dans les JSON
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.password, '"password":"[HIDDEN]"');

    // Masquer les tokens dans les JSON
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.authToken, '"token":"[HIDDEN]"');

    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const sanitized = {};

    for (const [key, value] of Object.entries(data)) {
      // Masquer complètement certaines clés sensibles
      if (['password', 'token', 'apiKey', 'secret', 'passwordHash'].includes(key)) {
        sanitized[key] = '[HIDDEN]';
        continue;
      }

      // Masquer les userId
      if (key === 'userId' || key === 'id' && typeof value === 'string' && value.startsWith('c')) {
        sanitized[key] = hashUserId(value);
        continue;
      }

      // Masquer les emails
      if (key === 'email' && typeof value === 'string') {
        sanitized[key] = maskEmail(value);
        continue;
      }

      // Récursif pour les objets imbriqués
      sanitized[key] = sanitizeData(value);
    }

    return sanitized;
  }

  return data;
}

/**
 * Logger sécurisé - équivalent de console.log
 * @param {...any} args - Arguments à logger
 */
export function secureLog(...args) {
  const sanitized = args.map(arg => sanitizeData(arg));
  console.log(...sanitized);
}

/**
 * Logger sécurisé - équivalent de console.warn
 * @param {...any} args - Arguments à logger
 */
export function secureWarn(...args) {
  const sanitized = args.map(arg => sanitizeData(arg));
  console.warn(...sanitized);
}

/**
 * Logger sécurisé - équivalent de console.error
 * @param {...any} args - Arguments à logger
 */
export function secureError(...args) {
  const sanitized = args.map(arg => sanitizeData(arg));
  console.error(...sanitized);
}

/**
 * Logger sécurisé - équivalent de console.info
 * @param {...any} args - Arguments à logger
 */
export function secureInfo(...args) {
  const sanitized = args.map(arg => sanitizeData(arg));
  console.info(...sanitized);
}

/**
 * Logger avec contexte - ajoute un préfixe et sanitize
 * @param {string} context - Contexte du log (ex: "[auth]")
 * @param {string} level - Niveau: "log", "warn", "error", "info"
 * @param {...any} args - Arguments à logger
 */
export function logWithContext(context, level = 'log', ...args) {
  const sanitized = args.map(arg => sanitizeData(arg));
  const prefix = `[${context}]`;

  switch (level) {
    case 'warn':
      console.warn(prefix, ...sanitized);
      break;
    case 'error':
      console.error(prefix, ...sanitized);
      break;
    case 'info':
      console.info(prefix, ...sanitized);
      break;
    default:
      console.log(prefix, ...sanitized);
  }
}

// Exports par défaut
export default {
  log: secureLog,
  warn: secureWarn,
  error: secureError,
  info: secureInfo,
  context: logWithContext,
  sanitize: sanitizeData,
  hashUserId,
  maskEmail,
};
