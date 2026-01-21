import { useState, useCallback, useEffect } from 'react';
import { extractMacroSelections } from '@/lib/export/selectionHelpers';

/**
 * Hook pour gérer les templates d'export
 * @param {boolean} isOpen - Si le modal est ouvert
 * @param {Object} selections - Sélections actuelles
 * @param {string[]} sectionsOrder - Ordre des sections
 * @param {Function} setSelections - Setter pour les sélections
 * @param {Function} setSectionsOrder - Setter pour l'ordre des sections
 * @returns {Object} État et fonctions de gestion des templates
 */
export function useExportTemplates({ isOpen, selections, sectionsOrder, setSelections, setSectionsOrder }) {
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

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
      console.error('[useExportTemplates] Erreur chargement templates:', error);
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

  // Sauvegarder les sélections actuelles comme template
  const saveAsTemplate = useCallback(async (templateName) => {
    if (!templateName || !templateName.trim()) {
      return { ok: false, error: 'Le nom du template est requis' };
    }

    setIsSavingTemplate(true);
    try {
      const macroSelections = extractMacroSelections(selections, sectionsOrder);

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

      await fetchTemplates();
      return { ok: true, template: data.template };
    } catch (error) {
      console.error('[useExportTemplates] Erreur sauvegarde template:', error);
      return { ok: false, error: error.message || 'Erreur lors de la sauvegarde' };
    } finally {
      setIsSavingTemplate(false);
    }
  }, [selections, sectionsOrder, fetchTemplates]);

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
            ...prevSection,
            enabled: templateSection.enabled,
          };

          if (templateSection.subsections) {
            newSelections.sections[sectionKey].subsections = { ...templateSection.subsections };
          }

          if (templateSection.options) {
            newSelections.sections[sectionKey].options = { ...templateSection.options };
          }
        } else {
          newSelections.sections[sectionKey] = { ...prevSection };
        }
      });

      return newSelections;
    });

    if (template.selections.sectionsOrder && Array.isArray(template.selections.sectionsOrder)) {
      setSectionsOrder(template.selections.sectionsOrder);
    }
  }, [setSelections, setSectionsOrder]);

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

      await fetchTemplates();
      return { ok: true };
    } catch (error) {
      console.error('[useExportTemplates] Erreur suppression template:', error);
      return { ok: false, error: error.message || 'Erreur lors de la suppression' };
    }
  }, [fetchTemplates]);

  return {
    templates,
    isLoadingTemplates,
    isSavingTemplate,
    saveAsTemplate,
    applyTemplate,
    deleteTemplate,
    fetchTemplates
  };
}
