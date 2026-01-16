'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';

/**
 * GrapesJsEditorModal - Fullscreen modal with GrapesJS editor
 */
export function GrapesJsEditorModal({
  isOpen,
  onClose,
  onSave,
  htmlContent = '',
  variables = [],
  templateName = '',
  templateSubject = '',
  saving = false,
}) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [editName, setEditName] = useState(templateName);
  const [editSubject, setEditSubject] = useState(templateSubject);
  const [mounted, setMounted] = useState(false);

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Update local state when props change
  useEffect(() => {
    setEditName(templateName);
    setEditSubject(templateSubject);
  }, [templateName, templateSubject]);

  // Initialize GrapesJS when modal opens
  useEffect(() => {
    if (!isOpen || !containerRef.current || editorRef.current) return;

    const initEditor = async () => {
      try {
        const grapesjs = (await import('grapesjs')).default;
        const newsletterPreset = (await import('grapesjs-preset-newsletter')).default;
        await import('grapesjs/dist/css/grapes.min.css');

        const editor = grapesjs.init({
          container: containerRef.current,
          height: '100%',
          width: 'auto',
          plugins: [newsletterPreset],
          pluginsOpts: {
            [newsletterPreset]: {
              modalTitleImport: 'Importer le template',
              modalTitleExport: 'Exporter le HTML',
            },
          },
          storageManager: false,
          assetManager: {
            upload: false,
            assets: [
              { src: '/icons/logo_email.png', name: 'Logo FitMyCV' },
              { src: '/icons/import.png', name: 'Import' },
              { src: '/icons/export.png', name: 'Export' },
              { src: '/icons/openai-symbol.png', name: 'OpenAI' },
            ],
          },
          canvas: {
            styles: [
              'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
            ],
          },
        });

        // Configure link component to have editable href trait
        const domComponents = editor.DomComponents;

        domComponents.addType('link', {
          model: {
            defaults: {
              traits: [
                {
                  type: 'text',
                  label: 'URL du lien',
                  name: 'href',
                },
                {
                  type: 'select',
                  label: 'Ouvrir dans',
                  name: 'target',
                  options: [
                    { value: '', name: 'Meme fenetre' },
                    { value: '_blank', name: 'Nouvelle fenetre' },
                  ],
                },
                {
                  type: 'text',
                  label: 'Titre',
                  name: 'title',
                },
              ],
            },
          },
          isComponent: (el) => el.tagName === 'A',
        });

        // Make images editable
        domComponents.addType('image', {
          model: {
            defaults: {
              traits: [
                {
                  type: 'text',
                  label: 'URL image',
                  name: 'src',
                },
                {
                  type: 'text',
                  label: 'Texte alternatif',
                  name: 'alt',
                },
                {
                  type: 'text',
                  label: 'Largeur',
                  name: 'width',
                },
                {
                  type: 'text',
                  label: 'Hauteur',
                  name: 'height',
                },
              ],
            },
          },
          isComponent: (el) => el.tagName === 'IMG',
        });

        // Add variable blocks
        const blockManager = editor.BlockManager;
        variables.forEach((variable) => {
          blockManager.add(`variable-${variable}`, {
            label: `{{${variable}}}`,
            category: 'Variables',
            content: `<span data-variable="${variable}" style="color: #3d97f0; font-weight: 500;">{{${variable}}}</span>`,
          });
        });

        // Add common email blocks
        blockManager.add('button-cta', {
          label: 'Bouton CTA',
          category: 'Email',
          content: `<a href="#" style="display: inline-block; padding: 16px 40px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">Cliquez ici</a>`,
        });

        blockManager.add('divider', {
          label: 'Separateur',
          category: 'Email',
          content: `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`,
        });

        // Load initial content
        if (htmlContent) {
          editor.setComponents(htmlContent);
        }

        editorRef.current = editor;
        setIsLoaded(true);
      } catch (err) {
        console.error('Error initializing GrapesJS:', err);
        setError(err.message);
      }
    };

    initEditor();

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
        setIsLoaded(false);
      }
    };
  }, [isOpen, htmlContent, variables]);

  // Handle save
  const handleSave = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.getHtml();
    const css = editorRef.current.getCss();
    const fullHtml = html + (css ? `<style>${css}</style>` : '');
    onSave({
      name: editName,
      subject: editSubject,
      htmlContent: fullHtml,
    });
  };

  // Handle close
  const handleClose = () => {
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
      setIsLoaded(false);
    }
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-900">
      {/* Header */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nom du template"
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm w-48 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Sujet de l'email"
              className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm w-64 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Variables info */}
          <div className="hidden lg:flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
            <span className="text-xs text-emerald-400">Variables:</span>
            {variables.slice(0, 3).map((v) => (
              <code key={v} className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-emerald-300">
                {`{{${v}}}`}
              </code>
            ))}
            {variables.length > 3 && (
              <span className="text-xs text-emerald-400">+{variables.length - 3}</span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!isLoaded || saving}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Sauvegarder
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor container */}
      <div className="h-[calc(100vh-56px)]">
        <style>{`
          /* Fix scroll and layout for GrapesJS */
          .gjs-editor { height: 100% !important; overflow: hidden !important; }
          .gjs-editor-cont { height: 100% !important; overflow: hidden !important; }
          .gjs-pn-views-container { overflow-y: auto !important; overflow-x: hidden !important; }
          .gjs-blocks-cs { overflow-y: auto !important; overflow-x: hidden !important; max-height: calc(100vh - 150px) !important; }
          .gjs-sm-sectors { overflow-y: auto !important; overflow-x: hidden !important; max-height: calc(100vh - 150px) !important; }
          .gjs-layers { overflow-y: auto !important; overflow-x: hidden !important; max-height: calc(100vh - 150px) !important; }
          .gjs-trt-traits { overflow-y: auto !important; overflow-x: hidden !important; max-height: calc(100vh - 150px) !important; }
          .gjs-cv-canvas { overflow: auto !important; }
          .gjs-frame-wrapper { overflow: auto !important; }

          /* Dark theme for GrapesJS */
          .gjs-one-bg { background-color: #1e293b !important; }
          .gjs-two-color { color: #f1f5f9 !important; }
          .gjs-three-bg { background-color: #334155 !important; }
          .gjs-four-color, .gjs-four-color-h:hover { color: #10b981 !important; }
          .gjs-pn-panel { background-color: #1e293b !important; }
          .gjs-pn-views-container { background-color: #0f172a !important; }
          .gjs-pn-views { border-bottom: 1px solid #334155 !important; }
          .gjs-blocks-cs { background-color: #0f172a !important; }
          .gjs-block { background-color: #1e293b !important; border: 1px solid #334155 !important; border-radius: 8px !important; color: #f1f5f9 !important; }
          .gjs-block:hover { background-color: #334155 !important; }
          .gjs-block-category { background-color: #0f172a !important; border-bottom: 1px solid #334155 !important; }
          .gjs-block-category .gjs-title { background-color: #1e293b !important; color: #f1f5f9 !important; border-bottom: 1px solid #334155 !important; }
          .gjs-sm-sector { background-color: #0f172a !important; border-bottom: 1px solid #334155 !important; }
          .gjs-sm-sector-title { background-color: #1e293b !important; color: #f1f5f9 !important; border: none !important; }
          .gjs-sm-properties { background-color: #0f172a !important; }
          .gjs-sm-property { color: #cbd5e1 !important; }
          .gjs-sm-label { color: #94a3b8 !important; }
          .gjs-field { background-color: #1e293b !important; border: 1px solid #334155 !important; color: #f1f5f9 !important; }
          .gjs-field input, .gjs-field select { color: #f1f5f9 !important; }
          .gjs-layers { background-color: #0f172a !important; }
          .gjs-layer { background-color: #1e293b !important; color: #f1f5f9 !important; }
          .gjs-layer:hover { background-color: #334155 !important; }
          .gjs-trt-traits { background-color: #0f172a !important; }
          .gjs-trt-trait { color: #cbd5e1 !important; }
          .gjs-toolbar { background-color: #1e293b !important; border-radius: 8px !important; }
          .gjs-toolbar-item { color: #f1f5f9 !important; }
          .gjs-cv-canvas { background-color: #64748b !important; }
          .gjs-pn-btn { color: #94a3b8 !important; }
          .gjs-pn-btn:hover { color: #f1f5f9 !important; }
          .gjs-pn-btn.gjs-pn-active { color: #10b981 !important; }
          .gjs-rte-toolbar { background-color: #1e293b !important; border: 1px solid #334155 !important; border-radius: 8px !important; }
          .gjs-rte-action { color: #f1f5f9 !important; border-right: 1px solid #334155 !important; }
          .gjs-rte-action:hover { background-color: #334155 !important; }
          .gjs-mdl-dialog { background-color: #1e293b !important; border-radius: 12px !important; }
          .gjs-mdl-header { background-color: #0f172a !important; color: #f1f5f9 !important; border-bottom: 1px solid #334155 !important; }
          .gjs-mdl-content { color: #cbd5e1 !important; }

          /* Scrollbar styling */
          .gjs-pn-views-container::-webkit-scrollbar,
          .gjs-blocks-cs::-webkit-scrollbar,
          .gjs-sm-sectors::-webkit-scrollbar,
          .gjs-layers::-webkit-scrollbar,
          .gjs-trt-traits::-webkit-scrollbar {
            width: 6px;
          }
          .gjs-pn-views-container::-webkit-scrollbar-track,
          .gjs-blocks-cs::-webkit-scrollbar-track,
          .gjs-sm-sectors::-webkit-scrollbar-track,
          .gjs-layers::-webkit-scrollbar-track,
          .gjs-trt-traits::-webkit-scrollbar-track {
            background: #0f172a;
          }
          .gjs-pn-views-container::-webkit-scrollbar-thumb,
          .gjs-blocks-cs::-webkit-scrollbar-thumb,
          .gjs-sm-sectors::-webkit-scrollbar-thumb,
          .gjs-layers::-webkit-scrollbar-thumb,
          .gjs-trt-traits::-webkit-scrollbar-thumb {
            background-color: #334155;
            border-radius: 3px;
          }
        `}</style>

        {!isLoaded && !error && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60">Chargement de l'editeur...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-red-400 mb-2">Erreur lors du chargement</p>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          style={{ height: '100%', display: isLoaded ? 'block' : 'none' }}
        />
      </div>

    </div>
  );

  return createPortal(modalContent, document.body);
}

export default GrapesJsEditorModal;
