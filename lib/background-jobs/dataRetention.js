/**
 * Jobs de rétention des données (RGPD)
 * Nettoie les données selon la politique de confidentialité
 */

import prisma from '@/lib/prisma';
import { deleteUserCompletely } from '@/lib/admin/userManagement';
import { sendInactivityWarningEmail } from '@/lib/email/emailService';
import logger from '@/lib/security/secureLogger';

const LOG_PREFIX = '[dataRetention]';

/**
 * Supprime les logs d'emails de plus de 12 mois
 * @returns {Promise<{success: boolean, count: number}>}
 */
export async function cleanupEmailLogs() {
  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const result = await prisma.emailLog.deleteMany({
      where: {
        createdAt: { lt: twelveMonthsAgo },
      },
    });

    console.log(`${LOG_PREFIX} ${result.count} logs d'emails supprimés (> 12 mois)`);
    return { success: true, count: result.count };
  } catch (error) {
    console.error(`${LOG_PREFIX} Erreur cleanup EmailLog:`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Supprime les logs de consentement cookies de plus de 6 mois
 * @returns {Promise<{success: boolean, count: number}>}
 */
export async function cleanupConsentLogs() {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await prisma.consentLog.deleteMany({
      where: {
        createdAt: { lt: sixMonthsAgo },
      },
    });

    console.log(`${LOG_PREFIX} ${result.count} logs de consentement supprimés (> 6 mois)`);
    return { success: true, count: result.count };
  } catch (error) {
    console.error(`${LOG_PREFIX} Erreur cleanup ConsentLog:`, error);
    return { success: false, count: 0, error: error.message };
  }
}

/**
 * Envoie un email d'avertissement aux comptes inactifs depuis 2 ans et 11 mois
 * (30 jours avant suppression)
 * @returns {Promise<{success: boolean, notified: number}>}
 */
export async function notifyInactiveAccounts() {
  try {
    // Calculer la date limite : 2 ans et 11 mois d'inactivité
    const warningThreshold = new Date();
    warningThreshold.setMonth(warningThreshold.getMonth() - 35); // 35 mois = 2 ans et 11 mois

    // Calculer la date limite pour ne pas re-notifier ceux déjà notifiés
    // On ne notifie que ceux qui sont entre 35 et 36 mois d'inactivité
    const alreadyNotifiedThreshold = new Date();
    alreadyNotifiedThreshold.setMonth(alreadyNotifiedThreshold.getMonth() - 36);

    // Trouver les comptes inactifs à notifier
    const inactiveUsers = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' }, // Ne jamais supprimer les admins
        OR: [
          // Cas 1: lastLoginAt existe et est dans la fenêtre de notification
          {
            lastLoginAt: {
              lt: warningThreshold,
              gte: alreadyNotifiedThreshold,
            },
          },
          // Cas 2: lastLoginAt n'existe pas, utiliser createdAt
          {
            lastLoginAt: null,
            createdAt: {
              lt: warningThreshold,
              gte: alreadyNotifiedThreshold,
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    let notifiedCount = 0;

    for (const user of inactiveUsers) {
      if (!user.email) continue;

      try {
        await sendInactivityWarningEmail({
          email: user.email,
          name: user.name,
          userId: user.id,
          lastActivity: user.lastLoginAt || user.createdAt,
        });
        notifiedCount++;
        logger.context('dataRetention', 'info', `Email d'avertissement envoyé à user ${user.id}`);
      } catch (emailError) {
        logger.context('dataRetention', 'error', `Erreur envoi email à user ${user.id}: ${emailError.message}`);
      }
    }

    console.log(`${LOG_PREFIX} ${notifiedCount}/${inactiveUsers.length} utilisateurs notifiés`);
    return { success: true, notified: notifiedCount, total: inactiveUsers.length };
  } catch (error) {
    console.error(`${LOG_PREFIX} Erreur notification comptes inactifs:`, error);
    return { success: false, notified: 0, error: error.message };
  }
}

/**
 * Supprime les comptes inactifs depuis plus de 3 ans
 * @returns {Promise<{success: boolean, deleted: number}>}
 */
export async function cleanupInactiveAccounts() {
  try {
    // Calculer la date limite : 3 ans d'inactivité
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    // Trouver les comptes inactifs à supprimer
    const inactiveUsers = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' }, // Ne jamais supprimer les admins
        OR: [
          // Cas 1: lastLoginAt existe et > 3 ans
          {
            lastLoginAt: { lt: threeYearsAgo },
          },
          // Cas 2: lastLoginAt n'existe pas, utiliser createdAt
          {
            lastLoginAt: null,
            createdAt: { lt: threeYearsAgo },
          },
        ],
      },
      select: {
        id: true,
        email: true,
      },
    });

    let deletedCount = 0;

    for (const user of inactiveUsers) {
      try {
        const result = await deleteUserCompletely(user.id);
        if (result.success) {
          deletedCount++;
          logger.context('dataRetention', 'info', `Compte inactif supprimé: user ${user.id}`);
        } else {
          logger.context('dataRetention', 'error', `Échec suppression user ${user.id}: ${result.error}`);
        }
      } catch (deleteError) {
        logger.context('dataRetention', 'error', `Erreur suppression user ${user.id}: ${deleteError.message}`);
      }
    }

    console.log(`${LOG_PREFIX} ${deletedCount}/${inactiveUsers.length} comptes inactifs supprimés`);
    return { success: true, deleted: deletedCount, total: inactiveUsers.length };
  } catch (error) {
    console.error(`${LOG_PREFIX} Erreur cleanup comptes inactifs:`, error);
    return { success: false, deleted: 0, error: error.message };
  }
}

/**
 * Exécute tous les jobs de rétention des données
 * @returns {Promise<object>} Résumé de toutes les opérations
 */
export async function runAllDataRetentionJobs() {
  console.log(`${LOG_PREFIX} === Début des jobs de rétention des données ===`);
  const startTime = Date.now();

  const results = {
    emailLogs: await cleanupEmailLogs(),
    consentLogs: await cleanupConsentLogs(),
    inactiveNotifications: await notifyInactiveAccounts(),
    inactiveAccounts: await cleanupInactiveAccounts(),
  };

  const duration = Date.now() - startTime;
  console.log(`${LOG_PREFIX} === Jobs terminés en ${duration}ms ===`);

  return {
    success: true,
    duration,
    results,
  };
}
