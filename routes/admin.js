/**
 * Admin Routes
 * Handles admin-only operations: approvals, metrics, moderation, and exports
 */

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const { read, write, uid } = require('../store');
const { authRequired, roleRequired } = require('../middleware/auth');
const { auditLog, auditMiddleware, AUDIT_ACTIONS } = require('../middleware/audit');
const { csrfProtection } = require('../middleware/csrf');
const postmark = require('../utils/postmark');
const dbUnified = require('../db-unified');

const router = express.Router();

/**
 * Check if collage debug logging is enabled
 * @returns {boolean} True if debug logging should be enabled
 */
function isCollageDebugEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.DEBUG_COLLAGE === 'true';
}

// Initialize Stripe if available
let stripe = null;
let STRIPE_ENABLED = false;

try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (stripeSecretKey) {
    // Try to load Stripe module - it might not be installed
    try {
      const stripeLib = require('stripe');
      stripe = stripeLib(stripeSecretKey);
      STRIPE_ENABLED = true;
      console.info('Stripe initialized successfully for admin routes');
    } catch (requireErr) {
      console.warn('Stripe package not available:', requireErr.message);
    }
  } else {
    console.info('Stripe secret key not configured, Stripe features will be disabled');
  }
} catch (err) {
  console.error('Failed to initialize Stripe in admin routes:', err.message);
}

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
    initialized: status.state === 'completed',
    state: status.state,
    connected: status.connected,
    error: status.error,
  });
});

// Cache for dashboard stats
let dashboardStatsCache = null;
let dashboardStatsCacheTime = 0;
const DASHBOARD_STATS_CACHE_TTL = 60000; // 60 seconds

/**
 * Calculate dashboard statistics using efficient counting
 * @returns {Promise<Object>} Dashboard statistics
 */
async function calculateDashboardStats() {
  // Use Promise.all with count operations instead of full reads
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    suspendedUsers,
    customerCount,
    supplierCount,
    adminCount,
    totalSuppliers,
    pendingSuppliers,
    approvedSuppliers,
    verifiedSuppliers,
    proSuppliers,
    featuredSuppliers,
    totalPackages,
    pendingPackages,
    approvedPackages,
    featuredPackages,
    totalPhotos,
    approvedPhotos,
    rejectedPhotos,
    totalTickets,
    openTickets,
    inProgressTickets,
    closedTickets,
    totalPlans,
    activePlans,
    totalMarketplace,
  ] = await Promise.all([
    dbUnified.count('users'),
    dbUnified.count('users', { verified: true }),
    dbUnified.count('users', { verified: false }),
    dbUnified.count('users', { suspended: true }),
    dbUnified.count('users', { role: 'customer' }),
    dbUnified.count('users', { role: 'supplier' }),
    dbUnified.count('users', { role: 'admin' }),
    dbUnified.count('suppliers'),
    dbUnified.count('suppliers', { approved: false }),
    dbUnified.count('suppliers', { approved: true }),
    dbUnified.count('suppliers', { verified: true }),
    dbUnified.count('suppliers', { isPro: true }),
    dbUnified.count('suppliers', { featured: true }),
    dbUnified.count('packages'),
    dbUnified.count('packages', { approved: false }),
    dbUnified.count('packages', { approved: true }),
    dbUnified.count('packages', { featured: true }),
    dbUnified.count('photos'),
    dbUnified.count('photos', { approved: true }),
    dbUnified.count('photos', { rejected: true }),
    dbUnified.count('tickets'),
    dbUnified.count('tickets', { status: 'open' }),
    dbUnified.count('tickets', { status: 'in-progress' }),
    dbUnified.count('tickets', { status: 'closed' }),
    dbUnified.count('plans'),
    dbUnified.count('plans', { status: 'active' }),
    dbUnified.count('marketplace_listings'),
  ]);

  // For complex filters (date comparisons, multiple conditions), we need to use MongoDB's query language
  // For local storage fallback, we still need to load and filter
  const dbType = dbUnified.getDatabaseType();
  let recentSignups = 0;
  let pendingPhotos = 0;
  let highPriorityTickets = 0;
  let pendingMarketplace = 0;
  let activeMarketplace = 0;
  let recentActivity24h = 0;
  let recentActivity7d = 0;

  if (dbType === 'mongodb') {
    // Use MongoDB date queries for efficiency
    const [
      recentSignupsResult,
      pendingPhotosResult,
      highPriorityResult,
      pendingMarketplaceResult,
      activeMarketplaceResult,
      recent24hResult,
      recent7dResult,
    ] = await Promise.all([
      dbUnified.count('users', { createdAt: { $gte: dayAgo.toISOString() } }),
      dbUnified.count('photos', { approved: false, rejected: false }),
      dbUnified.count('tickets', { priority: 'high', status: { $ne: 'closed' } }),
      dbUnified.count('marketplace_listings', { approved: false, status: 'pending' }),
      dbUnified.count('marketplace_listings', { approved: true, status: 'active' }),
      dbUnified.count('audit_logs', { timestamp: { $gte: dayAgo.toISOString() } }),
      dbUnified.count('audit_logs', { timestamp: { $gte: weekAgo.toISOString() } }),
    ]);

    recentSignups = recentSignupsResult;
    pendingPhotos = pendingPhotosResult;
    highPriorityTickets = highPriorityResult;
    pendingMarketplace = pendingMarketplaceResult;
    activeMarketplace = activeMarketplaceResult;
    recentActivity24h = recent24hResult;
    recentActivity7d = recent7dResult;
  } else {
    // Fallback for local storage - need to load and filter
    const [users, photos, tickets, marketplaceListings, auditLogs] = await Promise.all([
      dbUnified.read('users'),
      dbUnified.read('photos'),
      dbUnified.read('tickets'),
      dbUnified.read('marketplace_listings'),
      dbUnified.read('audit_logs'),
    ]);

    recentSignups = users.filter(u => {
      const createdAt = new Date(u.createdAt);
      return createdAt > dayAgo;
    }).length;

    pendingPhotos = photos.filter(p => !p.approved && !p.rejected).length;

    highPriorityTickets = tickets.filter(
      t => t.priority === 'high' && t.status !== 'closed'
    ).length;

    pendingMarketplace = marketplaceListings.filter(
      l => !l.approved && l.status === 'pending'
    ).length;

    activeMarketplace = marketplaceListings.filter(l => l.approved && l.status === 'active').length;

    recentActivity24h = auditLogs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime > dayAgo;
    }).length;

    recentActivity7d = auditLogs.filter(log => {
      const logTime = new Date(log.timestamp);
      return logTime > weekAgo;
    }).length;
  }

  return {
    users: {
      total: totalUsers,
      verified: verifiedUsers,
      unverified: unverifiedUsers,
      suspended: suspendedUsers,
      customers: customerCount,
      suppliers: supplierCount,
      admins: adminCount,
      recentSignups,
    },
    suppliers: {
      total: totalSuppliers,
      pending: pendingSuppliers,
      approved: approvedSuppliers,
      verified: verifiedSuppliers,
      pro: proSuppliers,
      featured: featuredSuppliers,
    },
    packages: {
      total: totalPackages,
      pending: pendingPackages,
      approved: approvedPackages,
      featured: featuredPackages,
    },
    photos: {
      total: totalPhotos,
      pending: pendingPhotos,
      approved: approvedPhotos,
      rejected: rejectedPhotos,
    },
    tickets: {
      total: totalTickets,
      open: openTickets,
      inProgress: inProgressTickets,
      closed: closedTickets,
      highPriority: highPriorityTickets,
    },
    marketplace: {
      total: totalMarketplace,
      pending: pendingMarketplace,
      active: activeMarketplace,
    },
    plans: {
      total: totalPlans,
      active: activePlans,
    },
    recentActivity: {
      last24Hours: recentActivity24h,
      last7Days: recentActivity7d,
    },
    pendingActions: {
      totalPending: pendingSuppliers + pendingPackages + pendingPhotos + pendingMarketplace,
      breakdown: {
        suppliers: pendingSuppliers,
        packages: pendingPackages,
        photos: pendingPhotos,
        marketplace: pendingMarketplace,
      },
    },
  };
}

/**
 * GET /api/admin/dashboard/stats
 * Get comprehensive dashboard statistics for admin overview
 */
router.get('/dashboard/stats', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const now = Date.now();

    // Return cached stats if still valid
    if (dashboardStatsCache && now - dashboardStatsCacheTime < DASHBOARD_STATS_CACHE_TTL) {
      return res.json(dashboardStatsCache);
    }

    // Calculate fresh stats using efficient counting
    const stats = await calculateDashboardStats();

    // Update cache
    dashboardStatsCache = stats;
    dashboardStatsCacheTime = now;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

/**
 * GET /api/admin/dashboard/recent-activity
 * Get recent admin activity for timeline view
 */
router.get('/dashboard/recent-activity', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const auditLogs = await dbUnified.read('audit_logs');

    // Sort by timestamp descending (newest first) and limit
    const recentLogs = auditLogs
      .sort((a, b) => {
        const aTime = new Date(a.timestamp).getTime();
        const bTime = new Date(b.timestamp).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);

    // Enrich with human-readable descriptions
    const enrichedLogs = recentLogs.map(log => ({
      ...log,
      description: formatActionDescription(log),
      timeAgo: getTimeAgo(log.timestamp),
    }));

    res.json({ activities: enrichedLogs });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// Helper function to format action descriptions
function formatActionDescription(log) {
  const action = log.action || '';
  const targetType = log.targetType || '';

  const actionMap = {
    user_suspended: `Suspended user`,
    user_unsuspended: `Unsuspended user`,
    user_verified: `Verified user`,
    user_banned: `Banned user`,
    supplier_approved: `Approved supplier`,
    supplier_rejected: `Rejected supplier`,
    package_approved: `Approved package`,
    package_rejected: `Rejected package`,
    photo_approved: `Approved photo`,
    photo_rejected: `Rejected photo`,
    marketplace_listing_approved: `Approved marketplace listing`,
    marketplace_listing_rejected: `Rejected marketplace listing`,
    BULK_PACKAGES_APPROVED: `Bulk approved packages`,
    BULK_PACKAGES_FEATURED: `Bulk featured packages`,
    BULK_USERS_VERIFIED: `Bulk verified users`,
    BULK_USERS_SUSPENDED: `Bulk suspended users`,
  };

  return actionMap[action] || `Performed ${action} on ${targetType}`;
}

// Helper function to get human-readable time ago
function getTimeAgo(timestamp) {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diff = now - time;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (days < 30) {
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else {
    return new Date(timestamp).toLocaleDateString();
  }
}

/**
 * GET /api/admin/users
 * List all users (without password hashes)
 */
router.get('/users', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const allUsers = await dbUnified.read('users');
    const users = (allUsers || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      verified: !!u.verified,
      marketingOptIn: !!u.marketingOptIn,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || null,
      subscription: u.subscription || { tier: 'free', status: 'active' },
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
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', items: [] });
  }
});

/**
 * GET /api/admin/users/search
 * Advanced user search with filtering
 * Query params: q (search term), role, verified, suspended, startDate, endDate, limit, offset
 */
router.get('/users/search', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const {
      q, // search term
      role,
      verified,
      suspended,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = req.query;

    const dbType = dbUnified.getDatabaseType();

    // For MongoDB, build a filter and use findWithOptions for efficient query
    if (dbType === 'mongodb') {
      // Build MongoDB filter
      const filter = {};

      if (role) {
        filter.role = role;
      }
      if (verified !== undefined) {
        filter.verified = verified === 'true';
      }
      if (suspended !== undefined) {
        filter.suspended = suspended === 'true';
      }
      if (q && q.trim()) {
        // Use MongoDB $or for text search
        const searchTerm = q.trim();
        filter.$or = [
          { email: { $regex: searchTerm, $options: 'i' } },
          { name: { $regex: searchTerm, $options: 'i' } },
        ];
      }

      // Date range filters
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate).toISOString();
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate).toISOString();
        }
      }

      // Get total count with filters
      const total = await dbUnified.count('users', filter);

      // Use findWithOptions with pagination and sorting
      const users = await dbUnified.findWithOptions('users', filter, {
        limit: parseInt(limit, 10),
        skip: parseInt(offset, 10),
        sort: { createdAt: -1 },
      });

      // Remove sensitive data
      const sanitizedUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        verified: !!u.verified,
        suspended: !!u.suspended,
        marketingOptIn: !!u.marketingOptIn,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt || null,
        subscription: u.subscription || { tier: 'free', status: 'active' },
      }));

      res.json({
        items: sanitizedUsers,
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: parseInt(offset, 10) + sanitizedUsers.length < total,
      });
    } else {
      // Fallback for local storage - load and filter in memory
      const allUsers = await dbUnified.read('users');

      // Apply filters
      let filteredUsers = allUsers;

      // Search term (email or name)
      if (q && q.trim()) {
        const searchTerm = q.trim().toLowerCase();
        filteredUsers = filteredUsers.filter(
          u =>
            (u.email && u.email.toLowerCase().includes(searchTerm)) ||
            (u.name && u.name.toLowerCase().includes(searchTerm))
        );
      }

      // Role filter
      if (role) {
        filteredUsers = filteredUsers.filter(u => u.role === role);
      }

      // Verified filter
      if (verified !== undefined) {
        const isVerified = verified === 'true' || verified === true;
        filteredUsers = filteredUsers.filter(u => !!u.verified === isVerified);
      }

      // Suspended filter
      if (suspended !== undefined) {
        const isSuspended = suspended === 'true' || suspended === true;
        filteredUsers = filteredUsers.filter(u => !!u.suspended === isSuspended);
      }

      // Date range filter
      if (startDate) {
        const start = new Date(startDate);
        filteredUsers = filteredUsers.filter(u => {
          const createdAt = new Date(u.createdAt);
          return createdAt >= start;
        });
      }

      if (endDate) {
        const end = new Date(endDate);
        filteredUsers = filteredUsers.filter(u => {
          const createdAt = new Date(u.createdAt);
          return createdAt <= end;
        });
      }

      // Sort by createdAt descending
      filteredUsers.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      // Apply pagination
      const total = filteredUsers.length;
      const startIndex = parseInt(offset, 10) || 0;
      const endIndex = startIndex + (parseInt(limit, 10) || 50);
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      // Remove sensitive data
      const sanitizedUsers = paginatedUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        verified: !!u.verified,
        suspended: !!u.suspended,
        marketingOptIn: !!u.marketingOptIn,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt || null,
        subscription: u.subscription || { tier: 'free', status: 'active' },
      }));

      res.json({
        items: sanitizedUsers,
        total,
        limit: parseInt(limit, 10) || 50,
        offset: parseInt(offset, 10) || 0,
        hasMore: endIndex < total,
      });
    }
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
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
  try {
    const users = read('users') || [];
    const suppliers = read('suppliers') || [];
    const plans = read('plans') || [];
    const msgs = read('messages') || [];
    const pkgs = read('packages') || [];
    const threads = read('threads') || [];
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
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      counts: {
        usersTotal: 0,
        usersByRole: {},
        suppliersTotal: 0,
        packagesTotal: 0,
        plansTotal: 0,
        messagesTotal: 0,
        threadsTotal: 0,
      },
    });
  }
});

/**
 * POST /api/admin/reset-demo
 * Reset demo data by clearing all collections and re-seeding
 */
router.post('/reset-demo', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.get('/suppliers', authRequired, roleRequired('admin'), async (_req, res) => {
  try {
    const raw = await dbUnified.read('suppliers');
    const items = raw.map(s => ({
      ...s,
      isPro: supplierIsProActiveFn ? supplierIsProActiveFn(s) : s.isPro,
      proExpiresAt: s.proExpiresAt || null,
    }));
    res.json({ items });
  } catch (error) {
    console.error('Error reading suppliers:', error);
    res.status(500).json({ error: 'Failed to load suppliers' });
  }
});

/**
 * GET /api/admin/suppliers/:id
 * Get details of a specific supplier
 */
router.get('/suppliers/:id', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const raw = await dbUnified.read('suppliers');
    const supplier = raw.find(s => s.id === req.params.id);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Add computed fields
    const enrichedSupplier = {
      ...supplier,
      isPro: supplierIsProActiveFn ? supplierIsProActiveFn(supplier) : supplier.isPro,
      proExpiresAt: supplier.proExpiresAt || null,
    };

    res.json({ supplier: enrichedSupplier });
  } catch (error) {
    console.error('Error reading supplier:', error);
    res.status(500).json({ error: 'Failed to load supplier' });
  }
});

/**
 * POST /api/admin/suppliers/:id/approve
 * Approve or reject a supplier
 */
router.post(
  '/suppliers/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const all = await dbUnified.read('suppliers');
      const i = all.findIndex(s => s.id === req.params.id);
      if (i < 0) {
        return res.status(404).json({ error: 'Not found' });
      }
      all[i].approved = !!(req.body && req.body.approved);
      await dbUnified.write('suppliers', all);
      res.json({ ok: true, supplier: all[i] });
    } catch (error) {
      console.error('Error approving supplier:', error);
      res.status(500).json({ error: 'Failed to approve supplier' });
    }
  }
);

/**
 * POST /api/admin/suppliers/:id/pro
 * Manage supplier Pro subscription
 */
router.post(
  '/suppliers/:id/pro',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { mode, duration } = req.body || {};
      const all = await dbUnified.read('suppliers');
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
          const users = await dbUnified.read('users');
          const u = users.find(u => u.id === s.ownerUserId);
          if (u) {
            u.isPro = !!s.isPro;
            await dbUnified.write('users', users);
          }
        }
      } catch (_e) {
        // ignore errors from user store
      }

      all[i] = s;
      await dbUnified.write('suppliers', all);

      const active = supplierIsProActiveFn ? supplierIsProActiveFn(s) : s.isPro;
      res.json({
        ok: true,
        supplier: {
          ...s,
          isPro: active,
          proExpiresAt: s.proExpiresAt || null,
        },
      });
    } catch (error) {
      console.error('Error updating supplier Pro status:', error);
      res.status(500).json({ error: 'Failed to update supplier Pro status' });
    }
  }
);

/**
 * POST /api/admin/suppliers/import-demo
 * Import demo suppliers from data/suppliers.json into the database
 * Idempotent: uses supplier ID as unique key (upsert behavior)
 */
router.post(
  '/suppliers/import-demo',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      // Read demo suppliers from JSON file
      const demoSuppliersPath = path.join(__dirname, '../data/suppliers.json');

      if (!fs.existsSync(demoSuppliersPath)) {
        return res.status(500).json({
          error: 'Demo suppliers file not found at data/suppliers.json',
        });
      }

      let demoSuppliers;
      try {
        const fileContent = fs.readFileSync(demoSuppliersPath, 'utf8');
        demoSuppliers = JSON.parse(fileContent);
      } catch (parseError) {
        console.error('Error parsing suppliers.json:', parseError);
        return res.status(500).json({
          error: `Failed to parse demo suppliers file: ${parseError.message}`,
        });
      }

      if (!Array.isArray(demoSuppliers)) {
        return res.status(500).json({
          error: 'Invalid demo suppliers format: expected an array',
        });
      }

      // Get current suppliers from database
      const existingSuppliers = await dbUnified.read('suppliers');

      // Create a map of existing suppliers by ID for quick lookup with their indices
      const existingById = new Map();
      existingSuppliers.forEach((supplier, index) => {
        existingById.set(supplier.id, index);
      });

      let insertedCount = 0;
      let updatedCount = 0;

      // Process each demo supplier (idempotent upsert)
      for (const demoSupplier of demoSuppliers) {
        if (!demoSupplier.id) {
          console.warn('Skipping supplier without ID:', demoSupplier);
          continue;
        }

        const existingIndex = existingById.get(demoSupplier.id);
        if (existingIndex !== undefined) {
          // Update existing supplier
          existingSuppliers[existingIndex] = {
            ...existingSuppliers[existingIndex],
            ...demoSupplier,
            updatedAt: new Date().toISOString(),
          };
          updatedCount++;
        } else {
          // Insert new supplier
          existingSuppliers.push({
            ...demoSupplier,
            createdAt: demoSupplier.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          insertedCount++;
        }
      }

      // Write back to database
      await dbUnified.write('suppliers', existingSuppliers);

      // Create audit log using DATA_EXPORT action as it's the closest match for data import
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: AUDIT_ACTIONS.DATA_EXPORT,
        targetType: 'suppliers',
        targetId: 'demo-import',
        details: {
          imported: true,
          inserted: insertedCount,
          updated: updatedCount,
          total: demoSuppliers.length,
        },
      });

      res.json({
        ok: true,
        inserted: insertedCount,
        updated: updatedCount,
        total: demoSuppliers.length,
        message: `Successfully imported ${demoSuppliers.length} demo supplier(s): ${insertedCount} new, ${updatedCount} updated`,
      });
    } catch (error) {
      console.error('Error importing demo suppliers:', error);
      res.status(500).json({
        error: `Failed to import demo suppliers: ${error.message}`,
      });
    }
  }
);

/**
 * GET /api/admin/packages
 * List all packages for admin moderation
 */
router.get('/packages', authRequired, roleRequired('admin'), (_req, res) => {
  res.json({ items: read('packages') });
});

/**
 * Generate a URL-safe slug from a title
 * @param {string} title - The title to convert to a slug
 * @returns {string} URL-safe slug
 */
function generateSlug(title) {
  if (!title) {
    return '';
  }
  return String(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * POST /api/admin/packages
 * Create a new package
 */
router.post('/packages', authRequired, roleRequired('admin'), csrfProtection, async (req, res) => {
  try {
    const { supplierId, title, description, price_display, image, approved, featured } = req.body;

    // Validate required fields
    if (!supplierId || !title) {
      return res.status(400).json({ error: 'Supplier ID and title are required' });
    }

    // Validate that supplier exists
    const suppliers = await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    const packages = await dbUnified.read('packages');
    const now = new Date().toISOString();

    // Generate slug from title
    const slug = generateSlug(title);
    if (!slug) {
      return res
        .status(400)
        .json({ error: 'Title must contain valid characters for slug generation' });
    }

    // Check if slug already exists
    const existingPackage = packages.find(p => p.slug === slug);
    if (existingPackage) {
      return res
        .status(400)
        .json({ error: 'A package with this title already exists. Please use a different title.' });
    }

    // Create new package
    const newPackage = {
      id: uid(),
      supplierId,
      title,
      slug,
      description: description || '',
      price_display: price_display || 'Contact for pricing',
      image: image || '/assets/images/placeholders/package-event.svg',
      approved: approved === true,
      featured: featured === true,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.id,
      versionHistory: [],
    };

    packages.push(newPackage);
    await dbUnified.write('packages', packages);

    // Create audit log
    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.PACKAGE_CREATED,
      targetType: 'package',
      targetId: newPackage.id,
      details: { packageTitle: newPackage.title },
    });

    res.status(201).json({ success: true, package: newPackage });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ error: 'Failed to create package' });
  }
});

/**
 * POST /api/admin/packages/:id/approve
 * Approve or reject a package
 */
router.post(
  '/packages/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
    const all = read('packages');
    const i = all.findIndex(p => p.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].approved = !!(req.body && req.body.approved);
    write('packages', all);
    res.json({ ok: true, package: all[i] });
  }
);

/**
 * POST /api/admin/packages/:id/feature
 * Feature or unfeature a package
 */
router.post(
  '/packages/:id/feature',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
    const all = read('packages');
    const i = all.findIndex(p => p.id === req.params.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    all[i].featured = !!(req.body && req.body.featured);
    write('packages', all);
    res.json({ ok: true, package: all[i] });
  }
);

/**
 * POST /api/admin/packages/bulk-approve
 * Bulk approve packages
 * Body: { packageIds: string[], approved: boolean }
 */
router.post(
  '/packages/bulk-approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { packageIds, approved = true } = req.body;

      if (!Array.isArray(packageIds) || packageIds.length === 0) {
        return res.status(400).json({ error: 'packageIds must be a non-empty array' });
      }

      // Limit batch size to prevent overload
      const MAX_BATCH_SIZE = 100;
      if (packageIds.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
          error: `Batch size cannot exceed ${MAX_BATCH_SIZE} items`,
        });
      }

      const packages = await dbUnified.read('packages');
      let updatedCount = 0;

      packageIds.forEach(packageId => {
        const index = packages.findIndex(p => p.id === packageId);
        if (index >= 0) {
          packages[index].approved = !!approved;
          packages[index].updatedAt = new Date().toISOString();
          packages[index].approvedBy = req.user.id;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await dbUnified.write('packages', packages);
      }

      // Create audit log
      await auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: approved ? 'BULK_PACKAGES_APPROVED' : 'BULK_PACKAGES_REJECTED',
        targetType: 'packages',
        targetId: 'bulk',
        details: { packageIds, count: updatedCount, approved },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Successfully ${approved ? 'approved' : 'rejected'} ${updatedCount} package(s)`,
        updatedCount,
      });
    } catch (error) {
      console.error('Error bulk approving packages:', error);
      res.status(500).json({ error: 'Failed to bulk approve packages' });
    }
  }
);

/**
 * POST /api/admin/packages/bulk-feature
 * Bulk feature/unfeature packages
 * Body: { packageIds: string[], featured: boolean }
 */
router.post(
  '/packages/bulk-feature',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { packageIds, featured = true } = req.body;

      if (!Array.isArray(packageIds) || packageIds.length === 0) {
        return res.status(400).json({ error: 'packageIds must be a non-empty array' });
      }

      const packages = await dbUnified.read('packages');
      let updatedCount = 0;

      packageIds.forEach(packageId => {
        const index = packages.findIndex(p => p.id === packageId);
        if (index >= 0) {
          packages[index].featured = !!featured;
          packages[index].updatedAt = new Date().toISOString();
          packages[index].featuredBy = req.user.id;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await dbUnified.write('packages', packages);
      }

      // Create audit log
      await auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: featured ? 'BULK_PACKAGES_FEATURED' : 'BULK_PACKAGES_UNFEATURED',
        targetType: 'packages',
        targetId: 'bulk',
        details: { packageIds, count: updatedCount, featured },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Successfully ${featured ? 'featured' : 'unfeatured'} ${updatedCount} package(s)`,
        updatedCount,
      });
    } catch (error) {
      console.error('Error bulk featuring packages:', error);
      res.status(500).json({ error: 'Failed to bulk feature packages' });
    }
  }
);

/**
 * POST /api/admin/packages/bulk-delete
 * Bulk delete packages
 * Body: { packageIds: string[] }
 */
router.post(
  '/packages/bulk-delete',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { packageIds } = req.body;

      if (!Array.isArray(packageIds) || packageIds.length === 0) {
        return res.status(400).json({ error: 'packageIds must be a non-empty array' });
      }

      // Limit batch size to prevent overload
      const MAX_BATCH_SIZE = 100;
      if (packageIds.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
          error: `Batch size cannot exceed ${MAX_BATCH_SIZE} items`,
        });
      }

      const packages = await dbUnified.read('packages');
      const initialCount = packages.length;

      // Filter out packages to delete
      const remainingPackages = packages.filter(p => !packageIds.includes(p.id));
      const deletedCount = initialCount - remainingPackages.length;

      if (deletedCount > 0) {
        await dbUnified.write('packages', remainingPackages);
      }

      // Create audit log
      await auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'BULK_PACKAGES_DELETED',
        targetType: 'packages',
        targetId: 'bulk',
        details: { packageIds, count: deletedCount },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Successfully deleted ${deletedCount} package(s)`,
        deletedCount,
      });
    } catch (error) {
      console.error('Error bulk deleting packages:', error);
      res.status(500).json({ error: 'Failed to bulk delete packages' });
    }
  }
);

// ---------- User Management ----------

/**
 * POST /api/admin/users/:id/suspend
 * Suspend or unsuspend a user account
 * Body: { suspended: boolean, reason: string, duration: string }
 */
router.post(
  '/users/:id/suspend',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

/**
 * POST /api/admin/users/:id/ban
 * Ban or unban a user permanently
 * Body: { banned: boolean, reason: string }
 */
router.post('/users/:id/ban', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.post(
  '/users/:id/verify',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

/**
 * POST /api/admin/users/:id/force-reset
 * Force a password reset for a user
 */
router.post(
  '/users/:id/force-reset',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
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

    // Send password reset email via Postmark BEFORE saving changes
    try {
      console.log(`📧 Admin ${req.user.email} initiating password reset for ${user.email}`);
      await postmark.sendPasswordResetEmail(user, resetToken);
      console.log(`✅ Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError.message);

      // If email fails, don't update user record
      return res.status(500).json({
        error: 'Failed to send password reset email',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
      });
    }

    // Only save changes after email is successfully sent
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
      details: { email: user.email, forced: true, emailSent: true },
    });

    res.json({
      message: 'Password reset email sent successfully',
      user: {
        id: user.id,
        email: user.email,
      },
    });
  }
);

/**
 * POST /api/admin/users/bulk-verify
 * Bulk verify user emails
 * Body: { userIds: string[] }
 */
router.post(
  '/users/bulk-verify',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { userIds } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds must be a non-empty array' });
      }

      const users = await dbUnified.read('users');
      const now = new Date().toISOString();
      let verifiedCount = 0;
      let alreadyVerifiedCount = 0;

      userIds.forEach(userId => {
        const index = users.findIndex(u => u.id === userId);
        if (index >= 0 && !users[index].verified) {
          users[index].verified = true;
          users[index].verifiedAt = now;
          users[index].verifiedBy = req.user.id;
          users[index].verificationToken = null;
          users[index].updatedAt = now;
          verifiedCount++;
        } else if (index >= 0 && users[index].verified) {
          alreadyVerifiedCount++;
        }
      });

      if (verifiedCount > 0) {
        await dbUnified.write('users', users);
      }

      // Create audit log
      await auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'BULK_USERS_VERIFIED',
        targetType: 'users',
        targetId: 'bulk',
        details: { userIds, verifiedCount, alreadyVerifiedCount },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Successfully verified ${verifiedCount} user(s)`,
        verifiedCount,
        alreadyVerifiedCount,
        totalRequested: userIds.length,
      });
    } catch (error) {
      console.error('Error bulk verifying users:', error);
      res.status(500).json({ error: 'Failed to bulk verify users' });
    }
  }
);

/**
 * POST /api/admin/users/bulk-suspend
 * Bulk suspend users
 * Body: { userIds: string[], suspended: boolean, reason: string, duration: string }
 */
router.post(
  '/users/bulk-suspend',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { userIds, suspended = true, reason, duration } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds must be a non-empty array' });
      }

      const users = await dbUnified.read('users');
      const now = new Date().toISOString();
      let updatedCount = 0;

      userIds.forEach(userId => {
        const index = users.findIndex(u => u.id === userId);
        if (index >= 0 && users[index].id !== req.user.id) {
          // Don't allow admins to suspend themselves
          users[index].suspended = !!suspended;
          users[index].suspendedAt = suspended ? now : null;
          users[index].suspendedBy = suspended ? req.user.id : null;
          users[index].suspensionReason = suspended ? reason || 'Bulk suspension' : null;
          users[index].suspensionDuration = suspended ? duration : null;
          users[index].updatedAt = now;

          // Calculate expiry if duration is provided
          if (suspended && duration) {
            const durationMs = parseDuration(duration);
            if (durationMs > 0) {
              const expiryDate = new Date(Date.now() + durationMs);
              users[index].suspensionExpiresAt = expiryDate.toISOString();
            }
          } else {
            users[index].suspensionExpiresAt = null;
          }

          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await dbUnified.write('users', users);
      }

      // Create audit log
      await auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: suspended ? 'BULK_USERS_SUSPENDED' : 'BULK_USERS_UNSUSPENDED',
        targetType: 'users',
        targetId: 'bulk',
        details: { userIds, count: updatedCount, reason, duration },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        message: `Successfully ${suspended ? 'suspended' : 'unsuspended'} ${updatedCount} user(s)`,
        updatedCount,
        totalRequested: userIds.length,
      });
    } catch (error) {
      console.error('Error bulk suspending users:', error);
      res.status(500).json({ error: 'Failed to bulk suspend users' });
    }
  }
);

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
 * POST /api/admin/suppliers/:id/verify
 * Verify a supplier account
 * Body: { verified: boolean, verificationNotes: string }
 */
router.post(
  '/suppliers/:id/verify',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { verified, verificationNotes } = req.body;
      const suppliers = await dbUnified.read('suppliers');
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
      await dbUnified.write('suppliers', suppliers);

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
    } catch (error) {
      console.error('Error verifying supplier:', error);
      res.status(500).json({ error: 'Failed to verify supplier' });
    }
  }
);

/**
 * POST /api/admin/suppliers/:id/subscription
 * Grant or update a supplier's subscription
 * Body: { tier: 'pro' | 'pro_plus', days: number }
 */
router.post(
  '/suppliers/:id/subscription',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { tier, days } = req.body;
      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === req.params.id);

      if (supplierIndex < 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      if (!tier || !['pro', 'pro_plus'].includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be "pro" or "pro_plus"' });
      }

      if (!days || days <= 0) {
        return res.status(400).json({ error: 'Invalid duration. Must be positive number of days' });
      }

      const supplier = suppliers[supplierIndex];
      const now = new Date().toISOString();
      const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      // Update subscription
      supplier.subscription = {
        tier: tier,
        status: 'active',
        startDate: now,
        endDate: expiryDate,
        grantedBy: req.user.id,
        grantedAt: now,
        autoRenew: false,
      };
      supplier.updatedAt = now;

      // Backward compatibility
      supplier.isPro = true;
      supplier.proPlan = tier === 'pro_plus' ? 'Pro+' : 'Pro';
      supplier.proPlanExpiry = expiryDate;

      suppliers[supplierIndex] = supplier;
      await dbUnified.write('suppliers', suppliers);

      // Create audit log with specific action
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'subscription_granted',
        targetType: 'supplier',
        targetId: supplier.id,
        details: {
          name: supplier.name,
          tier: tier,
          days: days,
          expiryDate: expiryDate,
        },
      });

      res.json({
        message: `${tier === 'pro_plus' ? 'Pro+' : 'Pro'} subscription granted successfully`,
        supplier: {
          id: supplier.id,
          name: supplier.name,
          subscription: supplier.subscription,
        },
      });
    } catch (error) {
      console.error('Error granting subscription:', error);
      res.status(500).json({ error: 'Failed to grant subscription' });
    }
  }
);

/**
 * DELETE /api/admin/suppliers/:id/subscription
 * Remove a supplier's subscription
 */
router.delete(
  '/suppliers/:id/subscription',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === req.params.id);

      if (supplierIndex < 0) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const supplier = suppliers[supplierIndex];
      const now = new Date().toISOString();

      // Remove subscription
      supplier.subscription = {
        tier: 'free',
        status: 'cancelled',
        cancelledAt: now,
        cancelledBy: req.user.id,
      };
      supplier.updatedAt = now;

      // Backward compatibility
      supplier.isPro = false;
      supplier.proPlan = null;
      supplier.proPlanExpiry = null;

      suppliers[supplierIndex] = supplier;
      await dbUnified.write('suppliers', suppliers);

      // Create audit log with specific action
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'subscription_removed',
        targetType: 'supplier',
        targetId: supplier.id,
        details: {
          name: supplier.name,
        },
      });

      res.json({
        message: 'Subscription removed successfully',
        supplier: {
          id: supplier.id,
          name: supplier.name,
          subscription: supplier.subscription,
        },
      });
    } catch (error) {
      console.error('Error removing subscription:', error);
      res.status(500).json({ error: 'Failed to remove subscription' });
    }
  }
);

/**
 * GET /api/admin/suppliers/pending-verification
 * Get suppliers awaiting verification
 */
router.get(
  '/suppliers/pending-verification',
  authRequired,
  roleRequired('admin'),
  async (req, res) => {
    try {
      const suppliers = await dbUnified.read('suppliers');
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
      console.error('Error fetching pending suppliers:', error);
      res.status(500).json({ error: 'Failed to fetch pending suppliers' });
    }
  }
);

/**
 * POST /api/admin/suppliers/bulk-approve
 * Bulk approve suppliers
 * Body: { supplierIds: string[] }
 */
router.post(
  '/suppliers/bulk-approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierIds } = req.body;

      if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
        return res.status(400).json({ error: 'supplierIds must be a non-empty array' });
      }

      // Limit batch size to prevent overload
      const MAX_BATCH_SIZE = 100;
      if (supplierIds.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
          error: `Batch size cannot exceed ${MAX_BATCH_SIZE} items`,
        });
      }

      const suppliers = await dbUnified.read('suppliers');
      let updatedCount = 0;

      supplierIds.forEach(supplierId => {
        const index = suppliers.findIndex(s => s.id === supplierId);
        if (index >= 0) {
          suppliers[index].approved = true;
          suppliers[index].updatedAt = new Date().toISOString();
          suppliers[index].approvedBy = req.user.id;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await dbUnified.write('suppliers', suppliers);
      }

      // Create audit log
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'BULK_SUPPLIERS_APPROVED',
        targetType: 'suppliers',
        targetId: 'bulk',
        details: { supplierIds, count: updatedCount },
      });

      res.json({
        success: true,
        message: `Successfully approved ${updatedCount} supplier(s)`,
        updatedCount,
      });
    } catch (error) {
      console.error('Error bulk approving suppliers:', error);
      res.status(500).json({ error: 'Failed to bulk approve suppliers' });
    }
  }
);

/**
 * POST /api/admin/suppliers/bulk-reject
 * Bulk reject suppliers
 * Body: { supplierIds: string[] }
 */
router.post(
  '/suppliers/bulk-reject',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierIds } = req.body;

      if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
        return res.status(400).json({ error: 'supplierIds must be a non-empty array' });
      }

      // Limit batch size to prevent overload
      const MAX_BATCH_SIZE = 100;
      if (supplierIds.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
          error: `Batch size cannot exceed ${MAX_BATCH_SIZE} items`,
        });
      }

      const suppliers = await dbUnified.read('suppliers');
      let updatedCount = 0;

      supplierIds.forEach(supplierId => {
        const index = suppliers.findIndex(s => s.id === supplierId);
        if (index >= 0) {
          suppliers[index].approved = false;
          suppliers[index].rejected = true;
          suppliers[index].updatedAt = new Date().toISOString();
          suppliers[index].rejectedBy = req.user.id;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await dbUnified.write('suppliers', suppliers);
      }

      // Create audit log
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'BULK_SUPPLIERS_REJECTED',
        targetType: 'suppliers',
        targetId: 'bulk',
        details: { supplierIds, count: updatedCount },
      });

      res.json({
        success: true,
        message: `Successfully rejected ${updatedCount} supplier(s)`,
        updatedCount,
      });
    } catch (error) {
      console.error('Error bulk rejecting suppliers:', error);
      res.status(500).json({ error: 'Failed to bulk reject suppliers' });
    }
  }
);

/**
 * POST /api/admin/suppliers/bulk-delete
 * Bulk delete suppliers
 * Body: { supplierIds: string[] }
 */
router.post(
  '/suppliers/bulk-delete',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { supplierIds } = req.body;

      if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
        return res.status(400).json({ error: 'supplierIds must be a non-empty array' });
      }

      // Limit batch size to prevent overload
      const MAX_BATCH_SIZE = 100;
      if (supplierIds.length > MAX_BATCH_SIZE) {
        return res.status(400).json({
          error: `Batch size cannot exceed ${MAX_BATCH_SIZE} items`,
        });
      }

      const suppliers = await dbUnified.read('suppliers');
      const initialCount = suppliers.length;

      // Filter out suppliers to delete
      const remainingSuppliers = suppliers.filter(s => !supplierIds.includes(s.id));
      const deletedCount = initialCount - remainingSuppliers.length;

      if (deletedCount > 0) {
        await dbUnified.write('suppliers', remainingSuppliers);

        // Also delete associated packages
        const packages = await dbUnified.read('packages');
        const remainingPackages = packages.filter(p => !supplierIds.includes(p.supplierId));
        if (remainingPackages.length < packages.length) {
          await dbUnified.write('packages', remainingPackages);
        }
      }

      // Create audit log
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'BULK_SUPPLIERS_DELETED',
        targetType: 'suppliers',
        targetId: 'bulk',
        details: { supplierIds, count: deletedCount },
      });

      res.json({
        success: true,
        message: `Successfully deleted ${deletedCount} supplier(s) and their associated packages`,
        deletedCount,
      });
    } catch (error) {
      console.error('Error bulk deleting suppliers:', error);
      res.status(500).json({ error: 'Failed to bulk delete suppliers' });
    }
  }
);

/**
 * PUT /api/admin/packages/:id
 * Edit package details (admin only)
 */
router.put('/packages/:id', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    price,
    price_display,
    image,
    approved,
    featured,
    features,
    availability,
    status,
    scheduledPublishAt,
  } = req.body;

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
    // Regenerate slug if title changes
    const newSlug = generateSlug(title);
    if (newSlug && newSlug !== pkg.slug) {
      // Check if new slug is already taken
      const existingPackage = packages.find((p, idx) => idx !== pkgIndex && p.slug === newSlug);
      if (existingPackage) {
        return res.status(400).json({
          error: 'A package with this title already exists. Please use a different title.',
        });
      }
      pkg.slug = newSlug;
    }
  }
  if (description !== undefined) {
    pkg.description = description;
  }
  if (price !== undefined) {
    pkg.price = price;
  }
  if (price_display !== undefined) {
    pkg.price_display = price_display;
  }
  if (image !== undefined) {
    pkg.image = image;
  }
  if (approved !== undefined) {
    pkg.approved = approved;
  }
  if (featured !== undefined) {
    pkg.featured = featured;
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
router.put(
  '/suppliers/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, contact, categories, amenities, location, serviceAreas } =
        req.body;

      const suppliers = await dbUnified.read('suppliers');
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
      await dbUnified.write('suppliers', suppliers);

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
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  }
);

/**
 * PUT /api/admin/users/:id
 * Edit user profile (admin only)
 */
router.put('/users/:id', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
    // eslint-disable-next-line no-unused-vars
    password: _password,
    // eslint-disable-next-line no-unused-vars
    passwordHash: _passwordHash,
    // eslint-disable-next-line no-unused-vars
    resetToken: _resetToken,
    // eslint-disable-next-line no-unused-vars
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
router.delete('/users/:id', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.delete(
  '/suppliers/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === id);

      if (supplierIndex === -1) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      const supplier = suppliers[supplierIndex];

      // Remove the supplier
      suppliers.splice(supplierIndex, 1);
      await dbUnified.write('suppliers', suppliers);

      // Also delete associated packages
      const packages = await dbUnified.read('packages');
      const updatedPackages = packages.filter(p => p.supplierId !== id);
      if (updatedPackages.length < packages.length) {
        await dbUnified.write('packages', updatedPackages);
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
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ error: 'Failed to delete supplier' });
    }
  }
);

/**
 * DELETE /api/admin/packages/:id
 * Delete a package (admin only)
 */
router.delete('/packages/:id', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.post(
  '/users/:id/grant-admin',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

/**
 * POST /api/admin/users/:id/revoke-admin
 * Revoke admin privileges from a user
 */
router.post(
  '/users/:id/revoke-admin',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
      return res
        .status(403)
        .json({ error: 'Cannot revoke admin privileges from the owner account' });
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
  }
);

// ---------- Photo Moderation ----------

/**
 * GET /api/admin/photos/pending
 * Get all photos pending approval
 */
router.get('/photos/pending', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const photos = await dbUnified.read('photos');
    const pendingPhotos = photos.filter(p => p.status === 'pending');

    // Enrich with supplier information
    const suppliers = await dbUnified.read('suppliers');
    const enrichedPhotos = pendingPhotos.map(photo => {
      const supplier = suppliers.find(s => s.id === photo.supplierId);
      return {
        ...photo,
        supplierName: supplier ? supplier.name : 'Unknown',
        supplierCategory: supplier ? supplier.category : null,
      };
    });

    res.json({ photos: enrichedPhotos });
  } catch (error) {
    console.error('Error fetching pending photos:', error);
    res.status(500).json({ error: 'Failed to fetch pending photos' });
  }
});

/**
 * POST /api/admin/photos/:id/approve
 * Approve a photo
 */
router.post(
  '/photos/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const photos = await dbUnified.read('photos');
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
      await dbUnified.write('photos', photos);

      // Add photo to supplier's photos array if not already there
      const suppliers = await dbUnified.read('suppliers');
      const supplierIndex = suppliers.findIndex(s => s.id === photo.supplierId);

      if (supplierIndex !== -1) {
        if (!suppliers[supplierIndex].photos) {
          suppliers[supplierIndex].photos = [];
        }
        if (!suppliers[supplierIndex].photos.includes(photo.url)) {
          suppliers[supplierIndex].photos.push(photo.url);
          await dbUnified.write('suppliers', suppliers);
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
    } catch (error) {
      console.error('Error approving photo:', error);
      res.status(500).json({ error: 'Failed to approve photo' });
    }
  }
);

/**
 * POST /api/admin/photos/:id/reject
 * Reject a photo
 */
router.post(
  '/photos/:id/reject',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const photos = await dbUnified.read('photos');
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
      await dbUnified.write('photos', photos);

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
    } catch (error) {
      console.error('Error rejecting photo:', error);
      res.status(500).json({ error: 'Failed to reject photo' });
    }
  }
);

// ---------- Smart Tagging ----------

/**
 * POST /api/admin/suppliers/smart-tags
 * Generate smart tags for all suppliers based on their descriptions and categories
 *
 * Smart tagging logic:
 * 1. Only processes approved suppliers
 * 2. Combines supplier name, descriptions, category, and amenities into searchable text
 * 3. Applies three types of tags:
 *    - Category-based tags: Direct mapping from supplier category (e.g., "Venues" -> venue, location, space)
 *    - Context-based tags: Keywords found in supplier text (e.g., "wedding", "luxury", "outdoor")
 *    - Location-based tags: Extracts words from location field (min 4 characters)
 * 4. Limits each supplier to 10 tags maximum to avoid overwhelming the system
 * 5. Creates an audit log entry tracking how many suppliers were tagged
 */
router.post(
  '/suppliers/smart-tags',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const suppliers = await dbUnified.read('suppliers');
      let taggedCount = 0;

      // Common wedding/event industry tags mapped to supplier categories
      // These tags are automatically applied based on the supplier's category field
      const tagMapping = {
        venues: ['venue', 'location', 'space', 'ceremony', 'reception'],
        catering: ['food', 'catering', 'menu', 'dining', 'buffet', 'meal'],
        photography: ['photo', 'photography', 'photographer', 'camera', 'pictures'],
        entertainment: ['music', 'band', 'dj', 'entertainment', 'performance'],
        flowers: ['flowers', 'floral', 'bouquet', 'decoration', 'decor'],
        transport: ['transport', 'car', 'vehicle', 'limousine', 'travel'],
        extras: ['extras', 'accessories', 'favors', 'gifts'],
      };

      // Context-based tags that are applied when keywords are found in supplier text
      // Key = tag to add, Value = array of keywords that trigger the tag
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
        // Skip unapproved suppliers - only tag suppliers that are live on the platform
        if (!supplier.approved) {
          return;
        }

        const tags = new Set(); // Use Set to automatically handle duplicates

        // Combine all searchable text from supplier profile
        const text = [
          supplier.name || '',
          supplier.description_short || '',
          supplier.description_long || '',
          supplier.category || '',
          ...(supplier.amenities || []),
        ]
          .join(' ')
          .toLowerCase();

        // Step 1: Add category-based tags
        // Normalize category name (remove spaces/special chars) to match mapping keys
        const categoryKey = (supplier.category || '').toLowerCase().replace(/[^a-z]/g, '');
        if (tagMapping[categoryKey]) {
          tagMapping[categoryKey].forEach(tag => tags.add(tag));
        }

        // Step 2: Add context-based tags by scanning text for keywords
        Object.entries(contextTags).forEach(([tag, keywords]) => {
          // If ANY keyword is found in the text, add the tag
          if (keywords.some(keyword => text.includes(keyword))) {
            tags.add(tag);
          }
        });

        // Step 3: Add location-based tags
        // Extract meaningful words from location (min 4 chars to avoid "UK", "NY", etc.)
        if (supplier.location) {
          const locationWords = supplier.location.toLowerCase().split(/[,\s]+/);
          locationWords.forEach(word => {
            if (word.length > 3) {
              tags.add(word);
            }
          });
        }

        // Only update supplier if we generated at least one tag
        if (tags.size > 0) {
          suppliers[index].tags = Array.from(tags).slice(0, 10); // Limit to 10 tags per supplier
          taggedCount++;
        }
      });

      await dbUnified.write('suppliers', suppliers);

      // Create audit log for tracking when tags were generated
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
    } catch (error) {
      console.error('Error generating smart tags:', error);
      res.status(500).json({ error: 'Failed to generate smart tags', details: error.message });
    }
  }
);

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
 * Get counts for sidebar badges (pending items for admin review)
 * Returns: pending suppliers, packages, photos, reviews, reports, and totals
 */
router.get('/badge-counts', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    // Use efficient counting instead of loading full collections
    const [
      pendingSuppliers,
      pendingPackages,
      pendingReviews,
      pendingReports,
      totalSuppliers,
      totalPackages,
      totalReviews,
      totalReports,
    ] = await Promise.all([
      dbUnified.count('suppliers', { approved: false }),
      dbUnified.count('packages', { approved: false }),
      dbUnified.count('reviews', { status: 'pending' }),
      dbUnified.count('reports', { status: 'pending' }),
      dbUnified.count('suppliers'),
      dbUnified.count('packages'),
      dbUnified.count('reviews'),
      dbUnified.count('reports'),
    ]);

    // Note: pendingPhotos requires special handling since photos are nested
    // in suppliers.photosGallery - need to load suppliers for this count
    let pendingPhotos = 0;
    const dbType = dbUnified.getDatabaseType();

    if (dbType === 'mongodb') {
      // For MongoDB, we could use aggregation, but for simplicity and to avoid
      // complex aggregation logic for nested arrays, we'll keep loading suppliers
      const suppliers = await dbUnified.read('suppliers');
      const packages = await dbUnified.read('packages');

      suppliers.forEach(supplier => {
        if (supplier.photosGallery && Array.isArray(supplier.photosGallery)) {
          pendingPhotos += supplier.photosGallery.filter(p => !p.approved).length;
        }
      });

      packages.forEach(pkg => {
        if (pkg.gallery && Array.isArray(pkg.gallery)) {
          pendingPhotos += pkg.gallery.filter(p => !p.approved).length;
        }
      });
    } else {
      // Local storage fallback
      const suppliers = await dbUnified.read('suppliers');
      const packages = await dbUnified.read('packages');

      suppliers.forEach(supplier => {
        if (supplier.photosGallery && Array.isArray(supplier.photosGallery)) {
          pendingPhotos += supplier.photosGallery.filter(p => !p.approved).length;
        }
      });

      packages.forEach(pkg => {
        if (pkg.gallery && Array.isArray(pkg.gallery)) {
          pendingPhotos += pkg.gallery.filter(p => !p.approved).length;
        }
      });
    }

    res.json({
      pending: {
        suppliers: pendingSuppliers,
        packages: pendingPackages,
        photos: pendingPhotos,
        reviews: pendingReviews,
        reports: pendingReports,
      },
      totals: {
        suppliers: totalSuppliers,
        packages: totalPackages,
        reviews: totalReviews,
        reports: totalReports,
      },
    });
  } catch (error) {
    console.error('Error fetching badge counts:', error);
    // Return zeroed counts instead of crashing
    res.status(500).json({
      error: 'Failed to fetch badge counts',
      pending: {
        suppliers: 0,
        packages: 0,
        photos: 0,
        reviews: 0,
        reports: 0,
      },
      totals: {
        suppliers: 0,
        packages: 0,
        reviews: 0,
        reports: 0,
      },
    });
  }
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
  // eslint-disable-next-line no-unused-vars
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

/**
 * POST /api/admin/users/:id/reset-password
 * Send password reset email to user
 */
router.post(
  '/users/:id/reset-password',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const users = read('users');
    const userIndex = users.findIndex(u => u.id === req.params.id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[userIndex];

    // Generate reset token
    const token = uid('reset');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Send password reset email via Postmark BEFORE saving token
    try {
      console.log(`📧 Admin ${req.user.email} sending password reset to ${user.email}`);
      await postmark.sendPasswordResetEmail(user, token);
      console.log(`✅ Password reset email sent to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError.message);

      // Log the failure in audit log
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
        targetType: 'user',
        targetId: user.id,
        details: { userEmail: user.email, emailSent: false, error: emailError.message },
      });

      return res.status(500).json({
        error: 'Failed to send password reset email',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
      });
    }

    // Only save reset token after email is successfully sent
    users[userIndex].resetToken = token;
    users[userIndex].resetTokenExpiresAt = expires;
    write('users', users);

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
  }
);

/**
 * POST /api/admin/users/:id/unsuspend
 * Unsuspend a user
 */
router.post(
  '/users/:id/unsuspend',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

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
router.put('/content/homepage', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.post(
  '/content/announcements',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

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
router.put(
  '/content/announcements/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

/**
 * DELETE /api/admin/content/announcements/:id
 * Delete an announcement
 */
router.delete(
  '/content/announcements/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

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
router.post('/content/faqs', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.put('/content/faqs/:id', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
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
router.delete(
  '/content/faqs/:id',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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
  }
);

// ---------- System Settings ----------

/**
 * GET /api/admin/settings/site
 * Get site configuration
 */
router.get('/settings/site', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const site = settings.site || {
      name: 'EventFlow',
      tagline: 'Event planning made simple',
      contactEmail: 'hello@eventflow.com',
      supportEmail: 'support@eventflow.com',
    };
    res.json(site);
  } catch (error) {
    console.error('Error reading site settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

/**
 * PUT /api/admin/settings/site
 * Update site configuration
 */
router.put(
  '/settings/site',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { name, tagline, contactEmail, supportEmail } = req.body;

      const settings = (await dbUnified.read('settings')) || {};
      settings.site = {
        name: name || 'EventFlow',
        tagline: tagline || 'Event planning made simple',
        contactEmail: contactEmail || 'hello@eventflow.com',
        supportEmail: supportEmail || 'support@eventflow.com',
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.email,
      };

      const writeSuccess = await dbUnified.write('settings', settings);

      if (!writeSuccess) {
        console.error('Failed to persist site settings to database');
        return res.status(500).json({ error: 'Failed to persist settings to database' });
      }

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'SETTINGS_UPDATED',
        targetType: 'site',
        targetId: null,
        details: { name, tagline },
      });

      res.json({ success: true, site: settings.site });
    } catch (error) {
      console.error('Error updating site settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

/**
 * GET /api/admin/settings/features
 * Get feature flags
 */
router.get('/settings/features', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const features = settings.features || {
      registration: true,
      supplierApplications: true,
      reviews: true,
      photoUploads: true,
      supportTickets: true,
      pexelsCollage: false,
    };

    // Ensure metadata fields are included in response
    // If they don't exist (older data), keep them undefined so frontend can handle gracefully
    const response = {
      registration: features.registration !== false,
      supplierApplications: features.supplierApplications !== false,
      reviews: features.reviews !== false,
      photoUploads: features.photoUploads !== false,
      supportTickets: features.supportTickets !== false,
      pexelsCollage: features.pexelsCollage === true,
      updatedAt: features.updatedAt,
      updatedBy: features.updatedBy,
    };

    res.json(response);
  } catch (error) {
    console.error('Error reading feature settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

/**
 * PUT /api/admin/settings/features
 * Update feature flags with timeout protection
 */
router.put(
  '/settings/features',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    const startTime = Date.now();
    const requestId = `features-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    console.log(`[${requestId}] Starting feature flags update by ${req.user.email}`);

    try {
      const {
        registration,
        supplierApplications,
        reviews,
        photoUploads,
        supportTickets,
        pexelsCollage,
      } = req.body;

      console.log(`[${requestId}] Request body validated, reading current settings...`);

      // Helper function to create timeout promise
      const createTimeout = (ms, operation) => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms);
        });
      };

      // Read current settings with timeout
      const settings = await Promise.race([
        dbUnified.read('settings'),
        createTimeout(5000, 'Read operation'),
      ]).then(result => result || {});

      console.log(`[${requestId}] Current settings read in ${Date.now() - startTime}ms`);

      // Validate all request data (all should be boolean or undefined)
      const featureFlags = [
        'registration',
        'supplierApplications',
        'reviews',
        'photoUploads',
        'supportTickets',
        'pexelsCollage',
      ];

      for (const flag of featureFlags) {
        const value = req.body[flag];
        if (value !== undefined && typeof value !== 'boolean') {
          console.error(`[${requestId}] Invalid ${flag} value:`, value);
          return res.status(400).json({
            error: `Invalid feature flag value: ${flag} must be boolean`,
            field: flag,
          });
        }
      }

      const newFeatures = {
        registration: registration !== false,
        supplierApplications: supplierApplications !== false,
        reviews: reviews !== false,
        photoUploads: photoUploads !== false,
        supportTickets: supportTickets !== false,
        pexelsCollage: pexelsCollage === true,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.email,
      };

      settings.features = newFeatures;

      console.log(`[${requestId}] Writing new feature flags to database...`, {
        pexelsCollage: newFeatures.pexelsCollage,
        registration: newFeatures.registration,
      });

      // Write with timeout protection (new timeout promise)
      const writeStart = Date.now();
      const writeSuccess = await Promise.race([
        dbUnified.write('settings', settings),
        createTimeout(5000, 'Write operation'),
      ]);

      console.log(
        `[${requestId}] Database write completed in ${Date.now() - writeStart}ms, success: ${writeSuccess}`
      );

      if (!writeSuccess) {
        console.error(`[${requestId}] Failed to persist feature flags to database`);
        return res.status(500).json({
          error: 'Failed to persist settings to database',
          details: 'Database write returned false',
        });
      }

      // Log Pexels feature flag changes specifically
      if (pexelsCollage !== undefined) {
        console.log(
          `[${requestId}] Pexels collage feature flag ${pexelsCollage ? 'ENABLED' : 'DISABLED'} by ${req.user.email}`
        );
      }

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'FEATURES_UPDATED',
        targetType: 'features',
        targetId: null,
        details: settings.features,
      });

      const totalTime = Date.now() - startTime;
      console.log(`[${requestId}] Feature flags update completed successfully in ${totalTime}ms`);

      res.json({ success: true, features: settings.features });
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `[${requestId}] Error updating feature settings after ${totalTime}ms:`,
        error.message
      );
      console.error(`[${requestId}] Stack trace:`, error.stack);

      // Provide detailed error message based on error type
      if (error.message.includes('timed out')) {
        return res.status(504).json({
          error: 'Request timed out',
          details: 'Database operation took too long to complete. Please try again.',
          duration: totalTime,
        });
      }

      res.status(500).json({
        error: 'Failed to update settings',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        duration: totalTime,
      });
    }
  }
);

/**
 * GET /api/admin/settings/maintenance
 * Get maintenance mode settings
 */
router.get('/settings/maintenance', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const maintenance = settings.maintenance || {
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    };
    res.json(maintenance);
  } catch (error) {
    console.error('Error reading maintenance settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

/**
 * PUT /api/admin/settings/maintenance
 * Update maintenance mode settings
 */
router.put(
  '/settings/maintenance',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { enabled, message, duration } = req.body;

      const settings = (await dbUnified.read('settings')) || {};

      // Calculate expiration time if duration is provided and maintenance is being enabled
      let expiresAt = null;
      if (enabled && duration && Number(duration) > 0) {
        const durationMs = Number(duration) * 60 * 1000; // duration is in minutes
        expiresAt = new Date(Date.now() + durationMs).toISOString();
      }

      settings.maintenance = {
        enabled: enabled === true,
        message: message || "We're performing scheduled maintenance. We'll be back soon!",
        duration: duration ? Number(duration) : null, // Store duration in minutes
        expiresAt: expiresAt,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.email,
      };

      const writeSuccess = await dbUnified.write('settings', settings);

      if (!writeSuccess) {
        console.error('Failed to persist maintenance settings to database');
        return res.status(500).json({ error: 'Failed to persist settings to database' });
      }

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'MAINTENANCE_UPDATED',
        targetType: 'maintenance',
        targetId: null,
        details: { enabled, message, duration, expiresAt },
      });

      res.json({ success: true, maintenance: settings.maintenance });
    } catch (error) {
      console.error('Error updating maintenance settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

/**
 * GET /api/admin/settings/email-templates/:name
 * Get email template
 */
router.get(
  '/settings/email-templates/:name',
  authRequired,
  roleRequired('admin'),
  async (req, res) => {
    try {
      const settings = (await dbUnified.read('settings')) || {};
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
    } catch (error) {
      console.error('Error reading email template:', error);
      res.status(500).json({ error: 'Failed to read settings' });
    }
  }
);

/**
 * PUT /api/admin/settings/email-templates/:name
 * Update email template
 */
router.put(
  '/settings/email-templates/:name',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { subject, body } = req.body;

      if (!subject || !body) {
        return res.status(400).json({ error: 'Subject and body are required' });
      }

      const settings = (await dbUnified.read('settings')) || {};
      if (!settings.emailTemplates) {
        settings.emailTemplates = {};
      }

      settings.emailTemplates[req.params.name] = {
        subject,
        body,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.email,
      };

      const writeSuccess = await dbUnified.write('settings', settings);

      if (!writeSuccess) {
        console.error('Failed to persist email template to database');
        return res.status(500).json({ error: 'Failed to persist template to database' });
      }

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'EMAIL_TEMPLATE_UPDATED',
        targetType: 'email-template',
        targetId: req.params.name,
        details: { subject },
      });

      res.json({ success: true, template: settings.emailTemplates[req.params.name] });
    } catch (error) {
      console.error('Error updating email template:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

/**
 * POST /api/admin/settings/email-templates/:name/reset
 * Reset email template to default
 */
router.post(
  '/settings/email-templates/:name/reset',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const settings = (await dbUnified.read('settings')) || {};
      if (!settings.emailTemplates) {
        settings.emailTemplates = {};
      }

      // Remove the custom template, will fall back to default
      delete settings.emailTemplates[req.params.name];
      await dbUnified.write('settings', settings);

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'EMAIL_TEMPLATE_RESET',
        targetType: 'email-template',
        targetId: req.params.name,
        details: {},
      });

      res.json({ success: true, message: 'Template reset to default' });
    } catch (error) {
      console.error('Error resetting email template:', error);
      res.status(500).json({ error: 'Failed to reset template' });
    }
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

// ---------- Public API Endpoints ----------

/**
 * GET /api/public/features
 * Get feature flags status (public endpoint, no auth required)
 * Returns which features are enabled/disabled for frontend UI
 */
router.get('/public/features', async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const features = settings.features || {};

    res.json({
      registration: features.registration !== false,
      supplierApplications: features.supplierApplications !== false,
      reviews: features.reviews !== false,
      photoUploads: features.photoUploads !== false,
      supportTickets: features.supportTickets !== false,
      pexelsCollage: features.pexelsCollage === true,
    });
  } catch (error) {
    console.error('Error reading feature flags:', error);
    // Return all features enabled as fallback
    res.json({
      registration: true,
      supplierApplications: true,
      reviews: true,
      photoUploads: true,
      supportTickets: true,
      pexelsCollage: false,
    });
  }
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
router.put('/tickets/:id', authRequired, roleRequired('admin'), csrfProtection, (req, res) => {
  const tickets = read('tickets');
  const index = tickets.findIndex(t => t.id === req.params.id);

  if (index < 0) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const { status, priority, assignedTo } = req.body;
  const ticket = tickets[index];

  if (status) {
    ticket.status = status;
  }
  if (priority) {
    ticket.priority = priority;
  }
  if (assignedTo !== undefined) {
    ticket.assignedTo = assignedTo;
  }

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
router.post(
  '/tickets/:id/reply',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  (req, res) => {
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

    if (!ticket.replies) {
      ticket.replies = [];
    }
    ticket.replies.push(reply);
    ticket.updatedAt = new Date().toISOString();

    tickets[index] = ticket;
    write('tickets', tickets);

    res.json({ ticket });
  }
);

// ---------- Payments ----------

/**
 * GET /api/admin/payments
 * List all payments for admin analytics
 */
router.get('/payments', authRequired, roleRequired('admin'), (_req, res) => {
  const payments = read('payments');
  // Sort by createdAt descending (newest first)
  payments.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
  res.json({ items: payments });
});

/**
 * GET /api/admin/stripe-analytics
 * Get live Stripe analytics data for admin dashboard
 */
router.get('/stripe-analytics', authRequired, roleRequired('admin'), async (_req, res) => {
  if (!STRIPE_ENABLED || !stripe) {
    return res.json({
      error: 'Stripe not configured',
      available: false,
      message: 'Stripe analytics are not available. Using local payment data instead.',
    });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    // Fetch data from Stripe
    const [charges, subscriptions, customers, balance] = await Promise.all([
      stripe.charges.list({
        limit: 100,
        created: { gte: thirtyDaysAgo },
      }),
      stripe.subscriptions.list({
        limit: 100,
        status: 'active',
      }),
      stripe.customers.list({
        limit: 100,
        created: { gte: thirtyDaysAgo },
      }),
      stripe.balance.retrieve(),
    ]);

    // Calculate analytics
    const totalRevenue = charges.data.reduce((sum, charge) => {
      return sum + (charge.amount_captured || 0);
    }, 0);

    const monthRevenue = charges.data
      .filter(charge => charge.created >= thirtyDaysAgo)
      .reduce((sum, charge) => {
        return sum + (charge.amount_captured || 0);
      }, 0);

    const analytics = {
      available: true,
      totalRevenue: totalRevenue / 100, // Convert from pence to pounds
      monthRevenue: monthRevenue / 100,
      activeSubscriptions: subscriptions.data.length,
      totalCharges: charges.data.length,
      newCustomers: customers.data.length,
      availableBalance:
        balance.available && balance.available.length > 0 ? balance.available[0].amount / 100 : 0,
      pendingBalance:
        balance.pending && balance.pending.length > 0 ? balance.pending[0].amount / 100 : 0,
      currency:
        balance.available && balance.available.length > 0 ? balance.available[0].currency : 'gbp',
      recentCharges: charges.data.slice(0, 10).map(charge => ({
        id: charge.id,
        amount: charge.amount / 100,
        currency: charge.currency,
        status: charge.status,
        created: charge.created,
        description: charge.description,
        customer: charge.customer,
      })),
      subscriptionBreakdown: {
        active: subscriptions.data.filter(s => s.status === 'active').length,
        trialing: subscriptions.data.filter(s => s.status === 'trialing').length,
        past_due: subscriptions.data.filter(s => s.status === 'past_due').length,
      },
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching Stripe analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch Stripe analytics',
      available: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users/:userId/resend-verification
 * Admin: Resend verification email to a specific user
 */
router.post(
  '/users/:userId/resend-verification',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  auditMiddleware(AUDIT_ACTIONS.RESEND_VERIFICATION, req => ({
    targetType: 'user',
    targetId: req.params.userId,
  })),
  async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }

    const users = read('users');
    const idx = users.findIndex(u => u.id === userId);

    if (idx === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[idx];

    // Check if user is already verified
    if (user.verified === true) {
      return res.status(400).json({ error: 'User is already verified' });
    }

    // Generate new verification token with 24-hour expiration
    const verificationToken = uid('verify');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Send verification email via Postmark BEFORE saving token
    try {
      console.log(`📧 Admin ${req.user.email} resending verification email to ${user.email}`);
      await postmark.sendVerificationEmail(user, verificationToken);
      console.log(`✅ Verification email resent successfully to ${user.email}`);
    } catch (emailError) {
      console.error('❌ Failed to resend verification email:', emailError.message);
      return res.status(500).json({
        error: 'Failed to send verification email. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? emailError.message : undefined,
      });
    }

    // Only update token after email is successfully sent
    users[idx].verificationToken = verificationToken;
    users[idx].verificationTokenExpiresAt = tokenExpiresAt;
    write('users', users);

    res.json({
      ok: true,
      message: `Verification email sent to ${user.email}`,
    });
  }
);

// ---------- Audit Logs ----------

/**
 * GET /api/admin/audit-logs
 * Get audit logs with optional filtering (canonical endpoint)
 */
router.get('/audit-logs', authRequired, roleRequired('admin'), async (req, res) => {
  const { adminId, adminEmail, action, targetType, targetId, startDate, endDate, limit } =
    req.query;

  const filters = {};
  if (adminId) {
    filters.adminId = adminId;
  }
  if (adminEmail) {
    filters.adminEmail = adminEmail;
  }
  if (action) {
    filters.action = action;
  }
  if (targetType) {
    filters.targetType = targetType;
  }
  if (targetId) {
    filters.targetId = targetId;
  }
  if (startDate) {
    filters.startDate = startDate;
  }
  if (endDate) {
    filters.endDate = endDate;
  }
  if (limit) {
    filters.limit = parseInt(limit, 10);
  }

  const { getAuditLogs } = require('../middleware/audit');
  const logs = await getAuditLogs(filters);

  res.json({ logs, count: logs.length });
});

/**
 * GET /api/admin/audit
 * Get audit logs with optional filtering
 * Backwards compatible endpoint - returns same format as /api/admin/audit-logs
 */
router.get('/audit', authRequired, roleRequired('admin'), async (req, res) => {
  const { adminId, adminEmail, action, targetType, targetId, startDate, endDate, limit } =
    req.query;

  const filters = {};
  if (adminId) {
    filters.adminId = adminId;
  }
  if (adminEmail) {
    filters.adminEmail = adminEmail;
  }
  if (action) {
    filters.action = action;
  }
  if (targetType) {
    filters.targetType = targetType;
  }
  if (targetId) {
    filters.targetId = targetId;
  }
  if (startDate) {
    filters.startDate = startDate;
  }
  if (endDate) {
    filters.endDate = endDate;
  }
  if (limit) {
    filters.limit = parseInt(limit, 10);
  }

  const { getAuditLogs } = require('../middleware/audit');
  const logs = await getAuditLogs(filters);

  // Use standardized response format
  res.json({ logs, count: logs.length });
});

// ---------- Marketplace Admin ----------

/**
 * GET /api/admin/marketplace/listings
 * Get all marketplace listings (including pending) for admin moderation
 */
router.get('/marketplace/listings', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const listings = await dbUnified.read('marketplace_listings');
    const users = await dbUnified.read('users');

    // Enrich listings with user info
    const enrichedListings = listings.map(listing => {
      const user = users.find(u => u.id === listing.userId);
      return {
        ...listing,
        userEmail: user ? user.email : 'Unknown',
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown',
      };
    });

    res.json({ listings: enrichedListings });
  } catch (error) {
    console.error('Error fetching admin marketplace listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

/**
 * POST /api/admin/marketplace/listings/:id/approve
 * Approve or reject a marketplace listing
 */
router.post(
  '/marketplace/listings/:id/approve',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { approved } = req.body || {};
      const listings = await dbUnified.read('marketplace_listings');
      const listing = listings.find(l => l.id === req.params.id);

      if (!listing) {
        return res.status(404).json({ error: 'Listing not found' });
      }

      listing.approved = !!approved;
      listing.status = approved ? 'active' : 'pending';
      listing.updatedAt = new Date().toISOString();

      await dbUnified.write('marketplace_listings', listings);

      // Log audit using auditLog function
      await auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: approved ? 'marketplace_listing_approved' : 'marketplace_listing_rejected',
        targetType: 'marketplace_listing',
        targetId: listing.id,
        details: { listingTitle: listing.title, approved },
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
      });

      res.json({ ok: true, listing });
    } catch (error) {
      console.error('Error approving marketplace listing:', error);
      res.status(500).json({ error: 'Failed to approve listing' });
    }
  }
);

// ============================================
// COLLAGE WIDGET ENDPOINTS
// ============================================

/**
 * Configure multer for local collage media storage
 * Stores files in /public/uploads/homepage-collage/
 */
const collageUploadDir = path.join(__dirname, '../public/uploads/homepage-collage');

// Ensure upload directory exists
if (!fs.existsSync(collageUploadDir)) {
  fs.mkdirSync(collageUploadDir, { recursive: true });
}

const collageUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, collageUploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      cb(null, `collage-${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for videos
  },
  fileFilter: function (req, file, cb) {
    // Allow images and videos
    const allowedTypes = /^(image|video)\//;
    if (!allowedTypes.test(file.mimetype)) {
      cb(new Error('Only image and video files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/**
 * GET /api/admin/homepage/collage-widget
 * Get collage widget configuration
 */
router.get('/homepage/collage-widget', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const collageWidget = settings.collageWidget || {
      enabled: false,
      source: 'pexels',
      mediaTypes: { photos: true, videos: true },
      intervalSeconds: 2.5,
      pexelsQueries: {
        venues: 'wedding venue elegant ballroom',
        catering: 'wedding catering food elegant',
        entertainment: 'live band wedding party',
        photography: 'wedding photography professional',
      },
      pexelsVideoQueries: {
        venues: 'wedding venue video aerial',
        catering: 'catering food preparation video',
        entertainment: 'live band music performance video',
        photography: 'wedding videography cinematic',
      },
      uploadGallery: [],
      fallbackToPexels: true,
      heroVideo: {
        enabled: true,
        autoplay: true,
        muted: true,
        loop: true,
        quality: 'hd',
      },
      videoQuality: {
        preference: 'hd',
        adaptive: true,
        mobileOptimized: true,
      },
      transition: {
        effect: 'fade',
        duration: 1000,
      },
      preloading: {
        enabled: true,
        count: 3,
      },
      mobileOptimizations: {
        slowerTransitions: true,
        disableVideos: false,
        touchControls: true,
      },
      contentFiltering: {
        aspectRatio: 'any',
        orientation: 'any',
        minResolution: 'SD',
      },
      playbackControls: {
        showControls: false,
        pauseOnHover: true,
        fullscreen: false,
      },
    };

    res.json(collageWidget);
  } catch (error) {
    console.error('Error reading collage widget config:', error);
    res.status(500).json({ error: 'Failed to read collage widget configuration' });
  }
});

/**
 * PUT /api/admin/homepage/collage-widget
 * Update collage widget configuration
 */
router.put(
  '/homepage/collage-widget',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const {
        enabled,
        source,
        mediaTypes,
        intervalSeconds,
        pexelsQueries,
        pexelsVideoQueries,
        uploadGallery,
        fallbackToPexels,
        heroVideo,
        videoQuality,
        transition,
        preloading,
        mobileOptimizations,
        contentFiltering,
        playbackControls,
      } = req.body;

      // Validation
      if (enabled !== undefined && typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
      }

      if (source && !['pexels', 'uploads'].includes(source)) {
        return res.status(400).json({ error: 'source must be "pexels" or "uploads"' });
      }

      if (intervalSeconds !== undefined) {
        const interval = Number(intervalSeconds);
        if (isNaN(interval) || interval < 1 || interval > 60) {
          return res.status(400).json({ error: 'intervalSeconds must be between 1 and 60' });
        }
      }

      if (transition?.effect && !['fade', 'slide', 'zoom', 'crossfade'].includes(transition.effect)) {
        return res.status(400).json({ error: 'Invalid transition effect' });
      }

      if (preloading?.count !== undefined) {
        const count = Number(preloading.count);
        if (isNaN(count) || count < 0 || count > 5) {
          return res.status(400).json({ error: 'Preloading count must be between 0 and 5' });
        }
      }

      if (videoQuality?.preference && !['hd', 'sd', 'auto'].includes(videoQuality.preference)) {
        return res.status(400).json({ error: 'Invalid video quality preference' });
      }

      // Validate uploadGallery structure if provided
      if (uploadGallery !== undefined) {
        if (!Array.isArray(uploadGallery)) {
          return res.status(400).json({ error: 'uploadGallery must be an array' });
        }
        // Validate all items are non-empty strings
        const invalidItems = uploadGallery.filter(item => typeof item !== 'string' || !item.trim());
        if (invalidItems.length > 0) {
          return res
            .status(400)
            .json({ error: 'All uploadGallery items must be non-empty strings' });
        }
      }

      // Mutual exclusivity check - only validate if source is uploads AND enabled is true
      if (enabled && source === 'uploads' && (!uploadGallery || uploadGallery.length === 0)) {
        return res.status(400).json({
          error: 'Upload gallery cannot be empty when source is "uploads" and widget is enabled',
        });
      }

      const settings = (await dbUnified.read('settings')) || {};
      if (!settings.collageWidget) {
        settings.collageWidget = {};
      }

      // Update only provided fields
      if (enabled !== undefined) {
        settings.collageWidget.enabled = enabled;
      }
      if (source) {
        settings.collageWidget.source = source;
      }
      if (mediaTypes) {
        settings.collageWidget.mediaTypes = mediaTypes;
      }
      if (intervalSeconds !== undefined) {
        settings.collageWidget.intervalSeconds = intervalSeconds;
      }
      if (pexelsQueries) {
        settings.collageWidget.pexelsQueries = pexelsQueries;
      }
      if (pexelsVideoQueries) {
        settings.collageWidget.pexelsVideoQueries = pexelsVideoQueries;
      }
      if (uploadGallery) {
        settings.collageWidget.uploadGallery = uploadGallery;
      }
      if (fallbackToPexels !== undefined) {
        settings.collageWidget.fallbackToPexels = fallbackToPexels;
      }
      if (heroVideo !== undefined) {
        settings.collageWidget.heroVideo = { ...settings.collageWidget.heroVideo, ...heroVideo };
      }
      if (videoQuality !== undefined) {
        settings.collageWidget.videoQuality = { ...settings.collageWidget.videoQuality, ...videoQuality };
      }
      if (transition !== undefined) {
        settings.collageWidget.transition = { ...settings.collageWidget.transition, ...transition };
      }
      if (preloading !== undefined) {
        settings.collageWidget.preloading = { ...settings.collageWidget.preloading, ...preloading };
      }
      if (mobileOptimizations !== undefined) {
        settings.collageWidget.mobileOptimizations = { ...settings.collageWidget.mobileOptimizations, ...mobileOptimizations };
      }
      if (contentFiltering !== undefined) {
        settings.collageWidget.contentFiltering = { ...settings.collageWidget.contentFiltering, ...contentFiltering };
      }
      if (playbackControls !== undefined) {
        settings.collageWidget.playbackControls = { ...settings.collageWidget.playbackControls, ...playbackControls };
      }

      settings.collageWidget.updatedAt = new Date().toISOString();
      settings.collageWidget.updatedBy = req.user.email;

      await dbUnified.write('settings', settings);

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'COLLAGE_WIDGET_UPDATED',
        targetType: 'homepage',
        targetId: 'collage-widget',
        details: { enabled, source, mediaTypes },
      });

      res.json({
        success: true,
        collageWidget: settings.collageWidget,
      });
    } catch (error) {
      console.error('Error updating collage widget config:', error);
      res.status(500).json({ error: 'Failed to update collage widget configuration' });
    }
  }
);

/**
 * GET /api/admin/homepage/collage-media
 * List all uploaded collage media files
 */
router.get('/homepage/collage-media', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    if (!fs.existsSync(collageUploadDir)) {
      return res.json({ media: [] });
    }

    const files = fs.readdirSync(collageUploadDir);
    const media = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.mov'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(collageUploadDir, file);
        const stats = fs.statSync(filePath);
        const ext = path.extname(file).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);

        return {
          filename: file,
          url: `/uploads/homepage-collage/${file}`,
          type: isVideo ? 'video' : 'photo',
          size: stats.size,
          uploadedAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ media });
  } catch (error) {
    console.error('Error listing collage media:', error);
    res.status(500).json({ error: 'Failed to list collage media' });
  }
});

/**
 * POST /api/admin/homepage/collage-media
 * Upload new collage media (photo or video)
 */
router.post(
  '/homepage/collage-media',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  collageUpload.array('media', 10), // Allow up to 10 files at once
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No media files provided' });
      }

      const uploadedMedia = req.files.map(file => {
        const ext = path.extname(file.filename).toLowerCase();
        const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);

        return {
          filename: file.filename,
          url: `/uploads/homepage-collage/${file.filename}`,
          type: isVideo ? 'video' : 'photo',
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };
      });

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'COLLAGE_MEDIA_UPLOADED',
        targetType: 'homepage',
        targetId: 'collage-media',
        details: { count: uploadedMedia.length, files: uploadedMedia.map(m => m.filename) },
      });

      res.json({
        success: true,
        media: uploadedMedia,
      });
    } catch (error) {
      console.error('Error uploading collage media:', error);
      res.status(500).json({ error: 'Failed to upload collage media' });
    }
  }
);

/**
 * DELETE /api/admin/homepage/collage-media/:filename
 * Delete a collage media file
 */
router.delete(
  '/homepage/collage-media/:filename',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { filename } = req.params;

      // Security: prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const filePath = path.join(collageUploadDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Use async file deletion
      await fs.promises.unlink(filePath);

      // Update settings to remove from uploadGallery if present
      const settings = (await dbUnified.read('settings')) || {};
      if (settings.collageWidget && settings.collageWidget.uploadGallery) {
        const fileUrl = `/uploads/homepage-collage/${filename}`;
        // Filter by comparing URLs without query parameters to handle cache busting
        settings.collageWidget.uploadGallery = settings.collageWidget.uploadGallery.filter(url => {
          const urlWithoutParams = url.split('?')[0];
          return urlWithoutParams !== fileUrl;
        });
        settings.collageWidget.updatedAt = new Date().toISOString();
        settings.collageWidget.updatedBy = req.user.email;
        await dbUnified.write('settings', settings);
      }

      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'COLLAGE_MEDIA_DELETED',
        targetType: 'homepage',
        targetId: 'collage-media',
        details: { filename },
      });

      res.json({
        success: true,
        message: 'Media file deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting collage media:', error);
      res.status(500).json({ error: 'Failed to delete collage media' });
    }
  }
);

/**
 * POST /api/admin/users/:id/subscription
 * Grant or update subscription for a user
 * Body: { tier: 'pro' | 'pro_plus', duration: '7d' | '30d' | '90d' | '1y' | 'lifetime', reason: string }
 */
router.post(
  '/users/:id/subscription',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { tier, duration, reason } = req.body;

      // Validate tier
      const validTiers = ['pro', 'pro_plus'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be "pro" or "pro_plus"' });
      }

      // Validate duration
      const validDurations = ['7d', '30d', '90d', '1y', 'lifetime'];
      if (!validDurations.includes(duration)) {
        return res
          .status(400)
          .json({ error: 'Invalid duration. Must be 7d, 30d, 90d, 1y, or lifetime' });
      }

      const users = read('users');
      const userIndex = users.findIndex(u => u.id === id);

      if (userIndex < 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[userIndex];
      const now = new Date();
      const startDate = now.toISOString();
      let endDate = null;

      // Calculate end date based on duration
      if (duration !== 'lifetime') {
        const durationMap = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '1y': 365,
        };
        const days = durationMap[duration];
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        endDate = end.toISOString();
      }

      // Store previous subscription info for history
      const previousTier = user.subscription?.tier || 'free';
      const action =
        !user.subscription || user.subscription.tier === 'free'
          ? 'granted'
          : tier !== previousTier
            ? 'upgraded'
            : 'renewed';

      // Update user subscription
      user.subscription = {
        tier,
        status: 'active',
        startDate,
        endDate,
        grantedBy: req.user.id,
        grantedAt: startDate,
        reason: reason || 'Manual admin grant',
        autoRenew: false,
      };

      // Initialize subscription history if it doesn't exist
      if (!user.subscriptionHistory) {
        user.subscriptionHistory = [];
      }

      // Add to subscription history
      user.subscriptionHistory.push({
        tier,
        action,
        date: startDate,
        adminId: req.user.id,
        adminEmail: req.user.email,
        reason: reason || 'Manual admin grant',
        previousTier,
        duration,
        endDate,
      });

      // Save updated user
      users[userIndex] = user;
      write('users', users);

      // Log to audit
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'USER_SUBSCRIPTION_GRANTED',
        targetType: 'user',
        targetId: id,
        details: { tier, duration, reason, endDate },
      });

      res.json({
        success: true,
        message: 'Subscription granted successfully',
        subscription: user.subscription,
      });
    } catch (error) {
      console.error('Error granting subscription:', error);
      res.status(500).json({ error: 'Failed to grant subscription' });
    }
  }
);

/**
 * DELETE /api/admin/users/:id/subscription
 * Remove subscription from a user
 * Body: { reason: string }
 */
router.delete(
  '/users/:id/subscription',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const users = read('users');
      const userIndex = users.findIndex(u => u.id === id);

      if (userIndex < 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = users[userIndex];

      if (!user.subscription || user.subscription.tier === 'free') {
        return res.status(400).json({ error: 'User has no active subscription to remove' });
      }

      const previousTier = user.subscription.tier;

      // Update subscription to cancelled/free
      user.subscription = {
        tier: 'free',
        status: 'cancelled',
        startDate: new Date().toISOString(),
        endDate: null,
        grantedBy: req.user.id,
        grantedAt: new Date().toISOString(),
        reason: reason || 'Manual admin removal',
        autoRenew: false,
      };

      // Initialize subscription history if it doesn't exist
      if (!user.subscriptionHistory) {
        user.subscriptionHistory = [];
      }

      // Add to subscription history
      user.subscriptionHistory.push({
        tier: 'free',
        action: 'cancelled',
        date: new Date().toISOString(),
        adminId: req.user.id,
        adminEmail: req.user.email,
        reason: reason || 'Manual admin removal',
        previousTier,
        duration: null,
        endDate: null,
      });

      // Save updated user
      users[userIndex] = user;
      write('users', users);

      // Log to audit
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'USER_SUBSCRIPTION_REMOVED',
        targetType: 'user',
        targetId: id,
        details: { previousTier, reason },
      });

      res.json({
        success: true,
        message: 'Subscription removed successfully',
      });
    } catch (error) {
      console.error('Error removing subscription:', error);
      res.status(500).json({ error: 'Failed to remove subscription' });
    }
  }
);

/**
 * GET /api/admin/users/:id/subscription-history
 * Get subscription history for a user
 */
router.get('/users/:id/subscription-history', authRequired, roleRequired('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const users = read('users');
    const user = users.find(u => u.id === id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const history = user.subscriptionHistory || [];

    res.json({
      success: true,
      history,
      currentSubscription: user.subscription || null,
    });
  } catch (error) {
    console.error('Error fetching subscription history:', error);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
});

/**
 * POST /api/admin/bulk/subscriptions
 * Bulk grant subscriptions to multiple users
 * Body: { userIds: string[], tier: string, duration: string, reason: string }
 */
router.post(
  '/bulk/subscriptions',
  authRequired,
  roleRequired('admin'),
  csrfProtection,
  async (req, res) => {
    try {
      const { userIds, tier, duration, reason } = req.body;

      // Validate input
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds must be a non-empty array' });
      }

      const validTiers = ['pro', 'pro_plus'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: 'Invalid tier. Must be "pro" or "pro_plus"' });
      }

      const validDurations = ['7d', '30d', '90d', '1y', 'lifetime'];
      if (!validDurations.includes(duration)) {
        return res
          .status(400)
          .json({ error: 'Invalid duration. Must be 7d, 30d, 90d, 1y, or lifetime' });
      }

      const users = read('users');
      const now = new Date();
      const startDate = now.toISOString();
      let endDate = null;

      // Calculate end date based on duration
      if (duration !== 'lifetime') {
        const durationMap = {
          '7d': 7,
          '30d': 30,
          '90d': 90,
          '1y': 365,
        };
        const days = durationMap[duration];
        const end = new Date(now);
        end.setDate(end.getDate() + days);
        endDate = end.toISOString();
      }

      const successfulUserIds = [];
      const failedUserIds = [];

      userIds.forEach(userId => {
        const userIndex = users.findIndex(u => u.id === userId);

        if (userIndex < 0) {
          failedUserIds.push(userId);
          return;
        }

        const user = users[userIndex];
        const previousTier = user.subscription?.tier || 'free';
        const action =
          !user.subscription || user.subscription.tier === 'free'
            ? 'granted'
            : tier !== previousTier
              ? 'upgraded'
              : 'renewed';

        // Update user subscription
        user.subscription = {
          tier,
          status: 'active',
          startDate,
          endDate,
          grantedBy: req.user.id,
          grantedAt: startDate,
          reason: reason || 'Bulk admin grant',
          autoRenew: false,
        };

        // Initialize subscription history if it doesn't exist
        if (!user.subscriptionHistory) {
          user.subscriptionHistory = [];
        }

        // Add to subscription history
        user.subscriptionHistory.push({
          tier,
          action,
          date: startDate,
          adminId: req.user.id,
          adminEmail: req.user.email,
          reason: reason || 'Bulk admin grant',
          previousTier,
          duration,
          endDate,
        });

        users[userIndex] = user;
        successfulUserIds.push(userId);
      });

      // Save all updated users
      write('users', users);

      // Log to audit
      auditLog({
        adminId: req.user.id,
        adminEmail: req.user.email,
        action: 'BULK_SUBSCRIPTIONS_GRANTED',
        targetType: 'users',
        targetId: 'bulk',
        details: {
          tier,
          duration,
          reason,
          successCount: successfulUserIds.length,
          failedCount: failedUserIds.length,
          userIds: successfulUserIds,
        },
      });

      res.json({
        success: true,
        message: `Successfully granted subscriptions to ${successfulUserIds.length} user(s)`,
        successCount: successfulUserIds.length,
        failedCount: failedUserIds.length,
        successfulUserIds,
        failedUserIds,
      });
    } catch (error) {
      console.error('Error granting bulk subscriptions:', error);
      res.status(500).json({ error: 'Failed to grant bulk subscriptions' });
    }
  }
);

/**
 * GET /api/maintenance/message (PUBLIC - no auth required)
 * Get maintenance mode message for display on maintenance page
 * This is intentionally not under /api/admin to avoid auth requirement
 */
router.get('/maintenance/message', async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const maintenance = settings.maintenance || {
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    };

    // Only return the message and enabled status, not admin details
    res.json({
      enabled: maintenance.enabled,
      message: maintenance.message,
    });
  } catch (error) {
    console.error('Error reading maintenance message:', error);
    // Return default message on error
    res.json({
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    });
  }
});

/**
 * GET /api/public/pexels-collage
 * Public endpoint to fetch Pexels images for homepage collage
 * Uses Pexels API when configured, falls back to curated fallback URLs when API unavailable
 */
router.get('/public/pexels-collage', async (req, res) => {
  try {
    // Check if Pexels collage is enabled via new collageWidget configuration
    const settings = (await dbUnified.read('settings')) || {};
    const collageWidget = settings.collageWidget || {};

    // Check both new collageWidget format and legacy pexelsCollage feature flag for backward compatibility
    const isEnabled = collageWidget.enabled === true || settings.features?.pexelsCollage === true;
    const source = collageWidget.source || 'pexels';

    // Debug logging to help diagnose configuration issues
    if (isCollageDebugEnabled()) {
      console.log('[Pexels Collage Endpoint] Configuration check:', {
        isEnabled,
        collageWidgetEnabled: collageWidget.enabled,
        legacyPexelsEnabled: settings.features?.pexelsCollage,
        source,
        category: req.query.category,
        photos: req.query.photos,
        videos: req.query.videos,
      });
    }

    if (!isEnabled) {
      return res.status(404).json({
        error: 'Pexels collage feature is not enabled',
        errorType: 'feature_disabled',
      });
    }

    // If source is not 'pexels' (and not empty/undefined), return an error (uploads source should use upload gallery)
    if (source && source !== 'pexels') {
      return res.status(400).json({
        error: 'This endpoint only supports Pexels source',
        errorType: 'invalid_source',
        message: 'Configure collage widget to use Pexels source or use upload gallery',
      });
    }

    const { category, photos = 'true', videos = 'true' } = req.query;

    if (!category) {
      return res.status(400).json({
        error: 'Category parameter required',
        errorType: 'validation',
      });
    }

    const validCategories = ['venues', 'catering', 'entertainment', 'photography'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        errorType: 'validation',
        validCategories,
      });
    }

    // Use new collageWidget.pexelsQueries, fallback to legacy pexelsCollageSettings for backward compatibility
    const pexelsQueries = collageWidget.pexelsQueries ||
      settings.pexelsCollageSettings?.queries || {
        venues: 'wedding venue elegant ballroom',
        catering: 'wedding catering food elegant',
        entertainment: 'live band wedding party',
        photography: 'wedding photography professional',
      };

    // Get video queries if videos are enabled
    const pexelsVideoQueries = collageWidget.pexelsVideoQueries || {
      venues: 'wedding venue video aerial',
      catering: 'catering food preparation video',
      entertainment: 'live band music performance video',
      photography: 'wedding videography cinematic',
    };

    // Support legacy pexelsCollageSettings for collection IDs if configured
    const pexelsCollageSettings = settings.pexelsCollageSettings || {};

    // Import Pexels service
    const { getPexelsService } = require('../utils/pexels-service');
    const pexels = getPexelsService();

    // Determine if we should fetch photos and/or videos
    const shouldFetchPhotos = photos === 'true';
    const shouldFetchVideos = videos === 'true';

    const allMedia = [];

    // Try to use Pexels API first
    if (pexels.isConfigured()) {
      try {
        // Check if collection ID is configured for this category or globally
        const collectionId =
          pexelsCollageSettings.collectionIds?.[category] || pexelsCollageSettings.collectionId;

        if (collectionId) {
          // Use collection-based fetching
          console.log(`📚 Fetching media from collection ${collectionId} for ${category}`);
          const results = await pexels.getCollectionMedia(collectionId, 8, 1, 'all');

          // Filter based on media type settings
          let media = results.media;
          if (!shouldFetchPhotos) {
            media = media.filter(item => item.type !== 'Photo');
          }
          if (!shouldFetchVideos) {
            media = media.filter(item => item.type !== 'Video');
          }

          if (media.length === 0) {
            console.warn(
              `⚠️  No media found in collection ${collectionId}, falling back to search`
            );
            // Fall through to search-based approach
          } else {
            return res.json({
              success: true,
              category,
              collectionId,
              photos: media.filter(item => item.type === 'Photo'),
              videos: media.filter(item => item.type === 'Video'),
              usingFallback: false,
              source: 'collection',
            });
          }
        }

        // Use query-based searching (default behavior or fallback from empty collection)
        const fetchPromises = [];

        if (shouldFetchPhotos) {
          const photoQuery = pexelsQueries[category] || category;
          console.log(`🔍 Searching photos with query: "${photoQuery}" for ${category}`);
          fetchPromises.push(
            pexels.searchPhotos(photoQuery, 4, 1).then(results => ({
              type: 'photos',
              items: results.photos,
            }))
          );
        }

        if (shouldFetchVideos) {
          const videoQuery = pexelsVideoQueries[category] || category;
          console.log(`🎥 Searching videos with query: "${videoQuery}" for ${category}`);
          fetchPromises.push(
            pexels.searchVideos(videoQuery, 4, 1).then(results => ({
              type: 'videos',
              items: results.videos
                .map(video => {
                  // Get the best quality video file (prefer HD, fallback to SD, then any available)
                  const videoFiles = video.videoFiles || [];
                  const hdFile =
                    videoFiles.find(f => f.quality === 'hd') ||
                    videoFiles.find(f => f.quality === 'sd') ||
                    videoFiles[0];

                  // Add validation before using
                  if (!hdFile || !hdFile.link) {
                    if (isCollageDebugEnabled()) {
                      console.warn(
                        `[Pexels Collage] No valid video file found for video ${video.id}`
                      );
                    }
                    return null; // Filter out invalid videos
                  }

                  return {
                    type: 'video',
                    id: video.id,
                    url: video.url,
                    src: {
                      large: hdFile.link,
                      original: hdFile.link,
                    },
                    thumbnail: video.image,
                    videographer: video.user?.name || 'Pexels',
                    videographer_url: video.user?.url || 'https://www.pexels.com',
                    duration: video.duration,
                    width: video.width,
                    height: video.height,
                  };
                })
                .filter(v => v !== null), // Filter out null values
            }))
          );
        }

        const results = await Promise.all(fetchPromises);

        // Separate photos and videos
        const photosResult = results.find(r => r.type === 'photos');
        const videosResult = results.find(r => r.type === 'videos');

        return res.json({
          success: true,
          category,
          photos: photosResult?.items || [],
          videos: videosResult?.items || [],
          usingFallback: false,
          source: 'search',
        });
      } catch (apiError) {
        console.warn(
          `⚠️  Pexels API failed for ${category} (${apiError.type || 'unknown'}): ${apiError.message}`
        );
        console.warn('💡 Falling back to curated URLs');
        // Fall through to fallback logic below
      }
    } else {
      console.log('ℹ️  Pexels API not configured, using fallback URLs');
    }

    // If API not configured or failed, use fallback URLs from config
    const {
      getRandomFallbackPhotos,
      getRandomFallbackVideos,
    } = require('../config/pexels-fallback');

    let fallbackPhotos = [];
    let fallbackVideos = [];

    if (shouldFetchPhotos) {
      const rawPhotos = getRandomFallbackPhotos(4);
      // Convert fallback photo format to match Pexels API format
      fallbackPhotos = rawPhotos.map(photo => ({
        id: photo.id,
        url: photo.url,
        photographer: photo.photographer,
        photographer_url: photo.photographer_url || 'https://www.pexels.com',
        src: {
          original: photo.src.original,
          large: photo.src.large,
          medium: photo.src.medium,
          small: photo.src.small,
        },
        alt: photo.alt,
      }));
    }

    if (shouldFetchVideos) {
      const rawVideos = getRandomFallbackVideos(4);
      // Convert fallback video format to match expected format
      fallbackVideos = rawVideos.map(video => {
        const videoFile = video.videoFiles?.[0];
        return {
          type: 'video',
          id: video.id,
          url: video.url,
          src: {
            large: videoFile?.link || '',
            original: videoFile?.link || '',
          },
          thumbnail: video.image,
          videographer: 'Pexels',
          videographer_url: 'https://www.pexels.com',
          duration: video.duration,
          width: videoFile?.width || 1920,
          height: videoFile?.height || 1080,
        };
      });
    }

    res.json({
      success: true,
      category,
      photos: fallbackPhotos,
      videos: fallbackVideos,
      usingFallback: true,
      source: 'fallback',
      message: 'Using curated fallback media from Pexels collection',
    });
  } catch (error) {
    console.error('❌ Error fetching Pexels collage images:', error);
    console.error('🔖 Error type:', error.type || 'unknown');

    // Return appropriate status code based on error type
    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      error: 'Failed to fetch Pexels images',
      message: error.userFriendlyMessage || error.message,
      errorType: error.type || 'unknown',
      details: error.message,
    });
  }
});

/**
 * GET /api/admin/public/pexels-video
 * Public endpoint to fetch Pexels videos for homepage hero section
 * Uses Pexels API when configured, falls back to curated fallback URLs when API unavailable
 */
router.get('/public/pexels-video', async (req, res) => {
  try {
    // Check if Pexels collage is enabled via collageWidget configuration
    const settings = (await dbUnified.read('settings')) || {};
    const collageWidget = settings.collageWidget || {};

    // Check both new collageWidget format and legacy pexelsCollage feature flag for backward compatibility
    const isEnabled = collageWidget.enabled === true || settings.features?.pexelsCollage === true;
    const source = collageWidget.source || 'pexels';

    // Debug logging
    if (isCollageDebugEnabled()) {
      console.log('[Pexels Video Endpoint] Configuration check:', {
        isEnabled,
        collageWidgetEnabled: collageWidget.enabled,
        legacyPexelsEnabled: settings.features?.pexelsCollage,
        source,
        query: req.query.query,
        mediaTypesVideos: collageWidget.mediaTypes?.videos,
      });
    }

    if (!isEnabled) {
      return res.status(404).json({
        error: 'Pexels collage feature is not enabled',
        errorType: 'feature_disabled',
      });
    }

    // Check if videos are enabled in mediaTypes - default to true if not explicitly disabled
    const videosEnabled = collageWidget.mediaTypes?.videos !== false;
    if (!videosEnabled) {
      return res.status(400).json({
        error: 'Videos are not enabled in collage widget settings',
        errorType: 'videos_disabled',
      });
    }

    // If source is not 'pexels', return an error
    if (source && source !== 'pexels') {
      return res.status(400).json({
        error: 'This endpoint only supports Pexels source',
        errorType: 'invalid_source',
        message: 'Configure collage widget to use Pexels source',
      });
    }

    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        error: 'Query parameter required',
        errorType: 'validation',
      });
    }

    // Import Pexels service
    const { getPexelsService } = require('../utils/pexels-service');
    const pexels = getPexelsService();

    // Try to use Pexels API first
    if (pexels.isConfigured()) {
      try {
        if (isCollageDebugEnabled()) {
          console.log(`🎥 Searching videos with query: "${query}"`);
        }

        const results = await pexels.searchVideos(query, 5, 1);

        if (results.videos && results.videos.length > 0) {
          // Transform to expected frontend format
          const videos = results.videos.map(video => ({
            id: video.id,
            url: video.url,
            image: video.image,
            duration: video.duration,
            user: {
              name: video.user?.name || 'Pexels',
              url: video.user?.url || 'https://www.pexels.com',
            },
            video_files: (video.videoFiles || []).map(file => ({
              id: file.id,
              quality: file.quality,
              file_type: file.fileType,
              width: file.width,
              height: file.height,
              link: file.link,
            })),
          }));

          return res.json({
            success: true,
            videos,
            query,
            usingFallback: false,
            source: 'pexels-api',
          });
        }

        // If no videos found, fall through to fallback
        console.warn(`⚠️  No videos found for query "${query}", using fallback`);
      } catch (apiError) {
        console.warn(
          `⚠️  Pexels API failed for video query "${query}" (${apiError.type || 'unknown'}): ${apiError.message}`
        );
        console.warn('💡 Falling back to curated video URLs');
        // Fall through to fallback logic below
      }
    } else {
      console.log('ℹ️  Pexels API not configured, using fallback video URLs');
    }

    // If API not configured or failed, use fallback URLs from config
    const { getRandomFallbackVideos } = require('../config/pexels-fallback');

    const fallbackVideos = getRandomFallbackVideos(5);

    // Transform fallback videos to match expected frontend format
    const videos = fallbackVideos.map(video => {
      const videoFile = video.videoFiles?.[0];
      return {
        id: video.id,
        url: video.url,
        image: video.image,
        duration: video.duration,
        user: {
          name: 'Pexels',
          url: 'https://www.pexels.com',
        },
        video_files: [
          {
            quality: videoFile?.quality || 'hd',
            file_type: 'video/mp4',
            width: videoFile?.width || 1920,
            height: videoFile?.height || 1080,
            link: videoFile?.link || '',
          },
        ],
      };
    });

    res.json({
      success: true,
      videos,
      query,
      usingFallback: true,
      source: 'fallback',
      message: 'Using curated fallback videos from Pexels collection',
    });
  } catch (error) {
    console.error('❌ Error fetching Pexels videos:', error);
    console.error('🔖 Error type:', error.type || 'unknown');

    // Return appropriate status code based on error type
    const statusCode = error.statusCode || 500;

    res.status(statusCode).json({
      error: 'Failed to fetch Pexels videos',
      message: error.userFriendlyMessage || error.message,
      errorType: error.type || 'unknown',
      details: error.message,
    });
  }
});

module.exports = router;
module.exports.setHelperFunctions = setHelperFunctions;
