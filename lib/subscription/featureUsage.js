/**
 * Système de gestion des limites de features et compteurs mensuels
 *
 * Fonctions principales :
 * - canUseFeature() : Vérifie si l'utilisateur peut utiliser une feature
 * - incrementFeatureCounter() : Incrémente le compteur (débite crédit si nécessaire)
 * - refundFeatureUsage() : Rembourse un usage suite à échec task
 * - resetExpiredCounters() : Reset mensuel des compteurs
 */

import prisma from '@/lib/prisma';
import { getCreditBalance, debitCredit, refundCredit } from './credits';
import dbEmitter from '@/lib/events/dbEmitter';

/**
 * Récupère l'abonnement actuel de l'utilisateur avec les limites de features
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{subscription: object, plan: object} | null>}
 */
async function getUserSubscriptionWithPlan(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: {
      plan: {
        include: {
          featureLimits: true,
        },
      },
    },
  });

  return subscription;
}

/**
 * Récupère ou crée le compteur mensuel d'une feature
 * @param {string} userId - ID de l'utilisateur
 * @param {string} featureName - Nom de la feature
 * @param {Date} periodStart - Début de la période
 * @param {Date} periodEnd - Fin de la période
 * @returns {Promise<object>}
 */
async function getOrCreateFeatureCounter(userId, featureName, periodStart, periodEnd) {
  let counter = await prisma.featureUsageCounter.findUnique({
    where: {
      userId_featureName_periodStart: {
        userId,
        featureName,
        periodStart,
      },
    },
  });

  if (!counter) {
    counter = await prisma.featureUsageCounter.create({
      data: {
        userId,
        featureName,
        count: 0,
        periodStart,
        periodEnd,
      },
    });
  }

  return counter;
}

/**
 * Calcule la période de comptage actuelle (mensuelle, basée sur date d'anniversaire abonnement)
 * @param {object} subscription - Objet subscription
 * @returns {{periodStart: Date, periodEnd: Date}}
 */
function getCurrentPeriod(subscription) {
  const now = new Date();

  if (!subscription) {
    // Si pas d'abonnement, utiliser le mois calendaire
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { periodStart, periodEnd };
  }

  // Utiliser la date anniversaire de l'abonnement
  const subscriptionStart = new Date(subscription.currentPeriodStart);
  const dayOfMonth = subscriptionStart.getDate();

  // Calculer le début de la période actuelle
  let periodStart = new Date(now.getFullYear(), now.getMonth(), dayOfMonth, 0, 0, 0, 0);
  if (periodStart > now) {
    // Si la date anniversaire est dans le futur ce mois-ci, prendre le mois précédent
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth, 0, 0, 0, 0);
  }

  // Calculer la fin de la période
  let periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setMilliseconds(-1); // Dernier milliseconde du mois

  return { periodStart, periodEnd };
}

/**
 * Vérifie si l'utilisateur peut utiliser une feature
 * @param {string} userId - ID de l'utilisateur
 * @param {string} featureName - Nom de la feature (generate_cv, import_pdf, etc.)
 * @param {string} analysisLevel - Niveau d'analyse (pour features IA) - 'rapid', 'medium', 'deep'
 * @returns {Promise<{canUse: boolean, reason: string, useCredit: boolean, creditBalance?: number}>}
 */
export async function canUseFeature(userId, featureName, analysisLevel = null) {
  try {
    // 1. Récupérer l'abonnement et les limites
    const subscription = await getUserSubscriptionWithPlan(userId);

    if (!subscription) {
      return {
        canUse: false,
        reason: 'Aucun abonnement actif',
        useCredit: false,
      };
    }

    if (subscription.status !== 'active') {
      return {
        canUse: false,
        reason: `Abonnement ${subscription.status}`,
        useCredit: false,
      };
    }

    // 2. Trouver la limite de cette feature dans le plan
    const featureLimit = subscription.plan.featureLimits.find(
      (fl) => fl.featureName === featureName
    );

    if (!featureLimit) {
      return {
        canUse: false,
        reason: 'Feature non disponible dans ce plan',
        useCredit: false,
      };
    }

    if (!featureLimit.isEnabled) {
      return {
        canUse: false,
        reason: 'Cette fonctionnalité est désactivée dans votre plan d\'abonnement. Changez d\'abonnement ou achetez des crédits pour l\'utiliser.',
        useCredit: false,
        actionRequired: true,
        redirectUrl: '/account/subscriptions',
      };
    }

    // 3. Vérifier les niveaux d'analyse autorisés (si applicable)
    if (analysisLevel && featureLimit.allowedAnalysisLevels) {
      const allowedLevels = JSON.parse(featureLimit.allowedAnalysisLevels);
      if (!allowedLevels.includes(analysisLevel)) {
        return {
          canUse: false,
          reason: `Niveau d'analyse "${analysisLevel}" non disponible dans ce plan`,
          useCredit: false,
        };
      }
    }

    // 4. Si limite = -1 (illimité), autoriser
    if (featureLimit.usageLimit === -1) {
      return {
        canUse: true,
        reason: 'Limite illimitée',
        useCredit: false,
      };
    }

    // 5. Vérifier le compteur mensuel
    const { periodStart, periodEnd } = getCurrentPeriod(subscription);
    const counter = await getOrCreateFeatureCounter(userId, featureName, periodStart, periodEnd);

    if (counter.count < featureLimit.usageLimit) {
      return {
        canUse: true,
        reason: `Limite non atteinte (${counter.count}/${featureLimit.usageLimit})`,
        useCredit: false,
      };
    }

    // 6. Limite atteinte → Vérifier si des crédits sont disponibles
    const creditBalance = await getCreditBalance(userId);

    if (creditBalance.balance > 0) {
      return {
        canUse: true,
        reason: 'Limite atteinte, utilisation d\'un crédit',
        useCredit: true,
        creditBalance: creditBalance.balance,
      };
    }

    // 7. Pas de crédits disponibles
    return {
      canUse: false,
      reason: 'Vous avez atteint votre limite mensuelle pour cette fonctionnalité. Changez d\'abonnement ou achetez des crédits pour continuer.',
      useCredit: false,
      actionRequired: true,
      redirectUrl: '/account/subscriptions',
    };
  } catch (error) {
    console.error('[FeatureUsage] Erreur dans canUseFeature:', error);
    return {
      canUse: false,
      reason: 'Erreur lors de la vérification des limites',
      useCredit: false,
    };
  }
}

/**
 * Incrémente le compteur de feature (et débite un crédit si nécessaire)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} featureName - Nom de la feature
 * @param {object} metadata - Métadonnées {taskId?, analysisLevel?}
 * @returns {Promise<{success: boolean, usedCredit: boolean, transactionId?: string, error?: string}>}
 */
export async function incrementFeatureCounter(userId, featureName, metadata = {}) {
  try {
    console.log(`[FeatureUsage] incrementFeatureCounter appelé: userId=${userId}, feature=${featureName}, analysisLevel=${metadata.analysisLevel}`);

    // Vérifier si l'utilisateur peut utiliser la feature
    const check = await canUseFeature(userId, featureName, metadata.analysisLevel);
    console.log(`[FeatureUsage] canUseFeature résultat:`, check);

    if (!check.canUse) {
      console.log(`[FeatureUsage] Feature bloquée: ${check.reason}`);
      return {
        success: false,
        usedCredit: false,
        error: check.reason,
        actionRequired: check.actionRequired,
        redirectUrl: check.redirectUrl,
      };
    }

    // Si on doit utiliser un crédit
    if (check.useCredit) {
      console.log(`[FeatureUsage] Utilisation d'un crédit pour ${featureName}`);
      const debitResult = await debitCredit(userId, 1, 'usage', {
        featureName,
        taskId: metadata.taskId,
        extra: { analysisLevel: metadata.analysisLevel },
      });

      if (!debitResult.success) {
        console.log(`[FeatureUsage] Échec du débit du crédit: ${debitResult.error}`);
        return {
          success: false,
          usedCredit: false,
          error: debitResult.error,
        };
      }

      console.log(`[FeatureUsage] Crédit débité avec succès, transactionId=${debitResult.transaction.id}`);

      // Émettre événement SSE pour rafraîchir l'UI
      dbEmitter.emit('db:change', {
        entity: 'CreditBalance',
        id: userId,
        userId,
        data: { action: 'credit_used', featureName, transactionId: debitResult.transaction.id },
      });

      return {
        success: true,
        usedCredit: true,
        transactionId: debitResult.transaction.id,
      };
    }

    // Sinon, incrémenter le compteur de l'abonnement
    console.log(`[FeatureUsage] Incrémentation du compteur d'abonnement pour ${featureName}`);
    const subscription = await getUserSubscriptionWithPlan(userId);
    const { periodStart, periodEnd } = getCurrentPeriod(subscription);

    const result = await prisma.featureUsageCounter.upsert({
      where: {
        userId_featureName_periodStart: {
          userId,
          featureName,
          periodStart,
        },
      },
      create: {
        userId,
        featureName,
        count: 1,
        periodStart,
        periodEnd,
      },
      update: {
        count: { increment: 1 },
      },
    });

    console.log(`[FeatureUsage] Compteur incrémenté: count=${result.count}`);

    // Émettre événement SSE pour rafraîchir l'UI
    dbEmitter.emit('db:change', {
      entity: 'FeatureUsageCounter',
      id: result.id,
      userId,
      data: { action: 'counter_incremented', featureName, count: result.count },
    });

    return {
      success: true,
      usedCredit: false,
      featureName,
      periodStart,
    };
  } catch (error) {
    console.error('[FeatureUsage] Erreur dans incrementFeatureCounter:', error);
    return {
      success: false,
      usedCredit: false,
      error: error.message || 'Erreur lors de l\'incrémentation du compteur',
    };
  }
}

/**
 * Rembourse un usage de feature suite à échec/annulation d'une task
 * @param {string} taskId - ID de la BackgroundTask
 * @returns {Promise<{success: boolean, refunded: boolean, error?: string}>}
 */
export async function refundFeatureUsage(taskId) {
  try {
    // Récupérer la task avec les infos de crédit
    const task = await prisma.backgroundTask.findUnique({
      where: { id: taskId },
      include: {
        creditTransaction: true,
      },
    });

    if (!task) {
      return { success: false, refunded: false, error: 'Task introuvable' };
    }

    // Si un crédit a été utilisé, le rembourser
    if (task.creditUsed && task.creditTransactionId) {
      const refundResult = await refundCredit(
        task.userId,
        task.creditTransactionId,
        `Échec de la tâche ${taskId}`
      );

      if (!refundResult.success) {
        return { success: false, refunded: false, error: refundResult.error };
      }

      console.log(`[FeatureUsage] Crédit remboursé pour task ${taskId}`);

      // Émettre événement SSE pour rafraîchir l'UI
      dbEmitter.emit('db:change', {
        entity: 'CreditBalance',
        id: task.userId,
        userId: task.userId,
        data: { action: 'credit_refunded', taskId },
      });

      return { success: true, refunded: true };
    }

    // Sinon, décrémenter le compteur d'abonnement
    if (task.featureName && task.featureCounterPeriodStart) {
      try {
        const result = await prisma.featureUsageCounter.updateMany({
          where: {
            userId: task.userId,
            featureName: task.featureName,
            periodStart: task.featureCounterPeriodStart,
            count: { gt: 0 }, // Ne décrémenter que si > 0
          },
          data: {
            count: { decrement: 1 },
          },
        });

        if (result.count > 0) {
          console.log(`[FeatureUsage] Compteur d'abonnement décrémenté pour task ${taskId}`);

          // Émettre événement SSE pour rafraîchir l'UI
          dbEmitter.emit('db:change', {
            entity: 'FeatureUsageCounter',
            id: task.userId,
            userId: task.userId,
            data: { action: 'counter_refunded', featureName: task.featureName, taskId },
          });

          return { success: true, refunded: true };
        } else {
          console.warn(`[FeatureUsage] Compteur introuvable ou déjà à 0 pour task ${taskId}`);
          return { success: true, refunded: false };
        }
      } catch (error) {
        console.error(`[FeatureUsage] Erreur lors du remboursement du compteur:`, error);
        return { success: true, refunded: false };
      }
    }

    console.log(`[FeatureUsage] Pas de crédit ni compteur à rembourser pour task ${taskId}`);
    return { success: true, refunded: false };
  } catch (error) {
    console.error('[FeatureUsage] Erreur dans refundFeatureUsage:', error);
    return {
      success: false,
      refunded: false,
      error: error.message || 'Erreur lors du remboursement',
    };
  }
}

/**
 * Reset des compteurs expirés (à exécuter quotidiennement via cron)
 * Supprime les compteurs dont la période est terminée
 * @returns {Promise<{deleted: number}>}
 */
export async function resetExpiredCounters() {
  try {
    const now = new Date();

    const result = await prisma.featureUsageCounter.deleteMany({
      where: {
        periodEnd: {
          lt: now, // Supprime les compteurs dont periodEnd < maintenant
        },
      },
    });

    console.log(`[FeatureUsage] ${result.count} compteurs expirés supprimés`);
    return { deleted: result.count };
  } catch (error) {
    console.error('[FeatureUsage] Erreur lors du reset des compteurs:', error);
    throw error;
  }
}

/**
 * Récupère les compteurs actuels de toutes les features pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Array<{featureName: string, count: number, limit: number, periodEnd: Date}>>}
 */
export async function getUserFeatureCounters(userId) {
  const subscription = await getUserSubscriptionWithPlan(userId);

  if (!subscription) {
    return [];
  }

  const { periodStart, periodEnd } = getCurrentPeriod(subscription);

  const counters = await prisma.featureUsageCounter.findMany({
    where: {
      userId,
      periodStart,
    },
  });

  // Fusionner avec les limites du plan
  return subscription.plan.featureLimits.map((featureLimit) => {
    const counter = counters.find((c) => c.featureName === featureLimit.featureName);

    return {
      featureName: featureLimit.featureName,
      count: counter?.count || 0,
      limit: featureLimit.usageLimit,
      isEnabled: featureLimit.isEnabled,
      periodEnd,
    };
  });
}
