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
 * @param {string} id - ID to validate
 * @returns {boolean} True if ID is valid MongoDB ObjectId
 */
function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
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
};
