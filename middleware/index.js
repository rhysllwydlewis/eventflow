/**
 * Central Middleware Exports
 * Consolidates all middleware modules for easy import
 */

const { configureSecurityHeaders, configureRateLimiting } = require('./security');
const { errorHandler, notFoundHandler, asyncHandler } = require('./errorHandler');
const {
  authRequired,
  roleRequired,
  getUserFromCookie,
  setAuthCookie,
  clearAuthCookie,
} = require('./auth');

module.exports = {
  // Security
  configureSecurityHeaders,
  configureRateLimiting,

  // Error handling
  errorHandler,
  notFoundHandler,
  asyncHandler,

  // Authentication
  authRequired,
  roleRequired,
  getUserFromCookie,
  setAuthCookie,
  clearAuthCookie,
};
