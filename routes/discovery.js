/**
 * Discovery Routes
 * Trending suppliers, new arrivals, popular packages, and recommendations
 */

'use strict';

const express = require('express');
const router = express.Router();

// These will be injected by server.js during route mounting
let authRequired;
let searchSystem;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Discovery routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = ['authRequired', 'searchSystem'];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Discovery routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  searchSystem = deps.searchSystem;
}

// ---------- Discovery Routes ----------

/**
 * Get trending suppliers
 * GET /api/discovery/trending
 */
router.get('/api/discovery/trending', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const trending = await searchSystem.getTrendingSuppliers(limit);

    res.json({
      success: true,
      count: trending.length,
      suppliers: trending,
    });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to get trending suppliers', details: error.message });
  }
});

/**
 * Get new arrivals
 * GET /api/discovery/new
 */
router.get('/api/discovery/new', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const newSuppliers = await searchSystem.getNewArrivals(limit);

    res.json({
      success: true,
      count: newSuppliers.length,
      suppliers: newSuppliers,
    });
  } catch (error) {
    console.error('Get new arrivals error:', error);
    res.status(500).json({ error: 'Failed to get new suppliers', details: error.message });
  }
});

/**
 * Get popular packages
 * GET /api/discovery/popular-packages
 */
router.get('/api/discovery/popular-packages', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const packages = await searchSystem.getPopularPackages(limit);

    res.json({
      success: true,
      count: packages.length,
      packages,
    });
  } catch (error) {
    console.error('Get popular packages error:', error);
    res.status(500).json({ error: 'Failed to get popular packages', details: error.message });
  }
});

/**
 * Get personalized recommendations
 * GET /api/discovery/recommendations
 */
router.get('/api/discovery/recommendations', authRequired, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const recommendations = await searchSystem.getRecommendations(req.user.id, limit);

    res.json({
      success: true,
      count: recommendations.length,
      suppliers: recommendations,
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations', details: error.message });
  }
});

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
