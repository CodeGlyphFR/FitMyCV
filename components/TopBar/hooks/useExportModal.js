import { useState, useEffect, useCallback, useMemo } from 'react';
import { ONBOARDING_EVENTS } from '@/lib/onboarding/onboardingEvents';
import {
  generateInitials,
  getDefaultSelections,
  migrateSelections,
  calculateCounters,
  calculateSubCounters
} from '@/lib/export/selectionHelpers';
import {
  getCvFilename,
  saveSelections as saveSelectionsToStorage,
  loadSelections,
  fetchCvData
} from '@/lib/export/exportStorage';
import {
  useExportSelections,
  DEFAULT_SECTIONS_ORDER
} from './export/useExportSelections';
import { useExportTemplates } from './export/useExportTemplates';
import { useExportDownload } from './export/useExportDownload';
import { useExportPreview } from './export/useExportPreview';

/**
 * Hook pour gérer le modal d'export PDF/Word
 * @param {Object} currentItem - Le CV actuellement sélectionné
 * @param {string} language - Langue courante
 * @param {Function} addNotification - Fonction pour afficher les notifications
 * @returns {Object} État et fonctions pour le modal d'export
 */
export function useExportModal({ currentItem, language, addNotification, t }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filename, setFilename] = useState('');
  const [cvData, setCvData] = useState(null);

  // Hook pour les sélections
  const {
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
    selectAll: selectAllBase,
    deselectAll,
    moveSectionUp,
    moveSectionDown,
    resetSectionsOrder
  } = useExportSelections();

  // Wrapper selectAll pour passer cvData
  const selectAll = useCallback(() => {
    selectAllBase(cvData);
  }, [selectAllBase, cvData]);

  // Fonction pour sauvegarder les sélections
  const saveSelections = useCallback(() => {
    saveSelectionsToStorage(currentItem, selections, cvData, sectionsOrder);
  }, [currentItem, selections, cvData, sectionsOrder]);

  // Hook pour la preview
  const {
    isPreview,
    previewHtml,
    isLoadingPreview,
    pageBreakElements,
    loadPreview: loadPreviewBase,
    closePreview,
    resetPreview
  } = useExportPreview({
    currentItem,
    language,
    selections,
    sectionsOrder,
    addNotification,
    saveSelections
  });

  // Wrapper loadPreview pour s'assurer que les deps sont à jour
  const loadPreview = useCallback(async () => {
    await loadPreviewBase();
  }, [loadPreviewBase]);

  // Fermer le modal (et sauvegarder les sélections)
  const closeModal = useCallback(() => {
    saveSelections();
    setIsOpen(false);
    resetPreview();
  }, [saveSelections, resetPreview]);

  // Hook pour les templates
  const {
    templates,
    isLoadingTemplates,
    isSavingTemplate,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate
  } = useExportTemplates({
    isOpen,
    selections,
    sectionsOrder,
    setSelections,
    setSectionsOrder
  });

  // Hook pour l'export
  const {
    isExporting,
    isExportingWord,
    exportPdf,
    exportWord
  } = useExportDownload({
    currentItem,
    filename,
    selections,
    cvData,
    sectionsOrder,
    pageBreakElements,
    closeModal,
    addNotification,
    saveSelections,
    t
  });

  // Calculer les compteurs
  const counters = useMemo(() => calculateCounters(cvData), [cvData]);
  const subCounters = useMemo(() => calculateSubCounters(cvData), [cvData]);

  // Charger les données du CV quand le modal s'ouvre
  useEffect(() => {
    if (!isOpen || !currentItem) return;

    const cvFilename = getCvFilename(currentItem);

    fetchCvData(cvFilename).then(data => {
      if (data) {
        setCvData(data);

        // Générer le nom de fichier par défaut
        const initials = generateInitials(data?.header?.full_name);
        const title = data?.header?.current_title?.replace(/\s+/g, '_') || '';
        const defaultFilename = initials && title
          ? `CV_${initials}_${title}`
          : cvFilename.replace('.json', '');
        setFilename(defaultFilename);

        // Charger les préférences sauvegardées ou utiliser les valeurs par défaut
        const saved = loadSelections(cvFilename);
        if (saved) {
          const migrated = migrateSelections(saved, data);
          resetSelections(data, migrated, saved.sectionsOrder);
        } else {
          resetSelections(data);
        }
      }
    }).catch(err => {
      console.error('[useExportModal] Erreur chargement CV:', err);
      resetSelections(null);
    });
  }, [isOpen, currentItem, resetSelections]);

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

  return {
    // État modal
    isOpen,
    openModal,
    closeModal,
    filename,
    setFilename,
    cvData,

    // Sélections
    selections,
    toggleSection,
    toggleSubsection,
    toggleSectionOption,
    toggleItem,
    toggleItemOption,
    selectAll,
    deselectAll,

    // Compteurs
    counters,
    subCounters,

    // Export
    exportPdf,
    exportWord,
    isExporting,
    isExportingWord,

    // Preview
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
    moveSectionUp,
    moveSectionDown,
    resetSectionsOrder
  };
}
