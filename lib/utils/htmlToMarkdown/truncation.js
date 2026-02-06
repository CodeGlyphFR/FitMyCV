/**
 * Smart truncation utilities for HTML to Markdown conversion
 * Preserves important sections while truncating content
 */

/**
 * Smart truncation that preserves important sections
 * @param {string} content - Markdown content
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated content
 */
export function smartTruncate(content, maxLength = 10000) {
  if (content.length <= maxLength) return content;

  // Important section patterns to preserve
  const importantPatterns = [
    /#{1,3}\s*(compétences?|skills?|technologies?)/gi,
    /#{1,3}\s*(profil|profile|requirements?|requis)/gi,
    /#{1,3}\s*(avantages?|benefits?|perks?)/gi,
    /#{1,3}\s*(salaire|salary|rémunération|compensation)/gi,
    /#{1,3}\s*(formation|education|diplôme)/gi,
    /\*\*(compétences?|skills?|profil|avantages?)\*\*/gi
  ];

  const lines = content.split('\n');
  const importantIndices = new Set();

  // Identify important lines and their following content
  lines.forEach((line, i) => {
    for (const pattern of importantPatterns) {
      if (pattern.test(line)) {
        // Mark this line and next 15 lines as important
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          importantIndices.add(j);
        }
        break;
      }
    }
  });

  // If no important sections found, just truncate normally
  if (importantIndices.size === 0) {
    return content.substring(0, maxLength) + '\n\n[...]';
  }

  // Reserve space for important content
  const reservedLength = 3000;
  const mainPartLength = maxLength - reservedLength;

  const result = [];
  let currentLength = 0;
  let addedSeparator = false;

  // Add main content (non-important lines first)
  for (let i = 0; i < lines.length && currentLength < mainPartLength; i++) {
    if (!importantIndices.has(i)) {
      result.push(lines[i]);
      currentLength += lines[i].length + 1;
    }
  }

  // Add important sections at the end
  if (importantIndices.size > 0 && currentLength < maxLength) {
    if (!addedSeparator) {
      result.push('');
      result.push('---');
      result.push('');
      addedSeparator = true;
    }

    const sortedIndices = Array.from(importantIndices).sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      if (currentLength < maxLength - 100 && lines[idx]) {
        result.push(lines[idx]);
        currentLength += lines[idx].length + 1;
      }
    }
  }

  return result.join('\n').trim() + '\n\n[...]';
}
