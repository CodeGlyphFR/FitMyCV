'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus, ArrowLeft, Image, Eye, Save, Check, Star, Trash2, Zap } from 'lucide-react';
import { EmailPreviewModal } from '../EmailPreviewModal';
import { Toast } from '../Toast';
import { MailyEditor, getEditorJSON, getEditorHTML } from '../MailyEditor';
import { ImagePickerModal } from '../ImagePickerModal';
import { render } from '@maily-to/render';
import { CATEGORY_LABELS } from '@/lib/email/triggers';

/**
 * EmailTemplatesSection - Section Templates avec triggers groupés par catégorie
 */
export function EmailTemplatesSection({ refreshKey, onLogsRefresh }) {
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
  const [editorReady, setEditorReady] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editName, setEditName] = useState('');
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [copyFromTemplateId, setCopyFromTemplateId] = useState('');
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [expandedCategories, setExpandedCategories] = useState({});

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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const fullUrl = `${siteUrl}${imagePath}`;

    editor.chain().focus().setImage({ src: fullUrl }).run();

    setToast({ type: 'success', message: 'Image insérée' });
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!selectedTemplate) return;

    const editor = editorRef.current;
    if (!editor) {
      setToast({ type: 'error', message: 'Éditeur non prêt' });
      return;
    }

    setSaving(true);
    try {
      const editorContent = getEditorJSON(editor);
      const designJson = { ...editorContent, backgroundColor };

      let htmlContent = '';
      try {
        htmlContent = await render(editorContent);
        htmlContent = htmlContent.replace(/background-color:\s*#ffffff/gi, `background-color:${backgroundColor}`);
        htmlContent = htmlContent.replace(/background-color:\s*white/gi, `background-color:${backgroundColor}`);
      } catch (renderError) {
        console.error('Error rendering HTML:', renderError);
        htmlContent = getEditorHTML(editor);
      }

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

      setTemplates((prev) =>
        prev.map((t) => (t.id === result.template.id ? result.template : t))
      );
      setSelectedTemplate(result.template);

      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template sauvegardé avec succès' });
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
      setToast({ type: 'error', message: 'Éditeur non prêt' });
      return;
    }

    try {
      const designJson = getEditorJSON(editor);
      let html = '';

      try {
        html = await render(designJson);
        html = html.replace(/background-color:\s*#ffffff/gi, `background-color:${backgroundColor}`);
        html = html.replace(/background-color:\s*white/gi, `background-color:${backgroundColor}`);
      } catch (renderError) {
        html = getEditorHTML(editor);
      }

      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (error) {
      console.error('Error exporting for preview:', error);
      setToast({ type: 'error', message: "Erreur lors de la génération de l'aperçu" });
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

      await fetchTriggers();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template activé avec succès' });
    } catch (error) {
      console.error('Error activating template:', error);
      setToast({ type: 'error', message: error.message || "Erreur lors de l'activation" });
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
      handleSelectTemplate(result.template);
      setNewTemplateName('');
      setCopyFromTemplateId('');
      setShowNewTemplateForm(false);

      setToast({ type: 'success', message: 'Template créé avec succès' });
    } catch (error) {
      console.error('Error creating template:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la création' });
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

      await fetchTemplates();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Template défini par défaut' });
    } catch (error) {
      console.error('Error setting default:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors de la définition par défaut' });
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

      await fetchTemplates();
      if (selectedTrigger) {
        await fetchTriggerTemplates(selectedTrigger.name);
      }

      setToast({ type: 'success', message: 'Statut par défaut retiré' });
    } catch (error) {
      console.error('Error removing default:', error);
      setToast({ type: 'error', message: error.message || 'Erreur lors du retrait du statut par défaut' });
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
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Group triggers by category
  const triggersByCategory = triggers.reduce((acc, trigger) => {
    const category = trigger.category || 'general';
    if (!acc[category]) acc[category] = [];
    acc[category].push(trigger);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Template Editor View
  if (selectedTemplate) {
    return (
      <div className="space-y-4">
        {/* Toast */}
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

        {/* Back button */}
        <button
          onClick={() => setSelectedTemplate(null)}
          className="text-white/60 hover:text-white flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
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
        <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/30 p-3">
          <p className="text-sm text-emerald-300">
            <strong>Variables disponibles :</strong>{' '}
            {selectedTrigger?.variables.map((v) => (
              <code key={v} className="mx-1 px-1.5 py-0.5 bg-white/10 rounded text-xs">@{v}</code>
            ))}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedTemplate.isActive ? (
              <span className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Check className="w-3 h-3" /> Actif
              </span>
            ) : (
              <button
                onClick={() => handleActivateTemplate(selectedTemplate.id)}
                className="text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Zap className="w-3 h-3" /> Activer
              </button>
            )}
            {selectedTemplate.isDefault ? (
              <span className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1">
                <Star className="w-3 h-3" /> Défaut
              </span>
            ) : (
              <button
                onClick={() => handleSetDefault(selectedTemplate.id)}
                className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Star className="w-3 h-3" /> Définir défaut
              </button>
            )}
            {!editorReady && (
              <span className="text-xs text-amber-400">Chargement...</span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setImagePickerOpen(true)}
              disabled={!editorReady}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Image className="w-4 h-4" />
              <span className="hidden sm:inline">Images</span>
            </button>

            {/* Background color picker */}
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-white/10 rounded-lg">
              <span className="text-xs text-white/60 hidden sm:inline">Fond:</span>
              <div
                className="w-6 h-6 rounded border border-white/30 flex items-center justify-center"
                style={{ backgroundColor }}
              >
                <div className="w-3 h-2 bg-white/80 rounded-xs" />
              </div>
              {['#ffffff', '#f9fafb', '#ecfdf5', '#d1fae5', '#020617'].map((color) => (
                <button
                  key={color}
                  onClick={() => setBackgroundColor(color)}
                  className={`w-5 h-5 rounded border-2 transition-all ${
                    backgroundColor === color
                      ? 'border-emerald-400 scale-110'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-2 border-white/20"
              />
            </div>

            <button
              onClick={handlePreview}
              disabled={!editorReady}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Aperçu</span>
            </button>

            <button
              onClick={handleSave}
              disabled={!editorReady || saving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden sm:inline">Sauvegarde...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Sauvegarder</span>
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

        {/* Preview Modal */}
        <EmailPreviewModal
          isOpen={previewOpen}
          onClose={() => setPreviewOpen(false)}
          htmlContent={previewHtml}
          subject={editSubject}
          templateId={selectedTemplate?.id}
          onTestSent={() => onLogsRefresh?.()}
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

  // Trigger Templates List View
  if (selectedTrigger) {
    return (
      <div className="space-y-4">
        {/* Toast */}
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

        {/* Back button & Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => setSelectedTrigger(null)}
            className="text-white/60 hover:text-white flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour aux triggers
          </button>
          <button
            onClick={() => setShowNewTemplateForm(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nouveau Template
          </button>
        </div>

        {/* Trigger info */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-4">
          <span className="text-3xl">{selectedTrigger.icon}</span>
          <div>
            <h3 className="text-lg font-medium text-white">{selectedTrigger.label}</h3>
            <p className="text-sm text-white/50">{selectedTrigger.description}</p>
          </div>
        </div>

        {/* New template form */}
        {showNewTemplateForm && (
          <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/30 p-4 space-y-3">
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
                    Template par défaut ({templates.find(t => t.isDefault)?.name})
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
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateTemplate}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm"
              >
                Créer
              </button>
            </div>
          </div>
        )}

        {/* Variables info */}
        <div className="bg-blue-500/10 rounded-xl border border-blue-500/30 p-3">
          <p className="text-sm text-blue-300">
            <strong>Variables disponibles :</strong>{' '}
            {selectedTrigger.variables.map((v) => (
              <code key={v} className="mx-1 px-1.5 py-0.5 bg-white/10 rounded text-xs">@{v}</code>
            ))}
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
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-medium flex items-center gap-2 flex-wrap">
                      {template.name}
                      {template.isActive && (
                        <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                          <Check className="w-3 h-3" /> ACTIF
                        </span>
                      )}
                      {template.isDefault && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                          <Star className="w-3 h-3" /> DÉFAUT
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-white/50 truncate">{template.subject}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
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
                      >
                        Retirer défaut
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(template.id)}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded-lg"
                      >
                        Défaut
                      </button>
                    )}
                    <button
                      onClick={() => handleSelectTemplate(template)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg"
                    >
                      Éditer
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 rounded-xl border border-white/10 p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-white/60">
              Aucun template pour ce trigger.
              <br />
              Créez-en un pour commencer.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Triggers List View (with collapsible categories)
  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {Object.entries(triggersByCategory).map(([category, categoryTriggers]) => {
        const isExpanded = expandedCategories[category] !== false; // Default to expanded

        return (
          <div key={category} className="rounded-xl border border-white/10 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-all text-left ${
                isExpanded
                  ? 'bg-emerald-500/10 border-b border-white/10'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-1 h-5 bg-emerald-400 rounded" />
                <span className="text-sm font-medium text-white">
                  {CATEGORY_LABELS[category] || category}
                </span>
                <span className="text-xs text-white/40">
                  ({categoryTriggers.length})
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-white/50" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/50" />
              )}
            </button>

            {/* Category content */}
            {isExpanded && (
              <div className="p-3 space-y-2 bg-white/5">
                {categoryTriggers.map((trigger) => (
                  <button
                    key={trigger.id}
                    onClick={() => handleSelectTrigger(trigger)}
                    className="w-full p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-left transition-all"
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
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded flex-shrink-0">
                          Actif
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded flex-shrink-0">
                          Aucun
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default EmailTemplatesSection;
