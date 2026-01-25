/**
 * Public Routes
 * Public-facing endpoints that don't require authentication
 * Includes homepage settings, public stats, and other publicly accessible data
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');
const { getPexelsService } = require('../utils/pexels-service');

/**
 * Check if collage debug logging is enabled
 * @returns {boolean} True if debug logging should be enabled
 */
function isCollageDebugEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.DEBUG_COLLAGE === 'true';
}

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
 * Returns collage widget configuration (backward compatible with Pexels collage)
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

    // Backward compatibility: Check both new collageWidget and old pexelsCollage feature flag
    const collageWidget = settings.collageWidget || {};
    const legacyPexelsEnabled = features.pexelsCollage === true;

    // If collageWidget is configured, use it
    // Otherwise fall back to legacy pexelsCollage behavior
    const collageEnabled =
      collageWidget.enabled !== undefined ? collageWidget.enabled : legacyPexelsEnabled;

    // Sanitize and validate Pexels settings for backward compatibility
    const pexelsCollageSettings = sanitizePexelsSettings(settings.pexelsCollageSettings);

    // Build response with new collageWidget structure
    const collageWidgetResponse = {
      enabled: collageEnabled,
      source: collageWidget.source || 'pexels',
      mediaTypes: collageWidget.mediaTypes || { photos: true, videos: true },
      intervalSeconds: collageWidget.intervalSeconds || pexelsCollageSettings.intervalSeconds,
      pexelsQueries: collageWidget.pexelsQueries || pexelsCollageSettings.queries,
      pexelsVideoQueries: collageWidget.pexelsVideoQueries || {
        venues: 'wedding venue video aerial',
        catering: 'catering food preparation video',
        entertainment: 'live band music performance video',
        photography: 'wedding videography cinematic',
      },
      uploadGallery: collageWidget.uploadGallery || [],
      fallbackToPexels:
        collageWidget.fallbackToPexels !== undefined ? collageWidget.fallbackToPexels : true,
    };

    // Debug logging
    if (isCollageDebugEnabled()) {
      console.log('[Homepage Settings] Returning collage config:', {
        collageEnabled,
        collageWidgetEnabled: collageWidget.enabled,
        legacyPexelsEnabled,
        source: collageWidgetResponse.source,
        hasQueries: !!collageWidgetResponse.pexelsQueries,
        uploadGalleryCount: collageWidgetResponse.uploadGallery.length,
      });
    }

    // Return response with both new and legacy formats for backward compatibility
    res.json({
      // New format
      collageWidget: collageWidgetResponse,

      // Legacy format (for backward compatibility)
      pexelsCollageEnabled: legacyPexelsEnabled,
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

/**
 * GET /api/public/stats
 * Get public statistics for homepage
 * Returns counts of verified suppliers, approved packages, active listings, and approved reviews
 *
 * Cache Policy: 5 minutes
 * - Stats don't change frequently, so caching improves performance
 */
let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

router.get('/stats', async (req, res) => {
  try {
    // Check cache
    const now = Date.now();
    if (statsCache && now - statsCacheTime < STATS_CACHE_DURATION) {
      res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
      return res.json(statsCache);
    }

    // Read all collections
    const suppliers = (await dbUnified.read('suppliers')) || [];
    const packages = (await dbUnified.read('packages')) || [];
    const marketplaceListings = (await dbUnified.read('marketplace_listings')) || [];
    const reviews = (await dbUnified.read('reviews')) || [];

    // Calculate stats
    const stats = {
      suppliersVerified: suppliers.filter(s => s.verified === true).length,
      packagesApproved: packages.filter(p => p.approved === true).length,
      marketplaceListingsActive: marketplaceListings.filter(m => m.status === 'active').length,
      reviewsApproved: reviews.filter(r => r.approved === true).length,
    };

    // Update cache
    statsCache = stats;
    statsCacheTime = now;

    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.json(stats);
  } catch (error) {
    console.error('[ERROR] Failed to read public stats:', error.message);
    res.status(500).json({
      error: 'Failed to read public stats',
      suppliersVerified: 0,
      packagesApproved: 0,
      marketplaceListingsActive: 0,
      reviewsApproved: 0,
    });
  }
});

/**
 * GET /api/public/pexels/photo
 * Public proxy for Pexels photo search API (no auth required)
 * Returns fallback photo URLs if API is not configured or fails
 * 
 * Query params:
 * - query: Search query string
 * - category: Category name (for fallback selection)
 * 
 * This endpoint allows frontend to fetch photos without exposing API keys
 */
router.get('/pexels/photo', async (req, res) => {
  try {
    const { query, category } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing query parameter',
        message: 'Query parameter "query" is required' 
      });
    }

    const pexels = getPexelsService();

    // Check if Pexels API is configured
    if (!pexels.isConfigured()) {
      console.log('[Pexels Photo Proxy] API not configured, using fallback');
      
      // Return fallback photo URL based on category
      const fallbackPhotos = {
        venues: '/assets/images/collage-venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };
      
      const fallbackUrl = fallbackPhotos[category] || '/assets/images/collage-venue.jpg';
      
      return res.json({
        success: true,
        fallback: true,
        photo: {
          src: {
            large: fallbackUrl,
            original: fallbackUrl,
          },
          photographer: 'EventFlow',
          photographer_url: '',
          alt: query,
        },
      });
    }

    try {
      // Fetch from Pexels API with timeout
      const results = await pexels.searchPhotos(query, 15, 1, { orientation: 'landscape' });
      
      if (!results.photos || results.photos.length === 0) {
        console.log('[Pexels Photo Proxy] No photos found, using fallback');
        
        // Return fallback
        const fallbackPhotos = {
          venues: '/assets/images/collage-venue.jpg',
          catering: '/assets/images/collage-catering.jpg',
          entertainment: '/assets/images/collage-entertainment.jpg',
          photography: '/assets/images/collage-photography.jpg',
        };
        
        const fallbackUrl = fallbackPhotos[category] || '/assets/images/collage-venue.jpg';
        
        return res.json({
          success: true,
          fallback: true,
          photo: {
            src: {
              large: fallbackUrl,
              original: fallbackUrl,
            },
            photographer: 'EventFlow',
            photographer_url: '',
            alt: query,
          },
        });
      }

      // Get a random photo from results
      const randomIndex = Math.floor(Math.random() * Math.min(10, results.photos.length));
      const photo = results.photos[randomIndex];
      
      res.json({
        success: true,
        fallback: false,
        photo,
      });
    } catch (apiError) {
      console.error('[Pexels Photo Proxy] API error:', apiError.message);
      
      // Return fallback on API error
      const fallbackPhotos = {
        venues: '/assets/images/collage-venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };
      
      const fallbackUrl = fallbackPhotos[category] || '/assets/images/collage-venue.jpg';
      
      return res.json({
        success: true,
        fallback: true,
        photo: {
          src: {
            large: fallbackUrl,
            original: fallbackUrl,
          },
          photographer: 'EventFlow',
          photographer_url: '',
          alt: query,
        },
      });
    }
  } catch (error) {
    console.error('[Pexels Photo Proxy] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch photo',
      message: error.message 
    });
  }
});

/**
 * GET /api/public/pexels/video
 * Public proxy for Pexels video search API (no auth required)
 * Returns null with fallback flag if API is not configured or fails
 * 
 * Query params:
 * - query: Search query string
 * - orientation: Video orientation (landscape, portrait, square)
 * 
 * This endpoint allows frontend to fetch videos without exposing API keys
 */
router.get('/pexels/video', async (req, res) => {
  try {
    const { query, orientation = 'landscape' } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing query parameter',
        message: 'Query parameter "query" is required' 
      });
    }

    const pexels = getPexelsService();

    // Check if Pexels API is configured
    if (!pexels.isConfigured()) {
      console.log('[Pexels Video Proxy] API not configured, returning null with fallback flag');
      
      return res.json({
        success: true,
        fallback: true,
        video: null,
      });
    }

    try {
      // Fetch from Pexels API with timeout
      const results = await pexels.searchVideos(query, 15, 1, { orientation });
      
      if (!results.videos || results.videos.length === 0) {
        console.log('[Pexels Video Proxy] No videos found, returning null with fallback flag');
        
        return res.json({
          success: true,
          fallback: true,
          video: null,
        });
      }

      // Get a random video from results
      const randomIndex = Math.floor(Math.random() * Math.min(5, results.videos.length));
      const video = results.videos[randomIndex];
      
      // Find HD video file
      const hdVideo = video.video_files.find(file => file.quality === 'hd' && file.width <= 1920) ||
                      video.video_files[0];
      
      res.json({
        success: true,
        fallback: false,
        video: {
          url: hdVideo.link,
          width: hdVideo.width,
          height: hdVideo.height,
          duration: video.duration,
        },
      });
    } catch (apiError) {
      console.error('[Pexels Video Proxy] API error:', apiError.message);
      
      return res.json({
        success: true,
        fallback: true,
        video: null,
      });
    }
  } catch (error) {
    console.error('[Pexels Video Proxy] Unexpected error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch video',
      message: error.message 
    });
  }
});

module.exports = router;
