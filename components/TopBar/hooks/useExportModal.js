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

  // États pour les templates
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // État pour les éléments de saut de page calculés par la preview
  const [pageBreakElements, setPageBreakElements] = useState([]);

  // Ordre par défaut des sections (sans header qui est toujours premier)
  const DEFAULT_SECTIONS_ORDER = ['summary', 'skills', 'experience', 'education', 'languages', 'projects', 'extras'];
  const [sectionsOrder, setSectionsOrder] = useState(DEFAULT_SECTIONS_ORDER);

  // Structure par défaut des sélections
  // Les sections vides sont désactivées par défaut
  const getDefaultSelections = (cvData) => {
    // Helper pour vérifier si une section a du contenu
    const hasContent = (key) => {
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
    };

    const selections = {
      sections: {
        header: {
          enabled: true,
          subsections: { links: true }
        },
        summary: { enabled: hasContent('summary') },
        skills: {
          enabled: hasContent('skills'),
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
          enabled: hasContent('experience'),
          items: cvData?.experience ? cvData.experience.map((_, index) => index) : [],
          options: {
            hideTechnologies: false,
            hideDescription: false,
            hideDeliverables: false
          }
        },
        education: {
          enabled: hasContent('education'),
          items: cvData?.education ? cvData.education.map((_, index) => index) : []
        },
        languages: {
          enabled: hasContent('languages'),
          items: cvData?.languages ? cvData.languages.map((_, index) => index) : []
        },
        projects: {
          enabled: hasContent('projects'),
          items: cvData?.projects ? cvData.projects.map((_, index) => index) : []
        },
        extras: {
          enabled: hasContent('extras'),
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

              // Charger l'ordre des sections si sauvegardé
              if (parsed.sectionsOrder && Array.isArray(parsed.sectionsOrder)) {
                setSectionsOrder(parsed.sectionsOrder);
              } else {
                setSectionsOrder(DEFAULT_SECTIONS_ORDER);
              }
            } else {
              // Pas de préférences sauvegardées pour ce CV, utiliser les valeurs par défaut
              setSelections(getDefaultSelections(data.cv));
              setSectionsOrder(DEFAULT_SECTIONS_ORDER);
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

  // Calculer les compteurs pour chaque section (basé sur le contenu réel du CV, pas les sélections)
  const counters = useMemo(() => {
    if (!cvData) return {};

    return {
      header: 1, // toujours 1
      summary: cvData.summary?.description ? 1 : 0,
      // Skills: compter le total des compétences dans le CV (pas ce qui est sélectionné)
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
  }, [cvData]);

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

  // Tout sélectionner (y compris tous les items)
  const selectAll = useCallback(() => {
    setSelections(prev => {
      const newSelections = { sections: {} };
      Object.keys(prev.sections).forEach(key => {
        const section = prev.sections[key];
        // Recalculer tous les indices d'items depuis cvData
        let allItems = undefined;
        if (section.items !== undefined && cvData?.[key]) {
          allItems = cvData[key].map((_, index) => index);
        } else if (section.items !== undefined) {
          // Fallback si cvData n'est pas disponible
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
  }, [cvData]);

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
            ...section, // Conserver options, itemsOptions, etc.
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
      if (index <= 0) return prev; // Déjà en haut
      const newOrder = [...prev];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  }, []);

  // Déplacer une section vers le bas
  const moveSectionDown = useCallback((sectionKey) => {
    setSectionsOrder(prev => {
      const index = prev.indexOf(sectionKey);
      if (index < 0 || index >= prev.length - 1) return prev; // Déjà en bas
      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  }, []);

  // Réinitialiser l'ordre des sections
  const resetSectionsOrder = useCallback(() => {
    setSectionsOrder(DEFAULT_SECTIONS_ORDER);
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

  // Écouter les messages de l'iframe de preview pour recevoir les éléments de saut de page
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'pageBreakElements') {
        setPageBreakElements(event.data.elements || []);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
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

    // Inclure l'ordre des sections
    selectionsToSave.sectionsOrder = sectionsOrder;

    localStorage.setItem(storageKey, JSON.stringify(selectionsToSave));
  }, [currentItem, selections, cvData, getStorageKey, sectionsOrder]);

  // Fermer le modal (et sauvegarder les sélections)
  const closeModal = useCallback(() => {
    // Sauvegarder les sélections avant de fermer
    saveSelections();
    setIsOpen(false);
    setIsExporting(false);
    setIsPreview(false);
    setPreviewHtml('');
  }, [saveSelections]);

  // État pour l'export Word
  const [isExportingWord, setIsExportingWord] = useState(false);

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
          sectionsOrder: sectionsOrder,
          customFilename: filename,
          pageBreakElements: pageBreakElements  // Éléments où forcer les sauts de page
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
  }, [currentItem, filename, selections, language, closeModal, addNotification, router, saveSelections, pageBreakElements, sectionsOrder, cvData]);

  // Exporter en Word
  const exportWord = useCallback(async () => {
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

    setIsExportingWord(true);

    try {
      // Sauvegarder les préférences pour ce CV
      saveSelections();

      // Préparer le nom du fichier
      const currentFilename = typeof currentItem === 'string'
        ? currentItem
        : (currentItem.file || currentItem.filename || currentItem.name);

      // Appeler l'API d'export Word
      const response = await fetch('/api/export-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: currentFilename,
          language: cvData?.language || 'fr',
          selections: selections,
          sectionsOrder: sectionsOrder,
          customFilename: filename
        }),
      });

      if (!response.ok) {
        console.log('[useExportModal] Erreur API Word, status:', response.status);

        // Arrêter le loading immédiatement
        setIsExportingWord(false);

        // Parser l'erreur de l'API avec gestion d'erreur
        let errorData = {};
        try {
          errorData = await response.json();
          console.log('[useExportModal] Error data:', errorData);
        } catch (parseError) {
          console.error('[useExportModal] Erreur parsing JSON:', parseError);
          errorData = { error: 'Erreur lors de l\'export Word' };
        }

        // Fermer le modal immédiatement
        closeModal();

        // Si l'API retourne actionRequired et redirectUrl (quota/feature désactivée)
        if (errorData.actionRequired && errorData.redirectUrl) {
          addNotification({
            type: 'error',
            message: errorData.error || 'Accès à cette fonctionnalité limité',
            redirectUrl: errorData.redirectUrl,
            linkText: 'Voir les options',
            duration: 10000,
          });
        } else {
          // Notification d'erreur simple sans redirect
          addNotification({
            type: 'error',
            message: errorData.error || 'Erreur lors de l\'export Word',
            duration: 4000,
          });
        }

        return;
      }

      // Télécharger le fichier Word
      console.log('[useExportModal] Début téléchargement Word:', filename);
      const blob = await response.blob();
      const forcedBlob = new Blob([blob], { type: 'application/octet-stream' });
      const url = window.URL.createObjectURL(forcedBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      console.log('[useExportModal] Téléchargement Word déclenché');
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fermer le modal
      closeModal();

      // Rafraîchir le compteur de crédits
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log('[useExportModal] Dispatch événement credits-updated');
          window.dispatchEvent(new Event('credits-updated'));
        }
      }, 100);

    } catch (error) {
      console.error('[useExportModal] Erreur catch générale Word:', error);

      // Arrêter le loading et fermer le modal
      setIsExportingWord(false);
      closeModal();

      // Notification d'erreur
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de l\'export Word',
        duration: 4000,
      });
    } finally {
      setIsExportingWord(false);
    }
  }, [currentItem, filename, selections, cvData, sectionsOrder, closeModal, addNotification, saveSelections]);

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
          sectionsOrder,
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

  // ============================================
  // Gestion des templates d'export
  // ============================================

  // Charger les templates depuis l'API
  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch('/api/export-templates');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des templates');
      }
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('[useExportModal] Erreur chargement templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  // Charger les templates au montage du modal
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  // Extraire la configuration macro des sélections courantes (sans les items individuels)
  const extractMacroSelections = useCallback(() => {
    const macroSelections = { sections: {}, sectionsOrder: sectionsOrder };

    Object.keys(selections.sections).forEach(sectionKey => {
      const section = selections.sections[sectionKey];
      macroSelections.sections[sectionKey] = {
        enabled: section.enabled,
      };

      // Copier les subsections si elles existent
      if (section.subsections) {
        macroSelections.sections[sectionKey].subsections = { ...section.subsections };
      }

      // Copier les options si elles existent
      if (section.options) {
        macroSelections.sections[sectionKey].options = { ...section.options };
      }

      // Ne PAS copier les items (c'est le niveau micro)
    });

    return macroSelections;
  }, [selections, sectionsOrder]);

  // Sauvegarder les sélections actuelles comme template
  const saveAsTemplate = useCallback(async (templateName) => {
    if (!templateName || !templateName.trim()) {
      return { ok: false, error: 'Le nom du template est requis' };
    }

    setIsSavingTemplate(true);
    try {
      const macroSelections = extractMacroSelections();

      const response = await fetch('/api/export-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName.trim(),
          selections: macroSelections,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { ok: false, error: data.error || 'Erreur lors de la sauvegarde', code: data.code };
      }

      // Rafraîchir la liste des templates
      await fetchTemplates();

      return { ok: true, template: data.template };
    } catch (error) {
      console.error('[useExportModal] Erreur sauvegarde template:', error);
      return { ok: false, error: error.message || 'Erreur lors de la sauvegarde' };
    } finally {
      setIsSavingTemplate(false);
    }
  }, [extractMacroSelections, fetchTemplates]);

  // Appliquer un template aux sélections courantes
  const applyTemplate = useCallback((template) => {
    if (!template?.selections?.sections) return;

    setSelections(prev => {
      const newSelections = { sections: {} };

      Object.keys(prev.sections).forEach(sectionKey => {
        const prevSection = prev.sections[sectionKey];
        const templateSection = template.selections.sections[sectionKey];

        if (templateSection) {
          newSelections.sections[sectionKey] = {
            // Garder les items et itemsOptions existants (niveau micro)
            ...prevSection,
            // Appliquer enabled du template
            enabled: templateSection.enabled,
          };

          // Appliquer les subsections du template si elles existent
          if (templateSection.subsections) {
            newSelections.sections[sectionKey].subsections = { ...templateSection.subsections };
          }

          // Appliquer les options du template si elles existent
          if (templateSection.options) {
            newSelections.sections[sectionKey].options = { ...templateSection.options };
          }
        } else {
          // Section non présente dans le template, garder l'état actuel
          newSelections.sections[sectionKey] = { ...prevSection };
        }
      });

      return newSelections;
    });

    // Appliquer l'ordre des sections du template si disponible
    if (template.selections.sectionsOrder && Array.isArray(template.selections.sectionsOrder)) {
      setSectionsOrder(template.selections.sectionsOrder);
    }
  }, []);

  // Supprimer un template
  const deleteTemplate = useCallback(async (templateId) => {
    try {
      const response = await fetch(`/api/export-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        return { ok: false, error: data.error || 'Erreur lors de la suppression' };
      }

      // Rafraîchir la liste des templates
      await fetchTemplates();

      return { ok: true };
    } catch (error) {
      console.error('[useExportModal] Erreur suppression template:', error);
      return { ok: false, error: error.message || 'Erreur lors de la suppression' };
    }
  }, [fetchTemplates]);

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
    exportWord,
    isExportingWord,
    counters,
    subCounters,
    cvData,
    isExporting,
    isPreview,
    previewHtml,
    isLoadingPreview,
    loadPreview,
    closePreview,
    // Templates
    templates,
    isLoadingTemplates,
    isSavingTemplate,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate,
    // Ordre des sections
    sectionsOrder,
    setSectionsOrder,
    resetSectionsOrder
  };
}
