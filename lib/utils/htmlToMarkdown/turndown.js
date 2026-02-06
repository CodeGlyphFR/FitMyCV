/**
 * Turndown service configuration for HTML to Markdown conversion
 * Creates and configures the Turndown service instance
 */

import TurndownService from 'turndown';

/**
 * Create configured Turndown service
 * @returns {TurndownService}
 */
export function createTurndownService() {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*'
  });

  // Remove images, scripts, styles, svg, iframe from output
  turndownService.remove(['img', 'script', 'style', 'svg', 'iframe', 'noscript', 'canvas', 'video', 'audio']);

  // Ignore navigation elements
  turndownService.addRule('removeNav', {
    filter: ['nav', 'header', 'footer', 'aside'],
    replacement: () => ''
  });

  // Ignore hidden elements
  turndownService.addRule('removeHidden', {
    filter: (node) => {
      if (node.nodeType !== 1) return false;
      const style = node.getAttribute('style') || '';
      const className = node.getAttribute('class') || '';
      return (
        style.includes('display: none') ||
        style.includes('display:none') ||
        style.includes('visibility: hidden') ||
        className.includes('hidden') ||
        className.includes('sr-only') ||
        className.includes('visually-hidden')
      );
    },
    replacement: () => ''
  });

  // Simplify links (keep text, remove URL noise)
  turndownService.addRule('simplifyLinks', {
    filter: 'a',
    replacement: (content) => content
  });

  return turndownService;
}

/**
 * Clean markdown content
 * @param {string} markdown - Raw markdown
 * @returns {string} - Cleaned markdown
 */
export function cleanMarkdownContent(markdown) {
  if (!markdown) return '';

  return markdown
    // Remove excessive newlines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Remove empty list items
    .replace(/^-\s*$/gm, '')
    // Remove lines that are just whitespace
    .replace(/^\s+$/gm, '')
    // Normalize multiple spaces
    .replace(/[ \t]+/g, ' ')
    // Remove leading/trailing whitespace from lines
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove excessive newlines again after line processing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
