/**
 * Unit tests for authentication helpers
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-for-testing-only-minimum-32-characters-long';

describe('Authentication Helpers', () => {
  describe('JWT Token', () => {
    it('should generate valid JWT token', () => {
      const payload = { userId: '123', role: 'customer' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify valid JWT token', () => {
      const payload = { userId: '123', role: 'customer' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

      const decoded = jwt.verify(token, JWT_SECRET);

      expect(decoded.userId).toBe('123');
      expect(decoded.role).toBe('customer');
    });

    it('should reject invalid JWT token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        jwt.verify(invalidToken, JWT_SECRET);
      }).toThrow();
    });

    it('should reject expired JWT token', () => {
      const payload = { userId: '123', role: 'customer' };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '-1s' });

      expect(() => {
        jwt.verify(token, JWT_SECRET);
      }).toThrow('jwt expired');
    });
  });

  describe('Password Hashing', () => {
    it('should hash password', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(wrongPassword, hash);

      expect(isValid).toBe(false);
    });
  });
});
