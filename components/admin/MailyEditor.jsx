'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  VariableExtension,
  getVariableSuggestions,
} from '@maily-to/core/extensions';

/**
 * Loading skeleton for the Maily editor
 */
function MailyEditorSkeleton() {
  return (
    <div className="w-full h-[600px] bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white/60">Chargement de l'editeur Maily...</p>
      </div>
    </div>
  );
}

/**
 * Detect the context of a color picker (what element it's editing)
 * Maily uses tooltip attributes: "Background Color" and "Text Color"
 */
function detectColorPickerContext(colorPickerContainer) {
  // Look for Maily's tooltip in buttons and parent elements
  // Maily uses aria-label or title on color picker triggers
  const allElements = colorPickerContainer.querySelectorAll('*');
  let foundTooltip = '';

  // Check the container itself and all children
  for (const el of [colorPickerContainer, ...allElements]) {
    const tooltip = el.getAttribute('aria-label') ||
                   el.getAttribute('title') ||
                   el.getAttribute('data-tooltip') ||
                   '';
    if (tooltip) {
      foundTooltip = tooltip.toLowerCase();
      break;
    }
  }

  // Also check parent elements up to 5 levels
  let parent = colorPickerContainer.parentElement;
  let depth = 0;
  while (parent && depth < 5 && !foundTooltip) {
    const tooltip = parent.getAttribute('aria-label') ||
                   parent.getAttribute('title') ||
                   parent.getAttribute('data-tooltip') ||
                   '';
    if (tooltip) {
      foundTooltip = tooltip.toLowerCase();
      break;
    }
    parent = parent.parentElement;
    depth++;
  }

  // Check text content as fallback
  const containerText = colorPickerContainer.textContent?.toLowerCase() || '';

  // Determine context based on tooltip or text
  if (foundTooltip.includes('background') || containerText.includes('background')) {
    return 'background';
  }
  if (foundTooltip.includes('text') || containerText.includes('text color')) {
    return 'text';
  }
  if (foundTooltip.includes('border') || containerText.includes('border')) {
    return 'border';
  }

  // Default to text color
  return 'text';
}

/**
 * Inject eyedropper button into Maily's color picker
 */
function injectEyedropperButton(colorPickerContainer) {
  // Check if eyedropper already injected
  if (colorPickerContainer.querySelector('.eyedropper-btn')) return;

  // Check if EyeDropper API is supported
  if (!('EyeDropper' in window)) return;

  // Find the HexColorInput (the text input for hex color)
  const hexInput = colorPickerContainer.querySelector('input');
  if (!hexInput) return;

  // Detect context
  const context = detectColorPickerContext(colorPickerContainer);

  // Create eyedropper button
  const eyedropperBtn = document.createElement('button');
  eyedropperBtn.className = 'eyedropper-btn';
  eyedropperBtn.type = 'button';
  eyedropperBtn.title = 'Pipette: capturer une couleur de la page';
  eyedropperBtn.dataset.colorContext = context;
  eyedropperBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M7 21L3 17l9.5-9.5L17 12l-9.5 9.5z" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M11 8L8.5 5.5l.5-.5a2.121 2.121 0 113 3l-.5.5L11 8z" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 17l2 2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M21 3l-3 3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  eyedropperBtn.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    padding: 4px;
    border: none;
    background: #f3f4f6;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #374151;
    transition: all 0.15s;
  `;

  // Style the input container to be relative
  const inputContainer = hexInput.parentElement;
  if (inputContainer) {
    inputContainer.style.position = 'relative';
    inputContainer.appendChild(eyedropperBtn);

    // Add padding to input to avoid overlap with button
    hexInput.style.paddingRight = '36px';
  }

  // Handle eyedropper click
  eyedropperBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const color = result.sRGBHex;

      // Re-detect context at click time for more accuracy
      // Look at the popover content wrapper and its siblings/parents
      const popover = colorPickerContainer.closest('[data-radix-popper-content-wrapper]');
      let clickContext = eyedropperBtn.dataset.colorContext;

      if (popover) {
        // Check for any tooltip or label in the popover's trigger or nearby elements
        const popoverContent = popover.querySelector('[role="dialog"], [data-state]');
        if (popoverContent) {
          const html = popoverContent.innerHTML.toLowerCase();
          if (html.includes('background')) {
            clickContext = 'background';
          } else if (html.includes('text color')) {
            clickContext = 'text';
          }
        }
      }

      console.log('[Eyedropper] Picked color:', color, 'context:', clickContext);

      // Dispatch custom event to apply color via TipTap editor
      window.dispatchEvent(new CustomEvent('maily-eyedropper-color', {
        detail: {
          color,
          context: clickContext,
          inputElement: hexInput
        }
      }));

      // Update the input visually and try to trigger React update
      hexInput.value = color.toUpperCase();

      // Try to simulate user input to trigger React's onChange
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(hexInput, color.toUpperCase());
      hexInput.dispatchEvent(new Event('input', { bubbles: true }));
      hexInput.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      // User cancelled or error
      if (err.name !== 'AbortError') {
        console.error('EyeDropper error:', err);
      }
    }
  });

  // Hover effect
  eyedropperBtn.addEventListener('mouseenter', () => {
    eyedropperBtn.style.background = '#e5e7eb';
    eyedropperBtn.style.color = '#111827';
  });
  eyedropperBtn.addEventListener('mouseleave', () => {
    eyedropperBtn.style.background = '#f3f4f6';
    eyedropperBtn.style.color = '#374151';
  });
}

/**
 * Dynamic import of Maily Editor to avoid SSR issues
 */
const Editor = dynamic(
  () => import('@maily-to/core').then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => <MailyEditorSkeleton />,
  }
);

/**
 * Default empty content for new templates
 */
const DEFAULT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Commencez a editer votre email...',
        },
      ],
    },
  ],
};

/**
 * MailyEditor - Wrapper component for @maily-to/core
 *
 * @param {Object} props
 * @param {Object} props.contentJson - Initial content in TipTap JSON format
 * @param {Array} props.variables - Available variables [{name, required}] or string[]
 * @param {Function} props.onReady - Callback when editor is ready (receives editor instance)
 * @param {Function} props.onChange - Callback on content change (receives editor instance)
 * @param {string} props.minHeight - Minimum height of the editor (default: '600px')
 * @param {string} props.backgroundColor - Background color for the editing area (default: '#ffffff')
 */
export function MailyEditor({
  contentJson,
  variables = [],
  onReady,
  onChange,
  minHeight = '600px',
  backgroundColor = '#ffffff',
}) {
  const editorRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onChangeRef = useRef(onChange);
  const [cssLoaded, setCssLoaded] = useState(false);

  // Load Maily CSS dynamically to avoid PostCSS conflicts
  useEffect(() => {
    const linkId = 'maily-to-styles';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = '/maily-editor.css';
      link.onload = () => setCssLoaded(true);
      link.onerror = () => setCssLoaded(true); // Continue anyway
      document.head.appendChild(link);
    } else {
      setCssLoaded(true);
    }
  }, []);

  // Watch for color picker popovers and inject eyedropper button
  useEffect(() => {
    if (!cssLoaded) return;

    // MutationObserver to detect color picker popovers
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Look for color picker containers (react-colorful creates these)
            const colorPickers = node.querySelectorAll
              ? node.querySelectorAll('.react-colorful')
              : [];

            // Also check if the node itself is a container with color picker
            if (node.classList?.contains('react-colorful')) {
              const container = node.closest('[data-radix-popper-content-wrapper]') || node.parentElement;
              if (container) {
                injectEyedropperButton(container);
              }
            }

            colorPickers.forEach((picker) => {
              const container = picker.closest('[data-radix-popper-content-wrapper]') || picker.parentElement?.parentElement;
              if (container) {
                injectEyedropperButton(container);
              }
            });
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [cssLoaded]);

  // Listen for eyedropper color pick events and apply to editor
  useEffect(() => {
    const handleEyedropperColor = (event) => {
      const { color, context } = event.detail;
      const editor = editorRef.current;

      if (editor && color) {
        // Check what type of element we're editing
        const isButton = editor.isActive('button');
        const isSection = editor.isActive('section');

        console.log('[Eyedropper] Applying color:', color, 'context:', context, 'isButton:', isButton, 'isSection:', isSection);

        if (isButton) {
          // For buttons, use context to determine which attribute to update
          // Maily buttons have: buttonColor (background) and textColor
          try {
            if (context === 'background') {
              // Update button background color
              editor.chain().focus().updateAttributes('button', { buttonColor: color }).run();
              console.log('[Eyedropper] Applied buttonColor:', color);
            } else {
              // Default to text color for buttons
              editor.chain().focus().updateAttributes('button', { textColor: color }).run();
              console.log('[Eyedropper] Applied textColor:', color);
            }
          } catch (e) {
            console.warn('Could not apply color to button:', e);
          }
        } else if (isSection) {
          // For sections, update background or border color
          try {
            if (context === 'border') {
              editor.chain().focus().updateAttributes('section', { borderColor: color }).run();
            } else {
              editor.chain().focus().updateAttributes('section', { backgroundColor: color }).run();
            }
          } catch (e) {
            console.warn('Could not apply color to section:', e);
          }
        } else {
          // Default: apply as text color using TipTap's setColor
          editor.chain().focus().setColor(color).run();
        }
      }
    };

    window.addEventListener('maily-eyedropper-color', handleEyedropperColor);
    return () => window.removeEventListener('maily-eyedropper-color', handleEyedropperColor);
  }, []);

  // Keep refs updated without causing re-renders
  useEffect(() => {
    onReadyRef.current = onReady;
    onChangeRef.current = onChange;
  }, [onReady, onChange]);

  // Format variables for Maily.to - memoized to prevent re-renders
  const formattedVariables = useMemo(() =>
    variables.map((v) => ({
      name: typeof v === 'string' ? v : v.name,
      required: typeof v === 'string' ? false : v.required ?? false,
    })),
    [variables]
  );

  // Configure extensions with variables
  const extensions = useMemo(() => {
    if (formattedVariables.length === 0) return [];

    return [
      VariableExtension.configure({
        suggestion: getVariableSuggestions('@'),
        variables: formattedVariables,
      }),
    ];
  }, [formattedVariables]);

  // Parse contentJson if it's a string - memoized
  const parsedContent = useMemo(() => {
    if (!contentJson) return DEFAULT_CONTENT;
    if (typeof contentJson === 'string') {
      try {
        const parsed = JSON.parse(contentJson);
        // Check if it's the old Unlayer format (has 'body' property)
        if (parsed.body) {
          return DEFAULT_CONTENT;
        }
        // Check for empty doc
        if (parsed.type === 'doc' && (!parsed.content || parsed.content.length === 0)) {
          return DEFAULT_CONTENT;
        }
        return parsed;
      } catch {
        return DEFAULT_CONTENT;
      }
    }
    // Check if it's the old Unlayer format
    if (contentJson.body) {
      return DEFAULT_CONTENT;
    }
    return contentJson;
  }, [contentJson]);

  // Stable callbacks using refs
  const handleCreate = useCallback((editor) => {
    editorRef.current = editor;
    if (onReadyRef.current) {
      onReadyRef.current(editor);
    }
  }, []);

  const handleUpdate = useCallback((editor) => {
    editorRef.current = editor;
    if (onChangeRef.current) {
      onChangeRef.current(editor);
    }
  }, []);

  // Show loading while CSS is loading
  if (!cssLoaded) {
    return <MailyEditorSkeleton />;
  }

  return (
    <div
      className="maily-editor-wrapper rounded-xl overflow-hidden shadow-lg border border-gray-200"
      style={{ minHeight }}
    >
      {/* Apply background color only to the editing content area */}
      <style>{`
        .maily-editor-wrapper .ProseMirror,
        .maily-editor-wrapper .tiptap {
          background-color: ${backgroundColor} !important;
          min-height: 500px;
        }
      `}</style>
      <Editor
        contentJson={parsedContent}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        extensions={extensions}
        config={{
          hasMenuBar: true,
          spellCheck: true,
          autofocus: false,
        }}
      />
    </div>
  );
}

/**
 * Get JSON content from editor instance
 * @param {Object} editor - Editor instance
 * @returns {Object} JSON content
 */
export function getEditorJSON(editor) {
  if (!editor) return null;
  return editor.getJSON();
}

/**
 * Get HTML content from editor instance
 * @param {Object} editor - Editor instance
 * @returns {string} HTML content
 */
export function getEditorHTML(editor) {
  if (!editor) return '';
  return editor.getHTML();
}

export default MailyEditor;
