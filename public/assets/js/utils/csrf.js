/**
 * CSRF Token Utility
 * Provides helper functions for CSRF token management
 */

/**
 * Get CSRF token from cookie
 * @returns {string|null} The CSRF token or null if not found
 */
function getCsrfToken() {
  // Try to get from global variable first
  if (window.__CSRF_TOKEN__) {
    return window.__CSRF_TOKEN__;
  }

  // Otherwise, read from cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf') {
      return value;
    }
  }

  return null;
}

/**
 * Add CSRF token to fetch options
 * @param {Object} options - Fetch options object
 * @returns {Object} Modified options with CSRF header
 */
function addCsrfToken(options = {}) {
  const token = getCsrfToken();

  if (!token) {
    console.warn('CSRF token not found');
    return options;
  }

  return {
    ...options,
    headers: {
      ...options.headers,
      'X-CSRF-Token': token,
    },
  };
}

/**
 * Fetch with automatic CSRF token inclusion
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise} Fetch promise
 */
async function fetchWithCsrf(url, options = {}) {
  // Only add CSRF for state-changing methods
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    options = addCsrfToken(options);
  }

  return fetch(url, options);
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getCsrfToken, addCsrfToken, fetchWithCsrf };
}

// Make available globally for non-module code
window.getCsrfToken = getCsrfToken;
window.addCsrfToken = addCsrfToken;
window.fetchWithCsrf = fetchWithCsrf;
