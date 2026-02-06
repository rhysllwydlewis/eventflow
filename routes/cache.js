/**
 * Cache Routes
 * Cache management and database metrics endpoints
 */

'use strict';

const express = require('express');
const router = express.Router();

// These will be injected by server.js during route mounting
let dbUnified;
let authRequired;
let roleRequired;
let csrfProtection;
let cache;
let sentry;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Cache routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = [
    'dbUnified',
    'authRequired',
    'roleRequired',
    'csrfProtection',
    'cache',
    'sentry',
  ];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Cache routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  roleRequired = deps.roleRequired;
  csrfProtection = deps.csrfProtection;
  cache = deps.cache;
  sentry = deps.sentry;
}

// ---------- Cache Routes ----------

router.get('/stats', authRequired, roleRequired('admin'), async (_req, res) => {
  try {
    const cacheStats = cache.getStats();
    res.json({
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

// Query performance metrics endpoint (admin only)
router.get('/database/metrics', authRequired, roleRequired('admin'), async (_req, res) => {
  try {
    const queryMetrics = dbUnified.getQueryMetrics ? dbUnified.getQueryMetrics() : {};
    res.json({
      metrics: queryMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting query metrics:', error);
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to get database metrics' });
  }
});

// Cache clear endpoint (admin only)
router.post('/clear', authRequired, roleRequired('admin'), csrfProtection, async (_req, res) => {
  try {
    await cache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    sentry.captureException(error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
