import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Génère les initiales à partir d'un nom complet
 * @param {string} fullName - Nom complet (ex: "Erick DE SMET")
 * @returns {string} Initiales en majuscules (ex: "EDS")
 */
function generateInitials(fullName) {
  if (!fullName) return '';

  // Diviser le nom en mots et prendre la première lettre de chaque mot
  const words = fullName.trim().split(/\s+/);
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return initials;
}

/**
 * Hook pour gérer le modal d'export PDF
 * @param {Object} currentItem - Le CV actuellement sélectionné
 * @param {string} language - Langue courante
 * @returns {Object} État et fonctions pour le modal d'export
 */
export function useExportModal({ currentItem, language }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filename, setFilename] = useState('');
  const [cvData, setCvData] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Structure par défaut des sélections
  const getDefaultSelections = (cvData) => {
    const selections = {
      sections: {
        header: {
          enabled: true,
          subsections: { links: true }
        },
        summary: { enabled: true },
        skills: {
          enabled: true,
          subsections: {
            hard_skills: true,
            soft_skills: true,
            tools: true,
            methodologies: true
          }
        },
        experience: {
          enabled: true,
          items: cvData?.experience ? cvData.experience.map((_, index) => index) : [],
          itemsOptions: cvData?.experience ? cvData.experience.reduce((acc, _, index) => {
            acc[index] = { includeDeliverables: true };
            return acc;
          }, {}) : {}
        },
        education: {
          enabled: true,
          items: cvData?.education ? cvData.education.map((_, index) => index) : []
        },
        languages: {
          enabled: true,
          items: cvData?.languages ? cvData.languages.map((_, index) => index) : []
        },
        projects: {
          enabled: true,
          items: cvData?.projects ? cvData.projects.map((_, index) => index) : []
        },
        extras: {
          enabled: true,
          items: cvData?.extras ? cvData.extras.map((_, index) => index) : []
        }
      }
    };
    return selections;
  };

  const [selections, setSelections] = useState(() => getDefaultSelections(null));

  // Charger les données du CV quand le modal s'ouvre
  useEffect(() => {
    if (!isOpen || !currentItem) return;

    const filename = typeof currentItem === 'string'
      ? currentItem
      : (currentItem.file || currentItem.filename || currentItem.name);

    // Charger les données du CV via l'API cvs (qui retourne les métadonnées + le contenu)
    fetch(`/api/cvs?current=${encodeURIComponent(filename)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load CV');
        return res.json();
      })
      .then(data => {
        // L'API /api/cvs retourne { items: [...], current: "..." }
        // On doit charger le CV individuellement
        return fetch(`/api/cvs/read?file=${encodeURIComponent(filename)}`);
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to read CV content');
        return res.json();
      })
      .then(data => {
        if (data.cv) {
          setCvData(data.cv);

          // Générer le nom de fichier par défaut au format CV_INITIALES_TITRE
          const initials = generateInitials(data.cv?.header?.full_name);
          const title = data.cv?.header?.current_title?.replace(/\s+/g, '_') || '';
          const defaultFilename = initials && title
            ? `CV_${initials}_${title}`
            : filename.replace('.json', '');
          setFilename(defaultFilename);

          // Initialiser les sélections avec les données du CV
          try {
            const saved = localStorage.getItem('pdf-export-preferences');
            if (saved) {
              const parsed = JSON.parse(saved);
              // Mettre à jour les items avec les données actuelles du CV
              const updated = { ...parsed };
              ['experience', 'education', 'languages', 'projects', 'extras'].forEach(key => {
                if (data.cv[key]) {
                  updated.sections[key] = {
                    ...updated.sections[key],
                    items: data.cv[key].map((_, index) => index)
                  };
                  // Pour experience, s'assurer que itemsOptions existe pour chaque item
                  if (key === 'experience') {
                    const itemsOptions = updated.sections[key].itemsOptions || {};
                    data.cv[key].forEach((_, index) => {
                      if (!itemsOptions[index]) {
                        itemsOptions[index] = { includeDeliverables: true };
                      }
                    });
                    updated.sections[key].itemsOptions = itemsOptions;
                  }
                }
              });
              setSelections(updated);
            } else {
              setSelections(getDefaultSelections(data.cv));
            }
          } catch (err) {
            console.error('[useExportModal] Erreur chargement préférences:', err);
            setSelections(getDefaultSelections(data.cv));
          }
        }
      })
      .catch(err => {
        console.error('[useExportModal] Erreur chargement CV:', err);
        // En cas d'erreur, initialiser avec des valeurs par défaut
        setSelections(getDefaultSelections(null));
      });
  }, [isOpen, currentItem]);

  // Calculer les compteurs pour chaque section
  const counters = useMemo(() => {
    if (!cvData) return {};

    return {
      header: 1, // toujours 1
      summary: cvData.summary?.description ? 1 : 0,
      skills: selections.sections.skills?.subsections
        ? Object.keys(selections.sections.skills.subsections).reduce((total, subKey) => {
            const isEnabled = selections.sections.skills.subsections[subKey];
            const count = cvData.skills?.[subKey]?.length || 0;
            return total + (isEnabled ? count : 0);
          }, 0)
        : 0,
      experience: cvData.experience?.length || 0,
      education: cvData.education?.length || 0,
      languages: cvData.languages?.length || 0,
      projects: cvData.projects?.length || 0,
      extras: cvData.extras?.length || 0
    };
  }, [cvData, selections.sections.skills]);

  // Calculer les sous-compteurs pour les sections granulaires
  const subCounters = useMemo(() => {
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
  }, [cvData]);

  // Toggle une section
  const toggleSection = useCallback((sectionKey) => {
    setSelections(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: {
          ...prev.sections[sectionKey],
          enabled: !prev.sections[sectionKey].enabled
        }
      }
    }));
  }, []);

  // Toggle une sous-section
  const toggleSubsection = useCallback((sectionKey, subsectionKey) => {
    setSelections(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionKey]: {
          ...prev.sections[sectionKey],
          subsections: {
            ...prev.sections[sectionKey].subsections,
            [subsectionKey]: !prev.sections[sectionKey].subsections[subsectionKey]
          }
        }
      }
    }));
  }, []);

  // Toggle un élément individuel (pour experience, education, etc.)
  const toggleItem = useCallback((sectionKey, itemIndex) => {
    setSelections(prev => {
      const section = prev.sections[sectionKey];
      if (!section || !section.items) return prev;

      const items = section.items;
      const newItems = items.includes(itemIndex)
        ? items.filter(i => i !== itemIndex)
        : [...items, itemIndex].sort((a, b) => a - b);

      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...section,
            items: newItems
          }
        }
      };
    });
  }, []);

  // Toggle une option d'un élément individuel (ex: includeDeliverables pour experience)
  const toggleItemOption = useCallback((sectionKey, itemIndex, optionKey) => {
    setSelections(prev => {
      const section = prev.sections[sectionKey];
      if (!section || !section.itemsOptions) return prev;

      const currentOptions = section.itemsOptions[itemIndex] || {};
      const newOptions = {
        ...currentOptions,
        [optionKey]: !currentOptions[optionKey]
      };

      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...section,
            itemsOptions: {
              ...section.itemsOptions,
              [itemIndex]: newOptions
            }
          }
        }
      };
    });
  }, []);

  // Tout sélectionner
  const selectAll = useCallback(() => {
    setSelections(prev => {
      const newSelections = { sections: {} };
      Object.keys(prev.sections).forEach(key => {
        const section = prev.sections[key];
        newSelections.sections[key] = {
          enabled: true,
          subsections: section.subsections
            ? Object.keys(section.subsections).reduce((acc, subKey) => {
                acc[subKey] = true;
                return acc;
              }, {})
            : undefined,
          items: section.items ? section.items : undefined
        };
      });
      return newSelections;
    });
  }, []);

  // Tout désélectionner (sauf header)
  const deselectAll = useCallback(() => {
    setSelections(prev => {
      const newSelections = { sections: {} };
      Object.keys(prev.sections).forEach(key => {
        const section = prev.sections[key];
        if (key === 'header') {
          // Header reste toujours activé
          newSelections.sections[key] = { ...section, enabled: true };
        } else {
          newSelections.sections[key] = {
            enabled: false,
            subsections: section.subsections
              ? Object.keys(section.subsections).reduce((acc, subKey) => {
                  acc[subKey] = false;
                  return acc;
                }, {})
              : undefined,
            items: section.items ? [] : undefined
          };
        }
      });
      return newSelections;
    });
  }, []);

  // Ouvrir le modal
  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Fermer le modal
  const closeModal = useCallback(() => {
    setIsOpen(false);
    setIsExporting(false);
  }, []);

  // Exporter le PDF
  const exportPdf = useCallback(async () => {
    if (!currentItem || !filename.trim()) {
      alert('Nom de fichier manquant');
      return;
    }

    // Vérifier qu'au moins une section est sélectionnée (header est toujours sélectionné)
    const hasSelection = Object.values(selections.sections).some(s => s.enabled);
    if (!hasSelection) {
      alert('Veuillez sélectionner au moins une section');
      return;
    }

    setIsExporting(true);

    try {
      // Sauvegarder les préférences
      localStorage.setItem('pdf-export-preferences', JSON.stringify(selections));

      // Préparer le nom du fichier
      const currentFilename = typeof currentItem === 'string'
        ? currentItem
        : (currentItem.file || currentItem.filename || currentItem.name);

      // Appeler l'API d'export
      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: currentFilename,
          language: language,
          selections: selections,
          customFilename: filename
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'export PDF');
      }

      // Télécharger le PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fermer le modal
      closeModal();
    } catch (error) {
      console.error('[useExportModal] Erreur export:', error);
      alert('Erreur lors de l\'export PDF');
    } finally {
      setIsExporting(false);
    }
  }, [currentItem, filename, selections, language, closeModal]);

  return {
    isOpen,
    openModal,
    closeModal,
    filename,
    setFilename,
    selections,
    toggleSection,
    toggleSubsection,
    toggleItem,
    toggleItemOption,
    selectAll,
    deselectAll,
    exportPdf,
    counters,
    subCounters,
    cvData,
    isExporting
  };
}
