/**
 * Legacy Messaging Deprecation Enforcement Middleware
 *
 * Controls behaviour of v1/v2/v3 messaging endpoints via the
 * LEGACY_MESSAGING_MODE environment variable:
 *
 *   off        – write requests return HTTP 410 Gone; reads still respond but
 *                carry deprecation headers.
 *   read-only  – same as "off" (default while migration window is open).
 *   on         – all requests pass through; deprecation headers are still set.
 *
 * Default: "read-only"
 *
 * All responses include the standard deprecation header suite regardless of
 * mode so that clients can detect the change:
 *   X-API-Deprecation
 *   X-API-Deprecation-Version
 *   X-API-Deprecation-Replacement
 *   X-API-Deprecation-Info
 *   X-API-Deprecation-Sunset
 */

'use strict';

const moduleLogger = require('../utils/logger');
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Build the deprecation middleware for a given API version.
 *
 * @param {object} opts
 * @param {'v1'|'v2'|'v3'} opts.version   - API version label.
 * @param {string}          opts.sunset    - ISO date string for sunset date.
 * @param {Function}        [opts.logger]  - Optional logger.warn function.
 * @returns {Function} Express middleware
 */
function createDeprecationMiddleware({ version, sunset, logger }) {
  return function legacyDeprecationMiddleware(req, res, next) {
    // Always set deprecation headers
    res.setHeader('X-API-Deprecation', 'true');
    res.setHeader('X-API-Deprecation-Version', version);
    res.setHeader('X-API-Deprecation-Sunset', sunset);
    res.setHeader('X-API-Deprecation-Replacement', '/api/v4/messenger');
    res.setHeader(
      'X-API-Deprecation-Info',
      `This ${version} API is deprecated and will be removed. ` +
        'Please migrate to /api/v4/messenger. ' +
        'See /docs/LEGACY_API_SHUTDOWN.md for migration guidance.'
    );

    const logFn =
      typeof logger === 'function'
        ? logger
        : msg => (logger || moduleLogger).warn(`[DEPRECATED API] ${msg}`);

    // Re-read mode every request so env-var changes in tests take effect
    const currentMode = (process.env.LEGACY_MESSAGING_MODE || 'read-only').toLowerCase();

    const isWrite = WRITE_METHODS.has(req.method.toUpperCase());

    if (currentMode === 'off' || currentMode === 'read-only') {
      if (isWrite) {
        logFn(
          `${version} write blocked (LEGACY_MESSAGING_MODE=${currentMode}): ` +
            `${req.method} ${req.originalUrl}`
        );
        return res.status(410).json({
          error: 'Gone',
          message:
            `This ${version} messaging endpoint has been shut down. ` +
            'Please migrate to /api/v4/messenger.',
          replacement: '/api/v4/messenger',
          docs: '/docs/LEGACY_API_SHUTDOWN.md',
        });
      }
    }

    // Log all deprecation usage (read or write when mode is "on")
    logFn(
      `${version} API called (LEGACY_MESSAGING_MODE=${currentMode}): ` +
        `${req.method} ${req.originalUrl} – migrate to /api/v4/messenger`
    );

    next();
  };
}

module.exports = { createDeprecationMiddleware };
