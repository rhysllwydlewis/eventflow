/**
 * Rate Limiting Middleware
 * Configures rate limiters for different types of requests
 */

'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for authentication routes
 * 100 requests per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for write operations
 * 80 requests per 10 minutes
 */
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authLimiter,
  writeLimiter
};
