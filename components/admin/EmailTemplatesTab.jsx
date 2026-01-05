'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EmailPreviewModal } from './EmailPreviewModal';
import { EmailLogsTable } from './EmailLogsTable';
import { EmailStatsKPIs } from './EmailStatsKPIs';
import { Toast } from './Toast';
import { MailyEditor, getEditorJSON, getEditorHTML } from './MailyEditor';
import { ImagePickerModal } from './ImagePickerModal';
import { render } from '@maily-to/render';
import { CATEGORY_LABELS } from '@/lib/email/triggers';

/**
 * EmailTemplatesTab - Gestion des templates email avec triggers
 */
export function EmailTemplatesTab({ refreshKey }) {
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
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [editorReady, setEditorReady] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editName, setEditName] = useState('');
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copyFromTemplateId, setCopyFromTemplateId] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');

  // Ref for editor instance
  const editorRef = useRef(null);

  // Fetch triggers from API
  const fetchTriggers = async () => {
    try {
      const res = await fetch('/api/admin/email-triggers');
      if (!res.ok) throw new Error('Failed to fetch triggers');
      const data = await res.json();
      setTriggers(data.triggers || []);
    } catch (error) {
      console.error('Error fetching triggers:', error);
      setToast({ type: 'error', message: 'Erreur lors du chargement des triggers' });
    }
  };

  // Fetch all templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/email-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTriggers(), fetchTemplates()]);
      setLoading(false);
    };
    loadData();
  }, [refreshKey]);

  // Fetch templates for a specific trigger
  const fetchTriggerTemplates = async (triggerName) => {
    try {
      const res = await fetch(`/api/admin/email-triggers/${triggerName}/templates`);
      if (!res.ok) throw new Error('Failed to fetch trigger templates');
      const data = await res.json();
      setTriggerTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching trigger templates:', error);
      setTriggerTemplates([]);
    }
  };

  // Handle trigger selection
  const handleSelectTrigger = async (trigger) => {
    setSelectedTrigger(trigger);
    setSelectedTemplate(null);
    setEditorReady(false);
    setShowNewTemplateForm(false);
    editorRef.current = null;

    await fetchTriggerTemplates(trigger.name);
  };

  // Handle template selection
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setEditSubject(template?.subject || '');
    setEditName(template?.name || '');
    setEditorReady(false);
    setShowNewTemplateForm(false);
    editorRef.current = null;

    // Load background color from designJson if available
    try {
      const design = template?.designJson ? JSON.parse(template.designJson) : null;
      setBackgroundColor(design?.backgroundColor || '#ffffff');
    } catch {
      setBackgroundColor('#ffffff');
    }
  };

  // Handle editor ready
  const handleEditorReady = useCallback((editor) => {
    editorRef.current = editor;
    setEditorReady(true);
  }, []);

  // Handle editor change
  const handleEditorChange = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  // Handle image selection from picker
  const handleImageSelect = useCallback((imagePath) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Get the full URL for the image
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const fullUrl = `${siteUrl}${imagePath}`;

    // Insert image at current cursor position using TipTap's setImage command
    editor.chain().focus().setImage({ src: fullUrl }).run();

    setToast({ type: 'success', message: 'Image inseree' });
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!selectedTemplate) return;

    const editor = editorRef.current;
    if (!editor) {
      setToast({ type: 'error', message: 'Editeur non pret' });
      return;
    }

    setSaving(true);
    try {
      // Get JSON and render HTML
      const editorContent = getEditorJSON(editor);

      // Add backgroundColor to the design JSON
      const designJson = {
        ...editorContent,
        backgroundColor,
      };

      let htmlContent = '';
      try {
        // Render with Maily - it generates a complete HTML document
        htmlContent = await render(editorContent);

        // Simple background color replacement - don't overcomplicate
        htmlContent = htmlContent.replace(/background-color:\s*#ffffff/gi, `background-color:${backgroundColor}`);
        htmlContent = htmlContent.replace(/background-color:\s*white/gi, `background-color:${backgroundColor}`);
      } catch (renderError) {
        console.error('Error rendering HTML:', renderError);
        // Fallback to editor HTML if render fails
        htmlContent = getEditorHTML(editor);
      }

      // Save to API
      const res = await fetch(`/api/admin/email-templates/${selectedTemplate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          subject: editSubject,
          designJson: JSON.stringify(designJson),
          htmlContent,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      const result = await res.json();

      // Update local state
      setTemplates((prev) =>
        prev.map((t) => (t.id === result.template.id ? result.template : t))
      );
      setSelectedTemplate(result.template);

      // Refresh trigger templates list
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template sauvegarde avec succes' });
    } catch (error) {
      console.error('Error saving template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  // Handle preview
  const handlePreview = async () => {
    const editor = editorRef.current;
    if (!editor) {
      setToast({ type: 'error', message: 'Editeur non pret' });
      return;
    }

    try {
      const designJson = getEditorJSON(editor);
      let html = '';

      try {
        // Render with Maily - it generates a complete HTML document
        html = await render(designJson);

        // Simple background color replacement - don't overcomplicate
        html = html.replace(/background-color:\s*#ffffff/gi, `background-color:${backgroundColor}`);
        html = html.replace(/background-color:\s*white/gi, `background-color:${backgroundColor}`);
      } catch (renderError) {
        html = getEditorHTML(editor);
      }

      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error exporting for preview:', error);
      setToast({ type: 'error', message: 'Erreur lors de la generation de l\'apercu' });
    }
  };

  // Handle activate template
  const handleActivateTemplate = async (templateId) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}/activate`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to activate');
      }

      // Refresh data
      await fetchTriggers();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template active avec succes' });
    } catch (error) {
      console.error('Error activating template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de l\'activation' });
    }
  };

  // Handle create new template
  const handleCreateTemplate = async () => {
    if (!selectedTrigger || !newTemplateName.trim()) {
      setToast({ type: 'error', message: 'Nom du template requis' });
      return;
    }

    try {
      const body = {
        name: newTemplateName.trim(),
        subject: `${selectedTrigger.label} - FitMyCV.io`,
      };

      // Add copyFromTemplateId if user selected a template to import from
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

      // Refresh templates and select the new one
      await fetchTriggerTemplates(selectedTrigger.name);
      await fetchTemplates(); // Refresh all templates list
      handleSelectTemplate(result.template);
      setNewTemplateName('');
      setCopyFromTemplateId('');
      setShowNewTemplateForm(false);

      setToast({ type: 'success', message: 'Template cree avec succes' });
    } catch (error) {
      console.error('Error creating template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la creation' });
    }
  };

  // Handle set template as default
  const handleSetDefault = async (templateId) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}/set-default`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to set as default');
      }

      // Refresh all templates to update isDefault flags
      await fetchTemplates();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template defini par defaut' });
    } catch (error) {
      console.error('Error setting default:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la definition par defaut' });
    }
  };

  // Handle remove default status
  const handleRemoveDefault = async (templateId) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}/set-default`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove default');
      }

      // Refresh all templates to update isDefault flags
      await fetchTemplates();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Statut par defaut retire' });
    } catch (error) {
      console.error('Error removing default:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors du retrait du statut par defaut' });
    }
  };

  // Handle delete template
  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Supprimer ce template ?')) return;

    try {
      const res = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }

      // Refresh data
      await fetchTriggers();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      if (selectedTemplate?.id === templateId) {
        setSelectedTemplate(null);
      }

      setToast({ type: 'success', message: 'Template supprime' });
    } catch (error) {
      console.error('Error deleting template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la suppression' });
    }
  };

  // Group triggers by category
  const triggersByCategory = triggers.reduce((acc, trigger) => {
    const category = trigger.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(trigger);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Main content */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel - Triggers list */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <span>🎯</span>
              Triggers Email
            </h3>

            {Object.entries(triggersByCategory).map(([category, categoryTriggers]) => (
              <div key={category} className="space-y-2">
                <h4 className="text-sm font-medium text-white/60 uppercase tracking-wider">
                  {CATEGORY_LABELS[category] || category}
                </h4>

                {categoryTriggers.map((trigger) => (
                  <button
                    key={trigger.id}
                    onClick={() => handleSelectTrigger(trigger)}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      selectedTrigger?.id === trigger.id
                        ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{trigger.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {trigger.label}
                        </div>
                        <div className="text-xs text-white/50 truncate">
                          {trigger.description}
                        </div>
                      </div>
                      {trigger.hasActiveTemplate ? (
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">
                          Actif
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">
                          Aucun
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Right panel - Editor */}
          <div className="lg:col-span-2 space-y-4">
            {/* No trigger selected */}
            {!selectedTrigger && (
              <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                <div className="text-4xl mb-4">👈</div>
                <h3 className="text-lg text-white font-medium">Selectionnez un trigger</h3>
                <p className="text-white/50 mt-2">
                  Cliquez sur un trigger pour voir ou creer ses templates
                </p>
              </div>
            )}

            {/* Trigger selected - Templates list */}
            {selectedTrigger && !selectedTemplate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">
                    {selectedTrigger.icon} Templates pour "{selectedTrigger.label}"
                  </h3>
                  <button
                    onClick={() => setShowNewTemplateForm(true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nouveau Template
                  </button>
                </div>

                {/* New template form */}
                {showNewTemplateForm && (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        placeholder="Nom du nouveau template..."
                        className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm text-white/60 whitespace-nowrap">Importer depuis:</label>
                      <select
                        value={copyFromTemplateId}
                        onChange={(e) => setCopyFromTemplateId(e.target.value)}
                        className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">-- Commencer vide --</option>
                        {templates.find(t => t.isDefault) && (
                          <option value="default" className="bg-slate-800">
                            ⭐ Template par defaut ({templates.find(t => t.isDefault)?.name})
                          </option>
                        )}
                        <optgroup label="Tous les templates" className="bg-slate-800">
                          {templates.map((t) => (
                            <option key={t.id} value={t.id} className="bg-slate-800">
                              {t.name} {t.trigger?.label ? `(${t.trigger.label})` : ''} {t.isDefault ? '⭐' : ''}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowNewTemplateForm(false);
                          setNewTemplateName('');
                          setCopyFromTemplateId('');
                        }}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleCreateTemplate}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                      >
                        Creer
                      </button>
                    </div>
                  </div>
                )}

                {/* Variables info */}
                <div className="bg-blue-500/10 rounded-xl border border-blue-500/30 p-4">
                  <p className="text-sm text-blue-300">
                    <strong>Variables disponibles:</strong>{' '}
                    {selectedTrigger.variables.map((v) => `@${v}`).join(', ')}
                  </p>
                </div>

                {/* Templates list */}
                {triggerTemplates.length > 0 ? (
                  <div className="space-y-2">
                    {triggerTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-4 rounded-xl border transition-all ${
                          template.isActive
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : template.isDefault
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium flex items-center gap-2">
                              {template.name}
                              {template.isActive && (
                                <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded">
                                  ACTIF
                                </span>
                              )}
                              {template.isDefault && (
                                <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                                  DEFAUT
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-white/50">{template.subject}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!template.isActive && (
                              <button
                                onClick={() => handleActivateTemplate(template.id)}
                                className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm rounded-lg"
                              >
                                Activer
                              </button>
                            )}
                            {template.isDefault ? (
                              <button
                                onClick={() => handleRemoveDefault(template.id)}
                                className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded-lg"
                                title="Retirer le statut par defaut"
                              >
                                Retirer defaut
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSetDefault(template.id)}
                                className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded-lg"
                                title="Utiliser comme modele pour les nouveaux templates"
                              >
                                Defaut
                              </button>
                            )}
                            <button
                              onClick={() => handleSelectTemplate(template)}
                              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg"
                            >
                              Editer
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
                    <div className="text-3xl mb-3">📭</div>
                    <p className="text-white/60">
                      Aucun template pour ce trigger.
                      <br />
                      Creez-en un pour commencer.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Template editor */}
            {selectedTemplate && (
              <div className="space-y-4">
                {/* Back button */}
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-white/60 hover:text-white flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Retour aux templates
                </button>

                {/* Template name & subject */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <label className="block text-sm text-white/60 mb-2">Nom du template</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <label className="block text-sm text-white/60 mb-2">Sujet de l'email</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {/* Variables reminder */}
                <div className="bg-blue-500/10 rounded-xl border border-blue-500/30 p-3">
                  <p className="text-sm text-blue-300">
                    <strong>Tapez @ pour inserer:</strong>{' '}
                    {selectedTrigger?.variables.map((v) => `@${v}`).join(', ')}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedTemplate.isActive ? (
                      <span className="text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg">
                        Template actif
                      </span>
                    ) : (
                      <button
                        onClick={() => handleActivateTemplate(selectedTemplate.id)}
                        className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg"
                      >
                        Activer ce template
                      </button>
                    )}
                    {selectedTemplate.isDefault ? (
                      <span className="text-xs bg-blue-500 text-white px-3 py-1 rounded-lg">
                        Template par defaut
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(selectedTemplate.id)}
                        className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded-lg"
                      >
                        Definir par defaut
                      </button>
                    )}
                    {!editorReady && (
                      <span className="text-xs text-amber-400">Chargement...</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setImagePickerOpen(true)}
                      disabled={!editorReady}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                      title="Inserer une image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Images
                    </button>

                    {/* Background color picker */}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                      <label className="text-sm text-white/60">Fond email:</label>
                      {/* Mini preview */}
                      <div
                        className="w-8 h-6 rounded border border-white/30 flex items-center justify-center"
                        style={{ backgroundColor }}
                        title={`Apercu: ${backgroundColor}`}
                      >
                        <div className="w-4 h-3 bg-white/80 rounded-sm" />
                      </div>
                      {/* Quick color presets - site colors */}
                      {[
                        { color: '#ffffff', label: 'Blanc' },
                        { color: '#f9fafb', label: 'Gris clair' },
                        { color: '#ecfdf5', label: 'Emerald clair' },
                        { color: '#d1fae5', label: 'Emerald' },
                        { color: '#10b981', label: 'Emerald 500' },
                        { color: '#020617', label: 'App background' },
                      ].map(({ color, label }) => (
                        <button
                          key={color}
                          onClick={() => setBackgroundColor(color)}
                          className={`w-5 h-5 rounded border-2 transition-all ${
                            backgroundColor === color
                              ? 'border-emerald-400 scale-110'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                          style={{ backgroundColor: color }}
                          title={label}
                        />
                      ))}
                      <input
                        type="color"
                        value={backgroundColor}
                        onChange={(e) => setBackgroundColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-2 border-white/20"
                        title="Couleur personnalisee"
                      />
                    </div>

                    <button
                      onClick={handlePreview}
                      disabled={!editorReady}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Apercu
                    </button>

                    <button
                      onClick={handleSave}
                      disabled={!editorReady || saving}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sauvegarde...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Sauvegarder
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Maily Editor */}
                <MailyEditor
                  contentJson={selectedTemplate.designJson}
                  variables={selectedTrigger?.variables || []}
                  onReady={handleEditorReady}
                  onChange={handleEditorChange}
                  backgroundColor={backgroundColor}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Stats KPIs */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-white mb-4">Statistiques d'envoi</h3>
        <EmailStatsKPIs refreshKey={logsRefreshKey} />
      </div>

      {/* Email logs */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-white mb-4">Historique des envois</h3>
        <EmailLogsTable
          templateFilter={selectedTemplate?.name}
          refreshKey={logsRefreshKey}
          limit={10}
        />
      </div>

      {/* Preview Modal */}
      <EmailPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        htmlContent={previewHtml}
        subject={editSubject}
        templateId={selectedTemplate?.id}
        onTestSent={() => setLogsRefreshKey((prev) => prev + 1)}
      />

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={handleImageSelect}
      />
    </div>
  );
}

export default EmailTemplatesTab;
