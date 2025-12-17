/**
 * Unit tests for middleware functions
 */

const { configureSanitization, inputValidationMiddleware } = require('../../middleware/sanitize');

describe('Sanitization Middleware', () => {
  describe('configureSanitization', () => {
    it('should return middleware function', () => {
      const middleware = configureSanitization();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('inputValidationMiddleware', () => {
    it('should remove null bytes from body', () => {
      const req = {
        body: { name: 'test\0name', value: 'test\0value' },
        query: {},
        params: {},
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.body.name).toBe('testname');
      expect(req.body.value).toBe('testvalue');
      expect(next).toHaveBeenCalled();
    });

    it('should remove null bytes from query', () => {
      const req = {
        body: {},
        query: { search: 'test\0query' },
        params: {},
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.query.search).toBe('testquery');
      expect(next).toHaveBeenCalled();
    });

    it('should remove null bytes from params', () => {
      const req = {
        body: {},
        query: {},
        params: { id: 'test\0id' },
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.params.id).toBe('testid');
      expect(next).toHaveBeenCalled();
    });

    it('should handle nested objects', () => {
      const req = {
        body: {
          user: {
            name: 'test\0name',
            address: { city: 'test\0city' },
          },
        },
        query: {},
        params: {},
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.body.user.name).toBe('testname');
      expect(req.body.user.address.city).toBe('testcity');
      expect(next).toHaveBeenCalled();
    });

    it('should handle arrays with null bytes', () => {
      const req = {
        body: {
          tags: ['test\0tag1', 'test\0tag2'],
        },
        query: {},
        params: {},
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.body.tags[0]).toBe('testtag1');
      expect(req.body.tags[1]).toBe('testtag2');
      expect(next).toHaveBeenCalled();
    });

    it('should handle missing body, query, or params', () => {
      const req = {};
      const res = {};
      const next = jest.fn();

      expect(() => {
        inputValidationMiddleware(req, res, next);
      }).not.toThrow();

      expect(next).toHaveBeenCalled();
    });

    it('should preserve non-string values', () => {
      const req = {
        body: {
          count: 42,
          active: true,
          items: null,
        },
        query: {},
        params: {},
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.body.count).toBe(42);
      expect(req.body.active).toBe(true);
      expect(req.body.items).toBeNull();
      expect(next).toHaveBeenCalled();
    });

    it('should handle multiple null bytes in single string', () => {
      const req = {
        body: { text: 'test\0\0\0string' },
        query: {},
        params: {},
      };
      const res = {};
      const next = jest.fn();

      inputValidationMiddleware(req, res, next);

      expect(req.body.text).toBe('teststring');
      expect(next).toHaveBeenCalled();
    });
  });
});
