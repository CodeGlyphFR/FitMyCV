/**
 * Migration de données : Chiffrement des contenus CV existants
 *
 * Chiffre les champs JSON sensibles de CvFile et CvVersion avec AES-256-GCM.
 * Skip automatiquement les enregistrements déjà chiffrés (idempotent).
 *
 * Note : Ce script reçoit un PrismaClient brut (sans extension de chiffrement)
 * depuis run-data-migrations.js, donc les opérations ORM fonctionnent normalement.
 *
 * Champs ciblés :
 * - CvFile: content, pendingChanges, jobOfferSnapshot
 * - CvVersion: content
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_VERSION = 'v1';
const BATCH_SIZE = 100;

let _cachedKey = null;

function getEncryptionKey() {
  if (_cachedKey) return _cachedKey;
  const secret = process.env.CV_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('[encrypt_cv_content] CV_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set');
  }
  _cachedKey = crypto.createHash('sha256').update(secret).digest();
  return _cachedKey;
}

function isEncryptedField(value) {
  if (typeof value !== 'string') return false;
  return /^v\d+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(value);
}

function encryptJsonField(data) {
  if (data === null || data === undefined) return data;
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

function needsEncryption(record, fields) {
  for (const field of fields) {
    if (record[field] !== null && record[field] !== undefined && !isEncryptedField(record[field])) {
      return true;
    }
  }
  return false;
}

module.exports = async (prisma) => {
  console.log('[encrypt_cv_content] Starting CV content encryption migration...');

  // --- CvFile ---
  const cvFileFields = ['content', 'pendingChanges', 'jobOfferSnapshot'];
  const totalCvFiles = await prisma.cvFile.count();
  console.log(`[encrypt_cv_content] CvFile: ${totalCvFiles} records to process`);

  let processedFiles = 0;
  let encryptedFiles = 0;
  let cursor = undefined;

  while (true) {
    const batch = await prisma.cvFile.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, content: true, pendingChanges: true, jobOfferSnapshot: true },
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      if (needsEncryption(record, cvFileFields)) {
        const data = {};
        for (const field of cvFileFields) {
          if (record[field] !== null && record[field] !== undefined && !isEncryptedField(record[field])) {
            data[field] = encryptJsonField(record[field]);
          }
        }
        // Le PrismaClient brut (sans extension) gère la sérialisation
        // d'une string JS vers un JSON string literal en JSONB
        await prisma.cvFile.update({
          where: { id: record.id },
          data,
        });
        encryptedFiles++;
      }
      processedFiles++;
    }

    cursor = batch[batch.length - 1].id;
    console.log(`[encrypt_cv_content] CvFile: ${processedFiles}/${totalCvFiles} processed, ${encryptedFiles} encrypted`);
  }

  // --- CvVersion ---
  const totalVersions = await prisma.cvVersion.count();
  console.log(`[encrypt_cv_content] CvVersion: ${totalVersions} records to process`);

  let processedVersions = 0;
  let encryptedVersions = 0;
  cursor = undefined;

  while (true) {
    const batch = await prisma.cvVersion.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor ? { cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, content: true },
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      if (record.content !== null && record.content !== undefined && !isEncryptedField(record.content)) {
        await prisma.cvVersion.update({
          where: { id: record.id },
          data: { content: encryptJsonField(record.content) },
        });
        encryptedVersions++;
      }
      processedVersions++;
    }

    cursor = batch[batch.length - 1].id;
    console.log(`[encrypt_cv_content] CvVersion: ${processedVersions}/${totalVersions} processed, ${encryptedVersions} encrypted`);
  }

  console.log(`[encrypt_cv_content] Migration complete!`);
  console.log(`[encrypt_cv_content] CvFile: ${encryptedFiles}/${totalCvFiles} encrypted`);
  console.log(`[encrypt_cv_content] CvVersion: ${encryptedVersions}/${totalVersions} encrypted`);
};
