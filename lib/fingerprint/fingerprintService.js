import crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Vérifie si un fingerprint navigateur a déjà été utilisé par un autre compte
 * et sauvegarde le fingerprint pour le nouvel utilisateur.
 *
 * @param {string} userId - ID de l'utilisateur courant
 * @param {string|null} rawVisitorId - visitorId brut de FingerprintJS
 * @param {Request|null} request - Request HTTP (pour IP et User-Agent)
 * @returns {Promise<{isDuplicate: boolean, reason?: string, matchedUserId?: string}>}
 */
export async function checkAndSaveFingerprint(userId, rawVisitorId, request) {
  if (!rawVisitorId) {
    return { isDuplicate: false, reason: 'no_fingerprint' };
  }

  // Hasher le visitorId avec SHA-256
  const hashedVisitorId = crypto.createHash('sha256').update(rawVisitorId).digest('hex');

  // Extraire IP et User-Agent depuis la request
  let ipAddress = null;
  let userAgent = null;
  if (request) {
    ipAddress = request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers?.get?.('x-real-ip')
      || null;
    userAgent = request.headers?.get?.('user-agent') || null;
  }

  // Chercher un fingerprint existant pour un AUTRE utilisateur
  const existingFingerprint = await prisma.browserFingerprint.findFirst({
    where: {
      visitorId: hashedVisitorId,
      userId: { not: userId },
    },
    select: { userId: true },
  });

  // Sauvegarder le fingerprint pour cet utilisateur
  await prisma.browserFingerprint.create({
    data: {
      visitorId: hashedVisitorId,
      userId,
      ipAddress,
      userAgent,
    },
  });

  if (existingFingerprint) {
    console.log(`[Fingerprint] Doublon détecté pour user ${userId} (match avec user ${existingFingerprint.userId})`);
    return { isDuplicate: true, matchedUserId: existingFingerprint.userId };
  }

  return { isDuplicate: false };
}
