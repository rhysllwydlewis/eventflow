/**
 * Content Sanitization Service
 * Sanitizes user-generated content to prevent XSS attacks
 */

'use strict';

let purifier = null;
let purifierInitAttempted = false;

// Configure DOMPurify to allow safe HTML
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'b',
    'i',
    'u',
    'strong',
    'em',
    'p',
    'br',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};

// Strict config for untrusted content (strips all HTML)
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

function basicSanitize(content, strict = false) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  if (strict) {
    return content.replace(/<[^>]*>/g, '');
  }

  // Conservative fallback if DOMPurify is unavailable in current runtime:
  // remove script/style tags and event handler attributes.
  return content
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

function getPurifier() {
  if (purifier || purifierInitAttempted) {
    return purifier;
  }

  purifierInitAttempted = true;

  try {
    const { JSDOM } = require('jsdom');
    const createDOMPurify = require('dompurify');
    const window = new JSDOM('').window;
    purifier = createDOMPurify(window);
  } catch (error) {
    purifier = null;
  }

  return purifier;
}

/**
 * Sanitize HTML content
 * @param {string} content - Raw HTML content
 * @param {boolean} strict - Use strict mode (no HTML allowed)
 * @returns {string} Sanitized content
 */
function sanitizeContent(content, strict = false) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const config = strict ? STRICT_CONFIG : SANITIZE_CONFIG;
  const safePurifier = getPurifier();

  if (!safePurifier) {
    return basicSanitize(content, strict);
  }

  return safePurifier.sanitize(content, config);
}

/**
 * Sanitize message object
 * Sanitizes all text fields in a message
 * @param {Object} message - Message object
 * @param {boolean} strict - Use strict mode
 * @returns {Object} Sanitized message
 */
function sanitizeMessage(message, strict = false) {
  if (!message || typeof message !== 'object') {
    return message;
  }

  const sanitized = { ...message };

  // Sanitize content field
  if (sanitized.content) {
    sanitized.content = sanitizeContent(sanitized.content, strict);
  }

  // Sanitize attachment filenames
  if (Array.isArray(sanitized.attachments)) {
    sanitized.attachments = sanitized.attachments.map(attachment => ({
      ...attachment,
      filename: sanitizeContent(attachment.filename || '', true),
    }));
  }

  // Sanitize metadata
  if (sanitized.metadata && typeof sanitized.metadata === 'object') {
    if (sanitized.metadata.subject) {
      sanitized.metadata.subject = sanitizeContent(sanitized.metadata.subject, true);
    }
  }

  return sanitized;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Strip all HTML tags
 * @param {string} html - HTML content
 * @returns {string} Plain text
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return sanitizeContent(html, true);
}

module.exports = {
  sanitizeContent,
  sanitizeMessage,
  escapeHtml,
  stripHtml,
  SANITIZE_CONFIG,
  STRICT_CONFIG,
};
