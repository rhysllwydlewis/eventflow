/**
 * Text Highlighting Utility
 * Provides functions for highlighting search keywords in text
 */

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape regex special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped regex string
 */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight keywords in text with <mark> tags
 * @param {string} text - Text to highlight
 * @param {string|string[]} keywords - Keyword(s) to highlight
 * @returns {string} HTML with highlighted keywords
 */
function highlightKeywords(text, keywords) {
  if (!text || !keywords) {
    return escapeHtml(text || '');
  }

  // Ensure keywords is an array
  const keywordArray = Array.isArray(keywords) ? keywords : [keywords];

  // Filter out empty keywords
  const validKeywords = keywordArray.filter(k => k && k.trim());

  if (validKeywords.length === 0) {
    return escapeHtml(text);
  }

  // Escape HTML first
  let highlighted = escapeHtml(text);

  // Highlight each keyword (case-insensitive)
  validKeywords.forEach(keyword => {
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword) {
      const regex = new RegExp(`(${escapeRegex(trimmedKeyword)})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    }
  });

  return highlighted;
}

/**
 * Split query into individual keywords for highlighting
 * @param {string} query - Search query
 * @returns {string[]} Array of keywords
 */
function splitQueryToKeywords(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  // Split by whitespace and remove empty strings
  return query
    .trim()
    .split(/\s+/)
    .filter(k => k.length > 0);
}

/**
 * Highlight query terms in text (convenience wrapper)
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML with highlighted terms
 */
function highlightQuery(text, query) {
  const keywords = splitQueryToKeywords(query);
  return highlightKeywords(text, keywords);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    escapeRegex,
    highlightKeywords,
    splitQueryToKeywords,
    highlightQuery,
  };
} else {
  // Browser global
  window.TextHighlighting = {
    escapeHtml,
    escapeRegex,
    highlightKeywords,
    splitQueryToKeywords,
    highlightQuery,
  };
}
