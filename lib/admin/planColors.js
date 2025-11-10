/**
 * Utilitaires pour les couleurs et styles des plans d'abonnement
 * Fichier sans dépendance Prisma - utilisable côté client et serveur
 */

/**
 * Configuration des couleurs par tier de plan
 */
export const PLAN_COLORS = {
  0: { bg: 'bg-gray-500/20', text: 'text-gray-300', icon: '🆓' },
  1: { bg: 'bg-gray-500/20', text: 'text-gray-300', icon: '🆓' },
  2: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '💼' },
  3: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '👑' },
};

/**
 * Retourne la couleur associée à un tier de plan (pour cohérence UI)
 * @param {number} tier - Tier du plan (0=Gratuit, 1=Basic, 2=Pro, 3=Premium)
 * @returns {Object} Objet avec bg, text colors et icon
 */
export function getPlanColor(tier) {
  return PLAN_COLORS[tier] || PLAN_COLORS[0];
}
