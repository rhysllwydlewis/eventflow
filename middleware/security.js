/**
 * Security Middleware
 * Configures Helmet CSP, CORS, and rate limiting
 */

'use strict';

const helmet = require('helmet');
// cors is used in server.js via require('cors')
// eslint-disable-next-line no-unused-vars
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Configure Helmet with Content Security Policy
 * @returns {Function} Helmet middleware
 */
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // 'unsafe-inline' needed for inline event handlers (onclick, onerror) in HTML
          // TODO: Refactor to remove inline handlers and eliminate this directive
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://cdn.socket.io',
          'https://cdn.tidycal.net',
          'https://estatic.com',
          'https://*.estatic.com',
          'https://maps.googleapis.com',
          'https://*.googleapis.com',
          'https://maps.gstatic.com',
          'https://*.gstatic.com',
          'https://googletagmanager.com',
          'https://*.googletagmanager.com',
          'https://hcaptcha.com',
          'https://*.hcaptcha.com',
          'https://js.stripe.com',
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers (onclick, onerror, etc.)
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: [
          "'self'",
          'data:',
          'https:', // Allows all HTTPS images
          'blob:',
          // Explicitly list Pexels domains for documentation and clarity
          // even though 'https:' already allows them
          'https://images.pexels.com',
          'https://*.pexels.com',
        ],
        connectSrc: [
          "'self'",
          'https:',
          'wss:',
          'ws:',
          'https://googletagmanager.com',
          'https://*.googletagmanager.com',
          'https://*.google-analytics.com',
          'https://*.analytics.google.com',
          'https://*.tidycal.net',
          'https://hcaptcha.com',
          'https://*.hcaptcha.com',
          'https://api.stripe.com',
        ],
        frameSrc: [
          "'self'",
          'https://www.google.com',
          'https://maps.google.com',
          'https://tidycal.com',
          'https://*.tidycal.com',
          'https://hcaptcha.com',
          'https://*.hcaptcha.com',
          'https://js.stripe.com',
          'https://hooks.stripe.com',
        ],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
        reportUri: '/api/csp-report',
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: false, // Don't enable preload yet (requires all subdomains on HTTPS)
    },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: 'nosniff',
    xDnsPrefetchControl: { allow: false },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

/**
 * Configure CORS with proper origin handling
 * @param {boolean} isProduction - Whether running in production
 * @returns {Object} CORS options
 */
function configureCORS(isProduction = false) {
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Get allowed origins from BASE_URL environment variable
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const allowedOrigins = [baseUrl];

      // If BASE_URL contains www, also allow non-www version and vice versa
      if (baseUrl.includes('www.')) {
        allowedOrigins.push(baseUrl.replace('www.', ''));
      } else if (baseUrl.includes('://')) {
        const [protocol, domain] = baseUrl.split('://');
        allowedOrigins.push(`${protocol}://www.${domain}`);
      }

      // For development, allow localhost on any port
      if (!isProduction) {
        allowedOrigins.push('http://localhost:3000');
        allowedOrigins.push('http://localhost:3001');
        allowedOrigins.push('http://127.0.0.1:3000');
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all origins but log warning
        logger.warn(`CORS request from non-configured origin: ${origin}`);
      }
    },
    credentials: true, // Allow cookies to be sent with requests
    optionsSuccessStatus: 200,
  };
}

/**
 * Create rate limiters for different types of requests
 * @returns {Object} Rate limiter instances
 */
function createRateLimiters() {
  return {
    // General auth limiter - 100 requests per 15 minutes
    authLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),

    // Strict auth limiter - 10 requests per 15 minutes
    strictAuthLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many requests. Please try again later.',
    }),

    // Password reset limiter - 5 requests per 15 minutes
    passwordResetLimiter: rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many password reset attempts. Please try again later.',
    }),

    // Write operations limiter - 80 requests per 10 minutes
    writeLimiter: rateLimit({
      windowMs: 10 * 60 * 1000,
      max: 80,
      standardHeaders: true,
      legacyHeaders: false,
    }),

    // Health check limiter - 60 requests per minute
    healthCheckLimiter: rateLimit({
      windowMs: 1 * 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      message: 'Too many health check requests',
    }),
  };
}

/**
 * Configure HTTPS redirect for production
 * @param {boolean} isProduction - Whether running in production
 * @returns {Function} Express middleware
 */
function configureHTTPSRedirect(isProduction = false) {
  return (req, res, next) => {
    if (!isProduction) {
      return next();
    }

    // Skip HTTPS redirect for health check and readiness endpoints
    if (req.path === '/api/health' || req.path === '/api/ready') {
      return next();
    }

    // Check if request is not secure (HTTP)
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';

    if (!isSecure) {
      // Redirect to HTTPS
      const httpsUrl = process.env.BASE_URL || `https://${req.headers.host}`;
      const redirectUrl = `${httpsUrl}${req.url}`;
      return res.redirect(301, redirectUrl);
    }

    // Check for non-www to www redirect (only if BASE_URL contains www)
    const configuredBaseUrl = process.env.BASE_URL || '';
    if (
      configuredBaseUrl.includes('www.') &&
      req.headers.host &&
      !req.headers.host.startsWith('www.')
    ) {
      const wwwUrl = `https://www.${req.headers.host}${req.url}`;
      return res.redirect(301, wwwUrl);
    }

    next();
  };
}

module.exports = {
  configureHelmet,
  configureCORS,
  createRateLimiters,
  configureHTTPSRedirect,
};
