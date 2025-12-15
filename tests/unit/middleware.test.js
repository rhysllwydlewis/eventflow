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
  });
});
