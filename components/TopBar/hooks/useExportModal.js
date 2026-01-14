import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ONBOARDING_EVENTS, emitOnboardingEvent } from '@/lib/onboarding/onboardingEvents';

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
 * @param {Function} addNotification - Fonction pour afficher les notifications
 * @returns {Object} État et fonctions pour le modal d'export
 */
export function useExportModal({ currentItem, language, addNotification }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filename, setFilename] = useState('');
  const [cvData, setCvData] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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
          },
          options: {
            hideProficiency: false
          }
        },
        experience: {
          enabled: true,
          items: cvData?.experience ? cvData.experience.map((_, index) => index) : [],
          itemsOptions: cvData?.experience ? cvData.experience.reduce((acc, _, index) => {
            acc[index] = { includeDeliverables: true };
            return acc;
          }, {}) : {},
          options: {
            hideTechnologies: false,
            hideDescription: false
          }
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

  // Générer la clé localStorage pour un CV spécifique
  const getStorageKey = useCallback((cvFilename) => {
    return `pdf-export-cv-${cvFilename}`;
  }, []);

  // Charger les données du CV quand le modal s'ouvre
  useEffect(() => {
    if (!isOpen || !currentItem) return;

    const cvFilename = typeof currentItem === 'string'
      ? currentItem
      : (currentItem.file || currentItem.filename || currentItem.name);

    // Charger les données du CV via l'API cvs (qui retourne les métadonnées + le contenu)
    fetch(`/api/cvs?current=${encodeURIComponent(cvFilename)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load CV');
        return res.json();
      })
      .then(data => {
        // L'API /api/cvs retourne { items: [...], current: "..." }
        // On doit charger le CV individuellement
        return fetch(`/api/cvs/read?file=${encodeURIComponent(cvFilename)}`);
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
            : cvFilename.replace('.json', '');
          setFilename(defaultFilename);

          // Initialiser les sélections avec les données du CV
          // Essayer d'abord de charger les préférences spécifiques à ce CV
          try {
            const storageKey = getStorageKey(cvFilename);
            const saved = localStorage.getItem(storageKey);

            if (saved) {
              const parsed = JSON.parse(saved);
              // Mettre à jour les items avec les données actuelles du CV
              // (au cas où des éléments ont été ajoutés/supprimés depuis la dernière sauvegarde)
              const updated = { ...parsed };

              ['experience', 'education', 'languages', 'projects', 'extras'].forEach(key => {
                if (data.cv[key]) {
                  const currentCount = data.cv[key].length;
                  const savedItems = updated.sections[key]?.items || [];

                  // Filtrer les items qui n'existent plus et ajouter les nouveaux
                  const validItems = savedItems.filter(i => i < currentCount);
                  // Si de nouveaux items ont été ajoutés, les inclure par défaut
                  const newItems = [];
                  for (let i = 0; i < currentCount; i++) {
                    if (!savedItems.includes(i) && i >= (parsed.sections[key]?.maxIndex || 0)) {
                      newItems.push(i);
                    }
                  }

                  updated.sections[key] = {
                    ...updated.sections[key],
                    items: [...validItems, ...newItems].sort((a, b) => a - b),
                    maxIndex: currentCount // Garder trace du nombre d'items lors de la sauvegarde
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

              // S'assurer que skills.options existe (migration des anciennes préférences)
              if (updated.sections.skills && !updated.sections.skills.options) {
                updated.sections.skills.options = { hideProficiency: false };
              }
              // S'assurer que experience.options existe (migration des anciennes préférences)
              if (updated.sections.experience && !updated.sections.experience.options) {
                updated.sections.experience.options = { hideTechnologies: false, hideDescription: false };
              }
              setSelections(updated);
            } else {
              // Pas de préférences sauvegardées pour ce CV, utiliser les valeurs par défaut
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
  }, [isOpen, currentItem, getStorageKey]);

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

  // Écouter l'événement onboarding pour ouvrir automatiquement le modal
  useEffect(() => {
    const handleOpenExport = () => {
      console.log('[useExportModal] Réception événement OPEN_EXPORT, ouverture modal');
      setIsOpen(true);
    };

    window.addEventListener(ONBOARDING_EVENTS.OPEN_EXPORT, handleOpenExport);

    return () => {
      window.removeEventListener(ONBOARDING_EVENTS.OPEN_EXPORT, handleOpenExport);
    };
  }, []);

  // Sauvegarder les sélections pour le CV actuel
  const saveSelections = useCallback(() => {
    if (!currentItem) return;

    const cvFilename = typeof currentItem === 'string'
      ? currentItem
      : (currentItem.file || currentItem.filename || currentItem.name);

    const storageKey = getStorageKey(cvFilename);

    // Ajouter maxIndex pour chaque section avec items pour gérer les ajouts futurs
    const selectionsToSave = {
      ...selections,
      sections: { ...selections.sections }
    };

    ['experience', 'education', 'languages', 'projects', 'extras'].forEach(key => {
      if (selectionsToSave.sections[key]?.items) {
        selectionsToSave.sections[key] = {
          ...selectionsToSave.sections[key],
          maxIndex: cvData?.[key]?.length || 0
        };
      }
    });

    localStorage.setItem(storageKey, JSON.stringify(selectionsToSave));
  }, [currentItem, selections, cvData, getStorageKey]);

  // Fermer le modal (et sauvegarder les sélections)
  const closeModal = useCallback(() => {
    // Sauvegarder les sélections avant de fermer
    saveSelections();
    setIsOpen(false);
    setIsExporting(false);
    setIsPreview(false);
    setPreviewHtml('');
  }, [saveSelections]);

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
      // Sauvegarder les préférences pour ce CV
      saveSelections();

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
          language: cvData?.language || 'fr',  // Utiliser la langue du CV, pas de l'interface
          selections: selections,
          customFilename: filename
        }),
      });

      if (!response.ok) {
        console.log('[useExportModal] Erreur API, status:', response.status);

        // Arrêter le loading immédiatement
        setIsExporting(false);

        // Parser l'erreur de l'API avec gestion d'erreur
        let errorData = {};
        try {
          errorData = await response.json();
          console.log('[useExportModal] Error data:', errorData);
        } catch (parseError) {
          console.error('[useExportModal] Erreur parsing JSON:', parseError);
          errorData = { error: 'Erreur lors de l\'export PDF' };
        }

        // Fermer le modal immédiatement
        closeModal();

        // Si l'API retourne actionRequired et redirectUrl (quota/feature désactivée)
        if (errorData.actionRequired && errorData.redirectUrl) {
          console.log('[useExportModal] Action required, affichage notification avec redirect');

          addNotification({
            type: 'error',
            message: errorData.error || 'Accès à cette fonctionnalité limité',
            redirectUrl: errorData.redirectUrl,
            linkText: 'Voir les options',
            duration: 10000, // 10 secondes pour laisser le temps de lire
          });

          // Pas de redirection automatique, l'utilisateur clique sur le bouton
        } else {
          // Notification d'erreur simple sans redirect
          addNotification({
            type: 'error',
            message: errorData.error || 'Erreur lors de l\'export PDF',
            duration: 4000,
          });
        }

        return;
      }

      // Télécharger le PDF
      console.log('[useExportModal] Début téléchargement PDF:', filename);
      const blob = await response.blob();
      // Forcer le type à octet-stream pour garantir le téléchargement au lieu de l'ouverture dans le navigateur
      const forcedBlob = new Blob([blob], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(forcedBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      console.log('[useExportModal] Téléchargement déclenché');
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fermer le modal
      closeModal();

      // Rafraîchir le compteur de crédits (l'export consomme des crédits)
      // Petit délai pour s'assurer que les états React sont à jour après closeModal
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log('[useExportModal] Dispatch événement credits-updated');
          window.dispatchEvent(new Event('credits-updated'));
        }
      }, 100);

      // Émettre l'événement pour l'onboarding (step 8) APRÈS fermeture du modal
      // Délai de 300ms pour garantir que le téléchargement a démarré avant navigation/événements
      setTimeout(() => {
        console.log('[useExportModal] Émission événement EXPORT_CLICKED pour onboarding');
        emitOnboardingEvent(ONBOARDING_EVENTS.EXPORT_CLICKED);
      }, 300);
    } catch (error) {
      console.error('[useExportModal] Erreur catch générale:', error);

      // Arrêter le loading et fermer le modal
      setIsExporting(false);
      closeModal();

      // Notification d'erreur
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de l\'export PDF',
        duration: 4000,
      });
    } finally {
      setIsExporting(false);
    }
  }, [currentItem, filename, selections, language, closeModal, addNotification, router, saveSelections]);

  // Charger la prévisualisation HTML avec indicateurs de saut de page
  const loadPreview = useCallback(async () => {
    if (!currentItem) return;

    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentItem,
          language,
          selections,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la prévisualisation');
      }

      const data = await response.json();
      setPreviewHtml(data.html);
      setIsPreview(true);

      // Sauvegarder les sélections lors de la prévisualisation
      saveSelections();

    } catch (error) {
      console.error('[useExportModal] Erreur prévisualisation:', error);
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de la prévisualisation',
        duration: 4000,
      });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [currentItem, language, selections, addNotification, saveSelections]);

  // Fermer la prévisualisation et revenir aux options
  const closePreview = useCallback(() => {
    setIsPreview(false);
    setPreviewHtml('');
  }, []);

  return {
    isOpen,
    openModal,
    closeModal,
    filename,
    setFilename,
    selections,
    toggleSection,
    toggleSubsection,
    toggleSectionOption,
    toggleItem,
    toggleItemOption,
    selectAll,
    deselectAll,
    exportPdf,
    counters,
    subCounters,
    cvData,
    isExporting,
    isPreview,
    previewHtml,
    isLoadingPreview,
    loadPreview,
    closePreview
  };
}
