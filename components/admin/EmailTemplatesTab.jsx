'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { EmailPreviewModal } from './EmailPreviewModal';
import { EmailLogsTable } from './EmailLogsTable';
import { Toast } from './Toast';
import EmailEditor from './EmailEditor';

// Template types configuration
const TEMPLATE_TYPES = [
  {
    name: 'verification',
    label: 'Verification Email',
    description: 'Envoye lors de l\'inscription',
    icon: '✉️',
    variables: ['userName', 'verificationUrl'],
  },
  {
    name: 'password_reset',
    label: 'Reset Mot de passe',
    description: 'Envoye lors d\'une demande de reset',
    icon: '🔐',
    variables: ['userName', 'resetUrl'],
  },
  {
    name: 'email_change',
    label: 'Changement Email',
    description: 'Envoye pour confirmer un changement d\'email',
    icon: '📧',
    variables: ['userName', 'verificationUrl', 'newEmail'],
  },
];

/**
 * Build merge tags from variables for Unlayer
 */
function buildMergeTags(variables) {
  return variables.reduce((acc, variable) => {
    const displayName = variable
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    return {
      ...acc,
      [variable]: {
        name: displayName,
        value: `{{${variable}}}`,
      },
    };
  }, {});
}

/**
 * EmailTemplatesTab - Onglet principal de gestion des templates email
 */
export function EmailTemplatesTab({ refreshKey }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [logsRefreshKey, setLogsRefreshKey] = useState(0);
  const [editorReady, setEditorReady] = useState(false);
  const [editSubject, setEditSubject] = useState('');

  // Ref to store the editor instance (captured via onReady)
  const editorRef = useRef(null);

  // Fetch templates from API
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/email-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');

      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setToast({ type: 'error', message: 'Erreur lors du chargement des templates' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [refreshKey]);

  // Handle template selection
  const handleSelectTemplate = (templateName) => {
    const template = templates.find((t) => t.name === templateName);
    setSelectedTemplate(template || null);
    setEditSubject(template?.subject || '');
    setEditorReady(false);
    // Reset editor ref when switching templates
    editorRef.current = null;
  };

  // Handle editor ready - capture editor instance via onReady callback
  // This is the recommended pattern for Next.js dynamic imports
  // See: https://stackoverflow.com/questions/77020572
  const handleEditorReady = useCallback((unlayer) => {
    // Store editor instance in ref
    editorRef.current = { editor: unlayer };

    // Load design if available
    if (selectedTemplate?.designJson) {
      try {
        const design = typeof selectedTemplate.designJson === 'string'
          ? JSON.parse(selectedTemplate.designJson)
          : selectedTemplate.designJson;

        if (design && Object.keys(design).length > 0) {
          unlayer.loadDesign(design);
        }
      } catch (error) {
        console.error('[EmailTemplatesTab] Error loading design:', error);
      }
    }

    setEditorReady(true);
  }, [selectedTemplate?.designJson]);

  // Handle save
  const handleSave = async () => {
    if (!selectedTemplate) return;

    const editor = editorRef.current?.editor;
    if (!editor) {
      setToast({ type: 'error', message: 'Editeur non pret' });
      return;
    }

    setSaving(true);
    try {
      // Export HTML from editor using callback pattern
      editor.exportHtml(async (data) => {
        const { design, html } = data;

        if (!html) {
          setToast({ type: 'error', message: 'Impossible d\'exporter le design' });
          setSaving(false);
          return;
        }

        try {
          // Save to API
          const res = await fetch(`/api/admin/email-templates/${selectedTemplate.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: editSubject,
              designJson: JSON.stringify(design),
              htmlContent: html,
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

          setToast({ type: 'success', message: 'Template sauvegarde avec succes' });
        } catch (error) {
          console.error('Error saving template:', error);
          setToast({ type: 'error', message: error.message || 'Erreur lors de la sauvegarde' });
        } finally {
          setSaving(false);
        }
      });
    } catch (error) {
      console.error('Error exporting template:', error);
      setToast({ type: 'error', message: 'Erreur lors de l\'export' });
      setSaving(false);
    }
  };

  // Handle preview
  const handlePreview = async () => {
    const editor = editorRef.current?.editor;
    if (!editor) {
      setToast({ type: 'error', message: 'Editeur non pret' });
      return;
    }

    try {
      editor.exportHtml((data) => {
        setPreviewHtml(data.html || '');
        setPreviewOpen(true);
      });
    } catch (error) {
      console.error('Error exporting for preview:', error);
      setToast({ type: 'error', message: 'Erreur lors de la generation de l\'apercu' });
    }
  };

  // Handle copy design from another template
  const handleCopyFrom = (e) => {
    const sourceName = e.target.value;
    if (!sourceName) return;

    const sourceTemplate = templates.find((t) => t.name === sourceName);
    if (sourceTemplate?.designJson) {
      try {
        const design = typeof sourceTemplate.designJson === 'string'
          ? JSON.parse(sourceTemplate.designJson)
          : sourceTemplate.designJson;

        const editor = editorRef.current?.editor;
        if (editor && design && Object.keys(design).length > 0) {
          editor.loadDesign(design);
          setToast({ type: 'success', message: `Design copie depuis "${getTemplateConfig(sourceName)?.label || sourceName}"` });
        }
      } catch (error) {
        console.error('[EmailTemplatesTab] Error copying design:', error);
        setToast({ type: 'error', message: 'Erreur lors de la copie du design' });
      }
    }
    e.target.value = ''; // Reset select
  };

  // Get template config
  const getTemplateConfig = (name) => TEMPLATE_TYPES.find((t) => t.name === name);

  // Build editor options with merge tags for current template
  const currentTemplateConfig = selectedTemplate ? getTemplateConfig(selectedTemplate.name) : null;
  const editorOptions = {
    version: 'latest',
    appearance: {
      theme: 'modern_dark',
      panels: {
        tools: {
          dock: 'left',
        },
      },
    },
    features: {
      textEditor: {
        spellChecker: true,
      },
    },
    mergeTags: currentTemplateConfig ? buildMergeTags(currentTemplateConfig.variables) : {},
    locale: 'fr-FR',
  };

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

      {/* Template selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TEMPLATE_TYPES.map((type) => {
          const template = templates.find((t) => t.name === type.name);
          const isSelected = selectedTemplate?.name === type.name;

          return (
            <button
              key={type.name}
              onClick={() => handleSelectTemplate(type.name)}
              className={`p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30'
                  : template
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  : 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
              }`}
              disabled={!template}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{type.icon}</span>
                <div>
                  <h3 className="text-white font-medium">{type.label}</h3>
                  <p className="text-sm text-white/50 mt-1">{type.description}</p>
                  {template ? (
                    <p className="text-xs text-emerald-400 mt-2">Configure</p>
                  ) : (
                    <p className="text-xs text-amber-400 mt-2">Non configure</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Editor section */}
      {selectedTemplate && (
        <div className="space-y-4">
          {/* Subject editor */}
          <div className="bg-white/5 rounded-xl border border-white/10 p-4">
            <label className="block text-sm text-white/60 mb-2">
              Sujet de l'email
            </label>
            <input
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50"
              placeholder="Sujet de l'email..."
            />
            <p className="text-xs text-white/40 mt-2">
              Variables disponibles: {getTemplateConfig(selectedTemplate.name)?.variables.map((v) => `{{${v}}}`).join(', ')}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/50">
                Template: <span className="text-white">{selectedTemplate.name}</span>
              </span>
              {!editorReady && (
                <span className="text-xs text-amber-400">Chargement de l'editeur...</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Copy from another template */}
              <select
                onChange={handleCopyFrom}
                disabled={!editorReady}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-lg transition-colors border border-white/20 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              >
                <option value="" className="bg-gray-900">Copier depuis...</option>
                {templates
                  .filter((t) => t.name !== selectedTemplate?.name)
                  .map((t) => (
                    <option key={t.name} value={t.name} className="bg-gray-900">
                      {getTemplateConfig(t.name)?.label || t.name}
                    </option>
                  ))}
              </select>

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

          {/* Email Editor */}
          <div className="w-full h-[600px] rounded-xl overflow-hidden border border-white/10">
            <EmailEditor
              options={editorOptions}
              minHeight="600px"
              onReady={handleEditorReady}
            />
          </div>
        </div>
      )}

      {/* No template selected */}
      {!selectedTemplate && !loading && templates.length > 0 && (
        <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h3 className="text-lg text-white font-medium">Selectionnez un template</h3>
          <p className="text-white/50 mt-2">
            Cliquez sur un des templates ci-dessus pour commencer l'edition
          </p>
        </div>
      )}

      {/* No templates configured */}
      {!loading && templates.length === 0 && (
        <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-6">
          <div className="flex items-start gap-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="text-amber-400 font-medium">Aucun template configure</h3>
              <p className="text-white/60 mt-1">
                Les templates email doivent etre initialises dans la base de donnees.
                Executez le seed Prisma pour creer les templates par defaut.
              </p>
              <code className="block mt-3 px-3 py-2 bg-black/30 rounded text-sm text-white/80 font-mono">
                npx prisma db seed
              </code>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

export default EmailTemplatesTab;
