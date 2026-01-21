import { useState, useCallback } from 'react';
import { ONBOARDING_EVENTS, emitOnboardingEvent } from '@/lib/onboarding/onboardingEvents';
import { getCvFilename } from '@/lib/export/exportStorage';

/**
 * Télécharge un blob comme fichier
 * @param {Blob} blob - Blob à télécharger
 * @param {string} filename - Nom du fichier
 */
function downloadBlob(blob, filename) {
  const forcedBlob = new Blob([blob], { type: 'application/octet-stream' });
  const url = window.URL.createObjectURL(forcedBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Gère les erreurs d'API d'export
 * @param {Response} response - Réponse de l'API
 * @param {string} formatName - Nom du format (PDF/Word)
 * @param {Function} addNotification - Fonction de notification
 */
async function handleExportError(response, formatName, addNotification) {
  let errorData = {};
  try {
    errorData = await response.json();
    console.log(`[useExportDownload] Error data:`, errorData);
  } catch (parseError) {
    console.error(`[useExportDownload] Erreur parsing JSON:`, parseError);
    errorData = { error: `Erreur lors de l'export ${formatName}` };
  }

  if (errorData.actionRequired && errorData.redirectUrl) {
    addNotification({
      type: 'error',
      message: errorData.error || 'Accès à cette fonctionnalité limité',
      redirectUrl: errorData.redirectUrl,
      linkText: 'Voir les options',
      duration: 10000,
    });
  } else {
    addNotification({
      type: 'error',
      message: errorData.error || `Erreur lors de l'export ${formatName}`,
      duration: 4000,
    });
  }
}

/**
 * Hook pour gérer les exports PDF et Word
 * @param {Object} params - Paramètres
 * @returns {Object} État et fonctions d'export
 */
export function useExportDownload({
  currentItem,
  filename,
  selections,
  cvData,
  sectionsOrder,
  pageBreakElements,
  closeModal,
  addNotification,
  saveSelections
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);

  // Exporter le PDF
  const exportPdf = useCallback(async () => {
    if (!currentItem || !filename.trim()) {
      alert('Nom de fichier manquant');
      return;
    }

    const hasSelection = Object.values(selections.sections).some(s => s.enabled);
    if (!hasSelection) {
      alert('Veuillez sélectionner au moins une section');
      return;
    }

    setIsExporting(true);

    try {
      saveSelections();

      const currentFilename = getCvFilename(currentItem);

      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentFilename,
          language: cvData?.language || 'fr',
          selections,
          sectionsOrder,
          customFilename: filename,
          pageBreakElements
        }),
      });

      if (!response.ok) {
        console.log('[useExportDownload] Erreur API, status:', response.status);
        setIsExporting(false);
        closeModal();
        await handleExportError(response, 'PDF', addNotification);
        return;
      }

      console.log('[useExportDownload] Début téléchargement PDF:', filename);
      const blob = await response.blob();
      downloadBlob(blob, `${filename}.pdf`);
      console.log('[useExportDownload] Téléchargement déclenché');

      closeModal();

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log('[useExportDownload] Dispatch événement credits-updated');
          window.dispatchEvent(new Event('credits-updated'));
        }
      }, 100);

      setTimeout(() => {
        console.log('[useExportDownload] Émission événement EXPORT_CLICKED pour onboarding');
        emitOnboardingEvent(ONBOARDING_EVENTS.EXPORT_CLICKED);
      }, 300);
    } catch (error) {
      console.error('[useExportDownload] Erreur catch générale:', error);
      setIsExporting(false);
      closeModal();
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de l\'export PDF',
        duration: 4000,
      });
    } finally {
      setIsExporting(false);
    }
  }, [currentItem, filename, selections, cvData, sectionsOrder, pageBreakElements, closeModal, addNotification, saveSelections]);

  // Exporter en Word
  const exportWord = useCallback(async () => {
    if (!currentItem || !filename.trim()) {
      alert('Nom de fichier manquant');
      return;
    }

    const hasSelection = Object.values(selections.sections).some(s => s.enabled);
    if (!hasSelection) {
      alert('Veuillez sélectionner au moins une section');
      return;
    }

    setIsExportingWord(true);

    try {
      saveSelections();

      const currentFilename = getCvFilename(currentItem);

      const response = await fetch('/api/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: currentFilename,
          language: cvData?.language || 'fr',
          selections,
          sectionsOrder,
          customFilename: filename
        }),
      });

      if (!response.ok) {
        console.log('[useExportDownload] Erreur API Word, status:', response.status);
        setIsExportingWord(false);
        closeModal();
        await handleExportError(response, 'Word', addNotification);
        return;
      }

      console.log('[useExportDownload] Début téléchargement Word:', filename);
      const blob = await response.blob();
      downloadBlob(blob, `${filename}.docx`);
      console.log('[useExportDownload] Téléchargement Word déclenché');

      closeModal();

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          console.log('[useExportDownload] Dispatch événement credits-updated');
          window.dispatchEvent(new Event('credits-updated'));
        }
      }, 100);
    } catch (error) {
      console.error('[useExportDownload] Erreur catch générale Word:', error);
      setIsExportingWord(false);
      closeModal();
      addNotification({
        type: 'error',
        message: error.message || 'Erreur lors de l\'export Word',
        duration: 4000,
      });
    } finally {
      setIsExportingWord(false);
    }
  }, [currentItem, filename, selections, cvData, sectionsOrder, closeModal, addNotification, saveSelections]);

  return {
    isExporting,
    isExportingWord,
    exportPdf,
    exportWord
  };
}
