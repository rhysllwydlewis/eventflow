/**
 * Shared configuration utility
 * Provides consistent access to application configuration values
 */

'use strict';

/**
 * Get the application base URL
 * Checks APP_BASE_URL, then BASE_URL, then falls back to localhost
 * @returns {string} Application base URL
 */
function getBaseUrl() {
  return process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
}

module.exports = {
  getBaseUrl,
};
