/**
 * Calculs de métriques de revenus pour le dashboard admin
 */

import prisma from '@/lib/prisma';

/**
 * Calcule toutes les KPI de revenus
 * @returns {Promise<Object>} Objet contenant toutes les métriques
 */
export async function calculateRevenueKPIs() {
  const results = {
    planDistribution: [],
    realMRR: 0,           // MRR réel (abonnements mensuels uniquement)
    realARR: 0,           // ARR réel (abonnements annuels uniquement)
    totalRevenue: 0,      // Total récurrent (MRR + ARR)
    creditRevenue: 0,     // Revenus des packs de crédits
    creditPackDetails: [], // Détails ventes par pack
    mrr: 0,               // MRR converti (pour compatibilité)
    arr: 0,               // ARR converti (pour compatibilité)
    mrrGrowth: 0,
    churnRate: 0,
    conversionRate: 0,
    arpu: 0,
  };

  // Calculer chaque métrique individuellement avec gestion d'erreur
  try {
    results.planDistribution = await calculatePlanDistribution();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculatePlanDistribution:', error);
  }

  try {
    results.realMRR = await calculateRealMRR();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateRealMRR:', error);
  }

  try {
    results.realARR = await calculateRealARR();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateRealARR:', error);
  }

  try {
    results.totalRevenue = await calculateTotalRevenue();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateTotalRevenue:', error);
  }

  try {
    const creditData = await getCreditPacksRevenue();
    results.creditRevenue = creditData.totalRevenue;
    results.creditPackDetails = creditData.packDetails;
  } catch (error) {
    console.error('[revenueMetrics] Erreur getCreditPacksRevenue:', error);
  }

  try {
    results.mrr = await calculateMRR();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateMRR:', error);
  }

  try {
    results.arr = await calculateARR();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateARR:', error);
  }

  try {
    results.mrrGrowth = await calculateMRRGrowth();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateMRRGrowth:', error);
  }

  try {
    results.churnRate = await calculateChurnRate();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateChurnRate:', error);
  }

  try {
    results.conversionRate = await calculateConversionRate();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateConversionRate:', error);
  }

  try {
    results.arpu = await calculateARPU();
  } catch (error) {
    console.error('[revenueMetrics] Erreur calculateARPU:', error);
  }

  return results;
}

/**
 * Calcule la distribution des utilisateurs par plan
 * @returns {Promise<Array>} Liste des plans avec nombre d'utilisateurs et revenus réels (sans conversion)
 */
export async function calculatePlanDistribution() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
    },
    include: {
      plan: true,
    },
  });

  const distribution = {};

  subscriptions.forEach((sub) => {
    const planName = sub.plan?.name || 'Gratuit';
    const planId = sub.plan?.id || 0;

    if (!distribution[planId]) {
      distribution[planId] = {
        planId,
        planName,
        tier: sub.plan?.tier || 0,
        count: 0,
        realMRR: 0,  // Revenus abonnements mensuels uniquement
        realARR: 0,  // Revenus abonnements annuels uniquement
      };
    }

    distribution[planId].count++;

    if (sub.billingPeriod === 'monthly') {
      distribution[planId].realMRR += sub.plan?.priceMonthly || 0;
    } else if (sub.billingPeriod === 'yearly') {
      distribution[planId].realARR += sub.plan?.priceYearly || 0;
    }
  });

  // Ajouter les utilisateurs sans abonnement (gratuit)
  const totalUsers = await prisma.user.count();
  const subscribedUsers = subscriptions.length;
  const freeUsers = totalUsers - subscribedUsers;

  if (freeUsers > 0 && !distribution[0]) {
    distribution[0] = {
      planId: 0,
      planName: 'Gratuit',
      tier: 0,
      count: freeUsers,
      realMRR: 0,
      realARR: 0,
    };
  } else if (freeUsers > 0 && distribution[0]) {
    distribution[0].count += freeUsers;
  }

  return Object.values(distribution).sort((a, b) => a.tier - b.tier);
}

/**
 * Calcule le MRR réel (abonnements mensuels uniquement, sans conversion des annuels)
 * @returns {Promise<number>} MRR réel en euros
 */
export async function calculateRealMRR() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      billingPeriod: 'monthly',
    },
    include: {
      plan: true,
    },
  });

  let mrr = 0;
  subscriptions.forEach((sub) => {
    mrr += sub.plan?.priceMonthly || 0;
  });

  return Math.round(mrr * 100) / 100;
}

/**
 * Calcule l'ARR réel (abonnements annuels uniquement, sans conversion des mensuels)
 * @returns {Promise<number>} ARR réel en euros
 */
export async function calculateRealARR() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      billingPeriod: 'yearly',
    },
    include: {
      plan: true,
    },
  });

  let arr = 0;
  subscriptions.forEach((sub) => {
    arr += sub.plan?.priceYearly || 0;
  });

  return Math.round(arr * 100) / 100;
}

/**
 * Calcule le total des revenus récurrents (MRR réel + ARR réel)
 * @returns {Promise<number>} Total en euros
 */
export async function calculateTotalRevenue() {
  const realMRR = await calculateRealMRR();
  const realARR = await calculateRealARR();
  return Math.round((realMRR + realARR) * 100) / 100;
}

/**
 * Calcule les revenus des packs de crédits vendus
 * @returns {Promise<Object>} Revenus totaux et détails par pack
 */
export async function getCreditPacksRevenue() {
  // Récupérer toutes les transactions d'achat de crédits
  const purchases = await prisma.creditTransaction.findMany({
    where: {
      type: 'purchase',
    },
    select: {
      amount: true,
      createdAt: true,
    },
  });

  // Récupérer tous les packs de crédits actifs
  const packs = await prisma.creditPack.findMany({
    where: {
      isActive: true,
    },
  });

  // Créer un map pour accès rapide aux packs par creditAmount
  const packMap = new Map(packs.map(p => [p.creditAmount, p]));

  // Grouper les achats par pack
  const packSales = {};
  let totalRevenue = 0;

  purchases.forEach((purchase) => {
    const pack = packMap.get(purchase.amount);
    if (!pack) return; // Pack introuvable ou désactivé

    if (!packSales[pack.id]) {
      packSales[pack.id] = {
        packId: pack.id,
        packName: pack.name,
        creditAmount: pack.creditAmount,
        price: pack.price,
        salesCount: 0,
        totalRevenue: 0,
      };
    }

    packSales[pack.id].salesCount++;
    packSales[pack.id].totalRevenue += pack.price;
    totalRevenue += pack.price;
  });

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    packDetails: Object.values(packSales).sort((a, b) => b.totalRevenue - a.totalRevenue),
  };
}

/**
 * Calcule le MRR (Monthly Recurring Revenue)
 * @returns {Promise<number>} MRR total en euros
 */
export async function calculateMRR() {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
    },
    include: {
      plan: true,
    },
  });

  let mrr = 0;

  subscriptions.forEach((sub) => {
    if (sub.billingPeriod === 'monthly') {
      mrr += sub.plan?.priceMonthly || 0;
    } else if (sub.billingPeriod === 'yearly') {
      // Convertir l'annuel en mensuel
      mrr += (sub.plan?.priceYearly || 0) / 12;
    }
  });

  return Math.round(mrr * 100) / 100; // Arrondir à 2 décimales
}

/**
 * Calcule l'ARR (Annual Recurring Revenue)
 * @returns {Promise<number>} ARR total en euros
 */
export async function calculateARR() {
  const mrr = await calculateMRR();
  return Math.round(mrr * 12 * 100) / 100;
}

/**
 * Calcule la croissance du MRR (mois actuel vs mois précédent)
 * @returns {Promise<number>} Pourcentage de croissance
 */
export async function calculateMRRGrowth() {
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // MRR actuel
  const currentMRR = await calculateMRR();

  // MRR du mois précédent (= abonnements actifs au début du mois actuel)
  // Un abonnement était actif au début du mois actuel si :
  // - Il a été créé avant le début du mois actuel
  // - ET soit il est toujours actif, soit il a été annulé après le début du mois actuel
  const previousSubscriptions = await prisma.subscription.findMany({
    where: {
      createdAt: {
        lt: startOfCurrentMonth,
      },
      OR: [
        { status: 'active' },
        {
          status: 'cancelled',
          canceledAt: {
            gte: startOfCurrentMonth,
          },
        },
      ],
    },
    include: {
      plan: true,
    },
  });

  let previousMRR = 0;
  previousSubscriptions.forEach((sub) => {
    if (sub.billingPeriod === 'monthly') {
      previousMRR += sub.plan?.priceMonthly || 0;
    } else if (sub.billingPeriod === 'yearly') {
      previousMRR += (sub.plan?.priceYearly || 0) / 12;
    }
  });

  if (previousMRR === 0) return 0;

  const growth = ((currentMRR - previousMRR) / previousMRR) * 100;
  return Math.round(growth * 100) / 100;
}

/**
 * Calcule le taux de churn (annulations du mois / total abonnements du début du mois)
 * @returns {Promise<number>} Pourcentage de churn
 */
export async function calculateChurnRate() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Nombre total d'abonnements actifs au début du mois
  const totalStartOfMonth = await prisma.subscription.count({
    where: {
      createdAt: {
        lt: startOfMonth,
      },
      OR: [
        { status: 'active' },
        {
          status: 'cancelled',
          canceledAt: {
            gte: startOfMonth,
          },
        },
      ],
    },
  });

  if (totalStartOfMonth === 0) return 0;

  // Nombre d'annulations ce mois
  const cancellationsThisMonth = await prisma.subscription.count({
    where: {
      status: 'cancelled',
      canceledAt: {
        gte: startOfMonth,
      },
    },
  });

  const churnRate = (cancellationsThisMonth / totalStartOfMonth) * 100;
  return Math.round(churnRate * 100) / 100;
}

/**
 * Calcule le taux de conversion (utilisateurs payants / total utilisateurs)
 * @returns {Promise<number>} Pourcentage de conversion
 */
export async function calculateConversionRate() {
  const totalUsers = await prisma.user.count();

  if (totalUsers === 0) return 0;

  const paidUsers = await prisma.subscription.count({
    where: {
      status: 'active',
      plan: {
        OR: [
          { priceMonthly: { gt: 0 } },
          { priceYearly: { gt: 0 } },
        ],
      },
    },
  });

  const conversionRate = (paidUsers / totalUsers) * 100;
  return Math.round(conversionRate * 100) / 100;
}

/**
 * Calcule l'ARPU (Average Revenue Per User)
 * @returns {Promise<number>} ARPU en euros
 */
export async function calculateARPU() {
  const mrr = await calculateMRR();
  const totalUsers = await prisma.user.count();

  if (totalUsers === 0) return 0;

  const arpu = mrr / totalUsers;
  return Math.round(arpu * 100) / 100;
}

/**
 * Récupère l'historique du MRR sur les N derniers mois
 * @param {number} months - Nombre de mois à récupérer (défaut: 12)
 * @returns {Promise<Array>} Tableau d'objets {month, mrr}
 */
export async function getMRRHistory(months = 12) {
  const history = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    try {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      // Récupérer les abonnements actifs à cette date
      const subscriptions = await prisma.subscription.findMany({
        where: {
          createdAt: {
            lt: nextMonth,
          },
          OR: [
            { status: 'active' },
            {
              status: 'cancelled',
              canceledAt: {
                gte: targetDate,
              },
            },
          ],
        },
        include: {
          plan: true,
        },
      });

      let mrr = 0;
      subscriptions.forEach((sub) => {
        if (sub.billingPeriod === 'monthly') {
          mrr += sub.plan?.priceMonthly || 0;
        } else if (sub.billingPeriod === 'yearly') {
          mrr += (sub.plan?.priceYearly || 0) / 12;
        }
      });

      history.push({
        month: targetDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        mrr: Math.round(mrr * 100) / 100,
      });
    } catch (error) {
      console.error(`[revenueMetrics] Erreur getMRRHistory pour mois ${i}:`, error);
      // Ajouter un point de données vide pour ne pas casser le graphique
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      history.push({
        month: targetDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        mrr: 0,
      });
    }
  }

  return history;
}

