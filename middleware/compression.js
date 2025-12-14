/**
 * Compression middleware for response optimization
 * Adds gzip/brotli compression for HTTP responses
 */

const compression = require('compression');

/**
 * Configure compression middleware
 * @returns {Function} Express middleware
 */
function configureCompression() {
  return compression({
    // Only compress responses larger than 1kb
    threshold: 1024,
    
    // Compression level (0-9, where 6 is default balance between speed and ratio)
    level: 6,
    
    // Filter function to determine what to compress
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Use compression's default filter
      return compression.filter(req, res);
    },
  });
}

module.exports = configureCompression;
