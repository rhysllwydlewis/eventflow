/**
 * Admin Routes
 * Handles admin-only operations: approvals, metrics, moderation, and exports
 */

'use strict';

const express = require('express');
const { read, write, uid } = require('../store');
const { authRequired, roleRequired } = require('../middleware/auth');
const { auditLog, AUDIT_ACTIONS } = require('../middleware/audit');
const postmark = require('../utils/postmark');
const dbUnified = require('../db-unified');

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
 * GET /api/admin/db-status
 * Get database connection status
 */
router.get('/db-status', authRequired, roleRequired('admin'), (_req, res) => {
  const status = dbUnified.getDatabaseStatus();
  res.json({
    dbType: status.type,
    initialized: status.initialized,
    state: status.state,
  });
});

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
    lastLoginAt: u.lastLoginAt || null,
  }));
  // Sort newest first by createdAt
  users.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) {
      return 0;
    }
    if (!a.createdAt) {
      return 1;
    }
    if (!b.createdAt) {
      return -1;
    }
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
  const rows = users
    .map(u => {
      const name = (u.name || '').replace(/"/g, '""');
      const email = (u.email || '').replace(/"/g, '""');
      const role = (u.role || '').replace(/"/g, '""');
      return `"${name}","${email}","${role}"`;
    })
    .join('\n');
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
  const rows = users
    .map(u => {
      const esc = v => String(v ?? '').replace(/"/g, '""');
      const verified = u.verified ? 'yes' : 'no';
      const marketing = u.marketingOptIn ? 'yes' : 'no';
      return `"${esc(u.id)}","${esc(u.name)}","${esc(u.email)}","${esc(u.role)}","${verified}","${marketing}","${esc(u.createdAt)}","${esc(u.lastLoginAt || '')}"`;
    })
    .join('\n');
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
    messages: read('messages'),
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
      plans: 1 + (i % 3),
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
      threadsTotal: threads.length,
    },
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
      'events',
    ];
    collections.forEach(name => write(name, []));
    if (seedFn) {
      seedFn();
    }
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
    proExpiresAt: s.proExpiresAt || null,
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
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
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
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }

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
      proExpiresAt: s.proExpiresAt || null,
    },
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
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
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
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  all[i].featured = !!(req.body && req.body.featured);
  write('packages', all);
  res.json({ ok: true, package: all[i] });
});

// ---------- User Management ----------

/**
 * POST /api/admin/users/:id/suspend
 * Suspend or unsuspend a user account
 * Body: { suspended: boolean, reason: string, duration: string }
 */
router.post('/users/:id/suspend', authRequired, roleRequired('admin'), (req, res) => {
  const { suspended, reason, duration } = req.body;
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === req.params.id);

  if (userIndex < 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const now = new Date().toISOString();

  // Prevent admins from suspending themselves
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot suspend your own account' });
  }

  user.suspended = !!suspended;
  user.suspendedAt = suspended ? now : null;
  user.suspendedBy = suspended ? req.user.id : null;
  user.suspensionReason = suspended ? reason || 'No reason provided' : null;
  user.suspensionDuration = suspended ? duration : null;
  user.updatedAt = now;

  // Calculate expiry if duration is provided
  if (suspended && duration) {
    const durationMs = parseDuration(duration);
    if (durationMs > 0) {
      const expiryDate = new Date(Date.now() + durationMs);
      user.suspensionExpiresAt = expiryDate.toISOString();
    }
  } else {
    user.suspensionExpiresAt = null;
  }

  users[userIndex] = user;
  write('users', users);

  // Create audit log (requiring audit.js)
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: suspended ? AUDIT_ACTIONS.USER_SUSPENDED : AUDIT_ACTIONS.USER_UNSUSPENDED,
    targetType: 'user',
    targetId: user.id,
    details: { reason, duration, email: user.email },
  });

  res.json({
    message: suspended ? 'User suspended successfully' : 'User unsuspended successfully',
    user: {
      id: user.id,
      email: user.email,
      suspended: user.suspended,
      suspensionReason: user.suspensionReason,
    },
  });
});

/**
 * POST /api/admin/users/:id/ban
 * Ban or unban a user permanently
 * Body: { banned: boolean, reason: string }
 */
router.post('/users/:id/ban', authRequired, roleRequired('admin'), (req, res) => {
  const { banned, reason } = req.body;
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === req.params.id);

  if (userIndex < 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const now = new Date().toISOString();

  // Prevent admins from banning themselves
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot ban your own account' });
  }

  user.banned = !!banned;
  user.bannedAt = banned ? now : null;
  user.bannedBy = banned ? req.user.id : null;
  user.banReason = banned ? reason || 'No reason provided' : null;
  user.updatedAt = now;

  users[userIndex] = user;
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: banned ? AUDIT_ACTIONS.USER_BANNED : AUDIT_ACTIONS.USER_UNBANNED,
    targetType: 'user',
    targetId: user.id,
    details: { reason, email: user.email },
  });

  res.json({
    message: banned ? 'User banned successfully' : 'User unbanned successfully',
    user: {
      id: user.id,
      email: user.email,
      banned: user.banned,
      banReason: user.banReason,
    },
  });
});

/**
 * POST /api/admin/users/:id/verify
 * Manually verify a user's email
 */
router.post('/users/:id/verify', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === req.params.id);

  if (userIndex < 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const now = new Date().toISOString();

  if (user.verified) {
    return res.status(400).json({ error: 'User is already verified' });
  }

  user.verified = true;
  user.verifiedAt = now;
  user.verifiedBy = req.user.id;
  user.verificationToken = null; // Clear verification token
  user.updatedAt = now;

  users[userIndex] = user;
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.USER_VERIFIED,
    targetType: 'user',
    targetId: user.id,
    details: { email: user.email },
  });

  res.json({
    message: 'User verified successfully',
    user: {
      id: user.id,
      email: user.email,
      verified: user.verified,
    },
  });
});

/**
 * POST /api/admin/users/:id/force-reset
 * Force a password reset for a user
 */
router.post('/users/:id/force-reset', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === req.params.id);

  if (userIndex < 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const now = new Date().toISOString();

  // Generate reset token
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

  user.resetToken = resetToken;
  user.resetTokenExpiresAt = resetTokenExpiresAt;
  user.passwordResetRequired = true;
  user.updatedAt = now;

  users[userIndex] = user;
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
    targetType: 'user',
    targetId: user.id,
    details: { email: user.email, forced: true },
  });

  // TODO: Send password reset email
  const resetLink = `${process.env.BASE_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;

  res.json({
    message: 'Password reset initiated successfully',
    resetLink, // In production, this would be emailed, not returned
    user: {
      id: user.id,
      email: user.email,
    },
  });
});

/**
 * POST /api/admin/suppliers/:id/verify
 * Verify a supplier account
 * Body: { verified: boolean, verificationNotes: string }
 */
router.post('/suppliers/:id/verify', authRequired, roleRequired('admin'), (req, res) => {
  const { verified, verificationNotes } = req.body;
  const suppliers = read('suppliers');
  const supplierIndex = suppliers.findIndex(s => s.id === req.params.id);

  if (supplierIndex < 0) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  const supplier = suppliers[supplierIndex];
  const now = new Date().toISOString();

  supplier.verified = !!verified;
  supplier.verifiedAt = verified ? now : null;
  supplier.verifiedBy = verified ? req.user.id : null;
  supplier.verificationNotes = verificationNotes || '';
  supplier.verificationStatus = verified ? 'verified' : 'rejected';
  supplier.updatedAt = now;

  suppliers[supplierIndex] = supplier;
  write('suppliers', suppliers);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: verified ? AUDIT_ACTIONS.SUPPLIER_VERIFIED : AUDIT_ACTIONS.SUPPLIER_REJECTED,
    targetType: 'supplier',
    targetId: supplier.id,
    details: { name: supplier.name, notes: verificationNotes },
  });

  res.json({
    message: verified ? 'Supplier verified successfully' : 'Supplier verification rejected',
    supplier: {
      id: supplier.id,
      name: supplier.name,
      verified: supplier.verified,
      verificationStatus: supplier.verificationStatus,
    },
  });
});

/**
 * GET /api/admin/suppliers/pending-verification
 * Get suppliers awaiting verification
 */
router.get('/suppliers/pending-verification', authRequired, roleRequired('admin'), (req, res) => {
  const suppliers = read('suppliers');
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
});

// Helper function to parse duration strings like "7d", "1h", "30m"
function parseDuration(duration) {
  const match = duration.match(/^(\d+)([dhm])$/);
  if (!match) {
    return 0;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000; // days
    case 'h':
      return value * 60 * 60 * 1000; // hours
    case 'm':
      return value * 60 * 1000; // minutes
    default:
      return 0;
  }
}

/**
 * PUT /api/admin/packages/:id
 * Edit package details (admin only)
 */
router.put('/packages/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { title, description, price, features, availability, status, scheduledPublishAt } =
    req.body;

  const packages = read('packages');
  const pkgIndex = packages.findIndex(p => p.id === id);

  if (pkgIndex === -1) {
    return res.status(404).json({ error: 'Package not found' });
  }

  const pkg = packages[pkgIndex];

  // Store previous version for history
  if (!pkg.versionHistory) {
    pkg.versionHistory = [];
  }
  pkg.versionHistory.push({
    timestamp: new Date().toISOString(),
    editedBy: req.user.id,
    previousState: { ...pkg },
  });

  // Update fields if provided
  if (title !== undefined) {
    pkg.title = title;
  }
  if (description !== undefined) {
    pkg.description = description;
  }
  if (price !== undefined) {
    pkg.price = price;
  }
  if (features !== undefined) {
    pkg.features = features;
  }
  if (availability !== undefined) {
    pkg.availability = availability;
  }
  if (status !== undefined) {
    pkg.status = status;
  }
  if (scheduledPublishAt !== undefined) {
    pkg.scheduledPublishAt = scheduledPublishAt;
  }

  pkg.updatedAt = new Date().toISOString();
  pkg.lastEditedBy = req.user.id;

  packages[pkgIndex] = pkg;
  write('packages', packages);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.PACKAGE_EDITED,
    targetType: 'package',
    targetId: id,
    details: { packageTitle: pkg.title, changes: req.body },
  });

  res.json({ success: true, package: pkg });
});

/**
 * PUT /api/admin/suppliers/:id
 * Edit supplier profile (admin only)
 */
router.put('/suppliers/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { name, description, contact, categories, amenities, location, serviceAreas } = req.body;

  const suppliers = read('suppliers');
  const supplierIndex = suppliers.findIndex(s => s.id === id);

  if (supplierIndex === -1) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  const supplier = suppliers[supplierIndex];

  // Store previous version for history
  if (!supplier.versionHistory) {
    supplier.versionHistory = [];
  }
  supplier.versionHistory.push({
    timestamp: new Date().toISOString(),
    editedBy: req.user.id,
    previousState: { ...supplier },
  });

  // Update fields if provided
  if (name !== undefined) {
    supplier.name = name;
  }
  if (description !== undefined) {
    supplier.description = description;
  }
  if (contact !== undefined) {
    supplier.contact = contact;
  }
  if (categories !== undefined) {
    supplier.categories = categories;
  }
  if (amenities !== undefined) {
    supplier.amenities = amenities;
  }
  if (location !== undefined) {
    supplier.location = location;
  }
  if (serviceAreas !== undefined) {
    supplier.serviceAreas = serviceAreas;
  }

  supplier.updatedAt = new Date().toISOString();
  supplier.lastEditedBy = req.user.id;

  suppliers[supplierIndex] = supplier;
  write('suppliers', suppliers);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.SUPPLIER_EDITED,
    targetType: 'supplier',
    targetId: id,
    details: { supplierName: supplier.name, changes: req.body },
  });

  res.json({ success: true, supplier });
});

/**
 * PUT /api/admin/users/:id
 * Edit user profile (admin only)
 */
router.put('/users/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { name, email, role, verified, marketingOptIn } = req.body;

  const users = read('users');
  const userIndex = users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];

  // Store previous version for history (excluding sensitive data)
  if (!user.versionHistory) {
    user.versionHistory = [];
  }
  const {
    password: _password,
    passwordHash: _passwordHash,
    resetToken: _resetToken,
    twoFactorSecret: _twoFactorSecret,
    ...safeState
  } = user;
  user.versionHistory.push({
    timestamp: new Date().toISOString(),
    editedBy: req.user.id,
    previousState: safeState,
  });

  // Update fields if provided
  if (name !== undefined) {
    user.name = name;
  }
  if (email !== undefined) {
    user.email = email;
  }
  if (role !== undefined) {
    user.role = role;
  }
  if (verified !== undefined) {
    user.verified = verified;
  }
  if (marketingOptIn !== undefined) {
    user.marketingOptIn = marketingOptIn;
  }

  user.updatedAt = new Date().toISOString();
  user.lastEditedBy = req.user.id;

  users[userIndex] = user;
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'user_edited',
    targetType: 'user',
    targetId: user.id,
    details: { email: user.email, changes: req.body },
  });

  res.json({ success: true, user });
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user account (admin only)
 */
router.delete('/users/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];

  // Prevent admins from deleting themselves
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  // Prevent deletion of the owner account
  if (user.email === 'admin@event-flow.co.uk' || user.isOwner) {
    return res.status(403).json({ error: 'Cannot delete the owner account' });
  }

  // Remove the user
  users.splice(userIndex, 1);
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.USER_DELETED,
    targetType: 'user',
    targetId: user.id,
    details: { email: user.email, name: user.name },
  });

  res.json({ success: true, message: 'User deleted successfully' });
});

/**
 * DELETE /api/admin/suppliers/:id
 * Delete a supplier (admin only)
 */
router.delete('/suppliers/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const suppliers = read('suppliers');
  const supplierIndex = suppliers.findIndex(s => s.id === id);

  if (supplierIndex === -1) {
    return res.status(404).json({ error: 'Supplier not found' });
  }

  const supplier = suppliers[supplierIndex];

  // Remove the supplier
  suppliers.splice(supplierIndex, 1);
  write('suppliers', suppliers);

  // Also delete associated packages
  const packages = read('packages');
  const updatedPackages = packages.filter(p => p.supplierId !== id);
  if (updatedPackages.length < packages.length) {
    write('packages', updatedPackages);
  }

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'supplier_deleted',
    targetType: 'supplier',
    targetId: supplier.id,
    details: { name: supplier.name },
  });

  res.json({ success: true, message: 'Supplier and associated packages deleted successfully' });
});

/**
 * DELETE /api/admin/packages/:id
 * Delete a package (admin only)
 */
router.delete('/packages/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const packages = read('packages');
  const packageIndex = packages.findIndex(p => p.id === id);

  if (packageIndex === -1) {
    return res.status(404).json({ error: 'Package not found' });
  }

  const pkg = packages[packageIndex];

  // Remove the package
  packages.splice(packageIndex, 1);
  write('packages', packages);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'package_deleted',
    targetType: 'package',
    targetId: pkg.id,
    details: { title: pkg.title },
  });

  res.json({ success: true, message: 'Package deleted successfully' });
});

/**
 * POST /api/admin/users/:id/grant-admin
 * Grant admin privileges to a user
 */
router.post('/users/:id/grant-admin', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const now = new Date().toISOString();

  // Check if user already has admin role
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'User already has admin privileges' });
  }

  // Store previous role
  user.previousRole = user.role;
  user.role = 'admin';
  user.adminGrantedAt = now;
  user.adminGrantedBy = req.user.id;
  user.updatedAt = now;

  users[userIndex] = user;
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
    targetType: 'user',
    targetId: user.id,
    details: {
      email: user.email,
      previousRole: user.previousRole,
      newRole: 'admin',
    },
  });

  res.json({
    success: true,
    message: 'Admin privileges granted successfully',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * POST /api/admin/users/:id/revoke-admin
 * Revoke admin privileges from a user
 */
router.post('/users/:id/revoke-admin', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { newRole = 'customer' } = req.body;
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];
  const now = new Date().toISOString();

  // Check if user has admin role
  if (user.role !== 'admin') {
    return res.status(400).json({ error: 'User does not have admin privileges' });
  }

  // Prevent revoking own admin privileges
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot revoke your own admin privileges' });
  }

  // Prevent revoking owner's admin privileges
  if (user.email === 'admin@event-flow.co.uk' || user.isOwner) {
    return res.status(403).json({ error: 'Cannot revoke admin privileges from the owner account' });
  }

  // Validate newRole
  if (!['customer', 'supplier'].includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be customer or supplier' });
  }

  // Store previous role
  user.previousRole = user.role;
  user.role = newRole;
  user.adminRevokedAt = now;
  user.adminRevokedBy = req.user.id;
  user.updatedAt = now;

  users[userIndex] = user;
  write('users', users);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
    targetType: 'user',
    targetId: user.id,
    details: {
      email: user.email,
      previousRole: 'admin',
      newRole: newRole,
    },
  });

  res.json({
    success: true,
    message: 'Admin privileges revoked successfully',
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});

// ---------- Photo Moderation ----------

/**
 * GET /api/admin/photos/pending
 * Get all photos pending approval
 */
router.get('/photos/pending', authRequired, roleRequired('admin'), (req, res) => {
  const photos = read('photos');
  const pendingPhotos = photos.filter(p => p.status === 'pending');

  // Enrich with supplier information
  const suppliers = read('suppliers');
  const enrichedPhotos = pendingPhotos.map(photo => {
    const supplier = suppliers.find(s => s.id === photo.supplierId);
    return {
      ...photo,
      supplierName: supplier ? supplier.name : 'Unknown',
      supplierCategory: supplier ? supplier.category : null,
    };
  });

  res.json({ photos: enrichedPhotos });
});

/**
 * POST /api/admin/photos/:id/approve
 * Approve a photo
 */
router.post('/photos/:id/approve', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const photos = read('photos');
  const photoIndex = photos.findIndex(p => p.id === id);

  if (photoIndex === -1) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const photo = photos[photoIndex];
  const now = new Date().toISOString();

  // Update photo status
  photo.status = 'approved';
  photo.approvedAt = now;
  photo.approvedBy = req.user.id;

  photos[photoIndex] = photo;
  write('photos', photos);

  // Add photo to supplier's photos array if not already there
  const suppliers = read('suppliers');
  const supplierIndex = suppliers.findIndex(s => s.id === photo.supplierId);

  if (supplierIndex !== -1) {
    if (!suppliers[supplierIndex].photos) {
      suppliers[supplierIndex].photos = [];
    }
    if (!suppliers[supplierIndex].photos.includes(photo.url)) {
      suppliers[supplierIndex].photos.push(photo.url);
      write('suppliers', suppliers);
    }
  }

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.CONTENT_APPROVED,
    targetType: 'photo',
    targetId: photo.id,
    details: { supplierId: photo.supplierId, url: photo.url },
  });

  res.json({ success: true, message: 'Photo approved successfully', photo });
});

/**
 * POST /api/admin/photos/:id/reject
 * Reject a photo
 */
router.post('/photos/:id/reject', authRequired, roleRequired('admin'), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const photos = read('photos');
  const photoIndex = photos.findIndex(p => p.id === id);

  if (photoIndex === -1) {
    return res.status(404).json({ error: 'Photo not found' });
  }

  const photo = photos[photoIndex];
  const now = new Date().toISOString();

  // Update photo status
  photo.status = 'rejected';
  photo.rejectedAt = now;
  photo.rejectedBy = req.user.id;
  photo.rejectionReason = reason || 'No reason provided';

  photos[photoIndex] = photo;
  write('photos', photos);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: AUDIT_ACTIONS.CONTENT_REJECTED,
    targetType: 'photo',
    targetId: photo.id,
    details: {
      supplierId: photo.supplierId,
      url: photo.url,
      reason: photo.rejectionReason,
    },
  });

  res.json({ success: true, message: 'Photo rejected successfully', photo });
});

// ---------- Smart Tagging ----------

/**
 * POST /api/admin/suppliers/smart-tags
 * Generate smart tags for all suppliers based on their descriptions and categories
 */
router.post('/suppliers/smart-tags', authRequired, roleRequired('admin'), (req, res) => {
  const suppliers = read('suppliers');
  let taggedCount = 0;

  // Common wedding/event industry tags
  const tagMapping = {
    venues: ['venue', 'location', 'space', 'ceremony', 'reception'],
    catering: ['food', 'catering', 'menu', 'dining', 'buffet', 'meal'],
    photography: ['photo', 'photography', 'photographer', 'camera', 'pictures'],
    entertainment: ['music', 'band', 'dj', 'entertainment', 'performance'],
    flowers: ['flowers', 'floral', 'bouquet', 'decoration', 'decor'],
    transport: ['transport', 'car', 'vehicle', 'limousine', 'travel'],
    extras: ['extras', 'accessories', 'favors', 'gifts'],
  };

  // Additional context-based tags
  const contextTags = {
    wedding: ['wedding', 'bride', 'groom', 'marriage', 'nuptial'],
    outdoor: ['outdoor', 'garden', 'countryside', 'open-air'],
    indoor: ['indoor', 'barn', 'hall', 'ballroom'],
    luxury: ['luxury', 'premium', 'exclusive', 'upscale'],
    rustic: ['rustic', 'countryside', 'barn', 'rural'],
    modern: ['modern', 'contemporary', 'stylish'],
    traditional: ['traditional', 'classic', 'formal'],
    budget: ['affordable', 'budget', 'value'],
  };

  suppliers.forEach((supplier, index) => {
    if (!supplier.approved) {
      return;
    }

    const tags = new Set();
    const text = [
      supplier.name || '',
      supplier.description_short || '',
      supplier.description_long || '',
      supplier.category || '',
      ...(supplier.amenities || []),
    ]
      .join(' ')
      .toLowerCase();

    // Add category-based tags
    const categoryKey = (supplier.category || '').toLowerCase().replace(/[^a-z]/g, '');
    if (tagMapping[categoryKey]) {
      tagMapping[categoryKey].forEach(tag => tags.add(tag));
    }

    // Add context-based tags
    Object.entries(contextTags).forEach(([tag, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        tags.add(tag);
      }
    });

    // Add location tag if available
    if (supplier.location) {
      const locationWords = supplier.location.toLowerCase().split(/[,\s]+/);
      locationWords.forEach(word => {
        if (word.length > 3) {
          tags.add(word);
        }
      });
    }

    // Only update if we generated tags
    if (tags.size > 0) {
      suppliers[index].tags = Array.from(tags).slice(0, 10); // Limit to 10 tags
      taggedCount++;
    }
  });

  write('suppliers', suppliers);

  // Create audit log
  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'SMART_TAGS_GENERATED',
    targetType: 'suppliers',
    targetId: null,
    details: { suppliersTagged: taggedCount },
  });

  res.json({
    success: true,
    message: `Smart tags generated for ${taggedCount} suppliers`,
    taggedCount,
  });
});

// ---------- Badge Counts ----------

/**
 * Generate a unique ID using crypto module
 * @param {string} prefix - Prefix for the ID (e.g., 'announcement', 'faq')
 * @returns {string} Unique ID
 */
function generateUniqueId(prefix) {
  // Use crypto.randomUUID if available (Node 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  // Fallback for older Node versions
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}_${random}${random2}`;
}

/**
 * GET /api/admin/badge-counts
 * Get counts for sidebar badges (new users, pending photos, open tickets)
 */
router.get('/badge-counts', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const photos = read('photos') || [];
  const tickets = read('tickets') || [];

  // Count users created in last 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newUsers = users.filter(u => {
    if (!u.createdAt) {
      return false;
    }
    return new Date(u.createdAt).getTime() > sevenDaysAgo;
  }).length;

  // Count pending photos
  const pendingPhotos = photos.filter(p => !p.approved && !p.rejected).length;

  // Count open tickets
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  res.json({
    newUsers,
    pendingPhotos,
    openTickets,
  });
});

// ---------- User Detail Operations ----------

/**
 * GET /api/admin/users/:id
 * Get detailed information about a specific user
 */
router.get('/users/:id', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const user = users.find(u => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return user without password
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

/**
 * POST /api/admin/users/:id/reset-password
 * Send password reset email to user
 */
router.post('/users/:id/reset-password', authRequired, roleRequired('admin'), async (req, res) => {
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === req.params.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const user = users[userIndex];

  // Generate reset token
  const token = uid('reset');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Save reset token to user
  users[userIndex].resetToken = token;
  users[userIndex].resetTokenExpiresAt = expires;
  write('users', users);

  // Send password reset email
  const resetLink = `${process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'}/reset-password.html?token=${encodeURIComponent(token)}`;

  try {
    if (postmark.isPostmarkEnabled()) {
      await postmark.sendMail({
        to: user.email,
        subject: 'Reset your EventFlow password',
        template: 'password-reset',
        templateData: {
          name: user.name || 'there',
          resetLink: resetLink,
        },
        tags: ['password-reset', 'admin-initiated', 'transactional'],
        messageStream: 'password-reset',
      });
    } else {
      // Fallback: send simple email
      await postmark.sendMail({
        to: user.email,
        subject: 'Reset your EventFlow password',
        text: `Hi ${user.name || 'there'},\n\nAn administrator has initiated a password reset for your account.\n\nClick the link below to reset your password:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe EventFlow Team`,
        messageStream: 'password-reset',
      });
    }

    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      targetType: 'user',
      targetId: user.id,
      details: { userEmail: user.email, emailSent: true },
    });

    res.json({
      success: true,
      message: 'Password reset email sent successfully',
    });
  } catch (err) {
    console.error('Failed to send password reset email:', err);

    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      targetType: 'user',
      targetId: user.id,
      details: { userEmail: user.email, emailSent: false, error: err.message },
    });

    res.status(500).json({
      error: 'Failed to send password reset email',
      details: err.message,
    });
  }
});

/**
 * POST /api/admin/users/:id/unsuspend
 * Unsuspend a user
 */
router.post('/users/:id/unsuspend', authRequired, roleRequired('admin'), (req, res) => {
  const users = read('users');
  const userIndex = users.findIndex(u => u.id === req.params.id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[userIndex].suspended = false;
  users[userIndex].suspendedAt = null;
  users[userIndex].suspendedBy = null;
  users[userIndex].suspendedReason = null;

  write('users', users);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'USER_UNSUSPENDED',
    targetType: 'user',
    targetId: req.params.id,
    details: { userEmail: users[userIndex].email },
  });

  res.json({ success: true, message: 'User unsuspended', user: users[userIndex] });
});

// ---------- Content Management ----------

/**
 * GET /api/admin/content/homepage
 * Get homepage hero content
 */
router.get('/content/homepage', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  const homepage = content.homepage || {
    title: 'Plan Your Perfect Event',
    subtitle: 'Discover amazing suppliers and packages for your special day',
    ctaText: 'Start Planning',
  };
  res.json(homepage);
});

/**
 * PUT /api/admin/content/homepage
 * Update homepage hero content
 */
router.put('/content/homepage', authRequired, roleRequired('admin'), (req, res) => {
  const { title, subtitle, ctaText } = req.body;

  const content = read('content') || {};
  content.homepage = {
    title: title || 'Plan Your Perfect Event',
    subtitle: subtitle || 'Discover amazing suppliers and packages for your special day',
    ctaText: ctaText || 'Start Planning',
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'CONTENT_UPDATED',
    targetType: 'homepage',
    targetId: null,
    details: { title, subtitle, ctaText },
  });

  res.json({ success: true, content: content.homepage });
});

/**
 * GET /api/admin/content/announcements
 * Get all announcements
 */
router.get('/content/announcements', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  const announcements = content.announcements || [];
  res.json(announcements);
});

/**
 * POST /api/admin/content/announcements
 * Create a new announcement
 */
router.post('/content/announcements', authRequired, roleRequired('admin'), (req, res) => {
  const { message, type, active } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const content = read('content') || {};
  if (!content.announcements) {
    content.announcements = [];
  }

  const announcement = {
    id: generateUniqueId('announcement'),
    message,
    type: type || 'info',
    active: active !== false,
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
  };

  content.announcements.push(announcement);
  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'ANNOUNCEMENT_CREATED',
    targetType: 'announcement',
    targetId: announcement.id,
    details: { message, type },
  });

  res.json({ success: true, announcement });
});

/**
 * GET /api/admin/content/announcements/:id
 * Get a specific announcement
 */
router.get('/content/announcements/:id', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  const announcements = content.announcements || [];
  const announcement = announcements.find(a => a.id === req.params.id);

  if (!announcement) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  res.json(announcement);
});

/**
 * PUT /api/admin/content/announcements/:id
 * Update an announcement
 */
router.put('/content/announcements/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { message, type, active } = req.body;

  const content = read('content') || {};
  if (!content.announcements) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  const announcementIndex = content.announcements.findIndex(a => a.id === req.params.id);
  if (announcementIndex === -1) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  content.announcements[announcementIndex] = {
    ...content.announcements[announcementIndex],
    message: message || content.announcements[announcementIndex].message,
    type: type || content.announcements[announcementIndex].type,
    active: active !== undefined ? active : content.announcements[announcementIndex].active,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'ANNOUNCEMENT_UPDATED',
    targetType: 'announcement',
    targetId: req.params.id,
    details: { message, type, active },
  });

  res.json({ success: true, announcement: content.announcements[announcementIndex] });
});

/**
 * DELETE /api/admin/content/announcements/:id
 * Delete an announcement
 */
router.delete('/content/announcements/:id', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  if (!content.announcements) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  const announcementIndex = content.announcements.findIndex(a => a.id === req.params.id);
  if (announcementIndex === -1) {
    return res.status(404).json({ error: 'Announcement not found' });
  }

  const deleted = content.announcements.splice(announcementIndex, 1)[0];
  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'ANNOUNCEMENT_DELETED',
    targetType: 'announcement',
    targetId: req.params.id,
    details: { message: deleted.message },
  });

  res.json({ success: true, message: 'Announcement deleted' });
});

/**
 * GET /api/admin/content/faqs
 * Get all FAQs
 */
router.get('/content/faqs', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  const faqs = content.faqs || [];
  res.json(faqs);
});

/**
 * POST /api/admin/content/faqs
 * Create a new FAQ
 */
router.post('/content/faqs', authRequired, roleRequired('admin'), (req, res) => {
  const { question, answer, category } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Question and answer are required' });
  }

  const content = read('content') || {};
  if (!content.faqs) {
    content.faqs = [];
  }

  const faq = {
    id: generateUniqueId('faq'),
    question,
    answer,
    category: category || 'General',
    createdAt: new Date().toISOString(),
    createdBy: req.user.email,
  };

  content.faqs.push(faq);
  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'FAQ_CREATED',
    targetType: 'faq',
    targetId: faq.id,
    details: { question, category },
  });

  res.json({ success: true, faq });
});

/**
 * GET /api/admin/content/faqs/:id
 * Get a specific FAQ
 */
router.get('/content/faqs/:id', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  const faqs = content.faqs || [];
  const faq = faqs.find(f => f.id === req.params.id);

  if (!faq) {
    return res.status(404).json({ error: 'FAQ not found' });
  }

  res.json(faq);
});

/**
 * PUT /api/admin/content/faqs/:id
 * Update a FAQ
 */
router.put('/content/faqs/:id', authRequired, roleRequired('admin'), (req, res) => {
  const { question, answer, category } = req.body;

  const content = read('content') || {};
  if (!content.faqs) {
    return res.status(404).json({ error: 'FAQ not found' });
  }

  const faqIndex = content.faqs.findIndex(f => f.id === req.params.id);
  if (faqIndex === -1) {
    return res.status(404).json({ error: 'FAQ not found' });
  }

  content.faqs[faqIndex] = {
    ...content.faqs[faqIndex],
    question: question || content.faqs[faqIndex].question,
    answer: answer || content.faqs[faqIndex].answer,
    category: category || content.faqs[faqIndex].category,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'FAQ_UPDATED',
    targetType: 'faq',
    targetId: req.params.id,
    details: { question, category },
  });

  res.json({ success: true, faq: content.faqs[faqIndex] });
});

/**
 * DELETE /api/admin/content/faqs/:id
 * Delete a FAQ
 */
router.delete('/content/faqs/:id', authRequired, roleRequired('admin'), (req, res) => {
  const content = read('content') || {};
  if (!content.faqs) {
    return res.status(404).json({ error: 'FAQ not found' });
  }

  const faqIndex = content.faqs.findIndex(f => f.id === req.params.id);
  if (faqIndex === -1) {
    return res.status(404).json({ error: 'FAQ not found' });
  }

  const deleted = content.faqs.splice(faqIndex, 1)[0];
  write('content', content);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'FAQ_DELETED',
    targetType: 'faq',
    targetId: req.params.id,
    details: { question: deleted.question },
  });

  res.json({ success: true, message: 'FAQ deleted' });
});

// ---------- System Settings ----------

/**
 * GET /api/admin/settings/site
 * Get site configuration
 */
router.get('/settings/site', authRequired, roleRequired('admin'), (req, res) => {
  const settings = read('settings') || {};
  const site = settings.site || {
    name: 'EventFlow',
    tagline: 'Event planning made simple',
    contactEmail: 'hello@eventflow.com',
    supportEmail: 'support@eventflow.com',
  };
  res.json(site);
});

/**
 * PUT /api/admin/settings/site
 * Update site configuration
 */
router.put('/settings/site', authRequired, roleRequired('admin'), (req, res) => {
  const { name, tagline, contactEmail, supportEmail } = req.body;

  const settings = read('settings') || {};
  settings.site = {
    name: name || 'EventFlow',
    tagline: tagline || 'Event planning made simple',
    contactEmail: contactEmail || 'hello@eventflow.com',
    supportEmail: supportEmail || 'support@eventflow.com',
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('settings', settings);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'SETTINGS_UPDATED',
    targetType: 'site',
    targetId: null,
    details: { name, tagline },
  });

  res.json({ success: true, site: settings.site });
});

/**
 * GET /api/admin/settings/features
 * Get feature flags
 */
router.get('/settings/features', authRequired, roleRequired('admin'), (req, res) => {
  const settings = read('settings') || {};
  const features = settings.features || {
    registration: true,
    supplierApplications: true,
    reviews: true,
    photoUploads: true,
    supportTickets: true,
  };
  res.json(features);
});

/**
 * PUT /api/admin/settings/features
 * Update feature flags
 */
router.put('/settings/features', authRequired, roleRequired('admin'), (req, res) => {
  const { registration, supplierApplications, reviews, photoUploads, supportTickets } = req.body;

  const settings = read('settings') || {};
  settings.features = {
    registration: registration !== false,
    supplierApplications: supplierApplications !== false,
    reviews: reviews !== false,
    photoUploads: photoUploads !== false,
    supportTickets: supportTickets !== false,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('settings', settings);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'FEATURES_UPDATED',
    targetType: 'features',
    targetId: null,
    details: settings.features,
  });

  res.json({ success: true, features: settings.features });
});

/**
 * GET /api/admin/settings/maintenance
 * Get maintenance mode settings
 */
router.get('/settings/maintenance', authRequired, roleRequired('admin'), (req, res) => {
  const settings = read('settings') || {};
  const maintenance = settings.maintenance || {
    enabled: false,
    message: "We're performing scheduled maintenance. We'll be back soon!",
  };
  res.json(maintenance);
});

/**
 * PUT /api/admin/settings/maintenance
 * Update maintenance mode settings
 */
router.put('/settings/maintenance', authRequired, roleRequired('admin'), (req, res) => {
  const { enabled, message } = req.body;

  const settings = read('settings') || {};
  settings.maintenance = {
    enabled: enabled === true,
    message: message || "We're performing scheduled maintenance. We'll be back soon!",
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('settings', settings);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'MAINTENANCE_UPDATED',
    targetType: 'maintenance',
    targetId: null,
    details: { enabled, message },
  });

  res.json({ success: true, maintenance: settings.maintenance });
});

/**
 * GET /api/admin/settings/email-templates/:name
 * Get email template
 */
router.get('/settings/email-templates/:name', authRequired, roleRequired('admin'), (req, res) => {
  const settings = read('settings') || {};
  const emailTemplates = settings.emailTemplates || {};

  const defaultTemplates = {
    welcome: {
      subject: 'Welcome to EventFlow!',
      body: "Hi {{name}},\n\nWelcome to EventFlow! We're excited to help you plan your perfect event.\n\nBest regards,\nThe EventFlow Team",
    },
    verification: {
      subject: 'Verify your email address',
      body: 'Hi {{name}},\n\nPlease verify your email address by clicking the link below:\n\n{{verificationLink}}\n\nBest regards,\nThe EventFlow Team',
    },
    'password-reset': {
      subject: 'Reset your password',
      body: "Hi {{name}},\n\nYou requested a password reset. Click the link below to reset your password:\n\n{{resetLink}}\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe EventFlow Team",
    },
    'ticket-response': {
      subject: 'New response to your support ticket',
      body: 'Hi {{name}},\n\nYou have received a new response to your support ticket #{{ticketId}}.\n\n{{response}}\n\nBest regards,\nThe EventFlow Team',
    },
  };

  const template = emailTemplates[req.params.name] || defaultTemplates[req.params.name];

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
});

/**
 * PUT /api/admin/settings/email-templates/:name
 * Update email template
 */
router.put('/settings/email-templates/:name', authRequired, roleRequired('admin'), (req, res) => {
  const { subject, body } = req.body;

  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }

  const settings = read('settings') || {};
  if (!settings.emailTemplates) {
    settings.emailTemplates = {};
  }

  settings.emailTemplates[req.params.name] = {
    subject,
    body,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user.email,
  };

  write('settings', settings);

  auditLog({
    adminId: req.user.id,
    adminEmail: req.user.email,
    action: 'EMAIL_TEMPLATE_UPDATED',
    targetType: 'email-template',
    targetId: req.params.name,
    details: { subject },
  });

  res.json({ success: true, template: settings.emailTemplates[req.params.name] });
});

/**
 * POST /api/admin/settings/email-templates/:name/reset
 * Reset email template to default
 */
router.post(
  '/settings/email-templates/:name/reset',
  authRequired,
  roleRequired('admin'),
  (req, res) => {
    const settings = read('settings') || {};
    if (!settings.emailTemplates) {
      settings.emailTemplates = {};
    }

    // Remove the custom template, will fall back to default
    delete settings.emailTemplates[req.params.name];
    write('settings', settings);

    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'EMAIL_TEMPLATE_RESET',
      targetType: 'email-template',
      targetId: req.params.name,
      details: {},
    });

    res.json({ success: true, message: 'Template reset to default' });
  }
);

/**
 * GET /api/admin/settings/system-info
 * Get system information
 */
router.get('/settings/system-info', authRequired, roleRequired('admin'), (req, res) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const uptimeStr = `${hours}h ${minutes}m`;

  res.json({
    version: 'v17.0.0',
    environment: process.env.NODE_ENV || 'production',
    database: 'JSON File Store',
    uptime: uptimeStr,
  });
});

// ---------- Tickets Management ----------

/**
 * GET /api/admin/tickets
 * List all support tickets
 */
router.get('/tickets', authRequired, roleRequired('admin'), (req, res) => {
  const tickets = read('tickets');
  
  // Sort by date (newest first)
  tickets.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
  
  res.json({ items: tickets });
});

/**
 * GET /api/admin/tickets/:id
 * Get single ticket details
 */
router.get('/tickets/:id', authRequired, roleRequired('admin'), (req, res) => {
  const tickets = read('tickets');
  const ticket = tickets.find(t => t.id === req.params.id);
  
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  res.json({ ticket });
});

/**
 * PUT /api/admin/tickets/:id
 * Update ticket (status, priority, assigned)
 */
router.put('/tickets/:id', authRequired, roleRequired('admin'), (req, res) => {
  const tickets = read('tickets');
  const index = tickets.findIndex(t => t.id === req.params.id);
  
  if (index < 0) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  const { status, priority, assignedTo } = req.body;
  const ticket = tickets[index];
  
  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  if (assignedTo !== undefined) ticket.assignedTo = assignedTo;
  
  ticket.updatedAt = new Date().toISOString();
  ticket.updatedBy = req.user.id;
  
  tickets[index] = ticket;
  write('tickets', tickets);
  
  res.json({ ticket });
});

/**
 * POST /api/admin/tickets/:id/reply
 * Add a reply to a ticket
 */
router.post('/tickets/:id/reply', authRequired, roleRequired('admin'), (req, res) => {
  const tickets = read('tickets');
  const index = tickets.findIndex(t => t.id === req.params.id);
  
  if (index < 0) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  const ticket = tickets[index];
  const reply = {
    id: uid('reply'),
    message,
    authorId: req.user.id,
    authorEmail: req.user.email,
    createdAt: new Date().toISOString(),
  };
  
  if (!ticket.replies) ticket.replies = [];
  ticket.replies.push(reply);
  ticket.updatedAt = new Date().toISOString();
  
  tickets[index] = ticket;
  write('tickets', tickets);
  
  res.json({ ticket });
});

// ---------- Audit Logs ----------

/**
 * GET /api/admin/audit
 * Get audit logs with optional filtering
 */
router.get('/audit', authRequired, roleRequired('admin'), (req, res) => {
  const { adminId, action, targetType, startDate, endDate, limit } = req.query;
  
  const filters = {};
  if (adminId) filters.adminId = adminId;
  if (action) filters.action = action;
  if (targetType) filters.targetType = targetType;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (limit) filters.limit = parseInt(limit, 10);
  
  const { getAuditLogs } = require('../middleware/audit');
  const logs = getAuditLogs(filters);
  
  res.json({ items: logs });
});

module.exports = router;
module.exports.setHelperFunctions = setHelperFunctions;
