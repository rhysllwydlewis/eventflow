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
  legacyHeaders: false,
});

/**
 * Rate limiter for write operations
 * 80 requests per 10 minutes
 */
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for email resend operations
 * 3 requests per 15 minutes per email address
 */
const resendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many resend requests. Please try again in 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => {
    // Rate limit by email address to prevent abuse of a single account
    return req.body.email || req.ip;
  },
});

module.exports = {
  authLimiter,
  writeLimiter,
  resendEmailLimiter,
};
