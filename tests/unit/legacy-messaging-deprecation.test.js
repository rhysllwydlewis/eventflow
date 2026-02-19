/**
 * Unit tests for legacy messaging deprecation middleware
 * Tests middleware/legacyMessaging.js behaviour under all LEGACY_MESSAGING_MODE values.
 */

'use strict';

const { createDeprecationMiddleware } = require('../../middleware/legacyMessaging');

function makeResMock() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

function makeReqMock(method, url) {
  return { method, originalUrl: url };
}

describe('createDeprecationMiddleware', () => {
  const originalMode = process.env.LEGACY_MESSAGING_MODE;

  afterEach(() => {
    // Restore env after each test
    if (originalMode === undefined) {
      delete process.env.LEGACY_MESSAGING_MODE;
    } else {
      process.env.LEGACY_MESSAGING_MODE = originalMode;
    }
  });

  // ---------------------------------------------------------------------------
  // Header injection – all modes
  // ---------------------------------------------------------------------------

  describe('deprecation headers', () => {
    ['on', 'off', 'read-only'].forEach(mode => {
      it(`sets all required X-API-Deprecation headers in "${mode}" mode (GET)`, () => {
        process.env.LEGACY_MESSAGING_MODE = mode;
        const mw = createDeprecationMiddleware({ version: 'v1', sunset: '2026-12-31' });
        const req = makeReqMock('GET', '/api/v1/messages/threads');
        const res = makeResMock();
        const next = jest.fn();

        mw(req, res, next);

        expect(res.headers['X-API-Deprecation']).toBe('true');
        expect(res.headers['X-API-Deprecation-Version']).toBe('v1');
        expect(res.headers['X-API-Deprecation-Sunset']).toBe('2026-12-31');
        expect(res.headers['X-API-Deprecation-Replacement']).toBe('/api/v4/messenger');
        expect(res.headers['X-API-Deprecation-Info']).toMatch(/v1/);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Mode: "on" – all requests pass through
  // ---------------------------------------------------------------------------

  describe('mode: "on"', () => {
    beforeEach(() => {
      process.env.LEGACY_MESSAGING_MODE = 'on';
    });

    it('calls next() for GET requests', () => {
      const mw = createDeprecationMiddleware({ version: 'v1', sunset: '2026-12-31' });
      const req = makeReqMock('GET', '/api/v1/messages/threads');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    it('calls next() for POST requests', () => {
      const mw = createDeprecationMiddleware({ version: 'v1', sunset: '2026-12-31' });
      const req = makeReqMock('POST', '/api/v1/messages/threads');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Mode: "off" – write requests blocked with 410
  // ---------------------------------------------------------------------------

  describe('mode: "off"', () => {
    beforeEach(() => {
      process.env.LEGACY_MESSAGING_MODE = 'off';
    });

    const readMethods = ['GET'];
    const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    readMethods.forEach(method => {
      it(`calls next() for read method ${method}`, () => {
        const mw = createDeprecationMiddleware({ version: 'v2', sunset: '2026-12-31' });
        const req = makeReqMock(method, '/api/v2/messages/threads');
        const res = makeResMock();
        const next = jest.fn();

        mw(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
      });
    });

    writeMethods.forEach(method => {
      it(`returns 410 Gone for write method ${method}`, () => {
        const mw = createDeprecationMiddleware({ version: 'v2', sunset: '2026-12-31' });
        const req = makeReqMock(method, '/api/v2/messages/threads');
        const res = makeResMock();
        const next = jest.fn();

        mw(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(410);
        expect(res.body.error).toBe('Gone');
        expect(res.body.replacement).toBe('/api/v4/messenger');
      });
    });

    it('includes deprecation headers even for blocked (410) responses', () => {
      const mw = createDeprecationMiddleware({ version: 'v2', sunset: '2026-12-31' });
      const req = makeReqMock('POST', '/api/v2/messages/threads');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(res.headers['X-API-Deprecation']).toBe('true');
      expect(res.headers['X-API-Deprecation-Version']).toBe('v2');
    });
  });

  // ---------------------------------------------------------------------------
  // Mode: "read-only" – same as "off"
  // ---------------------------------------------------------------------------

  describe('mode: "read-only"', () => {
    beforeEach(() => {
      process.env.LEGACY_MESSAGING_MODE = 'read-only';
    });

    it('calls next() for GET requests', () => {
      const mw = createDeprecationMiddleware({ version: 'v3', sunset: '2027-03-31' });
      const req = makeReqMock('GET', '/api/v3/messenger/conversations');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('returns 410 for POST requests', () => {
      const mw = createDeprecationMiddleware({ version: 'v3', sunset: '2027-03-31' });
      const req = makeReqMock('POST', '/api/v3/messenger/conversations');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(410);
    });
  });

  // ---------------------------------------------------------------------------
  // Default mode – should behave as "read-only"
  // ---------------------------------------------------------------------------

  describe('default mode (no env var set)', () => {
    beforeEach(() => {
      delete process.env.LEGACY_MESSAGING_MODE;
    });

    it('blocks POST requests with 410 by default', () => {
      const mw = createDeprecationMiddleware({ version: 'v1', sunset: '2026-12-31' });
      const req = makeReqMock('POST', '/api/v1/messages/threads');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(410);
    });

    it('allows GET requests by default', () => {
      const mw = createDeprecationMiddleware({ version: 'v1', sunset: '2026-12-31' });
      const req = makeReqMock('GET', '/api/v1/messages/threads');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom logger
  // ---------------------------------------------------------------------------

  describe('custom logger', () => {
    it('calls provided logger function instead of console.warn', () => {
      process.env.LEGACY_MESSAGING_MODE = 'on';
      const loggerFn = jest.fn();
      const mw = createDeprecationMiddleware({
        version: 'v1',
        sunset: '2026-12-31',
        logger: loggerFn,
      });
      const req = makeReqMock('GET', '/api/v1/messages/threads');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(loggerFn).toHaveBeenCalledTimes(1);
      expect(loggerFn.mock.calls[0][0]).toMatch(/v1/);
    });
  });

  // ---------------------------------------------------------------------------
  // Version and sunset propagated correctly
  // ---------------------------------------------------------------------------

  describe('version and sunset values', () => {
    it('sets the correct version header for v3', () => {
      process.env.LEGACY_MESSAGING_MODE = 'on';
      const mw = createDeprecationMiddleware({ version: 'v3', sunset: '2027-03-31' });
      const req = makeReqMock('GET', '/api/v3/messenger/conversations');
      const res = makeResMock();
      const next = jest.fn();

      mw(req, res, next);

      expect(res.headers['X-API-Deprecation-Version']).toBe('v3');
      expect(res.headers['X-API-Deprecation-Sunset']).toBe('2027-03-31');
    });
  });
});
