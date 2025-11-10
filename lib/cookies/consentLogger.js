/**
 * Logger pour l'audit des consentements cookies (RGPD)
 * Enregistre tous les changements de consentement en base de données
 */

import prisma from '@/lib/prisma';

/**
 * Enregistre un changement de consentement en base de données
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {string} action - Type d'action: "created", "updated", "revoked"
 * @param {object} preferences - Préférences de consentement { necessary, functional, analytics, marketing }
 * @param {object} request - Objet Request Next.js (pour IP et userAgent)
 * @returns {Promise<object|null>} Le log créé ou null en cas d'erreur
 */
export async function logConsent(userId, action, preferences, request = null) {
  if (!userId) {
    console.warn('[ConsentLogger] userId manquant, log ignoré');
    return null;
  }

  try {
    // Extraire IP et userAgent de la requête
    let ip = null;
    let userAgent = null;

    if (request) {
      // Récupérer l'IP (gérer les proxies)
      ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

      // Récupérer le userAgent
      userAgent = request.headers.get('user-agent') || 'unknown';
    }

    // Créer le log en base
    const log = await prisma.consentLog.create({
      data: {
        userId,
        action,
        preferences: JSON.stringify(preferences),
        ip,
        userAgent,
      },
    });

    console.log(`[ConsentLogger] Consent logged: ${action} for user ${userId}`);
    return log;
  } catch (error) {
    // Ne pas bloquer l'utilisateur en cas d'erreur de logging
    console.error('[ConsentLogger] Erreur lors de l\'enregistrement du consentement:', error);
    return null;
  }
}

/**
 * Récupère l'historique des consentements d'un utilisateur
 *
 * @param {string} userId - ID de l'utilisateur
 * @param {number} limit - Nombre maximum de logs à récupérer (défaut: 50)
 * @returns {Promise<array>} Liste des logs de consentement
 */
export async function getConsentHistory(userId, limit = 50) {
  if (!userId) {
    return [];
  }

  try {
    const logs = await prisma.consentLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Parser les préférences JSON
    return logs.map(log => ({
      ...log,
      preferences: JSON.parse(log.preferences),
    }));
  } catch (error) {
    console.error('[ConsentLogger] Erreur lors de la récupération de l\'historique:', error);
    return [];
  }
}

/**
 * Supprime les logs de consentement plus anciens qu'une date donnée
 * Utile pour nettoyer les anciens logs (RGPD - minimisation des données)
 *
 * @param {Date} beforeDate - Date avant laquelle supprimer les logs
 * @returns {Promise<number>} Nombre de logs supprimés
 */
export async function cleanOldConsentLogs(beforeDate) {
  try {
    const result = await prisma.consentLog.deleteMany({
      where: {
        createdAt: {
          lt: beforeDate,
        },
      },
    });

    console.log(`[ConsentLogger] ${result.count} anciens logs de consentement supprimés`);
    return result.count;
  } catch (error) {
    console.error('[ConsentLogger] Erreur lors du nettoyage des logs:', error);
    return 0;
  }
}
