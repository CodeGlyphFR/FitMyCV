/**
 * Politique de mots de passe sécurisée
 * Valide la force des mots de passe et peut vérifier contre des listes de mots de passe compromis
 */

// Configuration de la politique
const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxLength: 128, // Limite pour éviter les DoS
};

// Liste de mots de passe courants à interdire
const COMMON_PASSWORDS = new Set([
  'password', 'password123', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon', 'baseball',
  'iloveyou', 'master', 'sunshine', 'ashley', 'bailey', 'passw0rd',
  'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael',
  'football', 'password1', 'welcome', 'ninja', 'admin', 'admin123',
]);

/**
 * Valide un mot de passe selon la politique de sécurité
 * @param {string} password - Mot de passe à valider
 * @returns {{valid: boolean, errors: string[], strength: string}}
 */
export function validatePassword(password) {
  const errors = [];
  let strength = 'weak';

  // Vérifier que le mot de passe existe
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Mot de passe requis'],
      strength: 'invalid',
    };
  }

  // Vérifier la longueur minimale
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Le mot de passe doit contenir au moins ${PASSWORD_POLICY.minLength} caractères`);
  }

  // Vérifier la longueur maximale (prévention DoS)
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Le mot de passe ne peut pas dépasser ${PASSWORD_POLICY.maxLength} caractères`);
  }

  // Vérifier la présence de majuscules
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }

  // Vérifier la présence de minuscules
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }

  // Vérifier la présence de chiffres
  if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }

  // Vérifier la présence de caractères spéciaux
  if (PASSWORD_POLICY.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\';/~`]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...)');
  }

  // Vérifier contre les mots de passe courants
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Ce mot de passe est trop courant et facilement devinable');
  }

  // Vérifier les patterns faibles (séquences, répétitions)
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Le mot de passe ne doit pas contenir de caractères répétés 3 fois de suite');
  }

  if (/(?:abc|bcd|cde|def|012|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('Le mot de passe ne doit pas contenir de séquences évidentes');
  }

  // Calculer la force du mot de passe
  if (errors.length === 0) {
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\';/~`]/.test(password);
    const length = password.length;

    const criteria = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length;

    if (length >= 16 && criteria >= 4) {
      strength = 'very_strong';
    } else if (length >= 14 && criteria >= 3) {
      strength = 'strong';
    } else if (length >= 12 && criteria >= 3) {
      strength = 'medium';
    } else {
      strength = 'weak';
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Vérifie si un mot de passe a été compromis via l'API Have I Been Pwned
 * NOTE: Cette fonction fait un appel réseau externe. À utiliser avec parcimonie.
 * Pour la prod, envisager un cache ou une vérification asynchrone.
 * @param {string} password - Mot de passe à vérifier
 * @returns {Promise<boolean>} - true si le mot de passe est compromis
 */
export async function isPasswordPwned(password) {
  try {
    const crypto = await import('crypto');
    const sha1 = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    // API Have I Been Pwned utilise k-anonymity
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'CV-Builder-Security-Check',
      },
      timeout: 5000, // Timeout de 5 secondes
    });

    if (!response.ok) {
      console.warn('[passwordPolicy] Impossible de vérifier via Have I Been Pwned');
      return false; // En cas d'erreur, on ne bloque pas l'utilisateur
    }

    const text = await response.text();
    const hashes = text.split('\r\n');

    // Chercher notre suffix dans la liste
    for (const line of hashes) {
      const [hashSuffix, count] = line.split(':');
      if (hashSuffix === suffix) {
        console.warn(`[passwordPolicy] Mot de passe trouvé dans ${count} fuites de données`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('[passwordPolicy] Erreur lors de la vérification Have I Been Pwned:', error);
    // En cas d'erreur, on ne bloque pas l'utilisateur
    return false;
  }
}

/**
 * Génère un mot de passe aléatoire sécurisé
 * @param {number} length - Longueur souhaitée (par défaut: 16)
 * @returns {string} - Mot de passe généré
 */
export function generateSecurePassword(length = 16) {
  const crypto = require('crypto');
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = uppercase + lowercase + numbers + special;

  let password = '';

  // Garantir au moins un de chaque type
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += special[crypto.randomInt(0, special.length)];

  // Compléter avec des caractères aléatoires
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(0, all.length)];
  }

  // Mélanger le mot de passe
  return password.split('').sort(() => crypto.randomInt(-1, 2)).join('');
}

/**
 * Obtient la configuration actuelle de la politique de mot de passe
 * @returns {Object} - Configuration de la politique
 */
export function getPasswordPolicy() {
  return { ...PASSWORD_POLICY };
}
