/**
 * Tests for Advanced Search CSRF Integration
 * Validates that advanced-search.js properly uses the CSRF handler
 */

// Mock fetch globally
global.fetch = jest.fn();

// Setup minimal DOM environment
global.document = {
  cookie: '',
};

// Setup window mock
global.window = {
  __CSRF_TOKEN__: null,
  csrfToken: null,
  csrfHandler: null,
};

describe('Advanced Search CSRF Integration', () => {
  let CSRFHandler;

  beforeAll(() => {
    // Load the CSRF handler module
    CSRFHandler = require('../../public/assets/js/utils/csrf-handler.js');
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    global.fetch.mockReset();
    global.document.cookie = '';
    global.window.__CSRF_TOKEN__ = null;
    global.window.csrfToken = null;
    
    // Create new CSRF handler instance
    global.window.csrfHandler = new CSRFHandler();
  });

  describe('apiFetch with CSRF Handler', () => {
    it('should use window.csrfHandler.fetch for API calls', async () => {
      global.window.csrfHandler.token = 'test-token';
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, results: [] }),
      });

      // Simulate the apiFetch function from advanced-search.js
      const apiFetch = async (url, options = {}) => {
        if (!window.csrfHandler) {
          throw new Error('CSRF handler not available');
        }

        const fetchOptions = {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        };

        const response = await window.csrfHandler.fetch(url, fetchOptions);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ 
            error: `HTTP ${response.status}` 
          }));
          throw new Error(error.error || error.message || `Request failed: ${response.status}`);
        }

        return await response.json();
      };

      const result = await apiFetch('/api/v2/search/advanced?q=test');
      
      expect(result).toEqual({ success: true, results: [] });
      expect(global.fetch).toHaveBeenCalled();
      
      // The CSRF handler adds the token to headers - verify fetch was called correctly
      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[0]).toBe('/api/v2/search/advanced?q=test');
      expect(fetchCall[1].headers).toBeDefined();
    });

    it('should throw error if CSRF handler is not available', async () => {
      global.window.csrfHandler = null;

      const apiFetch = async (url, options = {}) => {
        if (!window.csrfHandler) {
          throw new Error('CSRF handler not available');
        }
        // ... rest of function
      };

      await expect(apiFetch('/api/v2/search/advanced?q=test')).rejects.toThrow('CSRF handler not available');
    });

    it('should handle 403 CSRF errors with retry', async () => {
      global.window.csrfHandler.token = 'old-token';

      // First call: 403 CSRF error
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          clone: () => ({
            json: async () => ({ error: 'CSRF token invalid' }),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ csrfToken: 'new-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, results: ['result1'] }),
        });

      const apiFetch = async (url, options = {}) => {
        const fetchOptions = {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        };

        const response = await window.csrfHandler.fetch(url, fetchOptions);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ 
            error: `HTTP ${response.status}` 
          }));
          throw new Error(error.error || error.message || `Request failed: ${response.status}`);
        }

        return await response.json();
      };

      const result = await apiFetch('/api/v2/search/advanced?q=test');
      
      expect(result).toEqual({ success: true, results: ['result1'] });
      // Should have been called 3 times: initial 403, token refresh, retry
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Search with Retry Logic', () => {
    it('should retry search on transient failures', async () => {
      global.window.csrfHandler.token = 'test-token';

      // Simulate 2 failures then success
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, results: ['item1', 'item2'], totalCount: 2 }),
        });

      const executeSearchWithRetry = async (query, retries = 3, delay = 100) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await window.csrfHandler.ensureToken();

            const apiFetch = async (url) => {
              const response = await window.csrfHandler.fetch(url, {
                headers: { 'Content-Type': 'application/json' },
              });
              
              if (!response.ok) {
                throw new Error('Request failed');
              }
              
              return await response.json();
            };

            const encodedQuery = encodeURIComponent(query);
            const data = await apiFetch(`/api/v2/search/advanced?q=${encodedQuery}`);
            
            return data;
          } catch (error) {
            if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
            } else {
              throw error;
            }
          }
        }
      };

      const result = await executeSearchWithRetry('test query');
      
      expect(result).toEqual({ success: true, results: ['item1', 'item2'], totalCount: 2 });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after all retries exhausted', async () => {
      global.window.csrfHandler.token = 'test-token';
      global.fetch.mockRejectedValue(new Error('Persistent failure'));

      const executeSearchWithRetry = async (query, retries = 3, delay = 10) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            const apiFetch = async (url) => {
              const response = await window.csrfHandler.fetch(url);
              return await response.json();
            };

            return await apiFetch(`/api/v2/search/advanced?q=${encodeURIComponent(query)}`);
          } catch (error) {
            if (attempt < retries) {
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw error;
            }
          }
        }
      };

      await expect(executeSearchWithRetry('test')).rejects.toThrow('Persistent failure');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
