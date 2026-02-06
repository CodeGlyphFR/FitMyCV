/**
 * Helpers pour la gestion des sélections d'export PDF/Word
 */

/**
 * Génère les initiales à partir d'un nom complet
 * @param {string} fullName - Nom complet (ex: "Erick DE SMET")
 * @returns {string} Initiales en majuscules (ex: "EDS")
 */
export function generateInitials(fullName) {
  if (!fullName) return '';

  const words = fullName.trim().split(/\s+/);
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return initials;
}

/**
 * Vérifie si une section du CV a du contenu
 * @param {Object} cvData - Données du CV
 * @param {string} key - Clé de la section
 * @returns {boolean}
 */
export function hasContent(cvData, key) {
  if (!cvData) return false;
  switch (key) {
    case 'summary':
      return !!(cvData.summary?.description);
    case 'skills':
      return !!(cvData.skills?.hard_skills?.length || cvData.skills?.soft_skills?.length ||
               cvData.skills?.tools?.length || cvData.skills?.methodologies?.length);
    case 'experience':
      return !!(cvData.experience?.length);
    case 'education':
      return !!(cvData.education?.length);
    case 'languages':
      return !!(cvData.languages?.length);
    case 'projects':
      return !!(cvData.projects?.length);
    case 'extras':
      return !!(cvData.extras?.length);
    default:
      return true;
  }
}

/**
 * Génère la structure par défaut des sélections basée sur le contenu du CV
 * @param {Object|null} cvData - Données du CV
 * @returns {Object} Structure de sélections par défaut
 */
export function getDefaultSelections(cvData) {
  const selections = {
    sections: {
      header: {
        enabled: true,
        subsections: { links: true }
      },
      summary: { enabled: hasContent(cvData, 'summary') },
      skills: {
        enabled: hasContent(cvData, 'skills'),
        subsections: {
          hard_skills: true,
          soft_skills: true,
          tools: true,
          methodologies: true
        },
        options: {
          hideProficiency: false
        }
      },
      experience: {
        enabled: hasContent(cvData, 'experience'),
        items: cvData?.experience ? cvData.experience.map((_, index) => index) : [],
        options: {
          hideTechnologies: false,
          hideDescription: false,
          hideDeliverables: false
        }
      },
      education: {
        enabled: hasContent(cvData, 'education'),
        items: cvData?.education ? cvData.education.map((_, index) => index) : []
      },
      languages: {
        enabled: hasContent(cvData, 'languages'),
        items: cvData?.languages ? cvData.languages.map((_, index) => index) : []
      },
      projects: {
        enabled: hasContent(cvData, 'projects'),
        items: cvData?.projects ? cvData.projects.map((_, index) => index) : []
      },
      extras: {
        enabled: hasContent(cvData, 'extras'),
        items: cvData?.extras ? cvData.extras.map((_, index) => index) : []
      }
    }
  };
  return selections;
}

/**
 * Migre les sélections sauvegardées avec les nouvelles données du CV
 * @param {Object} savedSelections - Sélections sauvegardées
 * @param {Object} cvData - Données actuelles du CV
 * @returns {Object} Sélections migrées
 */
export function migrateSelections(savedSelections, cvData) {
  const updated = { ...savedSelections };

  const sectionsWithItems = ['experience', 'education', 'languages', 'projects', 'extras'];

  sectionsWithItems.forEach(key => {
    if (cvData[key]) {
      const currentCount = cvData[key].length;
      const savedItems = updated.sections[key]?.items || [];

      // Filtrer les items qui n'existent plus et ajouter les nouveaux
      const validItems = savedItems.filter(i => i < currentCount);
      const newItems = [];
      for (let i = 0; i < currentCount; i++) {
        if (!savedItems.includes(i) && i >= (savedSelections.sections[key]?.maxIndex || 0)) {
          newItems.push(i);
        }
      }

      updated.sections[key] = {
        ...updated.sections[key],
        items: [...validItems, ...newItems].sort((a, b) => a - b),
        maxIndex: currentCount
      };

      // Pour experience, s'assurer que itemsOptions existe pour chaque item
      if (key === 'experience') {
        const itemsOptions = updated.sections[key].itemsOptions || {};
        cvData[key].forEach((_, index) => {
          if (!itemsOptions[index]) {
            itemsOptions[index] = { includeDeliverables: true };
          }
        });
        updated.sections[key].itemsOptions = itemsOptions;
      }
    }
  });

  // Migrations des options manquantes
  if (updated.sections.skills && !updated.sections.skills.options) {
    updated.sections.skills.options = { hideProficiency: false };
  }
  if (updated.sections.experience && !updated.sections.experience.options) {
    updated.sections.experience.options = { hideTechnologies: false, hideDescription: false };
  }

  return updated;
}

/**
 * Calcule les compteurs pour chaque section du CV
 * @param {Object} cvData - Données du CV
 * @returns {Object} Compteurs par section
 */
export function calculateCounters(cvData) {
  if (!cvData) return {};

  return {
    header: 1,
    summary: cvData.summary?.description ? 1 : 0,
    skills: (cvData.skills?.hard_skills?.length || 0) +
            (cvData.skills?.soft_skills?.length || 0) +
            (cvData.skills?.tools?.length || 0) +
            (cvData.skills?.methodologies?.length || 0),
    experience: cvData.experience?.length || 0,
    education: cvData.education?.length || 0,
    languages: cvData.languages?.length || 0,
    projects: cvData.projects?.length || 0,
    extras: cvData.extras?.length || 0
  };
}

/**
 * Calcule les sous-compteurs pour les sections granulaires
 * @param {Object} cvData - Données du CV
 * @returns {Object} Sous-compteurs
 */
export function calculateSubCounters(cvData) {
  if (!cvData) return {};

  return {
    skills: {
      hard_skills: cvData.skills?.hard_skills?.length || 0,
      soft_skills: cvData.skills?.soft_skills?.length || 0,
      tools: cvData.skills?.tools?.length || 0,
      methodologies: cvData.skills?.methodologies?.length || 0
    },
    header: {
      contact: cvData.header?.contact ? 1 : 0,
      links: cvData.header?.contact?.links?.length || 0
    },
    summary: {
      description: cvData.summary?.description ? 1 : 0
    }
  };
}

/**
 * Extrait la configuration macro des sélections (sans les items individuels)
 * @param {Object} selections - Sélections actuelles
 * @param {string[]} sectionsOrder - Ordre des sections
 * @returns {Object} Configuration macro
 */
export function extractMacroSelections(selections, sectionsOrder) {
  const macroSelections = { sections: {}, sectionsOrder };

  Object.keys(selections.sections).forEach(sectionKey => {
    const section = selections.sections[sectionKey];
    macroSelections.sections[sectionKey] = {
      enabled: section.enabled,
    };

    if (section.subsections) {
      macroSelections.sections[sectionKey].subsections = { ...section.subsections };
    }

    if (section.options) {
      macroSelections.sections[sectionKey].options = { ...section.options };
    }
  });

  return macroSelections;
}
