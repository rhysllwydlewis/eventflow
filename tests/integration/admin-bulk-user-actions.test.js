/**
 * Integration tests for admin bulk user actions (contract-focused)
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

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../../middleware/audit', () => ({
  auditLog: (...args) => mockAuditLog(...args),
  auditMiddleware: () => (_req, _res, next) => next(),
  AUDIT_ACTIONS: {
    USER_CREATED: 'USER_CREATED',
    USER_UPDATED: 'USER_UPDATED',
  },
}));

jest.mock('../../middleware/domain-admin', () => ({
  isOwnerEmail: email => email === 'owner@example.com',
}));

jest.mock('../../db-unified', () => ({
  read: jest.fn(),
  write: jest.fn(),
}));

const dbUnified = require('../../db-unified');
const adminUserManagementRoutes = require('../../routes/admin-user-management');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminUserManagementRoutes);
  return app;
}

describe('Admin Bulk User Actions (contract tests)', () => {
  let app;
  let users;

  beforeEach(() => {
    app = createApp();
    users = [
      { id: 'admin-1', email: 'admin@example.com', role: 'admin', verified: true },
      { id: 'usr-1', email: 'u1@example.com', role: 'customer', verified: false },
      { id: 'usr-2', email: 'owner@example.com', role: 'customer', verified: false },
      { id: 'usr-3', email: 'u3@example.com', role: 'customer', verified: true },
    ];

    dbUnified.read.mockImplementation(async collection => {
      if (collection === 'users') {
        return users;
      }
      return [];
    });

    dbUnified.write.mockImplementation(async (collection, data) => {
      if (collection === 'users') {
        users = data;
      }
    });

    mockAuditLog.mockClear();
    dbUnified.read.mockClear();
    dbUnified.write.mockClear();
  });

  describe('POST /api/admin/users/bulk-delete', () => {
    it('rejects invalid input', async () => {
      const res = await request(app).post('/api/admin/users/bulk-delete').send({ userIds: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/userIds must be a non-empty array/i);
    });

    it('deletes deletable users, skips owner/self, and returns counts', async () => {
      const res = await request(app)
        .post('/api/admin/users/bulk-delete')
        .send({ userIds: ['admin-1', 'usr-1', 'usr-2'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deletedCount).toBe(1);
      expect(res.body.totalRequested).toBe(3);

      expect(users.map(u => u.id)).toEqual(['admin-1', 'usr-2', 'usr-3']);
      expect(dbUnified.write).toHaveBeenCalledTimes(1);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_USERS_DELETED',
          details: expect.objectContaining({
            deletedCount: 1,
            userIds: ['admin-1', 'usr-1', 'usr-2'],
          }),
        })
      );
    });
  });

  describe('POST /api/admin/users/bulk-verify', () => {
    it('verifies unverified users and returns verification counters', async () => {
      const res = await request(app)
        .post('/api/admin/users/bulk-verify')
        .send({ userIds: ['usr-1', 'usr-3', 'missing'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verifiedCount).toBe(1);
      expect(res.body.alreadyVerifiedCount).toBe(1);
      expect(res.body.totalRequested).toBe(3);

      expect(users.find(u => u.id === 'usr-1').verified).toBe(true);
      expect(dbUnified.write).toHaveBeenCalledTimes(1);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_USERS_VERIFIED',
          details: expect.objectContaining({ verifiedCount: 1, alreadyVerifiedCount: 1 }),
        })
      );
    });
  });

  describe('POST /api/admin/users/bulk-suspend', () => {
    it('suspends requested users except self and returns updatedCount', async () => {
      const res = await request(app)
        .post('/api/admin/users/bulk-suspend')
        .send({
          userIds: ['admin-1', 'usr-1', 'usr-3'],
          suspended: true,
          reason: 'policy violation',
          duration: '7d',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.updatedCount).toBe(2);
      expect(res.body.totalRequested).toBe(3);

      expect(users.find(u => u.id === 'admin-1').suspended).toBeUndefined();
      expect(users.find(u => u.id === 'usr-1').suspended).toBe(true);
      expect(users.find(u => u.id === 'usr-3').suspended).toBe(true);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_USERS_SUSPENDED',
          details: expect.objectContaining({ count: 2, reason: 'policy violation' }),
        })
      );
    });
  });
});
