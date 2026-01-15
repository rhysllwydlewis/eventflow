/**
 * Public Routes
 * Public-facing endpoints that don't require authentication
 * Includes homepage settings, public stats, and other publicly accessible data
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');

// Whitelist of allowed Pexels collage setting keys
const ALLOWED_PEXELS_KEYS = ['intervalSeconds', 'queries', 'perPage', 'orientation', 'tags'];

// Safe defaults for Pexels collage settings
const DEFAULT_PEXELS_SETTINGS = {
  intervalSeconds: 2.5,
  queries: {
    venues: 'wedding venue elegant ballroom',
    catering: 'wedding catering food elegant',
    entertainment: 'live band wedding party',
    photography: 'wedding photography professional',
  },
};

/**
 * Validate and sanitize Pexels collage settings
 * @param {Object} settings - Raw settings from database
 * @returns {Object} Safe, validated settings
 */
function sanitizePexelsSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT_PEXELS_SETTINGS;
  }

  const sanitized = {};

  // Only copy whitelisted keys
  ALLOWED_PEXELS_KEYS.forEach(key => {
    if (settings[key] !== undefined) {
      sanitized[key] = settings[key];
    }
  });

  // Validate and enforce bounds on numeric values
  if (sanitized.intervalSeconds !== undefined) {
    const interval = Number(sanitized.intervalSeconds);
    if (isNaN(interval) || interval < 1 || interval > 60) {
      sanitized.intervalSeconds = DEFAULT_PEXELS_SETTINGS.intervalSeconds;
    } else {
      sanitized.intervalSeconds = interval;
    }
  } else {
    sanitized.intervalSeconds = DEFAULT_PEXELS_SETTINGS.intervalSeconds;
  }

  // Ensure queries object exists
  if (!sanitized.queries || typeof sanitized.queries !== 'object') {
    sanitized.queries = DEFAULT_PEXELS_SETTINGS.queries;
  }

  // Support backwards compatibility: if 'interval' exists and 'intervalSeconds' doesn't, copy it over
  if (settings.interval && !sanitized.intervalSeconds) {
    const interval = Number(settings.interval);
    if (!isNaN(interval) && interval >= 1 && interval <= 60) {
      sanitized.intervalSeconds = interval;
    }
  }

  return sanitized;
}

/**
 * GET /api/public/homepage-settings
 * Get homepage settings for public display (no auth required)
 * Returns Pexels collage feature status and configuration
 *
 * Cache Policy: no-store (for immediate flag effect)
 * - Ensures feature flag changes take effect immediately
 * - Safer than caching for admin-controlled settings
 */
router.get('/homepage-settings', async (req, res) => {
  try {
    // Use no-store for immediate feature flag effect
    res.set('Cache-Control', 'no-store, private');

    const settings = (await dbUnified.read('settings')) || {};
    const features = settings.features || {};

    // Sanitize and validate Pexels settings
    const pexelsCollageSettings = sanitizePexelsSettings(settings.pexelsCollageSettings);

    // Return minimal response - only safe, validated data
    res.json({
      pexelsCollageEnabled: features.pexelsCollage === true,
      pexelsCollageSettings,
    });
  } catch (error) {
    // Log only unexpected errors (5xx), not noisy logs
    if (!res.headersSent) {
      console.error('[ERROR] Failed to read homepage settings:', error.message);
      res.status(500).json({ error: 'Failed to read homepage settings' });
    }
  }
});

module.exports = router;
