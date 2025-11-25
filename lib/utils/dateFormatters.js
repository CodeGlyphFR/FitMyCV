/**
 * Utilitaires de formatage de dates pour l'interface admin
 * Centralise les fonctions de formatage utilisées dans les composants admin
 */

/**
 * Formate une date au format français DD/MM/YYYY
 * @param {string|Date} dateString - Date à formater
 * @returns {string} Date formatée ou '-' si invalide
 */
export function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

/**
 * Formate une date de manière relative ("Il y a X jours")
 * @param {string|Date} dateString - Date à formater
 * @returns {string} Temps relatif ou date formatée
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return '-';

  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    }

    // Plus de 30 jours, retourner la date formatée
    return formatDate(dateString);
  } catch {
    return '-';
  }
}

/**
 * Formate une durée en millisecondes en chaîne lisible
 * @param {number} ms - Durée en millisecondes
 * @returns {string} Durée formatée (ex: "15m 32s", "2h 15m")
 */
export function formatDuration(ms) {
  if (!ms || ms <= 0) return '-';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${seconds}s`;
}

/**
 * Formate une date au format ISO pour affichage détaillé
 * @param {string|Date} dateString - Date à formater
 * @returns {string} Date et heure formatées
 */
export function formatDateTime(dateString) {
  if (!dateString) return '-';

  try {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}
