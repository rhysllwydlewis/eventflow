const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * Generates and validates CSRF tokens for state-changing operations
 */

// Store tokens in memory (in production, use session storage or Redis)
const tokenStore = new Map();

// Token expiration time (1 hour)
const TOKEN_EXPIRY = 60 * 60 * 1000;

/**
 * Generate a CSRF token
 * @returns {string} The generated token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware to generate and attach CSRF token to requests
 * Should be used before routes that need CSRF protection
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const token = req.headers['x-csrf-token'] || req.body?._csrf;

  if (!token) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  // Validate token
  const storedData = tokenStore.get(token);
  
  if (!storedData) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Check if token has expired
  if (Date.now() > storedData.expiresAt) {
    tokenStore.delete(token);
    return res.status(403).json({ error: 'CSRF token expired' });
  }

  // Token is valid, proceed
  next();
}

/**
 * Get or create a CSRF token
 * @param {Object} req - Express request object
 * @returns {string} The CSRF token
 */
function getToken(req) {
  // In a session-based system, you would store this in req.session
  // For now, we'll generate a new token each time
  const token = generateToken();
  const expiresAt = Date.now() + TOKEN_EXPIRY;
  
  tokenStore.set(token, {
    createdAt: Date.now(),
    expiresAt: expiresAt
  });

  return token;
}

/**
 * Cleanup expired tokens periodically
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(token);
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupExpiredTokens, 15 * 60 * 1000);

module.exports = {
  csrfProtection,
  getToken,
  generateToken
};
