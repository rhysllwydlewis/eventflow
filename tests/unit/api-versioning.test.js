/**
 * Unit tests for API versioning middleware
 */

'use strict';

const {
  apiVersionMiddleware,
  getApiVersion,
  isSupportedVersion,
  requireVersion,
  deprecateVersion,
} = require('../../middleware/api-versioning');

describe('API Versioning Middleware', () => {
  describe('getApiVersion', () => {
    it('should extract version from path', () => {
      const req = { path: '/api/v1/users' };
      expect(getApiVersion(req)).toBe('v1');
    });

    it('should extract v2 from path', () => {
      const req = { path: '/api/v2/suppliers' };
      expect(getApiVersion(req)).toBe('v2');
    });

    it('should return null for non-versioned path', () => {
      const req = { path: '/api/users' };
      expect(getApiVersion(req)).toBeNull();
    });

    it('should return null for non-API path', () => {
      const req = { path: '/about' };
      expect(getApiVersion(req)).toBeNull();
    });
  });

  describe('isSupportedVersion', () => {
    it('should return true for v1', () => {
      expect(isSupportedVersion('v1')).toBe(true);
    });

    it('should return true for v2', () => {
      expect(isSupportedVersion('v2')).toBe(true);
    });

    it('should return false for v3', () => {
      expect(isSupportedVersion('v3')).toBe(false);
    });
  });

  describe('apiVersionMiddleware', () => {
    it('should set apiVersion to v1 by default', () => {
      const req = { path: '/api/users' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      apiVersionMiddleware(req, res, next);

      expect(req.apiVersion).toBe('v1');
      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1');
      expect(next).toHaveBeenCalled();
    });

    it('should extract version from path', () => {
      const req = { path: '/api/v2/users' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      apiVersionMiddleware(req, res, next);

      expect(req.apiVersion).toBe('v2');
      expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v2');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireVersion', () => {
    it('should allow supported version', () => {
      const middleware = requireVersion('v1', 'v2');
      const req = { apiVersion: 'v1' };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject unsupported version', () => {
      const middleware = requireVersion('v1');
      const req = { apiVersion: 'v2' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unsupported API version',
          requestedVersion: 'v2',
          supportedVersions: ['v1'],
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('deprecateVersion', () => {
    it('should add deprecation headers for specified version', () => {
      const middleware = deprecateVersion('v1', '2025-12-31');
      const req = { apiVersion: 'v1' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
      expect(res.setHeader).toHaveBeenCalledWith('Sunset', '2025-12-31');
      expect(res.setHeader).toHaveBeenCalledWith('Link', '</api/v2>; rel="successor-version"');
      expect(next).toHaveBeenCalled();
    });

    it('should not add headers for other versions', () => {
      const middleware = deprecateVersion('v1', '2025-12-31');
      const req = { apiVersion: 'v2' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});
