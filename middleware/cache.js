/**
 * Cache Middleware
 * Provides HTTP caching with Redis/memory cache and ETag support
 */

'use strict';

const cache = require('../cache');

/**
 * Cache middleware for GET requests
 * @param {Object} options - Cache options
 * @param {number} options.ttl - Time to live in seconds (default: 300)
 * @param {Function} options.keyGenerator - Function to generate cache key
 * @param {boolean} options.etag - Enable ETag support (default: true)
 * @returns {Function} Express middleware
 */
function cacheMiddleware(options = {}) {
  const {
    ttl = 300,
    keyGenerator = req => `cache:${req.method}:${req.originalUrl}`,
    etag = true,
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      // Check cache
      const cachedData = await cache.get(cacheKey);

      if (cachedData) {
        // Check ETag if enabled
        if (etag && cachedData.etag) {
          const clientETag = req.headers['if-none-match'];
          if (clientETag === cachedData.etag) {
            return res.status(304).end();
          }
        }

        // Add cache headers
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', `public, max-age=${ttl}`);

        if (etag && cachedData.etag) {
          res.set('ETag', cachedData.etag);
        }

        return res.json(cachedData.data);
      }

      // Cache miss - intercept response
      res.set('X-Cache', 'MISS');
      res.set('Cache-Control', `public, max-age=${ttl}`);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache response
      res.json = function (data) {
        const etagValue = etag ? cache.generateETag(data) : null;

        if (etagValue) {
          res.set('ETag', etagValue);
        }

        // Cache the response
        cache.set(cacheKey, { data, etag: etagValue }, ttl).catch(err => {
          console.error('Cache set error:', err);
        });

        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * Invalidates cache on write operations (POST, PUT, PATCH, DELETE)
 * @param {Object} options - Invalidation options
 * @param {Function} options.patternGenerator - Function to generate cache key pattern
 * @returns {Function} Express middleware
 */
function invalidateCacheMiddleware(options = {}) {
  const { patternGenerator = req => `cache:GET:${req.baseUrl}*` } = options;

  return async (req, res, next) => {
    // Only invalidate on write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const pattern = patternGenerator(req);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to invalidate after response
      res.json = function (data) {
        // Invalidate cache after successful response
        const statusCode = res.statusCode;
        if (statusCode >= 200 && statusCode < 300) {
          cache.delPattern(pattern).catch(err => {
            console.error('Cache invalidation error:', err);
          });
        }

        return originalJson(data);
      };
    }

    next();
  };
}

/**
 * Cache warming middleware
 * Preloads critical data into cache on startup
 * @param {Function} warmingFunction - Async function that returns data to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} Express middleware
 */
function cacheWarmingMiddleware(warmingFunction, ttl = 3600) {
  return async (req, res, next) => {
    try {
      const data = await warmingFunction();
      if (data) {
        await cache.warmCache(data, ttl);
        console.log('✅ Cache warmed with critical data');
      }
    } catch (error) {
      console.error('Cache warming error:', error);
    }
    next();
  };
}

/**
 * Conditional cache middleware
 * Only caches if condition function returns true
 * @param {Function} condition - Function that returns true/false
 * @param {Object} options - Cache options (same as cacheMiddleware)
 * @returns {Function} Express middleware
 */
function conditionalCacheMiddleware(condition, options = {}) {
  const cacheMw = cacheMiddleware(options);

  return (req, res, next) => {
    if (condition(req)) {
      return cacheMw(req, res, next);
    }
    next();
  };
}

module.exports = {
  cacheMiddleware,
  invalidateCacheMiddleware,
  cacheWarmingMiddleware,
  conditionalCacheMiddleware,
};
