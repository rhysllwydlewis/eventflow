/**
 * API Versioning Middleware
 * Provides version routing and backward compatibility support
 */

'use strict';

/**
 * Extract API version from request path
 * @param {Request} req - Express request object
 * @returns {string|null} - Version string (e.g., 'v1', 'v2') or null if not versioned
 */
function getApiVersion(req) {
  const versionMatch = req.path.match(/^\/api\/(v\d+)/);
  return versionMatch ? versionMatch[1] : null;
}

/**
 * API Version middleware - adds version info to request object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
function apiVersionMiddleware(req, res, next) {
  const version = getApiVersion(req);
  req.apiVersion = version || 'v1'; // Default to v1 if not specified

  // Add version to response headers
  res.setHeader('X-API-Version', req.apiVersion);

  next();
}

/**
 * Version compatibility checker
 * Returns true if the requested version is supported
 * @param {string} version - Version to check (e.g., 'v1', 'v2')
 * @returns {boolean} - Whether the version is supported
 */
function isSupportedVersion(version) {
  const supportedVersions = ['v1', 'v2'];
  return supportedVersions.includes(version);
}

/**
 * Version requirement middleware
 * Rejects requests with unsupported API versions
 * @param {Array<string>} versions - Array of supported versions
 * @returns {Function} Express middleware function
 */
function requireVersion(...versions) {
  return (req, res, next) => {
    const requestedVersion = req.apiVersion || 'v1';

    if (!versions.includes(requestedVersion)) {
      return res.status(400).json({
        error: 'Unsupported API version',
        requestedVersion,
        supportedVersions: versions,
      });
    }

    next();
  };
}

/**
 * Deprecation warning middleware
 * Adds deprecation headers for older API versions
 * @param {string} version - Version to deprecate
 * @param {string} sunsetDate - ISO date when version will be removed
 * @returns {Function} Express middleware function
 */
function deprecateVersion(version, sunsetDate) {
  return (req, res, next) => {
    if (req.apiVersion === version) {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', sunsetDate);
      res.setHeader('Link', '</api/v2>; rel="successor-version"');
    }
    next();
  };
}

module.exports = {
  apiVersionMiddleware,
  getApiVersion,
  isSupportedVersion,
  requireVersion,
  deprecateVersion,
};
