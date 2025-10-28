/**
 * Fonctions utilitaires pour identifier et comparer les plans d'abonnement
 * de manière robuste et cohérente dans toute l'application
 */

/**
 * Vérifie si un plan est le plan gratuit
 * @param {Object} plan - Le plan à vérifier
 * @returns {boolean}
 */
export function isFreePlan(plan) {
  if (!plan) return false;

  // Priorité au flag robuste, avec fallback sur le prix
  return plan.isFree ?? (plan.priceMonthly === 0 && plan.priceYearly === 0);
}

/**
 * Obtient le tier d'un plan (0=Gratuit, 1=Pro, 2=Premium)
 * @param {Object} plan - Le plan
 * @returns {number}
 */
export function getPlanTier(plan) {
  if (!plan) return 0;

  // Priorité au tier explicite
  if (typeof plan.tier === 'number') {
    return plan.tier;
  }

  // Fallback : déterminer tier par prix
  if (plan.priceMonthly === 0 && plan.priceYearly === 0) {
    return 0; // Gratuit
  } else if (plan.priceMonthly > 20) {
    return 2; // Premium
  } else {
    return 1; // Pro
  }
}

/**
 * Vérifie si un plan est populaire/recommandé
 * @param {Object} plan - Le plan à vérifier
 * @returns {boolean}
 */
export function isPopularPlan(plan) {
  if (!plan) return false;
  return plan.isPopular ?? false;
}

/**
 * Compare deux plans et détermine si c'est un upgrade, downgrade ou égal
 * @param {Object} currentPlan - Plan actuel
 * @param {Object} targetPlan - Plan cible
 * @returns {'upgrade'|'downgrade'|'same'}
 */
export function comparePlans(currentPlan, targetPlan) {
  if (!currentPlan || !targetPlan) return 'same';

  const currentTier = getPlanTier(currentPlan);
  const targetTier = getPlanTier(targetPlan);

  if (targetTier > currentTier) return 'upgrade';
  if (targetTier < currentTier) return 'downgrade';
  return 'same';
}

/**
 * Vérifie si le changement de plan est un upgrade
 * @param {Object} currentPlan - Plan actuel
 * @param {Object} targetPlan - Plan cible
 * @returns {boolean}
 */
export function isUpgrade(currentPlan, targetPlan) {
  return comparePlans(currentPlan, targetPlan) === 'upgrade';
}

/**
 * Vérifie si le changement de plan est un downgrade
 * @param {Object} currentPlan - Plan actuel
 * @param {Object} targetPlan - Plan cible
 * @returns {boolean}
 */
export function isDowngrade(currentPlan, targetPlan) {
  return comparePlans(currentPlan, targetPlan) === 'downgrade';
}

/**
 * Retourne l'icône appropriée pour un plan
 * @param {Object} plan - Le plan
 * @returns {string}
 */
export function getPlanIcon(plan) {
  if (!plan) return "🎯";

  const tier = getPlanTier(plan);

  switch (tier) {
    case 2: // Premium
      return "👑";
    case 1: // Pro
      return "⚡";
    case 0: // Gratuit
    default:
      return "🎯";
  }
}

/**
 * Retourne la classe de couleur pour un plan (Tailwind)
 * @param {Object} plan - Le plan
 * @returns {string}
 */
export function getPlanColorClass(plan) {
  if (!plan) return "from-gray-500/20 to-gray-600/20 border-gray-500/50";

  const tier = getPlanTier(plan);

  switch (tier) {
    case 2: // Premium
      return "from-purple-500/20 to-pink-500/20 border-purple-500/50";
    case 1: // Pro
      return "from-blue-500/20 to-cyan-500/20 border-blue-500/50";
    case 0: // Gratuit
    default:
      return "from-gray-500/20 to-gray-600/20 border-gray-500/50";
  }
}

/**
 * Formatte le prix d'un plan pour l'affichage
 * @param {Object} plan - Le plan
 * @param {'monthly'|'yearly'} period - Période de facturation
 * @returns {string}
 */
export function formatPlanPrice(plan, period = 'monthly') {
  if (!plan) return "0€";

  if (isFreePlan(plan)) {
    return "Gratuit";
  }

  const price = period === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const suffix = period === 'yearly' ? '/an' : '/mois';

  return `${price}€${suffix}`;
}

/**
 * Calcule le pourcentage d'économie annuelle
 * @param {Object} plan - Le plan
 * @returns {number}
 */
export function getYearlyDiscount(plan) {
  if (!plan || !plan.priceYearly || !plan.priceMonthly) return 0;

  const monthlyTotal = plan.priceMonthly * 12;
  const yearlyTotal = plan.priceYearly;

  if (monthlyTotal === 0) return 0;

  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
}
