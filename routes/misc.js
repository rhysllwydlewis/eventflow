/**
 * Miscellaneous Routes
 * Various utility endpoints including venues, captcha, settings, maintenance, and CSP reporting
 */

'use strict';

const express = require('express');
const router = express.Router();

// These will be injected by server.js during route mounting
let dbUnified;
let authRequired;
let csrfProtection;
let writeLimiter;
let geocoding;
let verifyHCaptcha;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Misc routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = [
    'dbUnified',
    'authRequired',
    'csrfProtection',
    'writeLimiter',
    'geocoding',
    'verifyHCaptcha',
  ];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Misc routes: missing required dependencies: ${missing.join(', ')}`);
  }

  dbUnified = deps.dbUnified;
  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;
  writeLimiter = deps.writeLimiter;
  geocoding = deps.geocoding;
  verifyHCaptcha = deps.verifyHCaptcha;
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
 */
function applyAuthRequired(req, res, next) {
  if (!authRequired) {
    return res.status(503).json({ error: 'Auth service not initialized' });
  }
  return authRequired(req, res, next);
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

function applyWriteLimiter(req, res, next) {
  if (!writeLimiter) {
    return res.status(503).json({ error: 'Rate limiter not initialized' });
  }
  return writeLimiter(req, res, next);
}

// ---------- Venues Proximity Search ----------

router.get('/venues/near', async (req, res) => {
  try {
    const { location, radiusMiles = 10 } = req.query;

    // Get all approved Venues category suppliers
    let venues = (await dbUnified.read('suppliers')).filter(
      s => s.approved && s.category === 'Venues'
    );

    // If no location provided, return all venues
    if (!location || location.trim() === '') {
      // Add distance as null for all venues
      venues = venues.map(v => ({ ...v, distance: null }));

      return res.json({
        venues,
        total: venues.length,
        filtered: false,
        message: 'Showing all venues (no location filter)',
      });
    }

    // Try to geocode the location
    const coords = await geocoding.geocodeLocation(location);

    if (!coords) {
      // Could not geocode - return all venues with a warning
      venues = venues.map(v => ({ ...v, distance: null }));

      return res.json({
        venues,
        total: venues.length,
        filtered: false,
        radiusMiles: parseFloat(radiusMiles) || 10,
        warning: `Could not find location "${location}". Showing all venues.`,
      });
    }

    // Filter venues by proximity
    const radius = parseFloat(radiusMiles) || 10;

    // Calculate distance for each venue that has coordinates
    const venuesWithDistance = venues
      .map(venue => {
        if (
          venue.latitude !== null &&
          venue.latitude !== undefined &&
          venue.longitude !== null &&
          venue.longitude !== undefined
        ) {
          const distance = geocoding.calculateDistance(
            coords.latitude,
            coords.longitude,
            venue.latitude,
            venue.longitude
          );
          return { ...venue, distance };
        }
        // Venue without coordinates - exclude from proximity filter
        return null;
      })
      .filter(v => v !== null);

    // Filter by radius
    const nearbyVenues = venuesWithDistance.filter(v => v.distance <= radius);

    // Sort by distance
    nearbyVenues.sort((a, b) => a.distance - b.distance);

    res.json({
      venues: nearbyVenues,
      total: nearbyVenues.length,
      filtered: true,
      location: location,
      coordinates: coords,
      radiusMiles: radius,
      message: `Found ${nearbyVenues.length} venues within ${radius} miles of ${location}`,
    });
  } catch (error) {
    console.error('Venue proximity search error:', error);
    res.status(500).json({
      error: 'Failed to search venues',
      details: error.message,
    });
  }
});

// ---------- CAPTCHA Verification ----------

router.post('/verify-captcha', applyWriteLimiter, async (req, res) => {
  const { token } = req.body || {};
  const result = await verifyHCaptcha(token);

  if (result.success) {
    return res.json(result);
  } else {
    const statusCode = result.error === 'CAPTCHA verification not configured' ? 500 : 400;
    return res.status(statusCode).json(result);
  }
});

// ---------- Settings ----------

router.get('/me/settings', applyAuthRequired, async (req, res) => {
  const users = await dbUnified.read('users');
  const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ notify: users[i].notify !== false });
});

router.post('/me/settings', applyAuthRequired, applyCsrfProtection, async (req, res) => {
  const users = await dbUnified.read('users');
  const i = users.findIndex(u => u.id === req.user.id);
  if (i < 0) {
    return res.status(404).json({ error: 'Not found' });
  }
  users[i].notify = !!(req.body && req.body.notify);
  await dbUnified.write('users', users);
  res.json({ ok: true, notify: users[i].notify });
});

// ---------- Maintenance ----------

router.get('/maintenance/message', async (req, res) => {
  try {
    const settings = (await dbUnified.read('settings')) || {};
    const maintenance = settings.maintenance || {
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    };

    // Return public maintenance information
    res.json({
      enabled: maintenance.enabled,
      message: maintenance.message,
    });
  } catch (error) {
    console.error('Error reading maintenance message:', error);
    // Return default message on error
    res.status(200).json({
      enabled: false,
      message: "We're performing scheduled maintenance. We'll be back soon!",
    });
  }
});

// ---------- CSP Reporting ----------

// CSP Violation Reporting Endpoint
router.post('/csp-report', express.json({ type: 'application/csp-report' }), (req, res) => {
  console.warn('CSP Violation:', req.body);
  res.status(204).end();
});

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
