import crypto from 'crypto';
import prisma from '@/lib/prisma';

function hashSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function extractIp(request) {
  if (!request) return null;
  return request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers?.get?.('x-real-ip')
    || null;
}

/**
 * Condition Prisma "appartient à un AUTRE utilisateur (ou compte supprimé)"
 */
function otherUserCondition(userId) {
  return { OR: [{ userId: { not: userId } }, { userId: null }] };
}

/**
 * Vérifie si un fingerprint navigateur OU une IP a déjà été utilisé par un autre compte
 * et sauvegarde les données pour le nouvel utilisateur.
 *
 * Doublon si : même visitorId OU même IP → 0 crédits de bienvenue.
 *
 * @param {string} userId - ID de l'utilisateur courant
 * @param {string|null} rawVisitorId - visitorId brut de FingerprintJS
 * @param {Request|null} request - Request HTTP (pour IP et User-Agent)
 * @returns {Promise<{isDuplicate: boolean, reason?: string, matchedUserId?: string}>}
 */
export async function checkAndSaveFingerprint(userId, rawVisitorId, request) {
  const rawIp = extractIp(request);
  const hashedVisitorId = rawVisitorId ? hashSha256(rawVisitorId) : null;
  const hashedIp = rawIp ? hashSha256(rawIp) : null;

  // Si aucun signal disponible → fail-open
  if (!hashedVisitorId && !hashedIp) {
    return { isDuplicate: false, reason: 'no_fingerprint_no_ip' };
  }

  // Chercher un doublon : même visitorId OU même IP chez un autre utilisateur
  const conditions = [];
  if (hashedVisitorId) conditions.push({ visitorId: hashedVisitorId, ...otherUserCondition(userId) });
  if (hashedIp) conditions.push({ ipHash: hashedIp, ...otherUserCondition(userId) });

  const existingFingerprint = await prisma.browserFingerprint.findFirst({
    where: { OR: conditions },
    select: { userId: true, visitorId: true, ipHash: true },
  });

  // Sauvegarder le fingerprint pour cet utilisateur
  await prisma.browserFingerprint.create({
    data: {
      visitorId: hashedVisitorId,
      ipHash: hashedIp,
      userId,
      ipAddress: rawIp,
      userAgent: request?.headers?.get?.('user-agent') || null,
    },
  });

  if (existingFingerprint) {
    const matchType = existingFingerprint.visitorId === hashedVisitorId ? 'fingerprint' : 'ip';
    console.log(`[Fingerprint] Doublon détecté pour user ${userId} via ${matchType} (match avec user ${existingFingerprint.userId || 'supprimé'})`);
    return { isDuplicate: true, matchedUserId: existingFingerprint.userId, matchType };
  }

  return { isDuplicate: false };
}

/**
 * Sauvegarde/rafraîchit le fingerprint d'un utilisateur existant au login.
 * Ne vérifie pas les doublons — sert uniquement à peupler la base.
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string|null} rawVisitorId - visitorId brut de FingerprintJS
 * @param {Request|null} request - Request HTTP (pour IP)
 */
export async function saveLoginFingerprint(userId, rawVisitorId, request) {
  const rawIp = extractIp(request);
  const hashedVisitorId = rawVisitorId ? hashSha256(rawVisitorId) : null;
  const hashedIp = rawIp ? hashSha256(rawIp) : null;

  if (!hashedVisitorId && !hashedIp) return;

  // Supprimer l'ancien record pour ce user+visitorId (rafraîchir)
  if (hashedVisitorId) {
    await prisma.browserFingerprint.deleteMany({
      where: { userId, visitorId: hashedVisitorId },
    });
  }

  // Créer un record frais avec IP/date à jour
  await prisma.browserFingerprint.create({
    data: {
      visitorId: hashedVisitorId,
      ipHash: hashedIp,
      userId,
      ipAddress: rawIp,
      userAgent: request?.headers?.get?.('user-agent') || null,
    },
  });
}
