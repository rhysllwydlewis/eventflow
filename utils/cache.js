/**
 * Cache Utility
 * Simple in-memory caching layer for frequently accessed data
 */

'use strict';

const logger = require('./logger');

// Simple in-memory cache store
const cache = new Map();

/**
 * Get data from cache
 * @param {string} key - Cache key
 * @returns {*} - Cached data or undefined
 */
function getCachedData(key) {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  // Check if entry has expired
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  logger.debug(`Cache hit: ${key}`);
  return entry.data;
}

/**
 * Set data in cache with optional TTL
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttl - Time to live in seconds (default: 600 = 10 minutes)
 * @returns {*} - The cached data
 */
function setCachedData(key, data, ttl = 600) {
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;

  cache.set(key, {
    data,
    expiresAt,
    createdAt: Date.now(),
  });

  logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
  return data;
}

/**
 * Invalidate a specific cache key
 * @param {string} key - Cache key to invalidate
 */
function invalidateCache(key) {
  const deleted = cache.delete(key);
  if (deleted) {
    logger.debug(`Cache invalidated: ${key}`);
  }
  return deleted;
}

/**
 * Invalidate all cache keys matching a pattern
 * @param {string} pattern - Pattern to match (e.g., 'user:')
 * @returns {number} - Number of keys invalidated
 */
function invalidateCachePattern(pattern) {
  let count = 0;

  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      count++;
    }
  }

  if (count > 0) {
    logger.debug(`Cache pattern invalidated: ${pattern} (${count} keys)`);
  }

  return count;
}

/**
 * Clear all cache entries
 */
function clearCache() {
  const size = cache.size;
  cache.clear();
  logger.debug(`Cache cleared (${size} keys)`);
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats
 */
function getCacheStats() {
  let expired = 0;
  const now = Date.now();

  for (const entry of cache.values()) {
    if (entry.expiresAt && now > entry.expiresAt) {
      expired++;
    }
  }

  return {
    size: cache.size,
    active: cache.size - expired,
    expired,
  };
}

/**
 * Clean up expired cache entries
 * @returns {number} - Number of entries removed
 */
function cleanupExpiredCache() {
  let removed = 0;
  const now = Date.now();

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt && now > entry.expiresAt) {
      cache.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    logger.debug(`Cache cleanup: ${removed} expired entries removed`);
  }

  return removed;
}

// Run cleanup every 5 minutes
const cacheCleanupInterval = setInterval(cleanupExpiredCache, 5 * 60 * 1000);
// Prevent this housekeeping timer from keeping Node.js/Jest processes alive.
if (typeof cacheCleanupInterval.unref === 'function') {
  cacheCleanupInterval.unref();
}

module.exports = {
  getCachedData,
  setCachedData,
  invalidateCache,
  invalidateCachePattern,
  clearCache,
  getCacheStats,
  cleanupExpiredCache,
};
