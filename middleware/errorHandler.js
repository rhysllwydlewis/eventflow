/**
 * Error Handler Middleware
 * Centralized error handling and 404 handler
 */

'use strict';

const logger = require('../utils/logger');
const sentry = require('../utils/sentry');
const { BaseError } = require('../errors');

/**
 * 404 Handler - Must be added after all routes
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function notFoundHandler(req, res) {
  // Check if request is for API endpoint
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Not Found',
      message: `API endpoint ${req.path} does not exist`,
      path: req.path,
    });
  }

  // For non-API routes, send 404 page or redirect to home
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Page Not Found - EventFlow</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        h1 { font-size: 4rem; margin: 0; }
        p { font-size: 1.2rem; }
        a {
          display: inline-block;
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 0.5rem;
          font-weight: 600;
        }
        a:hover { opacity: 0.9; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/">Go to Homepage</a>
      </div>
    </body>
    </html>
  `);
}

/**
 * Map known errors to HTTP status codes
 * @param {Error} err - Error object
 * @returns {number} - HTTP status code
 */
function getErrorStatusCode(err) {
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return 403;
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return 413;
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return 400;
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return 400;
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return 401;
  }

  // Default to provided status or 500
  return err.status || err.statusCode || 500;
}

/**
 * Get user-friendly error message based on error type
 * @param {Error} err - Error object
 * @param {boolean} isProduction - Whether in production mode
 * @returns {string} - Error message
 */
function getErrorMessage(err, isProduction) {
  // Don't leak error details in production for server errors
  if (isProduction && getErrorStatusCode(err) >= 500) {
    return 'Internal Server Error';
  }

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return 'Access denied: Origin not allowed';
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return 'File size exceeds the maximum allowed limit';
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return 'Too many files uploaded';
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return 'Unexpected file field';
  }

  // Return the original error message for known error types
  return err.message || 'An error occurred';
}

/**
 * Global Error Handler - Must be added after all routes and middlewares
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} _next - Express next function (unused)
 */
function errorHandler(err, req, res, _next) {
  // Handle BaseError instances with their built-in status codes
  if (err instanceof BaseError) {
    logger.error('Error:', {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
      path: req.path,
      method: req.method,
    });

    // Capture server errors in Sentry
    if (err.statusCode >= 500) {
      sentry.captureException(err, {
        tags: {
          path: req.path,
          method: req.method,
          statusCode: err.statusCode,
        },
      });
    }

    return res.status(err.statusCode).json({
      error: err.toJSON(),
    });
  }

  // Handle other errors with legacy logic
  const statusCode = getErrorStatusCode(err);
  const isProduction = process.env.NODE_ENV === 'production';

  // Log error (but not CORS rejections at error level)
  if (err.message === 'Not allowed by CORS') {
    logger.warn('CORS rejection:', {
      origin: req.headers.origin,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Error:', {
      message: err.message,
      code: err.code,
      stack: isProduction ? undefined : err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Capture in Sentry (except for expected client errors)
  if (statusCode >= 500) {
    sentry.captureException(err, {
      tags: {
        path: req.path,
        method: req.method,
        statusCode,
      },
    });
  }

  // Get user-friendly error message
  const errorMessage = getErrorMessage(err, isProduction);
  const errorStack = isProduction ? undefined : err.stack;

  // Send JSON error response
  res.status(statusCode).json({
    error: errorMessage,
    status: statusCode,
    ...(err.code && { code: err.code }),
    ...(errorStack && { stack: errorStack }),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
