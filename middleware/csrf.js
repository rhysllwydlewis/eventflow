const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 * Implements the Double-Submit Cookie pattern for CSRF protection
 *
 * How it works:
 * 1. Server generates a random CSRF token
 * 2. Token is set as a cookie (NOT HttpOnly, so JavaScript can read it)
 * 3. Client reads the cookie and includes it in the X-CSRF-Token header
 * 4. Server validates that cookie value matches header value
 *
 * Security properties:
 * - SameSite=Strict/Lax prevents cookie from being sent in cross-site requests
 * - Secure flag ensures cookie only sent over HTTPS in production
 * - No server-side storage required (stateless)
 * - Attacker cannot read cookie from different origin (same-origin policy)
 */

/**
 * Generate a CSRF token
 * @returns {string} The generated token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware
 * Validates that the CSRF token in the request header matches the cookie
 * Uses the Double-Submit Cookie pattern
 */
function csrfProtection(req, res, next) {
  // Skip CSRF protection in test environment for easier testing
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  // Skip CSRF for GET, HEAD, OPTIONS requests (safe methods)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body (supports legacy aliases)
  const tokenFromHeader =
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'] ||
    req.headers['x-xsrf-token'] ||
    req.body?._csrf ||
    req.body?.csrfToken ||
    req.body?.csrf;

  if (!tokenFromHeader) {
    return res.status(403).json({
      error: 'CSRF token missing',
      errorType: 'CSRFError',
      canRetry: true,
    });
  }

  // Get token from cookie (supports legacy alias)
  const tokenFromCookie = req.cookies?.csrf || req.cookies?.csrfToken;

  if (!tokenFromCookie) {
    return res.status(403).json({
      error: 'CSRF token missing',
      errorType: 'CSRFError',
      canRetry: true,
    });
  }

  // Validate that header token matches cookie token
  if (tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      errorType: 'CSRFError',
      canRetry: true,
    });
  }

  // Token is valid, proceed
  next();
}

/**
 * Get or create a CSRF token and set it as a cookie
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {string} The CSRF token
 */
function getToken(req, res) {
  // Check if a token already exists in the cookie (new or legacy name)
  let token = req.cookies?.csrf || req.cookies?.csrfToken;

  // If no token exists, generate a new one
  if (!token) {
    token = generateToken();
  }

  // Set the CSRF cookie
  // NOT HttpOnly - client needs to read it to send in header
  // SameSite=Lax for better compatibility while still providing CSRF protection
  // Note: SameSite=Strict would provide stronger protection but may break
  // legitimate cross-site navigation (e.g., external links to admin panel)
  // SameSite=Lax blocks CSRF on state-changing requests while allowing navigation
  // Secure only in production (HTTPS)
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: false, // Client needs to read this cookie
    secure: isProduction, // Only send over HTTPS in production
    sameSite: 'lax', // Lax for compatibility, can use 'strict' for stronger protection
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  };

  // Canonical cookie name used by current clients.
  res.cookie('csrf', token, cookieOptions);
  // Legacy compatibility cookie for older clients still reading csrfToken.
  res.cookie('csrfToken', token, cookieOptions);

  return token;
}

module.exports = {
  csrfProtection,
  getToken,
  generateToken,
};
