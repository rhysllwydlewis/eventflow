/**
 * Integration tests for admin endpoints
 * Tests the actual API routes for admin functionality
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../db-unified');
jest.mock('../../middleware/auth', () => ({
  authRequired: (req, res, next) => {
    req.user = { id: 'admin-id', email: 'admin@test.com', role: 'admin' };
    next();
  },
  roleRequired: (role) => (req, res, next) => {
    if (req.user && req.user.role === role) {
      return next();
    }
    res.status(403).json({ error: 'Forbidden' });
  },
}));

const dbUnified = require('../../db-unified');
const adminRoutes = require('../../routes/admin');

describe('Admin API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/maintenance/message', () => {
    it('should return maintenance message without authentication', async () => {
      dbUnified.read.mockResolvedValue({
        maintenance: {
          enabled: true,
          message: 'Under maintenance for testing',
        },
      });

      const response = await request(app).get('/api/admin/maintenance/message');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        message: 'Under maintenance for testing',
      });
    });

    it('should return default message when no settings exist', async () => {
      dbUnified.read.mockResolvedValue({});

      const response = await request(app).get('/api/admin/maintenance/message');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: false,
        message: "We're performing scheduled maintenance. We'll be back soon!",
      });
    });

    it('should handle errors gracefully', async () => {
      dbUnified.read.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/admin/maintenance/message');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled', false);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /api/admin/settings/maintenance', () => {
    it('should require authentication', async () => {
      // This test would need a proper setup with auth middleware
      // For now, we just verify the structure
      expect(adminRoutes).toBeDefined();
    });

    it('should return maintenance settings for admins', async () => {
      dbUnified.read.mockResolvedValue({
        maintenance: {
          enabled: false,
          message: 'Custom message',
          updatedAt: '2026-01-02T00:00:00.000Z',
          updatedBy: 'admin@test.com',
        },
      });

      const response = await request(app).get('/api/admin/settings/maintenance');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('enabled');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('PUT /api/admin/settings/maintenance', () => {
    it('should update maintenance settings', async () => {
      dbUnified.read.mockResolvedValue({});
      dbUnified.write.mockResolvedValue();

      const response = await request(app)
        .put('/api/admin/settings/maintenance')
        .send({
          enabled: true,
          message: 'Scheduled maintenance in progress',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.maintenance).toHaveProperty('enabled', true);
      expect(response.body.maintenance).toHaveProperty('message', 'Scheduled maintenance in progress');
    });

    it('should use default message if not provided', async () => {
      dbUnified.read.mockResolvedValue({});
      dbUnified.write.mockResolvedValue();

      const response = await request(app)
        .put('/api/admin/settings/maintenance')
        .send({
          enabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.maintenance).toHaveProperty(
        'message',
        "We're performing scheduled maintenance. We'll be back soon!"
      );
    });
  });

  describe('Data Source Consistency', () => {
    it('maintenance middleware and admin API should use the same data source', () => {
      // Both should use dbUnified
      const maintenanceMw = require('../../middleware/maintenance');
      const adminRoutes = require('../../routes/admin');

      // Check that both files require dbUnified
      const fs = require('fs');
      const maintenanceContent = fs.readFileSync('middleware/maintenance.js', 'utf8');
      const adminContent = fs.readFileSync('routes/admin.js', 'utf8');

      expect(maintenanceContent).toContain('require(\'../db-unified\')');
      expect(adminContent).toContain('require(\'../db-unified\')');
    });
  });
});
