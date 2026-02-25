/**
 * Supplier Admin Routes
 * Admin-only supplier management endpoints
 */

'use strict';

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();

// Dependencies injected by server.js
let dbUnified;
let authRequired;
let roleRequired;
let csrfProtection;
let supplierIsProActive;
let AI_ENABLED;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Supplier Admin routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = [
    'dbUnified',
    'authRequired',
    'roleRequired',
    'csrfProtection',
    'supplierIsProActive',
    'AI_ENABLED',
  ];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Supplier Admin routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  roleRequired = deps.roleRequired;
  csrfProtection = deps.csrfProtection;
  supplierIsProActive = deps.supplierIsProActive;
  AI_ENABLED = deps.AI_ENABLED;
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
 */
function applyAuthRequired(req, res, next) {
  if (!authRequired) {
    return res.status(503).json({ error: 'Auth service not initialized' });
  }
  return authRequired(req, res, next);
}

function applyRoleRequired(role) {
  return (req, res, next) => {
    if (!roleRequired) {
      return res.status(503).json({ error: 'Role service not initialized' });
    }
    return roleRequired(role)(req, res, next);
  };
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

/**
 * GET /api/admin/suppliers
 * List all suppliers with Pro status
 */
router.get('/suppliers', applyAuthRequired, applyRoleRequired('admin'), async (_req, res) => {
  try {
    const raw = await dbUnified.read('suppliers');
    const items = await Promise.all(
      raw.map(async s => ({
        ...s,
        isPro: await supplierIsProActive(s),
        proExpiresAt: s.proExpiresAt || null,
      }))
    );
    res.json({ items });
  } catch (error) {
    logger.error('Error reading suppliers for admin:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/suppliers/pending-verification
 * Get suppliers awaiting verification
 */
router.get(
  '/suppliers/pending-verification',
  applyAuthRequired,
  applyRoleRequired('admin'),
  async (_req, res) => {
    try {
      const suppliers = (await dbUnified.read('suppliers')) || [];
      const pending = suppliers.filter(
        s => !s.verified && (!s.verificationStatus || s.verificationStatus === 'pending')
      );

      res.json({
        suppliers: pending.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          location: s.location,
          ownerUserId: s.ownerUserId,
          createdAt: s.createdAt,
        })),
        count: pending.length,
      });
    } catch (error) {
      logger.error('Error fetching pending verification suppliers:', error);
      res.status(500).json({ suppliers: [], count: 0, error: 'Failed to fetch pending suppliers' });
    }
  }
);

/**
 * POST /api/admin/suppliers/:id/approve
 * Approve or reject a supplier
 */
router.post(
  '/suppliers/:id/approve',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('suppliers');
    const s = all.find(sup => sup.id === req.params.id);
    if (!s) {
      return res.status(404).json({ error: 'Not found' });
    }
    await dbUnified.updateOne(
      'suppliers',
      { id: req.params.id },
      {
        $set: { approved: !!(req.body && req.body.approved) },
      }
    );
    res.json({ ok: true, supplier: { ...s, approved: !!(req.body && req.body.approved) } });
  }
);

/**
 * POST /api/admin/suppliers/:id/pro
 * Manage Pro status (cancel or set duration)
 */
router.post(
  '/suppliers/:id/pro',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const { mode, duration } = req.body || {};
    const all = await dbUnified.read('suppliers');
    const s = all.find(sup => sup.id === req.params.id);
    if (!s) {
      return res.status(404).json({ error: 'Not found' });
    }

    const now = Date.now();
    const proUpdates = {};

    if (mode === 'cancel') {
      proUpdates.isPro = false;
      proUpdates.proExpiresAt = null;
    } else if (mode === 'duration') {
      let ms = 0;
      switch (duration) {
        case '1d':
          ms = 1 * 24 * 60 * 60 * 1000;
          break;
        case '7d':
          ms = 7 * 24 * 60 * 60 * 1000;
          break;
        case '1m':
          ms = 30 * 24 * 60 * 60 * 1000;
          break;
        case '1y':
          ms = 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          return res.status(400).json({ error: 'Invalid duration' });
      }
      proUpdates.isPro = true;
      proUpdates.proExpiresAt = new Date(now + ms).toISOString();
    } else {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    // Optionally mirror Pro flag to the owning user, if present.
    try {
      if (s.ownerUserId) {
        await dbUnified.updateOne(
          'users',
          { id: s.ownerUserId },
          { $set: { isPro: !!proUpdates.isPro } }
        );
      }
    } catch (_e) {
      // ignore errors from user store
    }

    await dbUnified.updateOne('suppliers', { id: req.params.id }, { $set: proUpdates });
    const updatedSupplier = { ...s, ...proUpdates };

    const active = await supplierIsProActive(updatedSupplier);
    res.json({
      ok: true,
      supplier: {
        ...updatedSupplier,
        isPro: active,
        proExpiresAt: updatedSupplier.proExpiresAt || null,
      },
    });
  }
);

/**
 * PUT /api/admin/suppliers/:id
 * Update supplier details (admin only)
 */
router.put(
  '/suppliers/:id',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const { id } = req.params;
    const suppliers = await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.id === id);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const now = new Date().toISOString();
    const supplierUpdates = {};

    // Update allowed fields
    const fields = [
      'name',
      'category',
      'location',
      'price_display',
      'website',
      'email',
      'phone',
      'maxGuests',
      'description_short',
      'description_long',
      'blurb',
      'amenities',
      'tags',
    ];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        supplierUpdates[field] = req.body[field];
      }
    }
    if (typeof req.body.approved === 'boolean') {
      supplierUpdates.approved = req.body.approved;
    }
    if (typeof req.body.verified === 'boolean') {
      supplierUpdates.verified = req.body.verified;
    }

    supplierUpdates.updatedAt = now;

    await dbUnified.updateOne('suppliers', { id }, { $set: supplierUpdates });

    res.json({ ok: true, supplier: { ...supplier, ...supplierUpdates } });
  }
);

/**
 * POST /api/admin/suppliers/:supplierId/badges/:badgeId
 * Award a badge to a supplier
 */
router.post(
  '/suppliers/:supplierId/badges/:badgeId',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    try {
      const { supplierId, badgeId } = req.params;

      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === supplierId);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const badges = supplier.badges || [];
      if (!badges.includes(badgeId)) {
        badges.push(badgeId);
        await dbUnified.updateOne('suppliers', { id: supplierId }, { $set: { badges } });
      }

      res.json({ success: true, supplier: { ...supplier, badges } });
    } catch (error) {
      logger.error('Error awarding badge:', error);
      res.status(500).json({ error: 'Failed to award badge' });
    }
  }
);

/**
 * DELETE /api/admin/suppliers/:supplierId/badges/:badgeId
 * Remove a badge from a supplier
 */
router.delete(
  '/suppliers/:supplierId/badges/:badgeId',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    try {
      const { supplierId, badgeId } = req.params;

      const suppliers = await dbUnified.read('suppliers');
      const supplier = suppliers.find(s => s.id === supplierId);

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const badges = (supplier.badges || []).filter(b => b !== badgeId);
      await dbUnified.updateOne('suppliers', { id: supplierId }, { $set: { badges } });

      res.json({ success: true, supplier: { ...supplier, badges } });
    } catch (error) {
      logger.error('Error removing badge:', error);
      res.status(500).json({ error: 'Failed to remove badge' });
    }
  }
);

/**
 * POST /api/admin/suppliers/smart-tags
 * Auto-categorization and scoring for all suppliers
 */
router.post(
  '/suppliers/smart-tags',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    const all = await dbUnified.read('suppliers');
    const now = new Date().toISOString();
    const updated = [];

    all.forEach(s => {
      const tags = [];
      if (s.category) {
        tags.push(s.category);
      }
      if (Array.isArray(s.amenities)) {
        s.amenities.slice(0, 3).forEach(a => tags.push(a));
      }
      if (s.location) {
        tags.push(s.location.split(',')[0].trim());
      }

      let score = 40;
      if (Array.isArray(s.photos) && s.photos.length) {
        score += 20;
      }
      if ((s.description_short || '').length > 40) {
        score += 15;
      }
      if ((s.description_long || '').length > 80) {
        score += 15;
      }
      if (Array.isArray(s.amenities) && s.amenities.length >= 3) {
        score += 10;
      }
      if (score > 100) {
        score = 100;
      }

      s.aiTags = tags;
      s.aiScore = score;
      s.aiUpdatedAt = now;
      updated.push({ id: s.id, aiTags: tags, aiScore: score });
    });

    await Promise.all(
      all.map(s =>
        dbUnified.updateOne(
          'suppliers',
          { id: s.id },
          {
            $set: { aiTags: s.aiTags, aiScore: s.aiScore, aiUpdatedAt: now },
          }
        )
      )
    );
    res.json({ ok: true, items: updated, aiEnabled: AI_ENABLED });
  }
);

/**
 * POST /api/admin/badges/evaluate
 * Evaluate and award badges to all suppliers
 */
router.post(
  '/badges/evaluate',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    try {
      const badgeManagement = require('../utils/badgeManagement');
      const results = await badgeManagement.evaluateAllSupplierBadges();
      res.json({
        success: true,
        message: 'Badge evaluation completed',
        results,
      });
    } catch (error) {
      logger.error('Error evaluating badges:', error);
      res.status(500).json({ error: 'Failed to evaluate badges' });
    }
  }
);

/**
 * POST /api/admin/badges/init
 * Initialize default badges in the database
 */
router.post(
  '/badges/init',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  async (req, res) => {
    try {
      const badgeManagement = require('../utils/badgeManagement');
      await badgeManagement.initializeDefaultBadges();
      res.json({
        success: true,
        message: 'Default badges initialized',
      });
    } catch (error) {
      logger.error('Error initializing badges:', error);
      res.status(500).json({ error: 'Failed to initialize badges' });
    }
  }
);

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
