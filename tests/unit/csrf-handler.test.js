/**
 * Tests for CSRF Handler
 * Validates token management, retry logic, and error handling
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
};

describe('CSRFHandler', () => {
  let CSRFHandler;
  let handler;

  beforeAll(() => {
    // Load the module after setting up mocks
    CSRFHandler = require('../../public/assets/js/utils/csrf-handler.js');
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    global.fetch.mockReset();
    global.document.cookie = '';
    global.window.__CSRF_TOKEN__ = null;
    global.window.csrfToken = null;

    // Create new handler instance
    handler = new CSRFHandler();
  });

  describe('getTokenFromCookie', () => {
    it('should extract CSRF token from cookie', () => {
      global.document.cookie = 'csrf=test-token-123; path=/';
      const token = handler.getTokenFromCookie();
      expect(token).toBe('test-token-123');
    });

    it('should return null if no CSRF cookie exists', () => {
      global.document.cookie = 'other=value';
      const token = handler.getTokenFromCookie();
      expect(token).toBeNull();
    });

    it('should decode URL-encoded tokens', () => {
      global.document.cookie = 'csrf=test%2Btoken%3D123; path=/';
      const token = handler.getTokenFromCookie();
      expect(token).toBe('test+token=123');
    });
  });

  describe('ensureToken', () => {
    it('should return cached token if available', async () => {
      handler.token = 'cached-token';
      const token = await handler.ensureToken();
      expect(token).toBe('cached-token');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch token from server if not cached', async () => {
      const mockToken = 'fresh-token-456';
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: mockToken }),
      });

      const token = await handler.ensureToken();
      expect(token).toBe(mockToken);
      expect(handler.token).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/csrf-token', {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });
    });

    it('should retry on fetch failure with exponential backoff', async () => {
      // Simulate 2 failures then success
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ csrfToken: 'retry-token' }),
        });

      const token = await handler.ensureToken();
      expect(token).toBe('retry-token');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error after all retries exhausted', async () => {
      global.fetch.mockRejectedValue(new Error('Persistent failure'));

      await expect(handler.ensureToken()).rejects.toThrow(
        'Failed to fetch CSRF token after 3 attempts'
      );
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should force refresh token when requested', async () => {
      handler.token = 'old-token';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ csrfToken: 'new-token' }),
      });

      const token = await handler.ensureToken(true);
      expect(token).toBe('new-token');
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('addTokenToOptions', () => {
    it('should add CSRF token for POST requests', () => {
      handler.token = 'test-token';
      const options = handler.addTokenToOptions({ method: 'POST' });
      expect(options.headers['X-CSRF-Token']).toBe('test-token');
    });

    it('should add CSRF token for PUT requests', () => {
      handler.token = 'test-token';
      const options = handler.addTokenToOptions({ method: 'PUT' });
      expect(options.headers['X-CSRF-Token']).toBe('test-token');
    });

    it('should add CSRF token for DELETE requests', () => {
      handler.token = 'test-token';
      const options = handler.addTokenToOptions({ method: 'DELETE' });
      expect(options.headers['X-CSRF-Token']).toBe('test-token');
    });

    it('should NOT add CSRF token for GET requests', () => {
      handler.token = 'test-token';
      const options = handler.addTokenToOptions({ method: 'GET' });
      expect(options.headers).toBeUndefined();
    });

    it('should preserve existing headers', () => {
      handler.token = 'test-token';
      const options = handler.addTokenToOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['X-CSRF-Token']).toBe('test-token');
    });
  });

  describe('fetch', () => {
    it('should add CSRF token for POST request', async () => {
      handler.token = 'test-token';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await handler.fetch('/api/test', { method: 'POST' });

      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[1].headers['X-CSRF-Token']).toBe('test-token');
    });

    it('should retry on 403 CSRF error', async () => {
      handler.token = 'old-token';

      // First call: 403 with CSRF error
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
          status: 200,
        });

      const response = await handler.fetch('/api/test', { method: 'POST' });
      expect(response.status).toBe(200);
      expect(global.fetch).toHaveBeenCalledTimes(3); // Initial + token refresh + retry
    });

    it('should add credentials: include if not specified', async () => {
      handler.token = 'test-token';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await handler.fetch('/api/test', { method: 'POST' });

      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[1].credentials).toBe('include');
    });

    it('should not override existing credentials', async () => {
      handler.token = 'test-token';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await handler.fetch('/api/test', {
        method: 'POST',
        credentials: 'same-origin',
      });

      const fetchCall = global.fetch.mock.calls[0];
      expect(fetchCall[1].credentials).toBe('same-origin');
    });
  });
});
