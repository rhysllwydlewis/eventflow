/**
 * Validators Utility
 * Common validation functions for user input
 */

'use strict';

const validator = require('validator');

/**
 * Validate password strength
 * @param {string} pw - Password to validate
 * @returns {boolean} True if password is valid
 */
function passwordOk(pw = '') {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
function isValidEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
function isValidUrl(url) {
  return typeof url === 'string' && validator.isURL(url);
}

/**
 * Sanitize email
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
function sanitizeEmail(email) {
  if (typeof email !== 'string') {
    return '';
  }
  return validator.normalizeEmail(email) || email.toLowerCase().trim();
}

/**
 * Validate user role
 * @param {string} role - Role to validate
 * @returns {boolean} True if role is valid
 */
function isValidRole(role) {
  const VALID_USER_ROLES = ['customer', 'supplier', 'admin'];
  return VALID_USER_ROLES.includes(role);
}

/**
 * Validate name length
 * @param {string} name - Name to validate
 * @param {number} maxLength - Maximum length (default 80)
 * @returns {boolean} True if name is valid
 */
function isValidName(name, maxLength = 80) {
  return typeof name === 'string' && name.trim().length > 0 && name.length <= maxLength;
}

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone is valid
 */
function isValidPhone(phone) {
  if (typeof phone !== 'string') {
    return false;
  }
  // Basic phone validation - adjust regex as needed
  return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(phone);
}

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim();
}

/**
 * Validate MongoDB ObjectId
 * MongoDB ObjectIds are 24-character hexadecimal strings
 * @param {string} id - ID to validate
 * @returns {boolean} True if ID is valid MongoDB ObjectId
 */
function isValidObjectId(id) {
  // MongoDB ObjectId format: 24-character hexadecimal (a-f, 0-9)
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

/**
 * Validate hex color format
 * @param {string} color - Color to validate (#RGB or #RRGGBB)
 * @returns {boolean} True if color is valid hex
 */
function isValidHexColor(color) {
  if (typeof color !== 'string') {
    return false;
  }
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

/**
 * Validate folder/label name
 * @param {string} name - Name to validate
 * @param {number} maxLength - Maximum length (default 100)
 * @returns {boolean} True if name is valid
 */
function isValidFolderLabelName(name, maxLength = 100) {
  return (
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.length <= maxLength &&
    // eslint-disable-next-line no-control-regex
    !/[<>:"/\\|?*\x00-\x1f]/.test(name) // No invalid file system chars
  );
}

/**
 * Validate icon/emoji (single char or short string)
 * @param {string} icon - Icon to validate
 * @returns {boolean} True if icon is valid
 */
function isValidIcon(icon) {
  return typeof icon === 'string' && icon.length >= 1 && icon.length <= 10;
}

/**
 * Validate search query length
 * @param {string} query - Search query to validate
 * @param {number} maxLength - Maximum length (default 500)
 * @returns {boolean} True if query is valid
 */
function isValidSearchQuery(query, maxLength = 500) {
  return typeof query === 'string' && query.trim().length > 0 && query.length <= maxLength;
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {number} maxLimit - Maximum items per page (default 100)
 * @returns {Object} Validated pagination params or error
 */
function validatePagination(page, limit, maxLimit = 100) {
  const parsedPage = parseInt(page, 10) || 1;
  const parsedLimit = parseInt(limit, 10) || 25;

  if (parsedPage < 1) {
    return { isValid: false, error: 'Page must be >= 1' };
  }

  if (parsedLimit < 1 || parsedLimit > maxLimit) {
    return { isValid: false, error: `Limit must be between 1 and ${maxLimit}` };
  }

  return {
    isValid: true,
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
}

module.exports = {
  passwordOk,
  isValidEmail,
  isValidUrl,
  sanitizeEmail,
  isValidRole,
  isValidName,
  isValidPhone,
  sanitizeString,
  isValidObjectId,
  isValidHexColor,
  isValidFolderLabelName,
  isValidIcon,
  isValidSearchQuery,
  validatePagination,
};
