/**
 * Gestion du stockage localStorage pour les préférences d'export
 */

/**
 * Génère la clé localStorage pour un CV spécifique
 * @param {string} cvFilename - Nom du fichier CV
 * @returns {string} Clé de stockage
 */
export function getStorageKey(cvFilename) {
  return `pdf-export-cv-${cvFilename}`;
}

/**
 * Extrait le nom de fichier d'un item CV
 * @param {string|Object} item - Item CV (string ou objet)
 * @returns {string} Nom de fichier
 */
export function getCvFilename(item) {
  if (!item) return '';
  return typeof item === 'string'
    ? item
    : (item.file || item.filename || item.name);
}

/**
 * Sauvegarde les sélections pour un CV spécifique
 * @param {string|Object} currentItem - Item CV actuel
 * @param {Object} selections - Sélections à sauvegarder
 * @param {Object} cvData - Données du CV
 * @param {string[]} sectionsOrder - Ordre des sections
 */
export function saveSelections(currentItem, selections, cvData, sectionsOrder) {
  if (!currentItem) return;

  const cvFilename = getCvFilename(currentItem);
  const storageKey = getStorageKey(cvFilename);

  // Ajouter maxIndex pour chaque section avec items
  const selectionsToSave = {
    ...selections,
    sections: { ...selections.sections }
  };

  const sectionsWithItems = ['experience', 'education', 'languages', 'projects', 'extras'];
  sectionsWithItems.forEach(key => {
    if (selectionsToSave.sections[key]?.items) {
      selectionsToSave.sections[key] = {
        ...selectionsToSave.sections[key],
        maxIndex: cvData?.[key]?.length || 0
      };
    }
  });

  selectionsToSave.sectionsOrder = sectionsOrder;

  localStorage.setItem(storageKey, JSON.stringify(selectionsToSave));
}

/**
 * Charge les sélections sauvegardées pour un CV
 * @param {string} cvFilename - Nom du fichier CV
 * @returns {Object|null} Sélections sauvegardées ou null
 */
export function loadSelections(cvFilename) {
  try {
    const storageKey = getStorageKey(cvFilename);
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch (err) {
    console.error('[exportStorage] Erreur chargement préférences:', err);
    return null;
  }
}

/**
 * Charge les données d'un CV depuis l'API
 * @param {string} cvFilename - Nom du fichier CV
 * @returns {Promise<Object|null>} Données du CV ou null
 */
export async function fetchCvData(cvFilename) {
  try {
    const response = await fetch(`/api/cvs/read?file=${encodeURIComponent(cvFilename)}`);
    if (!response.ok) throw new Error('Failed to read CV content');
    const data = await response.json();
    return data.cv || null;
  } catch (err) {
    console.error('[exportStorage] Erreur chargement CV:', err);
    return null;
  }
}
