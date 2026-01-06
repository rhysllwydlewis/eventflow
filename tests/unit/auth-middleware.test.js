/**
 * Unit tests for authentication middleware
 */

const jwt = require('jsonwebtoken');
const {
  setAuthCookie,
  clearAuthCookie,
  getUserFromCookie,
  authRequired,
  roleRequired,
} = require('../../middleware/auth');

const JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-testing-only-minimum-32-characters-long';

describe('Auth Middleware', () => {
  describe('setAuthCookie', () => {
    it('should set httpOnly cookie with token', () => {
      const res = {
        cookie: jest.fn(),
      };
      const token = 'test-token';

      setAuthCookie(res, token);

      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        token,
        expect.objectContaining({
          httpOnly: true,
          maxAge: expect.any(Number),
        })
      );
    });

    it('should set secure cookie in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = {
        cookie: jest.fn(),
      };
      const token = 'test-token';

      setAuthCookie(res, token);

      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        token,
        expect.objectContaining({
          secure: true,
          sameSite: 'strict',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should set non-secure cookie in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = {
        cookie: jest.fn(),
      };
      const token = 'test-token';

      setAuthCookie(res, token);

      expect(res.cookie).toHaveBeenCalledWith(
        'token',
        token,
        expect.objectContaining({
          secure: false,
          sameSite: 'lax',
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('clearAuthCookie', () => {
    it('should clear token cookie', () => {
      const res = {
        clearCookie: jest.fn(),
      };

      clearAuthCookie(res);

      expect(res.clearCookie).toHaveBeenCalledWith('token');
    });

    it('should clear cookie with proper options', () => {
      const res = {
        clearCookie: jest.fn(),
      };

      clearAuthCookie(res);

      // Should be called multiple times with different options
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.clearCookie.mock.calls.length).toBeGreaterThanOrEqual(2);

      // First call with full options
      expect(res.clearCookie).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );

      // Second call without options for legacy compatibility
      expect(res.clearCookie).toHaveBeenCalledWith('token');
    });

    it('should clear cookie with domain variants in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = {
        clearCookie: jest.fn(),
      };

      clearAuthCookie(res);

      // Should attempt to clear with domain variants for production
      expect(res.clearCookie).toHaveBeenCalled();
      expect(res.clearCookie.mock.calls.length).toBeGreaterThanOrEqual(3);

      // Check for domain-specific clearing
      const domainCalls = res.clearCookie.mock.calls.filter(
        call => call[1] && call[1].domain !== undefined
      );
      expect(domainCalls.length).toBeGreaterThan(0);

      process.env.NODE_ENV = originalEnv;
    });

    it('should not use domain variants in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = {
        clearCookie: jest.fn(),
      };

      clearAuthCookie(res);

      // In development, should only clear twice (with and without options)
      expect(res.clearCookie.mock.calls.length).toBe(2);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('getUserFromCookie', () => {
    it('should return user from valid JWT cookie', () => {
      const payload = { id: '123', email: 'test@example.com', role: 'customer' };
      const token = jwt.sign(payload, JWT_SECRET);

      const req = {
        cookies: { token },
      };

      const user = getUserFromCookie(req);

      expect(user).toBeDefined();
      expect(user.id).toBe('123');
      expect(user.email).toBe('test@example.com');
      expect(user.role).toBe('customer');
    });

    it('should return null if no cookie present', () => {
      const req = {
        cookies: {},
      };

      const user = getUserFromCookie(req);

      expect(user).toBeNull();
    });

    it('should return null if cookies object missing', () => {
      const req = {};

      const user = getUserFromCookie(req);

      expect(user).toBeNull();
    });

    it('should return null for invalid JWT token', () => {
      const req = {
        cookies: { token: 'invalid.jwt.token' },
      };

      const user = getUserFromCookie(req);

      expect(user).toBeNull();
    });

    it('should return null for expired JWT token', () => {
      const payload = { id: '123', email: 'test@example.com' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });

      const req = {
        cookies: { token },
      };

      const user = getUserFromCookie(req);

      expect(user).toBeNull();
    });
  });

  describe('authRequired', () => {
    it('should attach user to request and call next for valid auth', () => {
      const payload = { id: '123', email: 'test@example.com', role: 'customer' };
      const token = jwt.sign(payload, JWT_SECRET);

      const req = {
        cookies: { token },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authRequired(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('123');
      expect(req.userId).toBe('123');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 if no authentication', () => {
      const req = {
        cookies: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authRequired(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', () => {
      const req = {
        cookies: { token: 'invalid.token' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authRequired(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('roleRequired', () => {
    it('should allow access for matching role', () => {
      const middleware = roleRequired('admin');

      const req = {
        user: { id: '123', role: 'admin' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 for non-matching role', () => {
      const middleware = roleRequired('admin');

      const req = {
        user: { id: '123', role: 'customer' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if no user present', () => {
      const middleware = roleRequired('admin');

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should work with supplier role', () => {
      const middleware = roleRequired('supplier');

      const req = {
        user: { id: '456', role: 'supplier' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should work with customer role', () => {
      const middleware = roleRequired('customer');

      const req = {
        user: { id: '789', role: 'customer' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
