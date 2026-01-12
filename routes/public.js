/**
 * Public Routes
 * Public-facing endpoints that don't require authentication
 * Includes homepage settings, public stats, and other publicly accessible data
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');

/**
 * GET /api/public/homepage-settings
 * Get homepage settings for public display (no auth required)
 * Returns Pexels collage feature status and configuration
 * 
 * Cache Policy: public, max-age=60 (60 seconds)
 * - Public caching is safe as this contains only feature flags and public settings
 * - 60-second cache provides good performance while keeping settings reasonably fresh
 * - Alternative: use no-store for more real-time updates, but at cost of more DB queries
 */
router.get('/homepage-settings', async (req, res) => {
  try {
    // Add caching headers - cache for 60 seconds
    res.set('Cache-Control', 'public, max-age=60');
    
    const settings = (await dbUnified.read('settings')) || {};
    const features = settings.features || {};
    const pexelsCollageSettings = settings.pexelsCollageSettings || {
      intervalSeconds: 2.5,
      queries: {
        venues: 'wedding venue elegant ballroom',
        catering: 'wedding catering food elegant',
        entertainment: 'live band wedding party',
        photography: 'wedding photography professional',
      },
    };

    // Support backwards compatibility: if 'interval' exists and 'intervalSeconds' doesn't, copy it over
    if (pexelsCollageSettings.interval && !pexelsCollageSettings.intervalSeconds) {
      pexelsCollageSettings.intervalSeconds = pexelsCollageSettings.interval;
    }

    res.json({
      pexelsCollageEnabled: features.pexelsCollage === true,
      pexelsCollageSettings,
    });
  } catch (error) {
    console.error('Error reading homepage settings:', error);
    res.status(500).json({ error: 'Failed to read homepage settings' });
  }
});

module.exports = router;
