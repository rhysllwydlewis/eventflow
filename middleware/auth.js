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
 */
function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: isProd ? 'strict' : 'lax',
    secure: isProd,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

/**
 * Clear authentication cookie
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
    return res.status(401).json({ error: 'Unauthenticated' });
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
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden' });
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
