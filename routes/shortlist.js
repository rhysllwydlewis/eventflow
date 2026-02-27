/**
 * Shortlist Routes
 * API for managing user shortlists (favorites/saved items)
 */

'use strict';

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const dbUnified = require('../db-unified');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimits');
const validator = require('validator');

/**
 * Validate image URL - accepts both full URLs and relative paths
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid image URL
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Decode URL to catch encoded path traversal attempts
  let decodedUrl = url;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch (e) {
    // If decoding fails, use original URL
    decodedUrl = url;
  }

  // Reject path traversal attempts (including encoded)
  if (decodedUrl.includes('..')) {
    return false;
  }

  // Only accept relative paths from whitelisted prefixes
  if (url.startsWith('/')) {
    const allowedPrefixes = ['/api/photos/', '/uploads/', '/images/'];
    return allowedPrefixes.some(prefix => url.startsWith(prefix));
  }

  // Accept full URLs
  return validator.isURL(url);
}

/**
 * GET /api/shortlist
 * Get user's shortlist
 * Returns empty array for unauthenticated users (no 401)
 */
router.get('/', async (req, res) => {
  try {
    // Check if user is authenticated via middleware helper
    const { getUserFromCookie } = require('../middleware/auth');
    const user = await getUserFromCookie(req);

    // Return empty shortlist for unauthenticated users (fail-safe)
    if (!user) {
      return res.json({
        success: true,
        data: {
          items: [],
          updatedAt: new Date().toISOString(),
        },
      });
    }

    const shortlists = (await dbUnified.read('shortlists')) || [];
    const userShortlist = shortlists.find(s => s.userId === user.id);

    res.json({
      success: true,
      data: {
        items: userShortlist?.items || [],
        updatedAt: userShortlist?.updatedAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get shortlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve shortlist',
    });
  }
});

/**
 * POST /api/shortlist
 * Add item to shortlist (auth required)
 */
router.post('/', writeLimiter, authRequired, csrfProtection, async (req, res) => {
  try {
    const { type, id, name, imageUrl, category, location, priceHint, rating } = req.body;

    // Validate required fields
    if (!type || !id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Type, id, and name are required',
      });
    }

    // Validate type
    if (!['supplier', 'listing'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be "supplier" or "listing"',
      });
    }

    // Sanitize inputs
    const item = {
      type: validator.escape(type),
      id: validator.escape(id),
      name: validator.escape(name),
      imageUrl: isValidImageUrl(imageUrl) ? imageUrl : null,
      category: category ? validator.escape(category) : null,
      location: location ? validator.escape(location) : null,
      priceHint: priceHint ? validator.escape(priceHint) : null,
      rating: rating && !isNaN(rating) ? Number(rating) : null,
      addedAt: new Date().toISOString(),
    };

    const shortlists = (await dbUnified.read('shortlists')) || [];
    let userShortlist = shortlists.find(s => s.userId === req.user.id);

    if (!userShortlist) {
      // Create new shortlist for user
      userShortlist = {
        id: `shortlist_${req.user.id}`,
        userId: req.user.id,
        items: [],
        updatedAt: new Date().toISOString(),
      };
      await dbUnified.insertOne('shortlists', userShortlist);
    }

    // Check if item already exists
    const existingIndex = userShortlist.items.findIndex(
      i => i.type === item.type && i.id === item.id
    );

    if (existingIndex !== -1) {
      return res.status(400).json({
        success: false,
        error: 'Item already in shortlist',
      });
    }

    // Add item
    const updatedItems = [...userShortlist.items, item];
    await dbUnified.updateOne(
      'shortlists',
      { userId: req.user.id },
      {
        $set: { items: updatedItems, updatedAt: new Date().toISOString() },
      }
    );

    res.json({
      success: true,
      message: 'Item added to shortlist',
      data: { item },
    });
  } catch (error) {
    logger.error('Add to shortlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to shortlist',
    });
  }
});

/**
 * DELETE /api/shortlist/:type/:id
 * Remove item from shortlist (auth required)
 */
router.delete('/:type/:id', writeLimiter, authRequired, csrfProtection, async (req, res) => {
  try {
    const { type, id } = req.params;

    const shortlists = (await dbUnified.read('shortlists')) || [];
    const userShortlist = shortlists.find(s => s.userId === req.user.id);

    if (!userShortlist) {
      return res.status(404).json({
        success: false,
        error: 'Shortlist not found',
      });
    }

    const itemIndex = userShortlist.items.findIndex(i => i.type === type && i.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in shortlist',
      });
    }

    userShortlist.items.splice(itemIndex, 1);
    await dbUnified.updateOne(
      'shortlists',
      { userId: req.user.id },
      {
        $set: { items: userShortlist.items, updatedAt: new Date().toISOString() },
      }
    );

    res.json({
      success: true,
      message: 'Item removed from shortlist',
    });
  } catch (error) {
    logger.error('Remove from shortlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove item from shortlist',
    });
  }
});

/**
 * DELETE /api/shortlist
 * Clear entire shortlist (auth required)
 */
router.delete('/', writeLimiter, authRequired, csrfProtection, async (req, res) => {
  try {
    const shortlists = (await dbUnified.read('shortlists')) || [];
    const userShortlist = shortlists.find(s => s.userId === req.user.id);

    if (!userShortlist) {
      return res.json({
        success: true,
        message: 'Shortlist already empty',
      });
    }

    await dbUnified.updateOne(
      'shortlists',
      { userId: req.user.id },
      {
        $set: { items: [], updatedAt: new Date().toISOString() },
      }
    );

    res.json({
      success: true,
      message: 'Shortlist cleared',
    });
  } catch (error) {
    logger.error('Clear shortlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear shortlist',
    });
  }
});

module.exports = router;
