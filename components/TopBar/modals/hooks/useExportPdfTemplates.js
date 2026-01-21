'use client';

import { useState, useCallback } from 'react';

/**
 * Hook for managing export PDF template state
 */
export function useExportPdfTemplates({ templates, saveAsTemplate, applyTemplate, deleteTemplate }) {
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);

  // Handle template name change
  const handleTemplateNameChange = useCallback((value) => {
    setNewTemplateName(value);
    setTemplateError('');
  }, []);

  // Handle save template (new)
  const handleSaveNewTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) return;

    const result = await saveAsTemplate(newTemplateName);
    if (result.ok) {
      setShowSaveInput(false);
      setNewTemplateName('');
      setTemplateError('');
      if (result.template?.id) {
        setSelectedTemplateId(result.template.id);
      }
    } else {
      setTemplateError(result.error);
    }
    return result;
  }, [newTemplateName, saveAsTemplate]);

  // Handle key down in template input
  const handleTemplateInputKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter' && newTemplateName.trim()) {
      await handleSaveNewTemplate();
    } else if (e.key === 'Escape') {
      setShowSaveInput(false);
      setNewTemplateName('');
      setTemplateError('');
    }
  }, [newTemplateName, handleSaveNewTemplate]);

  // Cancel template save
  const cancelTemplateSave = useCallback(() => {
    setShowSaveInput(false);
    setNewTemplateName('');
    setTemplateError('');
  }, []);

  // Handle template selection
  const handleSelectTemplate = useCallback((template) => {
    setSelectedTemplateId(template.id);
    applyTemplate(template);
    setShowTemplateDropdown(false);
  }, [applyTemplate]);

  // Handle reset template (reapply selected)
  const handleResetTemplate = useCallback(() => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      applyTemplate(template);
    }
  }, [templates, selectedTemplateId, applyTemplate]);

  // Handle update existing template
  const handleUpdateTemplate = useCallback(async () => {
    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    if (!selectedTemplate) return;

    // Delete then recreate to overwrite
    await deleteTemplate(selectedTemplateId);
    const newResult = await saveAsTemplate(selectedTemplate.name);
    if (newResult.ok && newResult.template?.id) {
      setSelectedTemplateId(newResult.template.id);
    }
    setShowSaveDropdown(false);
  }, [templates, selectedTemplateId, deleteTemplate, saveAsTemplate]);

  // Handle delete template
  const handleDeleteTemplate = useCallback(async () => {
    await deleteTemplate(selectedTemplateId);
    setSelectedTemplateId('');
  }, [selectedTemplateId, deleteTemplate]);

  // Handle save button click
  const handleSaveButtonClick = useCallback(() => {
    if (selectedTemplateId) {
      // Template selected: show dropdown
      setShowSaveDropdown(!showSaveDropdown);
      setShowTemplateDropdown(false);
    } else {
      // No template selected: create new directly
      setShowSaveInput(true);
    }
  }, [selectedTemplateId, showSaveDropdown]);

  // Start creating new template
  const startCreateNewTemplate = useCallback(() => {
    setShowSaveDropdown(false);
    setShowSaveInput(true);
  }, []);

  return {
    // State
    showSaveInput,
    newTemplateName,
    templateError,
    selectedTemplateId,
    showTemplateDropdown,
    showSaveDropdown,
    // Setters
    setShowTemplateDropdown,
    setShowSaveDropdown,
    // Actions
    handleTemplateNameChange,
    handleSaveNewTemplate,
    handleTemplateInputKeyDown,
    cancelTemplateSave,
    handleSelectTemplate,
    handleResetTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleSaveButtonClick,
    startCreateNewTemplate,
  };
}
