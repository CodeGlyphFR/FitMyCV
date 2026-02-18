/**
 * Data migration: Encrypt existing OAuth tokens (access_token, refresh_token, id_token)
 *
 * Uses AES-256-GCM encryption with NEXTAUTH_SECRET as key.
 * Skips tokens that are already encrypted (contain ':' separator).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  const [iv, authTag] = parts;
  return iv.length === IV_LENGTH * 2 && authTag.length === AUTH_TAG_LENGTH * 2;
}

module.exports = async (prisma) => {
  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { access_token: { not: null } },
        { refresh_token: { not: null } },
        { id_token: { not: null } },
      ],
    },
    select: { id: true, access_token: true, refresh_token: true, id_token: true },
  });

  let encryptedCount = 0;
  let skippedCount = 0;

  for (const account of accounts) {
    const updates = {};

    if (account.access_token && !isEncrypted(account.access_token)) {
      updates.access_token = encrypt(account.access_token);
    }
    if (account.refresh_token && !isEncrypted(account.refresh_token)) {
      updates.refresh_token = encrypt(account.refresh_token);
    }
    if (account.id_token && !isEncrypted(account.id_token)) {
      updates.id_token = encrypt(account.id_token);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.account.update({
        where: { id: account.id },
        data: updates,
      });
      encryptedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log(`  Encrypted tokens for ${encryptedCount} account(s), skipped ${skippedCount} already encrypted.`);
};
