/**
 * HTML Sanitization Utility
 * Provides safe methods for inserting content into the DOM
 */

/**
 * Simple HTML sanitizer that escapes potentially dangerous characters
 * @param {string} str - The string to sanitize
 * @returns {string} - The sanitized string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Sanitize HTML by removing script tags and dangerous attributes
 * Note: For most use cases, prefer using escapeHtml() which is safer.
 * This function allows some HTML through but removes dangerous elements.
 * @param {string} html - The HTML string to sanitize
 * @returns {string} - The sanitized HTML
 */
function sanitizeHtml(html) {
  if (html === null || html === undefined) {
    return '';
  }

  let sanitized = String(html);

  // Remove script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  return sanitized;
}

/**
 * Safely set HTML content by creating a sanitized element
 * @param {HTMLElement} element - The element to set content on
 * @param {string} html - The HTML string to set
 */
function setHtmlContent(element, html) {
  if (!element) {
    return;
  }

  // Create a temporary container
  const temp = document.createElement('div');
  temp.innerHTML = sanitizeHtml(html);

  // Clear existing content
  element.innerHTML = '';

  // Move sanitized nodes
  while (temp.firstChild) {
    element.appendChild(temp.firstChild);
  }
}

/**
 * Create an element with safe text content
 * @param {string} tagName - The tag name
 * @param {string} text - The text content
 * @param {Object} attrs - Optional attributes
 * @returns {HTMLElement} - The created element
 */
function createElementWithText(tagName, text, attrs = {}) {
  const el = document.createElement(tagName);
  el.textContent = text;

  // Set safe attributes
  Object.keys(attrs).forEach(key => {
    if (key === 'className') {
      el.className = attrs[key];
    } else if (key === 'style' && typeof attrs[key] === 'object') {
      Object.assign(el.style, attrs[key]);
    } else if (key !== 'innerHTML' && !key.startsWith('on')) {
      el.setAttribute(key, attrs[key]);
    }
  });

  return el;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    sanitizeHtml,
    setHtmlContent,
    createElementWithText,
  };
}
