/**
 * Compression middleware for response optimization
 * Supports both Brotli and gzip compression for HTTP responses
 * Brotli is preferred when client supports it (better compression ratio)
 */

const compression = require('compression');
const zlib = require('zlib');

/**
 * Configure compression middleware with Brotli support
 * @returns {Function} Express middleware
 */
function configureCompression() {
  return compression({
    // Only compress responses larger than 1kb
    threshold: 1024,

    // Compression level (0-9 for gzip, where 6 is default balance between speed and ratio)
    level: 6,

    // Brotli compression parameters (when Brotli is available and client supports it)
    brotli: {
      enabled: true,
      zlib: {
        params: {
          // Brotli quality level (0-11, where 4 is good balance for dynamic content)
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      },
    },

    // Filter function to determine what to compress
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Don't compress responses with Cache-Control: no-transform
      const cacheControl = res.getHeader('Cache-Control');
      if (cacheControl && cacheControl.includes('no-transform')) {
        return false;
      }

      // Use compression's default filter (compresses text-based content types)
      return compression.filter(req, res);
    },
  });
}

module.exports = configureCompression;
