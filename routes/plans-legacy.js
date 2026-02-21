/**
 * Plans & Notes Routes (Legacy)
 * Plan management, notes, guest plans, and PDF export endpoints
 */

'use strict';

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const PDFDocument = require('pdfkit');

// These will be injected by server.js during route mounting
let dbUnified;
let authRequired;
let csrfProtection;
let roleRequired;
let uid;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Plans-legacy routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = ['dbUnified', 'authRequired', 'csrfProtection', 'roleRequired', 'uid'];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Plans-legacy routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;
  roleRequired = deps.roleRequired;
  uid = deps.uid;
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
 * Middleware: Verify plan ownership
 */
function planOwnerOnly(req, res, next) {
  if (!req.userId) {
    return res.status(403).json({ error: 'Not logged in' });
  }
  next();
}

// ---------- Plan Routes ----------

router.get('/plan', applyAuthRequired, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const plans = (await dbUnified.read('plans')).filter(p => p.userId === req.user.id);
  const suppliers = (await dbUnified.read('suppliers')).filter(s => s.approved);
  const items = plans.map(p => suppliers.find(s => s.id === p.supplierId)).filter(Boolean);
  res.json({ items });
});

router.post('/plan', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const { supplierId } = req.body || {};
  if (!supplierId) {
    return res.status(400).json({ error: 'Missing supplierId' });
  }
  const s = (await dbUnified.read('suppliers')).find(x => x.id === supplierId && x.approved);
  if (!s) {
    return res.status(404).json({ error: 'Supplier not found' });
  }
  const all = await dbUnified.read('plans');
  if (!all.find(p => p.userId === req.user.id && p.supplierId === supplierId)) {
    all.push({
      id: uid('pln'),
      userId: req.user.id,
      supplierId,
      createdAt: new Date().toISOString(),
    });
  }
  await dbUnified.write('plans', all);
  res.json({ ok: true });
});

router.delete('/plan/:supplierId', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const all = (await dbUnified.read('plans')).filter(
    p => !(p.userId === req.user.id && p.supplierId === req.params.supplierId)
  );
  await dbUnified.write('plans', all);
  res.json({ ok: true });
});

// ---------- Notes Routes ----------

router.get('/notes', applyAuthRequired, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const n = (await dbUnified.read('notes')).find(x => x.userId === req.user.id);
  res.json({ text: (n && n.text) || '' });
});

router.post('/notes', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.status(403).json({ error: 'Customers only' });
  }
  const all = await dbUnified.read('notes');
  const i = all.findIndex(x => x.userId === req.user.id);
  if (i >= 0) {
    all[i].text = String((req.body && req.body.text) || '');
    all[i].updatedAt = new Date().toISOString();
  } else {
    all.push({
      id: uid('nte'),
      userId: req.user.id,
      text: String((req.body && req.body.text) || ''),
      createdAt: new Date().toISOString(),
    });
  }
  await dbUnified.write('notes', all);
  res.json({ ok: true });
});

// ---------- Plan Save & Get Routes ----------

router.post(
  '/me/plan/save',
  applyAuthRequired,
  planOwnerOnly,
  applyCsrfProtection,
  async (req, res) => {
    const { plan } = req.body || {};
    if (!plan) {
      return res.status(400).json({ error: 'Missing plan' });
    }
    const plans = await dbUnified.read('plans');
    let p = plans.find(x => x.userId === req.userId);
    if (!p) {
      p = { id: uid('pln'), userId: req.userId, plan };
      plans.push(p);
    } else {
      p.plan = plan;
    }
    await dbUnified.write('plans', plans);
    res.json({ ok: true, plan: p });
  }
);

router.get('/me/plan', applyAuthRequired, planOwnerOnly, async (req, res) => {
  const plans = await dbUnified.read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) {
    return res.json({ ok: true, plan: null });
  }
  res.json({ ok: true, plan: p.plan });
});

// ---------- Guest Plan Creation ----------

/**
 * Create a guest plan (no authentication required)
 * POST /api/plans/guest
 * Returns: { ok: true, plan: {...}, token: 'secret-token' }
 */
router.post('/plans/guest', applyCsrfProtection, async (req, res) => {
  try {
    const { eventType, eventName, location, date, guests, budget, packages } = req.body || {};

    if (!eventType) {
      return res.status(400).json({ error: 'Event type is required' });
    }

    const plans = await dbUnified.read('plans');

    // Generate a secure token for guest plan claiming
    const token = uid('gst'); // guest token

    const newPlan = {
      id: uid('pln'),
      userId: null, // No user yet
      guestToken: token,
      eventType,
      eventName: eventName || '',
      location: location || '',
      date: date || '',
      guests: guests || null,
      budget: budget || '',
      packages: packages || [],
      isGuestPlan: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    plans.push(newPlan);
    await dbUnified.write('plans', plans);

    res.json({
      ok: true,
      plan: newPlan,
      token, // Frontend stores this to claim later
    });
  } catch (error) {
    logger.error('Error creating guest plan:', error);
    res.status(500).json({ error: 'Failed to create guest plan' });
  }
});

// ---------- Claim Guest Plan ----------

/**
 * Claim a guest plan and attach to authenticated user
 * POST /api/me/plans/claim
 * Body: { token: 'guest-token' }
 */
router.post(
  '/me/plans/claim',
  applyAuthRequired,
  applyRoleRequired('customer'),
  applyCsrfProtection,
  async (req, res) => {
    try {
      const { token } = req.body || {};

      if (!token) {
        return res.status(400).json({ error: 'Guest plan token is required' });
      }

      const plans = await dbUnified.read('plans');
      const planIndex = plans.findIndex(p => p.guestToken === token && p.isGuestPlan === true);

      if (planIndex === -1) {
        return res.status(404).json({ error: 'Guest plan not found or already claimed' });
      }

      // Check if user already has a plan
      const existingUserPlan = plans.find(p => p.userId === req.user.id);
      if (existingUserPlan) {
        return res.status(400).json({
          error: 'You already have a plan. Guest plan cannot be claimed.',
          existingPlanId: existingUserPlan.id,
        });
      }

      // Attach plan to user
      plans[planIndex].userId = req.user.id;
      plans[planIndex].isGuestPlan = false;
      plans[planIndex].claimedAt = new Date().toISOString();
      // Keep guestToken for audit trail but plan is now claimed

      await dbUnified.write('plans', plans);

      res.json({
        ok: true,
        plan: plans[planIndex],
        message: 'Plan successfully claimed!',
      });
    } catch (error) {
      logger.error('Error claiming guest plan:', error);
      res.status(500).json({ error: 'Failed to claim guest plan' });
    }
  }
);

// ---------- PDF Export ----------

router.get('/plan/export/pdf', applyAuthRequired, planOwnerOnly, async (req, res) => {
  const plans = await dbUnified.read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) {
    return res.status(400).json({ error: 'No plan saved' });
  }

  const suppliers = await dbUnified.read('suppliers');
  // eslint-disable-next-line no-unused-vars
  const _packages = await dbUnified.read('packages'); // currently unused, but kept for future detail

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=event_plan.pdf');

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(22).text('EventFlow — Event Plan', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown();

  doc.fontSize(16).text('Event Summary', { underline: true });
  doc.fontSize(12).text(JSON.stringify(p.plan.summary || {}, null, 2));
  doc.moveDown();

  doc.fontSize(16).text('Timeline', { underline: true });
  doc.fontSize(12).text(JSON.stringify(p.plan.timeline || [], null, 2));
  doc.moveDown();

  doc.fontSize(16).text('Suppliers', { underline: true });
  const supIds = (p.plan.suppliers || []).map(s => s.id);
  suppliers
    .filter(s => supIds.includes(s.id))
    .forEach(s => {
      doc.fontSize(14).text(s.name);
      doc.fontSize(12).text(s.category);
      doc.moveDown();
    });

  doc.fontSize(16).text('Notes', { underline: true });
  doc.fontSize(12).text(p.plan.notes || 'None');
  doc.moveDown();

  doc.end();
});

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
