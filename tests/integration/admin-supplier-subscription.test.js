/**
 * Integration tests for admin supplier subscription management
 * Tests POST /api/admin/suppliers/:id/subscription and DELETE /api/admin/suppliers/:id/subscription
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
  auditLog: jest.fn(),
  auditMiddleware: () => (_req, _res, next) => next(),
  AUDIT_ACTIONS: {},
}));

jest.mock('../../middleware/rateLimits', () => ({
  writeLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

jest.mock('../../middleware/domain-admin', () => ({
  isOwnerEmail: () => false,
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../../db-unified', () => ({
  read: jest.fn(),
  write: jest.fn(),
  updateOne: jest.fn().mockResolvedValue(true),
  insertOne: jest.fn().mockResolvedValue(true),
  deleteOne: jest.fn().mockResolvedValue(true),
}));

const dbUnified = require('../../db-unified');
const adminRoutes = require('../../routes/admin-user-management');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  return app;
}

const BASE_SUPPLIER = {
  id: 'sup-001',
  name: 'Test Supplier',
  email: 'supplier@test.com',
  approved: true,
  subscription: { tier: 'free' },
};

describe('Admin Supplier Subscription API', () => {
  let mockSuppliers;

  beforeEach(() => {
    mockSuppliers = [{ ...BASE_SUPPLIER }];
    dbUnified.read.mockImplementation(async collection => {
      if (collection === 'suppliers') {
        return [...mockSuppliers];
      }
      if (collection === 'users') {
        return [];
      }
      return [];
    });
    dbUnified.write.mockImplementation(async (collection, data) => {
      if (collection === 'suppliers') {
        mockSuppliers = [...data];
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/suppliers/:id/subscription', () => {
    it('grants Pro subscription for a given number of days', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/suppliers/sup-001/subscription')
        .send({ tier: 'pro', days: 30 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Pro/i);
      expect(dbUnified.updateOne).toHaveBeenCalledWith(
        'suppliers',
        { id: 'sup-001' },
        expect.objectContaining({
          $set: expect.objectContaining({
            isPro: true,
            subscription: expect.objectContaining({
              tier: 'pro',
              status: 'active',
            }),
          }),
        })
      );
    });

    it('grants Pro+ subscription', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/suppliers/sup-001/subscription')
        .send({ tier: 'pro_plus', days: 90 });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Pro\+/i);
      expect(dbUnified.updateOne).toHaveBeenCalledWith(
        'suppliers',
        { id: 'sup-001' },
        expect.objectContaining({
          $set: expect.objectContaining({
            subscription: expect.objectContaining({
              tier: 'pro_plus',
              status: 'active',
            }),
          }),
        })
      );
    });

    it('sets expiry date correctly', async () => {
      const beforeMs = Date.now();
      const app = createApp();
      await request(app)
        .post('/api/admin/suppliers/sup-001/subscription')
        .send({ tier: 'pro', days: 30 });
      const afterMs = Date.now();

      const updateCall = dbUnified.updateOne.mock.calls[0];
      const setData = updateCall[2].$set;
      const expiry = new Date(setData.subscription.endDate).getTime();
      const expectedMin = beforeMs + 30 * 24 * 60 * 60 * 1000;
      const expectedMax = afterMs + 30 * 24 * 60 * 60 * 1000;
      expect(expiry).toBeGreaterThanOrEqual(expectedMin);
      expect(expiry).toBeLessThanOrEqual(expectedMax);
    });

    it('returns 400 for invalid tier', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/suppliers/sup-001/subscription')
        .send({ tier: 'enterprise', days: 30 });
      expect(res.status).toBe(400);
    });

    it('returns 400 for zero days', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/suppliers/sup-001/subscription')
        .send({ tier: 'pro', days: 0 });
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown supplier', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/admin/suppliers/nonexistent/subscription')
        .send({ tier: 'pro', days: 30 });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/suppliers/:id/subscription', () => {
    beforeEach(() => {
      mockSuppliers = [
        {
          ...BASE_SUPPLIER,
          isPro: true,
          proPlan: 'Pro',
          proPlanExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          subscription: { tier: 'pro', status: 'active' },
        },
      ];
    });

    it('removes an active subscription', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/admin/suppliers/sup-001/subscription');

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed/i);
      expect(dbUnified.updateOne).toHaveBeenCalledWith(
        'suppliers',
        { id: 'sup-001' },
        expect.objectContaining({
          $set: expect.objectContaining({
            isPro: false,
            proPlan: null,
            proPlanExpiry: null,
            subscription: expect.objectContaining({
              tier: 'free',
              status: 'cancelled',
            }),
          }),
        })
      );
    });

    it('returns 404 for unknown supplier', async () => {
      const app = createApp();
      const res = await request(app).delete('/api/admin/suppliers/nonexistent/subscription');
      expect(res.status).toBe(404);
    });
  });
});
