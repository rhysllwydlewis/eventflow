/**
 * Spam Detection Service
 * Detects and prevents spam messages
 */

'use strict';

/**
 * Rate limiter cache
 * Key: userId, Value: { count, resetAt }
 *
 * NOTE: This is an in-memory store and does NOT work correctly in clustered/multi-process
 * environments. Each process maintains its own independent counters, so rate limits can
 * be exceeded across processes.
 * TODO: Replace with a Redis-backed counter (using the optional ioredis client already
 * loaded in websocket-server-v2.js) to support clustered deployments.
 */
const rateLimitCache = new Map();

/**
 * Recent messages cache for duplicate detection
 * Key: userId, Value: [{ content, timestamp }]
 *
 * NOTE: Same in-memory clustering limitation as rateLimitCache above.
 */
const recentMessagesCache = new Map();

/**
 * Get spam keywords from environment
 */
function getSpamKeywords() {
  const keywords = process.env.SPAM_KEYWORDS || '';
  return keywords
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if user is rate limited
 * @param {string} userId - User ID
 * @param {number} maxPerMinute - Maximum messages per minute
 * @returns {Object} { limited: boolean, retryAfter: number }
 */
function checkRateLimit(userId, maxPerMinute = 30) {
  const now = Date.now();
  const cache = rateLimitCache.get(userId);

  if (!cache) {
    rateLimitCache.set(userId, {
      count: 1,
      resetAt: now + 60000, // 1 minute
    });
    return { limited: false, retryAfter: 0 };
  }

  // Reset if window expired
  if (now >= cache.resetAt) {
    rateLimitCache.set(userId, {
      count: 1,
      resetAt: now + 60000,
    });
    return { limited: false, retryAfter: 0 };
  }

  // Increment count
  cache.count++;

  if (cache.count > maxPerMinute) {
    const retryAfter = Math.ceil((cache.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  return { limited: false, retryAfter: 0 };
}

/**
 * Check for duplicate messages
 * @param {string} userId - User ID
 * @param {string} content - Message content
 * @param {number} windowSeconds - Detection window in seconds
 * @returns {boolean} True if duplicate detected
 */
function checkDuplicate(userId, content, windowSeconds = 5) {
  const now = Date.now();
  const normalized = content.trim().toLowerCase();

  let recent = recentMessagesCache.get(userId);
  if (!recent) {
    recent = [];
    recentMessagesCache.set(userId, recent);
  }

  // Clean expired entries
  const cutoff = now - windowSeconds * 1000;
  const filtered = recent.filter(msg => msg.timestamp > cutoff);

  // Check for duplicate
  const isDuplicate = filtered.some(msg => msg.content === normalized);

  // Add current message
  filtered.push({ content: normalized, timestamp: now });

  // Keep only last 10 messages
  if (filtered.length > 10) {
    filtered.shift();
  }

  recentMessagesCache.set(userId, filtered);

  return isDuplicate;
}

/**
 * Count URLs in message
 * @param {string} content - Message content
 * @returns {number} Number of URLs
 */
function countUrls(content) {
  if (!content || typeof content !== 'string') {
    return 0;
  }

  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  const matches = content.match(urlRegex);
  return matches ? matches.length : 0;
}

/**
 * Check for spam keywords
 * @param {string} content - Message content
 * @returns {Array<string>} Detected spam keywords
 */
function detectSpamKeywords(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const keywords = getSpamKeywords();
  const normalized = content.toLowerCase();
  const detected = [];

  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      detected.push(keyword);
    }
  }

  return detected;
}

/**
 * Check if message is spam
 * @param {string} userId - User ID
 * @param {string} content - Message content
 * @param {Object} options - Detection options
 * @returns {Object} { isSpam: boolean, reason: string, score: number }
 */
function checkSpam(userId, content, options = {}) {
  const {
    maxUrlCount = 5,
    maxPerMinute = 30,
    checkDuplicates = true,
    checkKeywords = true,
  } = options;

  let score = 0;
  const reasons = [];

  // Rate limit check
  const rateLimit = checkRateLimit(userId, maxPerMinute);
  if (rateLimit.limited) {
    score += 100;
    reasons.push(`Rate limit exceeded (${maxPerMinute} messages/minute)`);
  }

  // Duplicate check
  if (checkDuplicates && checkDuplicate(userId, content)) {
    score += 50;
    reasons.push('Duplicate message detected');
  }

  // URL spam check
  const urlCount = countUrls(content);
  if (urlCount > maxUrlCount) {
    score += 30 * (urlCount - maxUrlCount);
    reasons.push(`Excessive URLs (${urlCount})`);
  }

  // Keyword check
  if (checkKeywords) {
    const spamKeywords = detectSpamKeywords(content);
    if (spamKeywords.length > 0) {
      score += 20 * spamKeywords.length;
      reasons.push(`Spam keywords: ${spamKeywords.join(', ')}`);
    }
  }

  // Spam threshold
  const isSpam = score >= 50;

  return {
    isSpam,
    score,
    reason: reasons.join('; '),
    details: {
      rateLimit: rateLimit.limited ? rateLimit : null,
      urlCount,
      spamKeywords: checkKeywords ? detectSpamKeywords(content) : null,
    },
  };
}

/**
 * Clean up expired cache entries
 * Should be called periodically
 */
function cleanupCache() {
  const now = Date.now();

  // Clean rate limit cache
  for (const [userId, cache] of rateLimitCache.entries()) {
    if (now >= cache.resetAt) {
      rateLimitCache.delete(userId);
    }
  }

  // Clean recent messages cache
  for (const [userId, recent] of recentMessagesCache.entries()) {
    const filtered = recent.filter(msg => now - msg.timestamp < 60000); // Keep 1 minute
    if (filtered.length === 0) {
      recentMessagesCache.delete(userId);
    } else {
      recentMessagesCache.set(userId, filtered);
    }
  }
}

// Cleanup every 5 minutes
const cleanupInterval = setInterval(cleanupCache, 5 * 60 * 1000);

// Prevent this housekeeping timer from keeping Node.js/Jest processes alive.
if (typeof cleanupInterval.unref === 'function') {
  cleanupInterval.unref();
}

module.exports = {
  checkRateLimit,
  checkDuplicate,
  countUrls,
  detectSpamKeywords,
  checkSpam,
  cleanupCache,
};
