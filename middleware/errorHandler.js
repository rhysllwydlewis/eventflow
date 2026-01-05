/**
 * Error Handler Middleware
 * Centralized error handling and 404 handler
 */

'use strict';

const logger = require('../utils/logger');
const sentry = require('../utils/sentry');

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
 * Global Error Handler - Must be added after all routes and middlewares
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} _next - Express next function (unused)
 */
function errorHandler(err, req, res, _next) {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Capture in Sentry
  sentry.captureException(err);

  // Don't leak error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction ? 'Internal Server Error' : err.message;
  const errorStack = isProduction ? undefined : err.stack;

  // Send error response
  res.status(err.status || 500).json({
    error: errorMessage,
    ...(errorStack && { stack: errorStack }),
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
