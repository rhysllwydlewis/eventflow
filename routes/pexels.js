/**
 * Pexels Stock Photos API Routes
 * Provides endpoints for browsing and selecting Pexels stock photos
 * For use with category images, hero banners, and other site content
 */

'use strict';

const express = require('express');
const router = express.Router();
const { getPexelsService } = require('../utils/pexels-service');
const { authRequired, roleRequired } = require('../middleware/auth');

/**
 * GET /api/pexels/search
 * Search for stock photos by query
 * Query params: q (search term), page (page number), perPage (results per page)
 * Requires admin authentication
 */
router.get('/search', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const pexels = getPexelsService();

    if (!pexels.isConfigured()) {
      return res.status(503).json({
        error: 'Pexels API not configured',
        message: 'Please configure PEXELS_API_KEY in your environment variables',
      });
    }

    const { q, page = 1, perPage = 15 } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Missing query parameter',
        message: 'Query parameter "q" is required',
      });
    }

    const results = await pexels.searchPhotos(q, parseInt(perPage), parseInt(page));

    res.json({
      success: true,
      query: q,
      ...results,
    });
  } catch (error) {
    console.error('Pexels search error:', error);
    res.status(500).json({
      error: 'Failed to search photos',
      message: error.message,
    });
  }
});

/**
 * GET /api/pexels/curated
 * Get curated stock photos (editor's picks)
 * Query params: page (page number), perPage (results per page)
 * Requires admin authentication
 */
router.get('/curated', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const pexels = getPexelsService();

    if (!pexels.isConfigured()) {
      return res.status(503).json({
        error: 'Pexels API not configured',
        message: 'Please configure PEXELS_API_KEY in your environment variables',
      });
    }

    const { page = 1, perPage = 15 } = req.query;

    const results = await pexels.getCuratedPhotos(parseInt(perPage), parseInt(page));

    res.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Pexels curated error:', error);
    res.status(500).json({
      error: 'Failed to fetch curated photos',
      message: error.message,
    });
  }
});

/**
 * GET /api/pexels/photo/:id
 * Get specific photo by ID
 * Requires admin authentication
 */
router.get('/photo/:id', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const pexels = getPexelsService();

    if (!pexels.isConfigured()) {
      return res.status(503).json({
        error: 'Pexels API not configured',
        message: 'Please configure PEXELS_API_KEY in your environment variables',
      });
    }

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        error: 'Invalid photo ID',
        message: 'Photo ID must be a number',
      });
    }

    const photo = await pexels.getPhotoById(parseInt(id));

    res.json({
      success: true,
      photo,
    });
  } catch (error) {
    console.error('Pexels photo error:', error);
    res.status(500).json({
      error: 'Failed to fetch photo',
      message: error.message,
    });
  }
});

/**
 * GET /api/pexels/categories
 * Get suggested search queries for each category
 * Requires admin authentication
 */
router.get('/categories', authRequired, roleRequired('admin'), (req, res) => {
  const { PexelsService } = require('../utils/pexels-service');
  const categories = PexelsService.getCategorySuggestions();

  res.json({
    success: true,
    categories,
  });
});

/**
 * GET /api/pexels/status
 * Check if Pexels API is configured and available
 * Requires admin authentication
 */
router.get('/status', authRequired, roleRequired('admin'), (req, res) => {
  const pexels = getPexelsService();

  res.json({
    configured: pexels.isConfigured(),
    apiKey: pexels.isConfigured() ? '***configured***' : null,
  });
});

module.exports = router;
