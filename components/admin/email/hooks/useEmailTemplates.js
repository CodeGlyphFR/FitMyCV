'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing email templates state
 */
export function useEmailTemplates({ refreshKey, onLogsRefresh }) {
  // State
  const [triggers, setTriggers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [triggerTemplates, setTriggerTemplates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copyFromTemplateId, setCopyFromTemplateId] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});

  // Fetch triggers from API
  const fetchTriggers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-triggers');
      if (!res.ok) throw new Error('Failed to fetch triggers');
      const data = await res.json();
      setTriggers(data.triggers || []);
    } catch (error) {
      console.error('Error fetching triggers:', error);
      setToast({ type: 'error', message: 'Erreur lors du chargement des triggers' });
    }
  }, []);

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTriggers(), fetchTemplates()]);
      setLoading(false);
    };
    loadData();
  }, [refreshKey, fetchTriggers, fetchTemplates]);

  // Fetch templates for a specific trigger
  const fetchTriggerTemplates = useCallback(async (triggerName) => {
    try {
      const res = await fetch(`/api/admin/email-triggers/${triggerName}/templates`);
      if (!res.ok) throw new Error('Failed to fetch trigger templates');
      const data = await res.json();
      setTriggerTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching trigger templates:', error);
      setTriggerTemplates([]);
    }
  }, []);

  // Handle trigger selection
  const handleSelectTrigger = useCallback(async (trigger) => {
    setSelectedTrigger(trigger);
    setSelectedTemplate(null);
    setShowNewTemplateForm(false);
    await fetchTriggerTemplates(trigger.name);
  }, [fetchTriggerTemplates]);

  // Handle edit template (open modal)
  const handleEditTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setEditorModalOpen(true);
  }, []);

  // Handle save from modal
  const handleSaveFromModal = useCallback(async ({ name, subject, htmlContent }) => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          designJson: '{}',
          htmlContent,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      const result = await res.json();

      setTemplates((prev) =>
        prev.map((t) => (t.id === result.template.id ? result.template : t))
      );
      setSelectedTemplate(result.template);

      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template sauvegarde avec succes' });
      setEditorModalOpen(false);
    } catch (error) {
      console.error('Error saving template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  }, [selectedTemplate, selectedTrigger, fetchTriggerTemplates]);

  // Handle preview stored HTML
  const handlePreviewHtml = useCallback((template) => {
    if (!template?.htmlContent) {
      setToast({ type: 'error', message: 'Aucun HTML stocke' });
      return;
    }
    setSelectedTemplate(template);
    setPreviewHtml(template.htmlContent);
    setPreviewOpen(true);
  }, []);

  // Handle activate template
  const handleActivateTemplate = useCallback(async (templateId) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}/activate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to activate');
      }

      await fetchTriggers();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template activé avec succès' });
    } catch (error) {
      console.error('Error activating template:', error);
      setToast({ type: 'error', message: error.message || "Erreur lors de l'activation" });
    }
  }, [selectedTrigger, fetchTriggers, fetchTriggerTemplates]);

  // Handle create new template
  const handleCreateTemplate = useCallback(async () => {
    if (!selectedTrigger || !newTemplateName.trim()) {
      setToast({ type: 'error', message: 'Nom du template requis' });
      return;
    }

    try {
      const body = {
        name: newTemplateName.trim(),
        subject: `${selectedTrigger.label} - FitMyCV.io`,
      };

      if (copyFromTemplateId) {
        body.copyFromTemplateId = copyFromTemplateId;
      }

      const res = await fetch(`/api/admin/email-triggers/${selectedTrigger.name}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create template');
      }

      const result = await res.json();

      await fetchTriggerTemplates(selectedTrigger.name);
      await fetchTemplates();
      setSelectedTemplate(result.template);
      setNewTemplateName('');
      setCopyFromTemplateId('');
      setShowNewTemplateForm(false);

      setToast({ type: 'success', message: 'Template créé avec succès' });
    } catch (error) {
      console.error('Error creating template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la création' });
    }
  }, [selectedTrigger, newTemplateName, copyFromTemplateId, fetchTriggerTemplates, fetchTemplates]);

  // Handle set template as default
  const handleSetDefault = useCallback(async (templateId) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}/set-default`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to set as default');
      }

      await fetchTemplates();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template défini par défaut' });
    } catch (error) {
      console.error('Error setting default:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la définition par défaut' });
    }
  }, [selectedTrigger, fetchTemplates, fetchTriggerTemplates]);

  // Handle remove default status
  const handleRemoveDefault = useCallback(async (templateId) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}/set-default`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove default');
      }

      await fetchTemplates();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Statut par défaut retiré' });
    } catch (error) {
      console.error('Error removing default:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors du retrait du statut par défaut' });
    }
  }, [selectedTrigger, fetchTemplates, fetchTriggerTemplates]);

  // Handle delete template
  const handleDeleteTemplate = useCallback(async (templateId) => {
    if (!confirm('Supprimer ce template ?')) return;

    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }

      await fetchTriggers();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }

      setToast({ type: 'success', message: 'Template supprimé' });
    } catch (error) {
      console.error('Error deleting template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la suppression' });
    }
  }, [selectedTrigger, selectedTemplate, fetchTriggers, fetchTriggerTemplates]);

  // Toggle category expansion
  const toggleCategory = useCallback((category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);

  // Group triggers by category
  const triggersByCategory = triggers.reduce((acc, trigger) => {
    const category = trigger.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(trigger);
    return acc;
  }, {});

  // Back to triggers list
  const backToTriggers = useCallback(() => {
    setSelectedTrigger(null);
  }, []);

  // Close editor modal
  const closeEditorModal = useCallback(() => {
    setEditorModalOpen(false);
    setSelectedTemplate(null);
  }, []);

  // Close preview modal
  const closePreviewModal = useCallback(() => {
    setPreviewOpen(false);
  }, []);

  // Cancel new template form
  const cancelNewTemplateForm = useCallback(() => {
    setShowNewTemplateForm(false);
    setNewTemplateName('');
    setCopyFromTemplateId('');
  }, []);

  return {
    // State
    triggers,
    templates,
    loading,
    selectedTrigger,
    selectedTemplate,
    triggerTemplates,
    saving,
    toast,
    setToast,
    previewOpen,
    previewHtml,
    editorModalOpen,
    showNewTemplateForm,
    setShowNewTemplateForm,
    newTemplateName,
    setNewTemplateName,
    copyFromTemplateId,
    setCopyFromTemplateId,
    expandedCategories,
    triggersByCategory,
    // Actions
    handleSelectTrigger,
    handleEditTemplate,
    handleSaveFromModal,
    handlePreviewHtml,
    handleActivateTemplate,
    handleCreateTemplate,
    handleSetDefault,
    handleRemoveDefault,
    handleDeleteTemplate,
    toggleCategory,
    backToTriggers,
    closeEditorModal,
    closePreviewModal,
    cancelNewTemplateForm,
    onLogsRefresh,
  };
}
