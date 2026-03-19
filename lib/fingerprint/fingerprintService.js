import crypto from 'crypto';
import prisma from '@/lib/prisma';

function hashSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Extrait l'IP réelle du client depuis la request.
 * Priorité : cf-connecting-ip (Cloudflare, IP réelle du client) > x-real-ip > x-forwarded-for
 */
function extractIp(request) {
  if (!request) return null;
  return request.headers?.get?.('cf-connecting-ip')
    || request.headers?.get?.('x-real-ip')
    || request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
    || request.ip
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
 * Sauvegarde TOUJOURS un record, même sans signal (pour audit).
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

  console.log(`[Fingerprint] Check pour user ${userId}: visitorId=${hashedVisitorId ? 'oui' : 'non'}, ip=${rawIp || 'non détectée'}`);

  // Chercher un doublon si on a au moins un signal
  let existingFingerprint = null;
  if (hashedVisitorId || hashedIp) {
    const conditions = [];
    if (hashedVisitorId) conditions.push({ visitorId: hashedVisitorId, ...otherUserCondition(userId) });
    if (hashedIp) conditions.push({ ipHash: hashedIp, ...otherUserCondition(userId) });

    existingFingerprint = await prisma.browserFingerprint.findFirst({
      where: { OR: conditions },
      select: { userId: true, visitorId: true, ipHash: true },
    });
  }

  // TOUJOURS sauvegarder le fingerprint (même sans signal, pour audit)
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
    const matchType = hashedVisitorId && existingFingerprint.visitorId === hashedVisitorId ? 'fingerprint' : 'ip';
    console.log(`[Fingerprint] DOUBLON détecté pour user ${userId} via ${matchType} (match avec user ${existingFingerprint.userId || 'supprimé'})`);
    return { isDuplicate: true, matchedUserId: existingFingerprint.userId, matchType };
  }

  if (!hashedVisitorId && !hashedIp) {
    console.log(`[Fingerprint] Aucun signal pour user ${userId} — fail-open`);
    return { isDuplicate: false, reason: 'no_fingerprint_no_ip' };
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

  // Supprimer les anciens records pour ce user (rafraîchir)
  const deleteConditions = [];
  if (hashedVisitorId) deleteConditions.push({ userId, visitorId: hashedVisitorId });
  if (hashedIp) deleteConditions.push({ userId, ipHash: hashedIp });

  if (deleteConditions.length > 0) {
    await prisma.browserFingerprint.deleteMany({
      where: { OR: deleteConditions },
    });
  }

  // Créer un record frais avec IP/fingerprint/date à jour
  await prisma.browserFingerprint.create({
    data: {
      visitorId: hashedVisitorId,
      ipHash: hashedIp,
      userId,
      ipAddress: rawIp,
      userAgent: request?.headers?.get?.('user-agent') || null,
    },
  });

  console.log(`[Fingerprint] Login refresh pour user ${userId}: visitorId=${hashedVisitorId ? 'oui' : 'non'}, ip=${rawIp || 'non détectée'}`);
}
