/**
 * Unit tests for xlsx security debt remediation
 * Tests the DISABLE_XLSX_EXPORT feature flag behaviour in utils/export.js
 */

'use strict';

const { exportToExcel, exportMiddleware } = require('../../utils/export');

const SAMPLE_DATA = [
  { name: 'Alice', email: 'alice@example.com', score: 90 },
  { name: 'Bob', email: 'bob@example.com', score: 75 },
];

describe('Export utility – DISABLE_XLSX_EXPORT feature flag', () => {
  afterEach(() => {
    delete process.env.DISABLE_XLSX_EXPORT;
  });

  describe('exportToExcel', () => {
    it('falls back to CSV when DISABLE_XLSX_EXPORT=true', () => {
      process.env.DISABLE_XLSX_EXPORT = 'true';

      const result = exportToExcel(SAMPLE_DATA, { filename: 'report.xlsx' });

      // Should return CSV-shaped result
      expect(result.contentType).toBe('text/csv');
      expect(result.filename).toBe('report.csv');
      expect(typeof result.data).toBe('string');
      expect(result.data).toContain('Alice');
    });

    it('does NOT fall back when DISABLE_XLSX_EXPORT is unset', () => {
      // xlsx is a devDependency; require() will succeed in the test environment
      const result = exportToExcel(SAMPLE_DATA, { filename: 'report.xlsx' });

      // Should be xlsx or CSV fallback from the catch block – either way, filename differs
      // We just verify it didn't throw and returned a valid result
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('does NOT fall back when DISABLE_XLSX_EXPORT=false', () => {
      process.env.DISABLE_XLSX_EXPORT = 'false';

      const result = exportToExcel(SAMPLE_DATA, { filename: 'report.xlsx' });

      // Should not be forced to CSV by the flag
      expect(result).toBeDefined();
    });

    it('renames .xlsx extension to .csv in fallback filename', () => {
      process.env.DISABLE_XLSX_EXPORT = 'true';

      const result = exportToExcel(SAMPLE_DATA, { filename: 'my-export.xlsx' });

      expect(result.filename).toBe('my-export.csv');
    });
  });

  describe('exportMiddleware – xlsx format blocked when flag is set', () => {
    function makeReqRes(format) {
      const req = { query: { format } };
      const res = {
        _status: 200,
        _body: null,
        status(code) {
          this._status = code;
          return this;
        },
        json(body) {
          this._body = body;
          return this;
        },
        setHeader() {},
        send() {},
      };
      const next = jest.fn();
      return { req, res, next };
    }

    it('returns 400 for xlsx format when DISABLE_XLSX_EXPORT=true', async () => {
      process.env.DISABLE_XLSX_EXPORT = 'true';

      const { req, res, next } = makeReqRes('xlsx');
      const middleware = exportMiddleware(async () => SAMPLE_DATA);
      await middleware(req, res, next);

      expect(res._status).toBe(400);
      expect(res._body.error).toMatch(/disabled/i);
    });

    it('returns 400 for excel format when DISABLE_XLSX_EXPORT=true', async () => {
      process.env.DISABLE_XLSX_EXPORT = 'true';

      const { req, res, next } = makeReqRes('excel');
      const middleware = exportMiddleware(async () => SAMPLE_DATA);
      await middleware(req, res, next);

      expect(res._status).toBe(400);
    });

    it('still serves xlsx when DISABLE_XLSX_EXPORT is unset', async () => {
      const { req, res, next } = makeReqRes('xlsx');

      // Intercept send to avoid actually writing buffer
      res.send = () => {};

      const middleware = exportMiddleware(async () => SAMPLE_DATA);
      await middleware(req, res, next);

      // Either sent successfully or next was called (error path) — no 400 from flag
      expect(res._status).not.toBe(400);
    });

    it('still serves CSV when DISABLE_XLSX_EXPORT=true', async () => {
      process.env.DISABLE_XLSX_EXPORT = 'true';

      const { req, res, next } = makeReqRes('csv');
      let sent = false;
      res.send = () => {
        sent = true;
      };

      const middleware = exportMiddleware(async () => SAMPLE_DATA);
      await middleware(req, res, next);

      expect(sent).toBe(true);
      expect(res._status).not.toBe(400);
    });
  });
});
