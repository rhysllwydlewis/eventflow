/**
 * Sentry Error Tracking and Performance Monitoring
 * Provides error tracking for both backend and frontend
 */

'use strict';

const logger = require('./logger');

let Sentry = null;
let sentryEnabled = false;

/**
 * Initialize Sentry for Node.js backend
 * @param {Object} app - Express app instance
 * @returns {boolean} Whether Sentry was initialized
 */
function initSentry(app) {
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!sentryDsn) {
    logger.info('ℹ️  Sentry DSN not configured, error tracking disabled');
    return false;
  }

  try {
    // eslint-disable-next-line global-require, node/no-missing-require
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn: sentryDsn,
      environment,
      release: process.env.npm_package_version
        ? `eventflow@${process.env.npm_package_version}`
        : undefined,
      // Performance monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
      // Set sampling rate for profiling
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
      // Enable automatic instrumentation
      integrations: [
        // HTTP instrumentation
        new Sentry.Integrations.Http({ tracing: true }),
        // Express instrumentation
        new Sentry.Integrations.Express({ app }),
        // MongoDB instrumentation
        new Sentry.Integrations.Mongo({ useMongoose: false }),
        // Redis instrumentation (if available)
        ...(Sentry.Integrations.Redis ? [new Sentry.Integrations.Redis()] : []),
      ],
      // BeforeSend hook for filtering/modifying events
      beforeSend(event) {
        // Don't send events in test environment
        if (environment === 'test') {
          return null;
        }

        // Filter out sensitive data
        if (event.request) {
          delete event.request.cookies;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
          }
        }

        return event;
      },
    });

    sentryEnabled = true;
    logger.info('✅ Sentry error tracking initialized');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Sentry:', error.message);
    return false;
  }
}

/**
 * Get Sentry request handler middleware
 * Must be the first middleware
 * @returns {Function} Express middleware
 */
function getRequestHandler() {
  if (sentryEnabled && Sentry) {
    return Sentry.Handlers.requestHandler();
  }
  return (req, res, next) => next();
}

/**
 * Get Sentry tracing middleware
 * Should be after requestHandler
 * @returns {Function} Express middleware
 */
function getTracingHandler() {
  if (sentryEnabled && Sentry) {
    return Sentry.Handlers.tracingHandler();
  }
  return (req, res, next) => next();
}

/**
 * Get Sentry error handler middleware
 * Must be before other error handlers
 * @returns {Function} Express middleware
 */
function getErrorHandler() {
  if (sentryEnabled && Sentry) {
    return Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture all errors with status >= 500
        if (error.status >= 500) {
          return true;
        }
        // Capture specific error types
        return error.name === 'UnhandledPromiseRejection' || error.name === 'Error';
      },
    });
  }
  return (err, req, res, next) => next(err);
}

/**
 * Capture exception manually
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
function captureException(error, context = {}) {
  if (sentryEnabled && Sentry) {
    Sentry.captureException(error, {
      tags: context.tags || {},
      extra: context.extra || {},
      user: context.user || {},
      level: context.level || 'error',
    });
  } else {
    logger.error('Error:', error, 'Context:', context);
  }
}

/**
 * Capture message manually
 * @param {string} message - Message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
function captureMessage(message, level = 'info', context = {}) {
  if (sentryEnabled && Sentry) {
    Sentry.captureMessage(message, {
      level,
      tags: context.tags || {},
      extra: context.extra || {},
      user: context.user || {},
    });
  } else {
    logger.log(level, message, context);
  }
}

/**
 * Set user context for error tracking
 * @param {Object} user - User information
 */
function setUser(user) {
  if (sentryEnabled && Sentry) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
  }
}

/**
 * Clear user context
 */
function clearUser() {
  if (sentryEnabled && Sentry) {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for tracking user actions
 * @param {Object} breadcrumb - Breadcrumb data
 */
function addBreadcrumb(breadcrumb) {
  if (sentryEnabled && Sentry) {
    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category || 'custom',
      level: breadcrumb.level || 'info',
      data: breadcrumb.data || {},
    });
  }
}

/**
 * Create transaction for performance monitoring
 * @param {string} name - Transaction name
 * @param {string} op - Operation type
 * @returns {Object} Transaction object
 */
function startTransaction(name, op = 'http') {
  if (sentryEnabled && Sentry) {
    return Sentry.startTransaction({
      name,
      op,
    });
  }
  // Return mock transaction if Sentry is not enabled
  return {
    finish: () => {},
    setTag: () => {},
    setData: () => {},
  };
}

/**
 * Flush pending events (useful before shutdown)
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<boolean>} Whether flush was successful
 */
async function flush(timeout = 2000) {
  if (sentryEnabled && Sentry) {
    try {
      await Sentry.flush(timeout);
      return true;
    } catch (error) {
      logger.error('Sentry flush error:', error);
      return false;
    }
  }
  return true;
}

/**
 * Close Sentry client
 * @returns {Promise<boolean>} Whether close was successful
 */
async function close() {
  if (sentryEnabled && Sentry) {
    try {
      await Sentry.close(2000);
      return true;
    } catch (error) {
      logger.error('Sentry close error:', error);
      return false;
    }
  }
  return true;
}

/**
 * Check if Sentry is enabled
 * @returns {boolean} Whether Sentry is enabled
 */
function isEnabled() {
  return sentryEnabled;
}

module.exports = {
  initSentry,
  getRequestHandler,
  getTracingHandler,
  getErrorHandler,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  startTransaction,
  flush,
  close,
  isEnabled,
};
