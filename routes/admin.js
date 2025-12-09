/**
 * Admin Routes
 * Handles admin-only operations: approvals, metrics, moderation, and exports
 */

'use strict';

const express = require('express');
const { read, write } = require('../store');
const { authRequired, roleRequired } = require('../middleware/auth');

const router = express.Router();

// This will be set by the main server.js when mounting these routes
let supplierIsProActiveFn = null;
let seedFn = null;

/**
 * Set helper functions (injected from server.js)
 * @param {Function} supplierIsProActive - Check if supplier Pro plan is active
 * @param {Function} seed - Re-seed database function
 */
function setHelperFunctions(supplierIsProActive, seed) {
  supplierIsProActiveFn = supplierIsProActive;
  seedFn = seed;
}

/**
 * GET /api/admin/users
 * List all users (without password hashes)
 */
router.get('/users', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users').map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    verified: !!u.verified,
    marketingOptIn: !!u.marketingOptIn,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null
  }));
  // Sort newest first by createdAt
  users.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  res.json({ items: users });
});

/**
 * GET /api/admin/marketing-export
 * Export marketing opt-in users as CSV
 */
router.get('/marketing-export', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users').filter(u => u.marketingOptIn);
  const header = 'name,email,role\n';
  const rows = users.map(u => {
    const name = (u.name || '').replace(/"/g, '""');
    const email = (u.email || '').replace(/"/g, '""');
    const role = (u.role || '').replace(/"/g, '""');
    return `"${name}","${email}","${role}"`;
  }).join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-marketing.csv"');
  res.send(csv);
});

/**
 * GET /api/admin/users-export
 * Export all users as CSV
 */
router.get('/users-export', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const header = 'id,name,email,role,verified,marketingOptIn,createdAt,lastLoginAt\n';
  const rows = users.map(u => {
    const esc = v => String(v ?? '').replace(/"/g, '""');
    const verified = u.verified ? 'yes' : 'no';
    const marketing = u.marketingOptIn ? 'yes' : 'no';
    return `"${esc(u.id)}","${esc(u.name)}","${esc(u.email)}","${esc(u.role)}","${verified}","${marketing}","${esc(u.createdAt)}","${esc(u.lastLoginAt || '')}"`;
  }).join('\n');
  const csv = header + rows + (rows ? '\n' : '');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-users.csv"');
  res.send(csv);
});

/**
 * GET /api/admin/export/all
 * Export all core collections as JSON
 */
router.get('/export/all', authRequired, roleRequired('admin'), (_req, res) => {
  const payload = {
    exportedAt: new Date().toISOString(),
    users: read('users'),
    suppliers: read('suppliers'),
    packages: read('packages'),
    plans: read('plans'),
    notes: read('notes'),
    events: read('events'),
    threads: read('threads'),
    messages: read('messages')
  };
  const json = JSON.stringify(payload, null, 2);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="eventflow-export.json"');
  res.send(json);
});

/**
 * GET /api/admin/metrics/timeseries
 * Get synthetic timeseries data for admin charts
 */
router.get('/metrics/timeseries', authRequired, roleRequired('admin'), (_req, res) => {
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
      plans: 1 + (i % 3)
    });
  }
  res.json({ series });
});

/**
 * GET /api/admin/metrics
 * Get admin dashboard metrics
 */
router.get('/metrics', authRequired, roleRequired('admin'), (_req, res) => {
  const users = read('users');
  const suppliers = read('suppliers');
  const plans = read('plans');
  const msgs = read('messages');
  const pkgs = read('packages');
  const threads = read('threads');
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
      threadsTotal: threads.length
    }
  });
});

/**
 * POST /api/admin/reset-demo
 * Reset demo data by clearing all collections and re-seeding
 */
router.post('/reset-demo', authRequired, roleRequired('admin'), (req, res) => {
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
      'events'
    ];
    collections.forEach(name => write(name, []));
    if (seedFn) seedFn();
    res.json({ ok: true });
  } catch (err) {
    console.error('Reset demo failed', err);
    res.status(500).json({ error: 'Reset demo failed' });
  }
});

/**
 * GET /api/admin/suppliers
 * List all suppliers for admin moderation
 */
router.get('/suppliers', authRequired, roleRequired('admin'), (_req, res) => {
  const raw = read('suppliers');
  const items = raw.map(s => ({
    ...s,
    isPro: supplierIsProActiveFn ? supplierIsProActiveFn(s) : s.isPro,
    proExpiresAt: s.proExpiresAt || null
  }));
  res.json({ items });
});

/**
 * POST /api/admin/suppliers/:id/approve
 * Approve or reject a supplier
 */
router.post('/suppliers/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('suppliers');
  const i = all.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].approved = !!(req.body && req.body.approved);
  write('suppliers', all);
  res.json({ ok: true, supplier: all[i] });
});

/**
 * POST /api/admin/suppliers/:id/pro
 * Manage supplier Pro subscription
 */
router.post('/suppliers/:id/pro', authRequired, roleRequired('admin'), (req, res) => {
  const { mode, duration } = req.body || {};
  const all = read('suppliers');
  const i = all.findIndex(s => s.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });

  const s = all[i];
  const now = Date.now();

  if (mode === 'cancel') {
    s.isPro = false;
    s.proExpiresAt = null;
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
    s.isPro = true;
    s.proExpiresAt = new Date(now + ms).toISOString();
  } else {
    return res.status(400).json({ error: 'Invalid mode' });
  }

  // Optionally mirror Pro flag to the owning user, if present.
  try {
    if (s.ownerUserId) {
      const users = read('users');
      const u = users.find(u => u.id === s.ownerUserId);
      if (u) {
        u.isPro = !!s.isPro;
        write('users', users);
      }
    }
  } catch (_e) {
    // ignore errors from user store
  }

  all[i] = s;
  write('suppliers', all);

  const active = supplierIsProActiveFn ? supplierIsProActiveFn(s) : s.isPro;
  res.json({
    ok: true,
    supplier: {
      ...s,
      isPro: active,
      proExpiresAt: s.proExpiresAt || null
    }
  });
});

/**
 * GET /api/admin/packages
 * List all packages for admin moderation
 */
router.get('/packages', authRequired, roleRequired('admin'), (_req, res) => {
  res.json({ items: read('packages') });
});

/**
 * POST /api/admin/packages/:id/approve
 * Approve or reject a package
 */
router.post('/packages/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('packages');
  const i = all.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].approved = !!(req.body && req.body.approved);
  write('packages', all);
  res.json({ ok: true, package: all[i] });
});

/**
 * POST /api/admin/packages/:id/feature
 * Feature or unfeature a package
 */
router.post('/packages/:id/feature', authRequired, roleRequired('admin'), (req, res) => {
  const all = read('packages');
  const i = all.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  all[i].featured = !!(req.body && req.body.featured);
  write('packages', all);
  res.json({ ok: true, package: all[i] });
});

module.exports = router;
module.exports.setHelperFunctions = setHelperFunctions;
