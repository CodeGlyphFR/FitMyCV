/**
 * AES-256-GCM encryption for CV JSON fields stored in the database.
 *
 * Uses CV_ENCRYPTION_KEY (derived via SHA-256) as the encryption key.
 * Each value gets a unique random IV ensuring ciphertext uniqueness.
 *
 * Format: v1:iv:authTag:ciphertext (all hex-encoded, prefixed by key version)
 * The "v1" prefix supports future key rotation.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_VERSION = 'v1';

// Cached derived key (module-level singleton)
let _cachedKey = null;

function getEncryptionKey() {
  if (_cachedKey) return _cachedKey;

  let secret = process.env.CV_ENCRYPTION_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[fieldEncryption] FATAL: CV_ENCRYPTION_KEY must be set in production');
    }
    // Dev fallback
    secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error('[fieldEncryption] CV_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set');
    }
    console.warn('[fieldEncryption] WARNING: Using NEXTAUTH_SECRET as fallback — set CV_ENCRYPTION_KEY');
  }

  _cachedKey = crypto.createHash('sha256').update(secret).digest();
  return _cachedKey;
}

/**
 * Check if a value is already encrypted (matches v1:iv:authTag:ciphertext format)
 * @param {*} value
 * @returns {boolean}
 */
export function isEncryptedField(value) {
  if (typeof value !== 'string') return false;
  return /^v\d+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value);
}

/**
 * Encrypt a JS object/array into a versioned encrypted string
 * @param {*} data - Object, array, or any JSON-serializable value
 * @returns {string|null|undefined} Encrypted string or null/undefined passthrough
 */
export function encryptJsonField(data) {
  if (data === null || data === undefined) return data;

  // Already encrypted — idempotent
  if (isEncryptedField(data)) return data;

  const plaintext = JSON.stringify(data);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${KEY_VERSION}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string back to a JS object/array
 * @param {*} encrypted - Encrypted string or legacy unencrypted JSON value
 * @returns {*} Parsed JS value
 */
export function decryptJsonField(encrypted) {
  if (encrypted === null || encrypted === undefined) return encrypted;

  // Not encrypted (legacy object/array from DB) — passthrough
  if (typeof encrypted !== 'string') return encrypted;

  // Check if it matches encrypted format
  if (!isEncryptedField(encrypted)) {
    // Could be a plain JSON string stored in DB — try parsing
    try {
      return JSON.parse(encrypted);
    } catch {
      return encrypted;
    }
  }

  const parts = encrypted.split(':');
  if (parts.length !== 4) {
    throw new Error('[fieldEncryption] Invalid encrypted format — expected v1:iv:authTag:ciphertext');
  }

  const [, ivHex, authTagHex, ciphertext] = parts;

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
