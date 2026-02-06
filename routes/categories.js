/**
 * Categories Routes
 * Public endpoints for browsing service categories
 */

'use strict';

const express = require('express');
const router = express.Router();

// Dependencies injected by server.js
let dbUnified;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Categories routes: dependencies object is required');
  }

  dbUnified = deps.dbUnified;
}

// Helper function to check if package is featured
function isFeaturedPackage(pkg) {
  return pkg.featured === true || pkg.isFeatured === true;
}

/**
 * GET /api/categories
 * List all categories ordered by their display order
 */
router.get('/', async (_req, res) => {
  const categories = await dbUnified.read('categories');
  const sorted = categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ items: sorted });
});

/**
 * GET /api/categories/:slug
 * Get category details and its packages
 */
router.get('/:slug', async (req, res) => {
  const categories = await dbUnified.read('categories');
  const category = categories.find(c => c.slug === req.params.slug);
  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Get all approved packages in this category
  const allPackages = await dbUnified.read('packages');
  const categoryPackages = allPackages.filter(p => {
    if (!p.approved) {
      return false;
    }
    if (!p.categories || !Array.isArray(p.categories)) {
      return false;
    }
    return p.categories.includes(req.params.slug);
  });

  // Sort: featured packages first
  const sorted = categoryPackages.sort((a, b) => {
    const aFeatured = isFeaturedPackage(a);
    const bFeatured = isFeaturedPackage(b);
    if (aFeatured && !bFeatured) {
      return -1;
    }
    if (!aFeatured && bFeatured) {
      return 1;
    }
    return 0;
  });

  res.json({ category, packages: sorted });
});

// Export router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
