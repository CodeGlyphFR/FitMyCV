import { useState, useCallback, useEffect } from 'react';

/**
 * Hook pour gérer la prévisualisation d'export
 * @param {Object} params - Paramètres
 * @returns {Object} État et fonctions de prévisualisation
 */
export function useExportPreview({
  currentItem,
  language,
  selections,
  sectionsOrder,
  addNotification,
  saveSelections
}) {
  const [isPreview, setIsPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pageBreakElements, setPageBreakElements] = useState([]);

  // Écouter les messages de l'iframe de preview pour recevoir les éléments de saut de page
  useEffect(() => {
    const handleMessage = (event) => {
      // Valider l'origine pour éviter l'injection de données par des iframes tierces
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'pageBreakElements') {
        setPageBreakElements(event.data.elements || []);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

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

      saveSelections();
    } catch (error) {
      console.error('[useExportPreview] Erreur prévisualisation:', error);
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de la prévisualisation',
        duration: 4000,
      });
    } finally {
      setIsLoadingPreview(false);
    }
  }, [currentItem, language, selections, sectionsOrder, addNotification, saveSelections]);

  // Fermer la prévisualisation et revenir aux options
  const closePreview = useCallback(() => {
    setIsPreview(false);
    setPreviewHtml('');
  }, []);

  // Reset preview state
  const resetPreview = useCallback(() => {
    setIsPreview(false);
    setPreviewHtml('');
    setPageBreakElements([]);
  }, []);

  return {
    isPreview,
    previewHtml,
    isLoadingPreview,
    pageBreakElements,
    loadPreview,
    closePreview,
    resetPreview
  };
}
