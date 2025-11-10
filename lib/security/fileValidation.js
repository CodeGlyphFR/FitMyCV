/**
 * Validation sécurisée des fichiers uploadés
 */

// Magic numbers pour les types de fichiers supportés
const FILE_SIGNATURES = {
  pdf: [
    [0x25, 0x50, 0x44, 0x46], // %PDF
  ],
  // Ajouter d'autres types si nécessaire
};

// Taille maximale par type de fichier (en octets)
const MAX_FILE_SIZES = {
  pdf: 10 * 1024 * 1024, // 10 MB
  default: 5 * 1024 * 1024, // 5 MB
};

/**
 * Vérifie le magic number d'un fichier
 * @param {Buffer} buffer - Buffer contenant les premiers octets du fichier
 * @param {string} expectedType - Type MIME attendu
 * @returns {boolean} - true si le magic number correspond
 */
function verifyMagicNumber(buffer, expectedType) {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const type = expectedType.split('/')[1]; // ex: 'application/pdf' -> 'pdf'
  const signatures = FILE_SIGNATURES[type];

  if (!signatures) {
    console.warn(`[fileValidation] Aucune signature définie pour le type ${expectedType}`);
    return false;
  }

  // Vérifier si au moins une signature correspond
  return signatures.some(signature => {
    return signature.every((byte, index) => buffer[index] === byte);
  });
}

/**
 * Valide un fichier uploadé
 * @param {File} file - Fichier à valider (ou objet avec {name, type, arrayBuffer()})
 * @param {Object} options - Options de validation
 * @param {string[]} options.allowedTypes - Types MIME autorisés (ex: ['application/pdf'])
 * @param {number} options.maxSize - Taille maximale en octets (optionnel)
 * @returns {Promise<{valid: boolean, error?: string, buffer?: Buffer}>}
 */
export async function validateUploadedFile(file, options = {}) {
  const { allowedTypes = ['application/pdf'], maxSize = null } = options;

  // Vérification 1 : Présence du fichier
  if (!file) {
    return { valid: false, error: 'Aucun fichier fourni' };
  }

  // Vérification 2 : Nom du fichier
  if (!file.name || typeof file.name !== 'string') {
    return { valid: false, error: 'Nom de fichier invalide' };
  }

  // Vérification 3 : Type MIME déclaré
  if (!file.type || !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Type de fichier non autorisé. Types acceptés : ${allowedTypes.join(', ')}`,
    };
  }

  // Vérification 4 : Taille du fichier
  const maxFileSize = maxSize || MAX_FILE_SIZES[file.type.split('/')[1]] || MAX_FILE_SIZES.default;
  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: `Fichier trop volumineux. Taille maximale : ${Math.round(maxFileSize / 1024 / 1024)} MB`,
    };
  }

  // Vérification 5 : Magic number (lecture des premiers octets)
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!verifyMagicNumber(buffer, file.type)) {
      return {
        valid: false,
        error: 'Le contenu du fichier ne correspond pas au type déclaré',
      };
    }

    return {
      valid: true,
      buffer,
    };
  } catch (error) {
    console.error('[fileValidation] Erreur lors de la lecture du fichier:', error);
    return {
      valid: false,
      error: 'Impossible de lire le fichier',
    };
  }
}

/**
 * Nettoie un nom de fichier pour éviter les injections
 * @param {string} filename - Nom de fichier à nettoyer
 * @returns {string} - Nom de fichier sécurisé
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  // Retirer les caractères dangereux
  let safe = filename
    .replace(/[^a-z0-9._-]/gi, '_') // Remplacer caractères non alphanumériques
    .replace(/\.{2,}/g, '.') // Empêcher les séquences de points (..)
    .replace(/^\.+/, '') // Retirer les points en début
    .slice(0, 255); // Limiter la longueur

  // Si le nom est vide après nettoyage, générer un nom par défaut
  if (!safe) {
    safe = `file_${Date.now()}`;
  }

  return safe;
}

/**
 * Vérifie qu'un chemin ne contient pas de traversal
 * @param {string} filepath - Chemin à vérifier
 * @returns {boolean} - true si le chemin est sûr
 */
export function isPathSafe(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    return false;
  }

  // Interdire les séquences de traversal
  const dangerousPatterns = [
    /\.\./g, // ..
    /~\//g, // ~/
    /\/\//g, // //
    /\\/g, // \
  ];

  return !dangerousPatterns.some(pattern => pattern.test(filepath));
}
