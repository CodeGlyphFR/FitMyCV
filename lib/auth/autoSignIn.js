/**
 * Service de gestion des tokens de connexion automatique
 * Utilisé après validation d'email pour connecter automatiquement l'utilisateur
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import logger from '@/lib/security/secureLogger';

/**
 * Génère un token de connexion automatique sécurisé
 * @returns {string} - Token unique
 */
function generateAutoSignInToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Crée un token de connexion automatique dans la base de données
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string>} - Token généré
 */
export async function createAutoSignInToken(userId) {
  // Supprimer les anciens tokens de l'utilisateur
  await prisma.autoSignInToken.deleteMany({
    where: { userId },
  });

  // Générer un nouveau token
  const token = generateAutoSignInToken();
  const expires = new Date();
  expires.setMinutes(expires.getMinutes() + 5); // Expire dans 5 minutes

  // Sauvegarder en base
  await prisma.autoSignInToken.create({
    data: {
      userId,
      token,
      expires,
    },
  });

  logger.context('autoSignIn', 'info', `Token de connexion automatique créé pour user ${userId}`);
  return token;
}

/**
 * Vérifie un token de connexion automatique
 * @param {string} token - Token à vérifier
 * @returns {Promise<{valid: boolean, userId?: string, error?: string}>}
 */
export async function verifyAutoSignInToken(token) {
  if (!token) {
    return { valid: false, error: 'Token manquant' };
  }

  const record = await prisma.autoSignInToken.findUnique({
    where: { token },
  });

  if (!record) {
    logger.context('autoSignIn', 'warn', 'Token invalide ou déjà utilisé');
    return { valid: false, error: 'Token invalide' };
  }

  // Vérifier l'expiration
  if (record.expires < new Date()) {
    // Token expiré, le supprimer
    await prisma.autoSignInToken.delete({
      where: { token },
    });
    logger.context('autoSignIn', 'warn', `Token expiré pour user ${record.userId}`);
    return { valid: false, error: 'Token expiré' };
  }

  logger.context('autoSignIn', 'info', `Token validé pour user ${record.userId}`);
  return { valid: true, userId: record.userId };
}

/**
 * Supprime un token de connexion automatique après utilisation
 * @param {string} token - Token à supprimer
 */
export async function deleteAutoSignInToken(token) {
  await prisma.autoSignInToken.deleteMany({
    where: { token },
  });
  logger.context('autoSignIn', 'info', 'Token de connexion automatique supprimé');
}

/**
 * Nettoie les tokens expirés (tâche de maintenance)
 */
export async function cleanupExpiredAutoSignInTokens() {
  const result = await prisma.autoSignInToken.deleteMany({
    where: {
      expires: {
        lt: new Date(),
      },
    },
  });
  logger.context('autoSignIn', 'info', `${result.count} tokens expirés supprimés`);
  return result.count;
}
