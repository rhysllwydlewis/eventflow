/**
 * Admin Routes
 * Handles admin-only operations: approvals, metrics, moderation, and exports
 */

'use strict';

const express = require('express');
const { read, write } = require('../store');
const { authRequired, roleRequired } = require('../middleware/auth');
const { auditLog, AUDIT_ACTIONS } = require('../middleware/audit');

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
    lastLoginAt: u.lastLoginAt || null,
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
  if (!match) return 0;

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
router.put(
  '/packages/:id',
  authRequired,
  roleRequired('admin'),
  auditLog(AUDIT_ACTIONS.PACKAGE_EDITED),
  (req, res) => {
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
    if (title !== undefined) pkg.title = title;
    if (description !== undefined) pkg.description = description;
    if (price !== undefined) pkg.price = price;
    if (features !== undefined) pkg.features = features;
    if (availability !== undefined) pkg.availability = availability;
    if (status !== undefined) pkg.status = status;
    if (scheduledPublishAt !== undefined) pkg.scheduledPublishAt = scheduledPublishAt;

    pkg.updatedAt = new Date().toISOString();
    pkg.lastEditedBy = req.user.id;

    packages[pkgIndex] = pkg;
    write('packages', packages);

    res.json({ success: true, package: pkg });
  }
);

/**
 * PUT /api/admin/suppliers/:id
 * Edit supplier profile (admin only)
 */
router.put(
  '/suppliers/:id',
  authRequired,
  roleRequired('admin'),
  auditLog(AUDIT_ACTIONS.SUPPLIER_EDITED),
  (req, res) => {
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
    if (name !== undefined) supplier.name = name;
    if (description !== undefined) supplier.description = description;
    if (contact !== undefined) supplier.contact = contact;
    if (categories !== undefined) supplier.categories = categories;
    if (amenities !== undefined) supplier.amenities = amenities;
    if (location !== undefined) supplier.location = location;
    if (serviceAreas !== undefined) supplier.serviceAreas = serviceAreas;

    supplier.updatedAt = new Date().toISOString();
    supplier.lastEditedBy = req.user.id;

    suppliers[supplierIndex] = supplier;
    write('suppliers', suppliers);

    res.json({ success: true, supplier });
  }
);

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
  const { password, passwordHash, resetToken, twoFactorSecret, ...safeState } = user;
  user.versionHistory.push({
    timestamp: new Date().toISOString(),
    editedBy: req.user.id,
    previousState: safeState,
  });

  // Update fields if provided
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (role !== undefined) user.role = role;
  if (verified !== undefined) user.verified = verified;
  if (marketingOptIn !== undefined) user.marketingOptIn = marketingOptIn;

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
    if (!supplier.approved) return;

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

module.exports = router;
module.exports.setHelperFunctions = setHelperFunctions;
