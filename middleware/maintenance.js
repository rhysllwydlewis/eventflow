/**
 * Maintenance Mode Middleware
 * Checks if maintenance mode is enabled and blocks non-admin users
 */

'use strict';

const { read } = require('../store');

/**
 * Middleware to check maintenance mode
 * If enabled, non-admin users are redirected to maintenance page
 * Admins can still access the site normally
 */
function maintenanceMode(req, res, next) {
  try {
    // Get maintenance settings
    const settings = read('settings') || {};
    const maintenance = settings.maintenance || { enabled: false };

    // If maintenance mode is not enabled, continue normally
    if (!maintenance.enabled) {
      return next();
    }

    // Allow access to maintenance page itself
    if (req.path === '/maintenance.html') {
      return next();
    }

    // Allow access to auth page for admin login
    if (req.path === '/auth.html' || req.path.startsWith('/api/auth')) {
      return next();
    }

    // Allow access to verification page (users need to verify their accounts)
    if (req.path === '/verify.html') {
      return next();
    }

    // Allow access to static assets
    if (req.path.startsWith('/assets/') || req.path.startsWith('/favicon')) {
      return next();
    }

    // Allow admins to access the site normally
    if (req.user && req.user.role === 'admin') {
      return next();
    }

    // For API requests from non-admin users, return 503
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        maintenance: true,
        message:
          maintenance.message || "We're performing scheduled maintenance. We'll be back soon!",
      });
    }

    // For HTML requests from non-admin users, redirect to maintenance page
    res.redirect('/maintenance.html');
  } catch (error) {
    console.error('Error in maintenance middleware:', error);
    // On error, allow access (fail-open for safety)
    next();
  }
}

module.exports = maintenanceMode;
