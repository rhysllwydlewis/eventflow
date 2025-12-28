/**
 * Unit tests for JWT token utilities
 * Tests token generation, validation, expiration, and security features
 */

const tokenUtils = require('../../utils/token');
const jwt = require('jsonwebtoken');

describe('Token Utilities', () => {
  const JWT_SECRET = 'test-secret-key-for-testing-only-minimum-32-characters-long';
  const originalSecret = process.env.JWT_SECRET;
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    if (originalSecret) {
      process.env.JWT_SECRET = originalSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
    process.env.NODE_ENV = originalEnv;
  });

  describe('generateVerificationToken', () => {
    it('should generate a valid JWT token for a user', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts

      // Verify it's a valid JWT
      const decoded = jwt.decode(token);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.email).toBe(user.email.toLowerCase());
      expect(decoded.type).toBe(tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION);
      expect(decoded.ver).toBe(tokenUtils.TOKEN_VERSION);
    });

    it('should normalize email to lowercase', () => {
      const user = {
        id: 'user123',
        email: 'Test@EXAMPLE.COM',
      };

      const token = tokenUtils.generateVerificationToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.email).toBe('test@example.com');
    });

    it('should include expiration time', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeTruthy();
      expect(decoded.iat).toBeTruthy();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);

      // Should expire in 24 hours (within 1 second margin)
      const expectedExpiry = decoded.iat + 24 * 60 * 60;
      expect(Math.abs(decoded.exp - expectedExpiry)).toBeLessThan(2);
    });

    it('should support custom expiration time', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user, {
        expiresInHours: 1,
      });

      const decoded = jwt.decode(token);
      const expectedExpiry = decoded.iat + 1 * 60 * 60;
      expect(Math.abs(decoded.exp - expectedExpiry)).toBeLessThan(2);
    });

    it('should support custom token type', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user, {
        type: tokenUtils.TOKEN_TYPES.PASSWORD_RESET,
      });

      const decoded = jwt.decode(token);
      expect(decoded.type).toBe(tokenUtils.TOKEN_TYPES.PASSWORD_RESET);
    });

    it('should throw error if user is missing', () => {
      expect(() => {
        tokenUtils.generateVerificationToken(null);
      }).toThrow('User object must contain id and email');
    });

    it('should throw error if user id is missing', () => {
      expect(() => {
        tokenUtils.generateVerificationToken({ email: 'test@example.com' });
      }).toThrow('User object must contain id and email');
    });

    it('should throw error if user email is missing', () => {
      expect(() => {
        tokenUtils.generateVerificationToken({ id: 'user123' });
      }).toThrow('User object must contain id and email');
    });

    it('should include token version', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.ver).toBe(tokenUtils.TOKEN_VERSION);
    });
  });

  describe('validateVerificationToken', () => {
    it('should validate a valid token', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);
      const validation = tokenUtils.validateVerificationToken(token);

      expect(validation.valid).toBe(true);
      expect(validation.userId).toBe(user.id);
      expect(validation.email).toBe(user.email.toLowerCase());
      expect(validation.type).toBe(tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION);
      expect(validation.issuedAt).toBeInstanceOf(Date);
      expect(validation.expiresAt).toBeInstanceOf(Date);
    });

    it('should reject missing token', () => {
      const validation = tokenUtils.validateVerificationToken(null);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('MISSING_TOKEN');
      expect(validation.message).toContain('required');
    });

    it('should reject empty token', () => {
      const validation = tokenUtils.validateVerificationToken('');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('MISSING_TOKEN');
    });

    it('should reject invalid token format', () => {
      const validation = tokenUtils.validateVerificationToken('invalid-token');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('INVALID_FORMAT');
    });

    it('should reject tampered token', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);
      // Tamper with the token
      const tamperedToken = `${token.substring(0, token.length - 5)}XXXXX`;

      const validation = tokenUtils.validateVerificationToken(tamperedToken);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('INVALID_SIGNATURE');
    });

    it('should reject expired token', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      // Generate token that expires immediately
      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          type: tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION,
          ver: tokenUtils.TOKEN_VERSION,
          iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const validation = tokenUtils.validateVerificationToken(token, {
        allowGracePeriod: false,
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('TOKEN_EXPIRED');
      expect(validation.canResend).toBe(true);
      expect(validation.expiredAt).toBeInstanceOf(Date);
    });

    it('should accept expired token within grace period', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      // Generate token that expired 2 minutes ago (within grace period)
      const now = Math.floor(Date.now() / 1000);
      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          type: tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION,
          ver: tokenUtils.TOKEN_VERSION,
          iat: now - 3600, // 1 hour ago
          exp: now - 120, // 2 minutes ago
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const validation = tokenUtils.validateVerificationToken(token, {
        allowGracePeriod: true,
      });

      expect(validation.valid).toBe(true);
      expect(validation.withinGracePeriod).toBe(true);
    });

    it('should reject token with wrong version', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          type: tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION,
          ver: tokenUtils.TOKEN_VERSION + 1, // Wrong version
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        JWT_SECRET,
        { algorithm: 'HS256' }
      );

      const validation = tokenUtils.validateVerificationToken(token);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('TOKEN_REVOKED');
    });

    it('should reject token with wrong type', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user, {
        type: tokenUtils.TOKEN_TYPES.PASSWORD_RESET,
      });

      const validation = tokenUtils.validateVerificationToken(token, {
        expectedType: tokenUtils.TOKEN_TYPES.EMAIL_VERIFICATION,
      });

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('WRONG_TOKEN_TYPE');
    });
  });

  describe('isJWTToken', () => {
    it('should identify JWT tokens', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);
      expect(tokenUtils.isJWTToken(token)).toBe(true);
    });

    it('should reject non-JWT tokens', () => {
      expect(tokenUtils.isJWTToken('verify_abc123xyz789')).toBe(false);
      expect(tokenUtils.isJWTToken('random-token')).toBe(false);
      expect(tokenUtils.isJWTToken('123456')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(tokenUtils.isJWTToken(null)).toBe(false);
      expect(tokenUtils.isJWTToken(undefined)).toBe(false);
    });

    it('should reject non-string values', () => {
      expect(tokenUtils.isJWTToken(123)).toBe(false);
      expect(tokenUtils.isJWTToken({})).toBe(false);
      expect(tokenUtils.isJWTToken([])).toBe(false);
    });
  });

  describe('extractToken', () => {
    it('should extract token from query parameter', () => {
      const req = {
        query: { token: 'test-token' },
        body: {},
        headers: {},
      };

      expect(tokenUtils.extractToken(req)).toBe('test-token');
    });

    it('should extract token from body', () => {
      const req = {
        query: {},
        body: { token: 'test-token' },
        headers: {},
      };

      expect(tokenUtils.extractToken(req)).toBe('test-token');
    });

    it('should extract token from Authorization header', () => {
      const req = {
        query: {},
        body: {},
        headers: {
          authorization: 'Bearer test-token',
        },
      };

      expect(tokenUtils.extractToken(req)).toBe('test-token');
    });

    it('should extract token from custom header', () => {
      const req = {
        query: {},
        body: {},
        headers: {
          'x-verification-token': 'test-token',
        },
      };

      expect(tokenUtils.extractToken(req)).toBe('test-token');
    });

    it('should prioritize query parameter over body', () => {
      const req = {
        query: { token: 'query-token' },
        body: { token: 'body-token' },
        headers: {},
      };

      expect(tokenUtils.extractToken(req)).toBe('query-token');
    });

    it('should return null if no token found', () => {
      const req = {
        query: {},
        body: {},
        headers: {},
      };

      expect(tokenUtils.extractToken(req)).toBeNull();
    });
  });

  describe('generateRandomToken', () => {
    it('should generate random token with prefix', () => {
      const token1 = tokenUtils.generateRandomToken('verify');
      const token2 = tokenUtils.generateRandomToken('verify');

      expect(token1).toMatch(/^verify_[a-f0-9]{64}$/);
      expect(token2).toMatch(/^verify_[a-f0-9]{64}$/);
      expect(token1).not.toBe(token2); // Should be unique
    });

    it('should use default prefix if not provided', () => {
      const token = tokenUtils.generateRandomToken();
      expect(token).toMatch(/^token_[a-f0-9]{64}$/);
    });
  });

  describe('maskEmail', () => {
    it('should mask email address', () => {
      expect(tokenUtils.maskEmail('test@example.com')).toBe('t***@example.com'); // 3 asterisks
      expect(tokenUtils.maskEmail('a@example.com')).toBe('*@example.com'); // 1 char gets masked
      expect(tokenUtils.maskEmail('ab@example.com')).toBe('**@example.com'); // 2 chars, both masked
      expect(tokenUtils.maskEmail('abc@example.com')).toBe('a**@example.com'); // >2 chars, show first + mask rest
      expect(tokenUtils.maskEmail('verylongemail@example.com')).toBe('v*****@example.com'); // max 5 asterisks
    });

    it('should handle invalid email', () => {
      expect(tokenUtils.maskEmail('invalid')).toBe('***');
      expect(tokenUtils.maskEmail('')).toBe('***');
      expect(tokenUtils.maskEmail(null)).toBe('***');
    });
  });

  describe('formatTimeAgo', () => {
    it('should format time correctly', () => {
      const now = new Date();

      expect(tokenUtils.formatTimeAgo(new Date(now - 30 * 1000))).toBe('just now');
      expect(tokenUtils.formatTimeAgo(new Date(now - 2 * 60 * 1000))).toBe('2 minutes ago');
      expect(tokenUtils.formatTimeAgo(new Date(now - 1 * 60 * 1000))).toBe('1 minute ago');
      expect(tokenUtils.formatTimeAgo(new Date(now - 2 * 60 * 60 * 1000))).toBe('2 hours ago');
      expect(tokenUtils.formatTimeAgo(new Date(now - 1 * 60 * 60 * 1000))).toBe('1 hour ago');
      expect(tokenUtils.formatTimeAgo(new Date(now - 2 * 24 * 60 * 60 * 1000))).toBe('2 days ago');
      expect(tokenUtils.formatTimeAgo(new Date(now - 1 * 24 * 60 * 60 * 1000))).toBe('1 day ago');
    });
  });

  describe('debugToken', () => {
    it('should return debug information in test environment', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      const token = tokenUtils.generateVerificationToken(user);
      const debug = tokenUtils.debugToken(token);

      expect(debug.isJWT).toBe(true);
      expect(debug.header).toBeTruthy();
      expect(debug.payload).toBeTruthy();
      expect(debug.payload.email).toContain('*'); // Should be masked
      expect(debug.isExpired).toBe(false);
      expect(debug.versionValid).toBe(true);
    });

    it('should handle invalid tokens', () => {
      const debug = tokenUtils.debugToken('invalid-token');
      expect(debug.isJWT).toBe(false);
      expect(debug.format).toBeTruthy();
    });

    it('should handle null token', () => {
      const debug = tokenUtils.debugToken(null);
      expect(debug.error).toBe('No token provided');
    });
  });
});
