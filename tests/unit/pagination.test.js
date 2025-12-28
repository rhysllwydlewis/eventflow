/**
 * Unit tests for pagination middleware
 */

'use strict';

const {
  parsePaginationParams,
  buildSortObject,
  encodeCursor,
  validatePagination,
} = require('../../middleware/pagination');

describe('Pagination Middleware', () => {
  describe('parsePaginationParams', () => {
    it('should parse default parameters', () => {
      const req = { query: {} };
      const params = parsePaginationParams(req);

      expect(params).toEqual({
        page: 1,
        limit: 20,
        skip: 0,
        cursor: null,
        sortBy: 'createdAt',
        sortOrder: -1,
      });
    });

    it('should parse custom page and limit', () => {
      const req = { query: { page: '2', limit: '50' } };
      const params = parsePaginationParams(req);

      expect(params.page).toBe(2);
      expect(params.limit).toBe(50);
      expect(params.skip).toBe(50);
    });

    it('should enforce max limit of 100', () => {
      const req = { query: { limit: '200' } };
      const params = parsePaginationParams(req);

      expect(params.limit).toBe(100);
    });

    it('should enforce min page of 1', () => {
      const req = { query: { page: '0' } };
      const params = parsePaginationParams(req);

      expect(params.page).toBe(1);
    });

    it('should parse sort parameters', () => {
      const req = { query: { sortBy: 'name', sortOrder: 'asc' } };
      const params = parsePaginationParams(req);

      expect(params.sortBy).toBe('name');
      expect(params.sortOrder).toBe(1);
    });

    it('should default to desc sort order', () => {
      const req = { query: { sortOrder: 'invalid' } };
      const params = parsePaginationParams(req);

      expect(params.sortOrder).toBe(-1);
    });
  });

  describe('buildSortObject', () => {
    it('should build MongoDB sort object', () => {
      const pagination = {
        sortBy: 'name',
        sortOrder: 1,
      };
      const sort = buildSortObject(pagination);

      expect(sort).toEqual({ name: 1 });
    });

    it('should handle descending sort', () => {
      const pagination = {
        sortBy: 'createdAt',
        sortOrder: -1,
      };
      const sort = buildSortObject(pagination);

      expect(sort).toEqual({ createdAt: -1 });
    });
  });

  describe('encodeCursor', () => {
    it('should encode cursor from document', () => {
      const doc = { _id: '123', createdAt: '2024-01-01' };
      const cursor = encodeCursor(doc, 'createdAt');

      expect(cursor).toBeTruthy();
      expect(typeof cursor).toBe('string');
    });

    it('should return null for null document', () => {
      const cursor = encodeCursor(null, 'createdAt');

      expect(cursor).toBeNull();
    });

    it('should handle documents without _id', () => {
      const doc = { id: '456', name: 'Test' };
      const cursor = encodeCursor(doc, 'name');

      expect(cursor).toBeTruthy();
    });
  });

  describe('validatePagination', () => {
    it('should allow valid pagination', () => {
      const req = { query: { page: '1', limit: '20' } };
      const res = {};
      const next = jest.fn();

      validatePagination(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject negative page', () => {
      const req = { query: { page: '-1' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      validatePagination(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid pagination parameter',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject limit over 100', () => {
      const req = { query: { limit: '200' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      validatePagination(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid pagination parameter',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject non-numeric page', () => {
      const req = { query: { page: 'abc' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      validatePagination(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
