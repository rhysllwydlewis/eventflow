/**
 * Logging middleware for request/response tracking
 * Uses Morgan for HTTP request logging with custom format
 */

const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

/**
 * Custom Morgan token for response time in milliseconds
 */
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '';
  }

  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 + (res._startAt[1] - req._startAt[1]) * 1e-6;

  return ms.toFixed(3);
});

/**
 * Custom Morgan token for ISO timestamp
 */
morgan.token('iso-date', () => {
  return new Date().toISOString();
});

/**
 * Configure logging middleware
 * @param {Object} options - Configuration options
 * @param {string} options.logDir - Directory for log files (optional)
 * @param {string} options.environment - Environment (development/production)
 * @returns {Function} Express middleware
 */
function configureLogging(options = {}) {
  const { logDir, environment = process.env.NODE_ENV || 'development' } = options;

  // Custom format for detailed logging
  const detailedFormat =
    ':iso-date :method :url :status :response-time-ms ms - :res[content-length]';

  // Short format for development
  const devFormat = ':method :url :status :response-time-ms ms';

  const format = environment === 'production' ? detailedFormat : devFormat;

  // If log directory is specified, create it and write to file
  if (logDir) {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const accessLogPath = path.join(logDir, 'access.log');
      const accessLogStream = fs.createWriteStream(accessLogPath, { flags: 'a' });

      return morgan(format, { stream: accessLogStream });
    } catch (err) {
      console.warn('Failed to create log directory, using console logging:', err.message);
    }
  }

  // Default: log to console
  return morgan(format);
}

/**
 * Request duration tracking middleware
 * Adds custom timing information to requests
 */
function requestDurationMiddleware(req, res, next) {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to log duration
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Add duration to response headers (for debugging) - only if headers haven't been sent
    if (process.env.NODE_ENV !== 'production' && !res.headersSent) {
      res.setHeader('X-Response-Time', `${duration}ms`);
    }

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`⚠️  Slow request: ${req.method} ${req.url} took ${duration}ms`);
    }

    // Call original end function
    originalEnd.apply(res, args);
  };

  next();
}

module.exports = {
  configureLogging,
  requestDurationMiddleware,
};
