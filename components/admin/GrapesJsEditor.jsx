'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * GrapesJsEditor - Visual HTML email editor using GrapesJS
 *
 * @param {Object} props
 * @param {string} props.htmlContent - Initial HTML content
 * @param {Array} props.variables - Available variables (e.g., ['userName', 'resetUrl'])
 * @param {Function} props.onReady - Callback when editor is ready (receives editor instance)
 * @param {Function} props.onChange - Callback on content change (receives editor instance)
 * @param {string} props.minHeight - Minimum height of the editor (default: '700px')
 */
export function GrapesJsEditor({
  htmlContent = '',
  variables = [],
  onReady,
  onChange,
  minHeight = '700px',
}) {
  const editorRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Initialize GrapesJS
  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const initEditor = async () => {
      try {
        // Dynamic imports to avoid SSR issues
        const grapesjs = (await import('grapesjs')).default;
        const newsletterPreset = (await import('grapesjs-preset-newsletter')).default;

        // Import CSS
        await import('grapesjs/dist/css/grapes.min.css');

        const editor = grapesjs.init({
          container: containerRef.current,
          height: minHeight,
          width: 'auto',
          plugins: [newsletterPreset],
          pluginsOpts: {
            [newsletterPreset]: {
              modalTitleImport: 'Importer le template',
              modalTitleExport: 'Exporter le HTML',
              importPlaceholder: '<table>...</table>',
              cellStyle: {
                'font-size': '14px',
                'font-weight': '400',
                'vertical-align': 'top',
                color: '#333333',
                margin: '0',
                padding: '0',
              },
            },
          },
          storageManager: false, // Disable built-in storage
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
          // French translations
          i18n: {
            locale: 'fr',
            messages: {
              fr: {
                assetManager: {
                  addButton: 'Ajouter image',
                  inputPlh: 'URL de l\'image',
                  modalTitle: 'Gestionnaire d\'images',
                  uploadTitle: 'Deposez vos fichiers ou cliquez pour uploader',
                },
                blockManager: {
                  labels: {},
                  categories: {},
                },
                domComponents: {
                  names: {
                    '': 'Element',
                    wrapper: 'Corps',
                    text: 'Texte',
                    comment: 'Commentaire',
                    image: 'Image',
                    video: 'Video',
                    label: 'Label',
                    link: 'Lien',
                    map: 'Carte',
                    table: 'Tableau',
                    row: 'Ligne',
                    cell: 'Cellule',
                  },
                },
                panels: {
                  buttons: {
                    titles: {
                      preview: 'Apercu',
                      fullscreen: 'Plein ecran',
                      'sw-visibility': 'Voir les composants',
                      'export-template': 'Voir le code',
                      'open-sm': 'Style Manager',
                      'open-tm': 'Parametres',
                      'open-layers': 'Calques',
                      'open-blocks': 'Blocs',
                    },
                  },
                },
                selectorManager: {
                  label: 'Classes',
                  selected: 'Selectionne',
                  emptyState: '- Etat -',
                  states: {
                    hover: 'Survol',
                    active: 'Clic',
                    'nth-of-type(2n)': 'Pair/Impair',
                  },
                },
                styleManager: {
                  empty: 'Selectionnez un element pour editer son style',
                  layer: 'Calque',
                  fileButton: 'Images',
                  sectors: {
                    general: 'General',
                    layout: 'Disposition',
                    typography: 'Typographie',
                    decorations: 'Decorations',
                    extra: 'Extra',
                    flex: 'Flex',
                    dimension: 'Dimension',
                  },
                },
                traitManager: {
                  empty: 'Selectionnez un element pour editer ses attributs',
                  label: 'Parametres du composant',
                  traits: {
                    labels: {},
                    attributes: {
                      id: 'Id',
                      alt: 'Alt',
                      title: 'Titre',
                      href: 'Lien',
                    },
                    options: {},
                  },
                },
              },
            },
          },
        });

        // Add custom blocks for variables
        const blockManager = editor.BlockManager;

        // Add variable blocks
        variables.forEach((variable) => {
          blockManager.add(`variable-${variable}`, {
            label: `{{${variable}}}`,
            category: 'Variables',
            content: `<span data-variable="${variable}" style="color: #3d97f0; font-weight: 500;">{{${variable}}}</span>`,
            attributes: { class: 'fa fa-code' },
          });
        });

        // Add common email blocks
        blockManager.add('button-cta', {
          label: 'Bouton CTA',
          category: 'Email',
          content: `
            <a href="#" style="display: inline-block; padding: 16px 40px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px;">
              Cliquez ici
            </a>
          `,
        });

        blockManager.add('divider', {
          label: 'Separateur',
          category: 'Email',
          content: `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`,
        });

        blockManager.add('spacer', {
          label: 'Espace',
          category: 'Email',
          content: `<div style="height: 32px;"></div>`,
        });

        // Load initial content
        if (htmlContent) {
          editor.setComponents(htmlContent);
        }

        // Track changes
        editor.on('change:changesCount', () => {
          if (onChange) {
            onChange(editor);
          }
        });

        editorRef.current = editor;
        setIsLoaded(true);

        if (onReady) {
          onReady(editor);
        }
      } catch (err) {
        console.error('Error initializing GrapesJS:', err);
        setError(err.message);
      }
    };

    initEditor();

    // Cleanup
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, []);

  // Update content when htmlContent prop changes (only if significantly different)
  useEffect(() => {
    if (editorRef.current && htmlContent && isLoaded) {
      const currentHtml = editorRef.current.getHtml();
      // Only update if content is significantly different (avoid loops)
      if (currentHtml.length < 100 && htmlContent.length > 100) {
        editorRef.current.setComponents(htmlContent);
      }
    }
  }, [htmlContent, isLoaded]);

  if (error) {
    return (
      <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
        <p className="text-red-400">Erreur lors du chargement de l'editeur: {error}</p>
      </div>
    );
  }

  return (
    <div className="grapesjs-editor-wrapper">
      <style>{`
        .grapesjs-editor-wrapper {
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Dark theme overrides */
        .gjs-one-bg {
          background-color: #1e293b !important;
        }
        .gjs-two-color {
          color: #f1f5f9 !important;
        }
        .gjs-three-bg {
          background-color: #334155 !important;
        }
        .gjs-four-color,
        .gjs-four-color-h:hover {
          color: #10b981 !important;
        }

        /* Panel backgrounds */
        .gjs-pn-panel {
          background-color: #1e293b !important;
        }
        .gjs-pn-views-container {
          background-color: #0f172a !important;
        }
        .gjs-pn-views {
          border-bottom: 1px solid #334155 !important;
        }

        /* Block manager */
        .gjs-blocks-cs {
          background-color: #0f172a !important;
        }
        .gjs-block {
          background-color: #1e293b !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
          color: #f1f5f9 !important;
        }
        .gjs-block:hover {
          background-color: #334155 !important;
        }
        .gjs-block-category {
          background-color: #0f172a !important;
          border-bottom: 1px solid #334155 !important;
        }
        .gjs-block-category .gjs-title {
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
          border-bottom: 1px solid #334155 !important;
        }

        /* Style manager */
        .gjs-sm-sector {
          background-color: #0f172a !important;
          border-bottom: 1px solid #334155 !important;
        }
        .gjs-sm-sector-title {
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
          border: none !important;
        }
        .gjs-sm-properties {
          background-color: #0f172a !important;
        }
        .gjs-sm-property {
          color: #cbd5e1 !important;
        }
        .gjs-sm-label {
          color: #94a3b8 !important;
        }
        .gjs-field {
          background-color: #1e293b !important;
          border: 1px solid #334155 !important;
          color: #f1f5f9 !important;
        }
        .gjs-field input,
        .gjs-field select {
          color: #f1f5f9 !important;
        }

        /* Layers */
        .gjs-layers {
          background-color: #0f172a !important;
        }
        .gjs-layer {
          background-color: #1e293b !important;
          color: #f1f5f9 !important;
        }
        .gjs-layer:hover {
          background-color: #334155 !important;
        }

        /* Trait manager */
        .gjs-trt-traits {
          background-color: #0f172a !important;
        }
        .gjs-trt-trait {
          color: #cbd5e1 !important;
        }

        /* Toolbar */
        .gjs-toolbar {
          background-color: #1e293b !important;
          border-radius: 8px !important;
        }
        .gjs-toolbar-item {
          color: #f1f5f9 !important;
        }

        /* Canvas */
        .gjs-cv-canvas {
          background-color: #64748b !important;
        }

        /* Buttons */
        .gjs-pn-btn {
          color: #94a3b8 !important;
        }
        .gjs-pn-btn:hover {
          color: #f1f5f9 !important;
        }
        .gjs-pn-btn.gjs-pn-active {
          color: #10b981 !important;
        }

        /* Rte toolbar */
        .gjs-rte-toolbar {
          background-color: #1e293b !important;
          border: 1px solid #334155 !important;
          border-radius: 8px !important;
        }
        .gjs-rte-action {
          color: #f1f5f9 !important;
          border-right: 1px solid #334155 !important;
        }
        .gjs-rte-action:hover {
          background-color: #334155 !important;
        }

        /* Modal */
        .gjs-mdl-dialog {
          background-color: #1e293b !important;
          border-radius: 12px !important;
        }
        .gjs-mdl-header {
          background-color: #0f172a !important;
          color: #f1f5f9 !important;
          border-bottom: 1px solid #334155 !important;
        }
        .gjs-mdl-content {
          color: #cbd5e1 !important;
        }

        /* Scrollbars */
        .gjs-pn-views-container::-webkit-scrollbar,
        .gjs-blocks-cs::-webkit-scrollbar {
          width: 8px;
        }
        .gjs-pn-views-container::-webkit-scrollbar-track,
        .gjs-blocks-cs::-webkit-scrollbar-track {
          background: #0f172a;
        }
        .gjs-pn-views-container::-webkit-scrollbar-thumb,
        .gjs-blocks-cs::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 4px;
        }
      `}</style>

      {!isLoaded && (
        <div className="w-full h-[700px] bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-white/60">Chargement de l'editeur GrapesJS...</p>
          </div>
        </div>
      )}

      <div ref={containerRef} style={{ display: isLoaded ? 'block' : 'none' }} />
    </div>
  );
}

/**
 * Get HTML content from editor instance
 * @param {Object} editor - GrapesJS editor instance
 * @returns {string} Full HTML content
 */
export function getEditorHtml(editor) {
  if (!editor) return '';
  return editor.getHtml() + `<style>${editor.getCss()}</style>`;
}

/**
 * Get only HTML without styles
 * @param {Object} editor - GrapesJS editor instance
 * @returns {string} HTML content
 */
export function getEditorHtmlOnly(editor) {
  if (!editor) return '';
  return editor.getHtml();
}

/**
 * Get CSS from editor instance
 * @param {Object} editor - GrapesJS editor instance
 * @returns {string} CSS content
 */
export function getEditorCss(editor) {
  if (!editor) return '';
  return editor.getCss();
}

export default GrapesJsEditor;
