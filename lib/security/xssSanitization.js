/**
 * Protection contre les attaques XSS
 * Sanitization des inputs utilisateur avant stockage et affichage
 */

/**
 * Liste des balises HTML autorisées (whitelist)
 * Pour un éditeur de CV, on peut autoriser quelques balises de mise en forme de base
 */
const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li'];

/**
 * Attributs HTML autorisés
 */
const ALLOWED_ATTRIBUTES = {};

/**
 * Échappe les caractères HTML dangereux
 * @param {string} str - Chaîne à échapper
 * @returns {string} - Chaîne échappée
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';

  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, char => htmlEscapes[char]);
}

/**
 * Nettoie une chaîne en supprimant tous les tags HTML
 * @param {string} str - Chaîne à nettoyer
 * @returns {string} - Chaîne sans HTML
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return '';

  // Supprimer les balises HTML
  return str
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Scripts
    .replace(/<style[^>]*>.*?<\/style>/gi, '') // Styles
    .replace(/<[^>]+>/g, '') // Toutes les autres balises
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Sanitize une chaîne en autorisant uniquement certaines balises HTML
 * ATTENTION: Cette fonction est basique. Pour un usage en production,
 * utilisez une bibliothèque comme DOMPurify ou sanitize-html
 * @param {string} html - HTML à sanitizer
 * @returns {string} - HTML sanitizé
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';

  // Supprimer les scripts et styles
  let clean = html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Supprime les event handlers (onclick, onload, etc.)
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Pour une meilleure sécurité, supprimer tous les attributs sauf ceux autorisés
  clean = clean.replace(/<(\w+)([^>]*)>/g, (match, tag, attrs) => {
    if (ALLOWED_TAGS.includes(tag.toLowerCase())) {
      // Pour l'instant, on ne garde aucun attribut pour plus de sécurité
      return `<${tag}>`;
    }
    // Tag non autorisé, le supprimer complètement
    return '';
  });

  return clean;
}

/**
 * Sanitize un objet récursivement (pour les données JSON)
 * @param {any} obj - Objet à sanitizer
 * @param {Object} options - Options de sanitization
 * @param {boolean} options.stripHtml - Si true, supprime tout le HTML (par défaut: false)
 * @param {boolean} options.escapeHtml - Si true, échappe le HTML (par défaut: false)
 * @returns {any} - Objet sanitizé
 */
export function sanitizeObject(obj, options = {}) {
  const { stripHtml: shouldStripHtml = false, escapeHtml: shouldEscapeHtml = false } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    if (shouldStripHtml) {
      return stripHtml(obj);
    }
    if (shouldEscapeHtml) {
      return escapeHtml(obj);
    }
    // Par défaut, sanitizer le HTML en gardant quelques balises
    return sanitizeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitizer aussi les clés d'objet
      const cleanKey = stripHtml(key);
      sanitized[cleanKey] = sanitizeObject(value, options);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize spécifiquement pour les données de CV
 * Les CVs contiennent du texte libre qui ne devrait pas avoir de HTML
 * @param {Object} cvData - Données du CV
 * @returns {Object} - CV sanitizé
 */
export function sanitizeCvData(cvData) {
  // Pour les CVs, on supprime tout le HTML car ce sont des données structurées
  // et non du contenu HTML
  return sanitizeObject(cvData, { stripHtml: true });
}

/**
 * Valide et sanitize une URL
 * @param {string} url - URL à valider
 * @param {string[]} allowedProtocols - Protocoles autorisés (par défaut: ['http:', 'https:'])
 * @returns {string|null} - URL sanitizée ou null si invalide
 */
export function sanitizeUrl(url, allowedProtocols = ['http:', 'https:']) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);

    // Vérifier le protocole
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn(`[sanitizeUrl] Protocole non autorisé: ${parsed.protocol}`);
      return null;
    }

    // Interdire les URLs javascript:, data:, etc.
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:' || parsed.protocol === 'vbscript:') {
      console.warn(`[sanitizeUrl] Protocole dangereux bloqué: ${parsed.protocol}`);
      return null;
    }

    return parsed.toString();
  } catch (error) {
    console.warn(`[sanitizeUrl] URL invalide: ${url}`);
    return null;
  }
}

/**
 * Sanitize une adresse email
 * @param {string} email - Email à valider
 * @returns {string|null} - Email sanitizé ou null si invalide
 */
export function sanitizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }

  // Nettoyer l'email
  const cleaned = email.toLowerCase().trim();

  // Validation basique
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(cleaned)) {
    return null;
  }

  // Vérifier qu'il n'y a pas de caractères dangereux
  if (cleaned.includes('<') || cleaned.includes('>') || cleaned.includes('"')) {
    return null;
  }

  return cleaned;
}
