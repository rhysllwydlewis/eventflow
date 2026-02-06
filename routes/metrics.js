/**
 * Metrics Routes
 * Analytics and metrics tracking endpoints
 */

'use strict';

const express = require('express');
const router = express.Router();

// These will be injected by server.js during route mounting
let dbUnified;
let authRequired;
let roleRequired;
let csrfProtection;
let seed;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Metrics routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = ['dbUnified', 'authRequired', 'roleRequired', 'csrfProtection', 'seed'];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Metrics routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  roleRequired = deps.roleRequired;
  csrfProtection = deps.csrfProtection;
  seed = deps.seed;
}

// ---------- Metrics Routes ----------

router.post('/metrics/track', csrfProtection, async (req, res) => {
  // In a real deployment you could log req.body here.
  res.json({ ok: true });
});

// Simple synthetic timeseries for admin charts
router.get('/admin/metrics/timeseries', authRequired, roleRequired('admin'), async (_req, res) => {
  const today = new Date();
  const days = 14;
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    series.push({
      date: iso,
      visitors: 20 + ((i * 7) % 15),
      signups: 3 + (i % 4),
      plans: 1 + (i % 3),
    });
  }
  res.json({ series });
});

// ---------- Admin ----------
router.get('/admin/metrics', authRequired, roleRequired('admin'), async (_req, res) => {
  const users = await dbUnified.read('users');
  const suppliers = await dbUnified.read('suppliers');
  const plans = await dbUnified.read('plans');
  const msgs = await dbUnified.read('messages');
  const pkgs = await dbUnified.read('packages');
  const threads = await dbUnified.read('threads');
  res.json({
    counts: {
      usersTotal: users.length,
      usersByRole: users.reduce((a, u) => {
        a[u.role] = (a[u.role] || 0) + 1;
        return a;
      }, {}),
      suppliersTotal: suppliers.length,
      packagesTotal: pkgs.length,
      plansTotal: plans.length,
      messagesTotal: msgs.length,
      threadsTotal: threads.length,
    },
  });
});

router.post(
  '/admin/reset-demo',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      // Clear key collections and rerun seeding
      const collections = [
        'users',
        'suppliers',
        'packages',
        'plans',
        'notes',
        'messages',
        'threads',
        'events',
      ];
      for (const name of collections) {
        await dbUnified.write(name, []);
      }
      await seed();
      res.json({ ok: true });
    } catch (err) {
      console.error('Reset demo failed', err);
      res.status(500).json({ error: 'Reset demo failed' });
    }
  }
);

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
