/**
 * Authentication and Authorization Middleware
 * Handles JWT verification, role-based access control, and auth helpers
 */

'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = String(process.env.JWT_SECRET || 'change_me');

/**
 * Set authentication cookie with JWT token
 * @param {Object} res - Express response object
 * @param {string} token - JWT token to set in cookie
 * @param {Object} options - Cookie options
 * @param {boolean} options.remember - If true, persists for 7 days; if false, session-only
 */
function setAuthCookie(res, token, options = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    secure: isProd,
  };

  // If remember is true, set maxAge for 7 days; otherwise, no maxAge (session-only)
  if (options.remember) {
    cookieOptions.maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days
  }
  // If remember is false or not set, cookie expires when browser closes (session-only)

  res.cookie('token', token, cookieOptions);
}

/**
 * Clear authentication cookie
 * Clears cookie with multiple domain configurations to ensure cleanup across www/apex variants
 * @param {Object} res - Express response object
 */
function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';

  // Clear cookie with same options used when setting it
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    secure: isProd,
    path: '/',
  });

  // Also clear without path option for legacy compatibility
  res.clearCookie('token');

  // In production, also try clearing with domain variants to handle www/apex domain cases
  if (isProd) {
    // Try clearing with explicit domain for production domains
    // This handles cases where cookie may have been set with domain=.event-flow.co.uk
    // SECURITY: Use environment variable to avoid hardcoding production domain
    const productionDomain = process.env.COOKIE_DOMAIN || '.event-flow.co.uk';
    const domains = [productionDomain];

    // Also try without leading dot if provided with dot
    if (productionDomain.startsWith('.')) {
      domains.push(productionDomain.substring(1));
    }

    domains.forEach(domain => {
      res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
        path: '/',
        domain: domain,
      });
    });
  }
}

/**
 * Extract and verify user from JWT cookie
 * @param {Object} req - Express request object
 * @returns {Object|null} User object or null if not authenticated
 */
function getUserFromCookie(req) {
  const t = req.cookies && req.cookies.token;
  if (!t) {
    return null;
  }
  try {
    return jwt.verify(t, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Middleware to require authentication
 * Verifies JWT token and attaches user to request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function authRequired(req, res, next) {
  const u = getUserFromCookie(req);
  if (!u) {
    // Log 401 for debugging (use logger if available, otherwise console)
    const logger = typeof require !== 'undefined' ? 
      (function() { try { return require('../utils/logger'); } catch(e) { return null; } })() : null;
    
    if (logger) {
      logger.warn('Authentication required but no valid user found', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    } else {
      console.warn('Auth required - 401:', {
        path: req.path,
        method: req.method
      });
    }
    
    return res.status(401).json({
      error: 'Unauthenticated',
      message: 'Please log in to access this resource.',
    });
  }
  req.user = u;
  // Also expose userId for routes that rely on it
  req.userId = u.id;
  next();
}

/**
 * Middleware factory to require specific role
 * @param {string} role - Required role (admin, supplier, customer)
 * @returns {Function} Express middleware function
 */
function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthenticated',
        message: 'Please log in to access this resource.',
      });
    }
    if (req.user.role !== role) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires ${role} role. Your current role is ${req.user.role}.`,
      });
    }
    next();
  };
}

/**
 * Middleware to check if user owns a plan
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function planOwnerOnly(req, res, next) {
  const { read } = require('../store');
  const plans = read('plans');
  const p = plans.find(x => x.userId === req.userId);
  if (!p) {
    return res.status(404).json({ error: 'No plan found' });
  }
  req.plan = p;
  next();
}

module.exports = {
  setAuthCookie,
  clearAuthCookie,
  getUserFromCookie,
  authRequired,
  roleRequired,
  planOwnerOnly,
};
