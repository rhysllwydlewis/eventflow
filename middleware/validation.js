/**
 * Validation Middleware
 * Provides input validation helpers for the application
 */

'use strict';

/**
 * Check if password meets minimum requirements
 * Must be at least 8 characters with letters and numbers
 * @param {string} pw - Password to validate
 * @returns {boolean} True if password is valid
 */
function passwordOk(pw = '') {
  return typeof pw === 'string' && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

module.exports = {
  passwordOk,
};
