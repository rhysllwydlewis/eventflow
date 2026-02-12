/**
 * Integration tests for admin batch operations validation (contract-focused)
 */

'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  authRequired: (req, _res, next) => {
    req.user = { id: 'admin-1', email: 'admin@example.com', role: 'admin' };
    next();
  },
  roleRequired: () => (_req, _res, next) => next(),
}));

jest.mock('../../middleware/csrf', () => ({
  csrfProtection: (_req, _res, next) => next(),
}));

jest.mock('../../middleware/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
  auditMiddleware: () => (_req, _res, next) => next(),
  AUDIT_ACTIONS: {
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
  },
}));

jest.mock('../../db-unified', () => ({
  read: jest.fn(async () => []),
  write: jest.fn(async () => undefined),
  count: jest.fn(async () => 0),
  findWithOptions: jest.fn(async () => []),
  getDatabaseType: jest.fn(() => 'local'),
}));

const adminRoutesV1 = require('../../routes/admin');
const adminRoutesV2 = require('../../routes/admin-v2');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutesV1);
  app.use('/api/v2/admin', adminRoutesV2);
  return app;
}

describe('Admin Batch Operations - Validation (contract tests)', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('v1 routes', () => {
    it('POST /packages/bulk-approve rejects non-array payload', async () => {
      const res = await request(app)
        .post('/api/admin/packages/bulk-approve')
        .send({ packageIds: 'not-an-array' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/packageIds must be a non-empty array/i);
    });

    it('POST /packages/bulk-delete rejects oversized batch', async () => {
      const packageIds = Array.from({ length: 101 }, (_, i) => `pkg-${i + 1}`);

      const res = await request(app).post('/api/admin/packages/bulk-delete').send({ packageIds });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/batch size cannot exceed/i);
    });
  });

  describe('v2 routes', () => {
    it('POST /packages/batch-approve returns structured error for oversized batch', async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `pkg-${i + 1}`);

      const res = await request(app).post('/api/v2/admin/packages/batch-approve').send({ ids });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('BATCH_SIZE_EXCEEDED');
    });

    it('POST /photos/batch-action validates action type', async () => {
      const res = await request(app)
        .post('/api/v2/admin/photos/batch-action')
        .send({ photos: ['ph-1'], action: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/action must be approve or reject/i);
    });

    it('POST /bulk-actions validates type whitelist with structured error', async () => {
      const res = await request(app)
        .post('/api/v2/admin/bulk-actions')
        .send({ action: 'approve', type: 'unknown', ids: ['x-1'] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVALID_TYPE');
    });
  });
});
