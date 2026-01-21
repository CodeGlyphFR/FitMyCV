import { useState, useCallback } from 'react';
import { getDefaultSelections } from '@/lib/export/selectionHelpers';

/**
 * Ordre par défaut des sections (sans header qui est toujours premier)
 */
export const DEFAULT_SECTIONS_ORDER = ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];

/**
 * Hook pour gérer les sélections d'export (sections, items, options)
 * @returns {Object} État et fonctions de manipulation des sélections
 */
export function useExportSelections() {
  const [selections, setSelections] = useState(() => getDefaultSelections(null));
  const [sectionsOrder, setSectionsOrder] = useState(DEFAULT_SECTIONS_ORDER);

  // Réinitialiser les sélections avec les données du CV
  const resetSelections = useCallback((cvData, savedSelections = null, savedSectionsOrder = null) => {
    if (savedSelections) {
      setSelections(savedSelections);
    } else {
      setSelections(getDefaultSelections(cvData));
    }

    if (savedSectionsOrder && Array.isArray(savedSectionsOrder)) {
      setSectionsOrder(savedSectionsOrder);
    } else {
      setSectionsOrder(DEFAULT_SECTIONS_ORDER);
    }
  }, []);

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

  // Toggle une option de section (ex: hideProficiency pour skills)
  const toggleSectionOption = useCallback((sectionKey, optionKey) => {
    setSelections(prev => {
      const section = prev.sections[sectionKey];
      if (!section) return prev;

      const currentOptions = section.options || {};
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [sectionKey]: {
            ...section,
            options: {
              ...currentOptions,
              [optionKey]: !currentOptions[optionKey]
            }
          }
        }
      };
    });
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

  // Tout sélectionner (y compris tous les items)
  const selectAll = useCallback((cvData) => {
    setSelections(prev => {
      const newSelections = { sections: {} };
      Object.keys(prev.sections).forEach(key => {
        const section = prev.sections[key];
        // Recalculer tous les indices d'items depuis cvData
        let allItems = undefined;
        if (section.items !== undefined && cvData?.[key]) {
          allItems = cvData[key].map((_, index) => index);
        } else if (section.items !== undefined) {
          allItems = section.items;
        }

        newSelections.sections[key] = {
          ...section,
          enabled: true,
          subsections: section.subsections
            ? Object.keys(section.subsections).reduce((acc, subKey) => {
                acc[subKey] = true;
                return acc;
              }, {})
            : undefined,
          items: allItems
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
          newSelections.sections[key] = { ...section, enabled: true };
        } else {
          newSelections.sections[key] = {
            ...section,
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

  // Déplacer une section vers le haut
  const moveSectionUp = useCallback((sectionKey) => {
    setSectionsOrder(prev => {
      const index = prev.indexOf(sectionKey);
      if (index <= 0) return prev;
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  }, []);

  // Déplacer une section vers le bas
  const moveSectionDown = useCallback((sectionKey) => {
    setSectionsOrder(prev => {
      const index = prev.indexOf(sectionKey);
      if (index < 0 || index >= prev.length - 1) return prev;
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  }, []);

  // Réinitialiser l'ordre des sections
  const resetSectionsOrder = useCallback(() => {
    setSectionsOrder(DEFAULT_SECTIONS_ORDER);
  }, []);

  return {
    selections,
    setSelections,
    sectionsOrder,
    setSectionsOrder,
    resetSelections,
    toggleSection,
    toggleSubsection,
    toggleSectionOption,
    toggleItem,
    toggleItemOption,
    selectAll,
    deselectAll,
    moveSectionUp,
    moveSectionDown,
    resetSectionsOrder
  };
}
