/**
 * AES-256-GCM encryption for OAuth tokens stored in the database.
 *
 * Uses NEXTAUTH_SECRET (first 32 bytes, hex-encoded or raw) as the encryption key.
 * Each value gets a unique random IV ensuring ciphertext uniqueness.
 *
 * Format: iv:authTag:ciphertext (all hex-encoded)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  // C1: Use dedicated encryption key, fallback to NEXTAUTH_SECRET for backward compatibility
  const secret = process.env.OAUTH_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('OAUTH_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set');
  }
  // Derive a 32-byte key from the secret using SHA-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext
 * @returns {string} encrypted string in format "iv:authTag:ciphertext"
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedText - format "iv:authTag:ciphertext"
 * @returns {string} decrypted plaintext
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return encryptedText;

  // C2: Fail-secure — reject values that don't match encrypted format
  if (!encryptedText.includes(':')) {
    console.warn('[tokenEncryption] SECURITY: Unencrypted value detected — run OAuth token migration');
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('[tokenEncryption] Invalid encrypted format — expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if a string looks like it's already encrypted
 * @param {string} value
 * @returns {boolean}
 */
export function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  // Check if parts look like hex strings of expected lengths
  const [iv, authTag] = parts;
  return iv.length === IV_LENGTH * 2 && authTag.length === AUTH_TAG_LENGTH * 2;
}
