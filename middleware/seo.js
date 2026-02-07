/**
 * SEO Middleware
 * Handles noindex headers and other SEO-related concerns
 */

'use strict';

const logger = require('../utils/logger');

/**
 * Noindex Middleware for Non-Public Pages
 * Adds X-Robots-Tag header to prevent indexing of authenticated/private pages
 * CRITICAL: Must come before express.static() so it intercepts HTML file requests
 * @returns {Function} Express middleware
 */
function noindexMiddleware() {
  // List of non-public pages that should not be indexed
  const noindexPaths = [
    '/auth.html',
    '/reset-password.html',
    '/dashboard.html',
    '/dashboard-customer.html',
    '/dashboard-supplier.html',
    '/messages.html',
    '/guests.html',
    '/checkout.html',
    '/my-marketplace-listings.html',
  ];

  return (req, res, next) => {
    // Check if path matches a noindex page (exact match)
    if (noindexPaths.includes(req.path)) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      logger.info(`X-Robots-Tag noindex applied to ${req.path}`);
    }

    // Also apply to admin pages (already blocked by middleware, but extra defense)
    if (req.path.startsWith('/admin') && req.path.endsWith('.html')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    next();
  };
}

module.exports = {
  noindexMiddleware,
};
