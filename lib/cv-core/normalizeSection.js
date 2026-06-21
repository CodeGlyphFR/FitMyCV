/**
 * Normalise une section de CV (languages, experience, projects, education,
 * extras, skills_used, ...) en garantissant qu'on récupère toujours un array.
 *
 * Pourquoi : certaines vieilles données stockées en base contiennent des
 * sections sérialisées sous forme de STRING (JSON encodé) au lieu d'un array.
 * Le pattern habituel `section || []` ne protège pas car une chaîne est truthy,
 * ce qui fait planter les `.map()/.forEach()/.filter()` avec
 * "X.map is not a function". Cette helper centralise la normalisation.
 *
 * @param {*} value - La valeur brute de la section (array, string JSON, null, objet...)
 * @returns {Array} Un array (vide si la valeur n'est pas exploitable comme array)
 */
export function normalizeSection(value) {
  // Cas normal : déjà un array → on le retourne tel quel (comportement inchangé)
  if (Array.isArray(value)) return value;

  // Vieilles données : section stockée comme string JSON
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // null / undefined / objet / autre → array vide
  return [];
}
