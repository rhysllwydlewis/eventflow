/**
 * Centralized API client for consistent endpoint management
 * Makes it easy to change API versions or base URLs in future
 */

class APIClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build full URL for endpoint
   * @param {string} path - API path (e.g., 'auth/login')
   * @returns {string} Full URL
   */
  url(path) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${this.baseUrl}/${cleanPath}`;
  }

  /**
   * Make authenticated request
   * @param {string} path - API path
   * @param {Object} options - Fetch options
   * @returns {Promise}
   */
  async request(path, options = {}) {
    const url = this.url(path);
    const headers = {
      ...this.defaultHeaders,
      ...options.headers,
    };

    // Add CSRF token if available
    if (window.csrfToken) {
      headers['X-CSRF-Token'] = window.csrfToken;
    }

    const config = {
      ...options,
      headers,
      credentials: 'include', // Include cookies for auth
    };

    const response = await fetch(url, config);
    return response;
  }

  /**
   * GET request
   */
  async get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  async put(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  async delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
window.apiClient = new APIClient('/api/v1');
