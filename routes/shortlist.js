/**
 * Shortlist Routes
 * API for managing user shortlists (favorites/saved items)
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');
const { authRequired } = require('../middleware/auth');
const validator = require('validator');

/**
 * GET /api/shortlist
 * Get user's shortlist (auth required)
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const shortlists = (await dbUnified.read('shortlists')) || [];
    const userShortlist = shortlists.find(s => s.userId === req.user.id);

    res.json({
      success: true,
      data: {
        items: userShortlist?.items || [],
        updatedAt: userShortlist?.updatedAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get shortlist error:', error);
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
router.post('/', authRequired, async (req, res) => {
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
      imageUrl: imageUrl && validator.isURL(imageUrl) ? imageUrl : null,
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
        userId: req.user.id,
        items: [],
        updatedAt: new Date().toISOString(),
      };
      shortlists.push(userShortlist);
    }

    // Check if item already exists
    const existingIndex = userShortlist.items.findIndex(i => i.type === item.type && i.id === item.id);
    
    if (existingIndex !== -1) {
      return res.status(400).json({
        success: false,
        error: 'Item already in shortlist',
      });
    }

    // Add item
    userShortlist.items.push(item);
    userShortlist.updatedAt = new Date().toISOString();

    await dbUnified.write('shortlists', shortlists);

    res.json({
      success: true,
      message: 'Item added to shortlist',
      data: { item },
    });
  } catch (error) {
    console.error('Add to shortlist error:', error);
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
router.delete('/:type/:id', authRequired, async (req, res) => {
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
    userShortlist.updatedAt = new Date().toISOString();

    await dbUnified.write('shortlists', shortlists);

    res.json({
      success: true,
      message: 'Item removed from shortlist',
    });
  } catch (error) {
    console.error('Remove from shortlist error:', error);
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
router.delete('/', authRequired, async (req, res) => {
  try {
    const shortlists = (await dbUnified.read('shortlists')) || [];
    const userShortlist = shortlists.find(s => s.userId === req.user.id);

    if (!userShortlist) {
      return res.json({
        success: true,
        message: 'Shortlist already empty',
      });
    }

    userShortlist.items = [];
    userShortlist.updatedAt = new Date().toISOString();

    await dbUnified.write('shortlists', shortlists);

    res.json({
      success: true,
      message: 'Shortlist cleared',
    });
  } catch (error) {
    console.error('Clear shortlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear shortlist',
    });
  }
});

module.exports = router;
