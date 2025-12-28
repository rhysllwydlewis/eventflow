/**
 * Token Validation Middleware
 * Provides middleware for extracting and validating verification tokens
 *
 * Features:
 * - Token extraction from multiple sources
 * - JWT validation with comprehensive error handling
 * - Legacy token support
 * - Rate limiting integration
 * - Detailed logging
 */

'use strict';

const {
  extractToken,
  validateVerificationToken,
  isJWTToken,
  debugToken,
  TOKEN_TYPES,
} = require('../utils/token');

/**
 * Middleware to extract and validate verification token
 * Attaches token validation result to req.tokenValidation
 *
 * @param {Object} options - Middleware options
 * @param {boolean} options.required - If true, returns error if token is missing
 * @param {boolean} options.allowGracePeriod - Allow expired tokens within grace period
 * @param {string} options.expectedType - Expected token type
 * @returns {Function} Express middleware
 */
function validateToken(options = {}) {
  const required = options.required !== false;
  const allowGracePeriod = options.allowGracePeriod !== false;
  const expectedType = options.expectedType || TOKEN_TYPES.EMAIL_VERIFICATION;

  return (req, res, next) => {
    const token = extractToken(req);

    console.log('🔍 Token validation middleware invoked');
    console.log(`   Required: ${required}`);
    console.log(`   Token present: ${!!token}`);
    console.log(`   Expected type: ${expectedType}`);

    // Handle missing token
    if (!token) {
      if (required) {
        console.error('❌ Token validation failed: Missing token');
        return res.status(400).json({
          error: 'Missing verification token',
          code: 'MISSING_TOKEN',
          message:
            'No verification token was provided. Please check your email for the verification link.',
        });
      }

      req.tokenValidation = {
        present: false,
        valid: false,
      };
      return next();
    }

    // Check if it's a JWT token
    const isJWT = isJWTToken(token);
    console.log(`   Token type: ${isJWT ? 'JWT' : 'Legacy'}`);

    // Debug token in development
    if (process.env.NODE_ENV !== 'production') {
      const debug = debugToken(token);
      console.log('   Debug info:', JSON.stringify(debug, null, 2));
    }

    // Validate JWT token
    if (isJWT) {
      const validation = validateVerificationToken(token, {
        allowGracePeriod,
        expectedType,
      });

      if (!validation.valid) {
        console.error(`❌ Token validation failed: ${validation.error}`);
        console.error(`   Message: ${validation.message}`);

        return res.status(400).json({
          error: validation.message,
          code: validation.error,
          canResend: validation.canResend,
          expiredAt: validation.expiredAt,
        });
      }

      console.log('✅ JWT token validated successfully');
      req.tokenValidation = {
        present: true,
        valid: true,
        isJWT: true,
        userId: validation.userId,
        email: validation.email,
        type: validation.type,
        issuedAt: validation.issuedAt,
        expiresAt: validation.expiresAt,
        withinGracePeriod: validation.withinGracePeriod,
      };

      return next();
    }

    // Handle legacy tokens
    console.log('⚠️ Legacy token detected - will be validated by route handler');
    req.tokenValidation = {
      present: true,
      valid: false, // Route handler will validate
      isJWT: false,
      legacyToken: token,
    };

    return next();
  };
}

/**
 * Middleware to require a valid JWT token (no legacy support)
 * Returns error if token is invalid or not a JWT
 */
function requireJWTToken(options = {}) {
  const allowGracePeriod = options.allowGracePeriod !== false;
  const expectedType = options.expectedType || TOKEN_TYPES.EMAIL_VERIFICATION;

  return (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
      return res.status(400).json({
        error: 'Missing verification token',
        code: 'MISSING_TOKEN',
      });
    }

    if (!isJWTToken(token)) {
      console.warn('⚠️ Legacy token rejected - JWT required');
      return res.status(400).json({
        error:
          'This verification link format is no longer supported. Please request a new verification email.',
        code: 'LEGACY_TOKEN_NOT_SUPPORTED',
        canResend: true,
      });
    }

    const validation = validateVerificationToken(token, {
      allowGracePeriod,
      expectedType,
    });

    if (!validation.valid) {
      return res.status(400).json({
        error: validation.message,
        code: validation.error,
        canResend: validation.canResend,
        expiredAt: validation.expiredAt,
      });
    }

    req.tokenValidation = {
      present: true,
      valid: true,
      isJWT: true,
      userId: validation.userId,
      email: validation.email,
      type: validation.type,
      issuedAt: validation.issuedAt,
      expiresAt: validation.expiresAt,
      withinGracePeriod: validation.withinGracePeriod,
    };

    next();
  };
}

/**
 * Debug middleware to log token information (development only)
 */
function debugTokenMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  const token = extractToken(req);
  if (token) {
    console.log('🔍 Token Debug Middleware');
    console.log('   Token:', `${token.substring(0, 30)}...`);
    console.log('   Is JWT:', isJWTToken(token));
    console.log('   Debug:', JSON.stringify(debugToken(token), null, 2));
  }

  next();
}

module.exports = {
  validateToken,
  requireJWTToken,
  debugTokenMiddleware,
};
