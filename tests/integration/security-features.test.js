/**
 * Integration tests for 2FA, Email, and Phone Verification
 * Tests the core functionality of security features
 */

'use strict';

const { encrypt, decrypt, hash, verifyHash, generateToken } = require('../../utils/encryption');
const speakeasy = require('speakeasy');

describe('Security Features Integration Tests', () => {
  describe('Encryption Utilities', () => {
    test('encrypt and decrypt should work correctly', () => {
      const original = 'test-secret-data';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original);
      expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    });

    test('hash and verifyHash should work correctly', () => {
      const value = 'BACKUP-CODE-1234';
      const hashed = hash(value);

      expect(verifyHash(value, hashed)).toBe(true);
      expect(verifyHash('wrong-value', hashed)).toBe(false);
      expect(hashed).toHaveLength(64); // SHA256 produces 64 hex chars
    });

    test('generateToken should produce unique tokens', () => {
      const token1 = generateToken(32);
      const token2 = generateToken(32);

      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(token2).toHaveLength(64);
    });

    test('encrypt should handle null values', () => {
      expect(encrypt(null)).toBeNull();
      expect(decrypt(null)).toBeNull();
    });
  });

  describe('2FA Token Generation', () => {
    test('speakeasy should generate valid secrets', () => {
      const secret = speakeasy.generateSecret({
        name: 'TestApp',
        issuer: 'EventFlow',
      });

      expect(secret).toHaveProperty('base32');
      expect(secret).toHaveProperty('otpauth_url');
      expect(secret.otpauth_url).toContain('otpauth://');
    });

    test('speakeasy TOTP verification should work', () => {
      const secret = speakeasy.generateSecret();
      const token = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32',
      });

      const verified = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token,
        window: 2,
      });

      expect(verified).toBe(true);
    });

    test('speakeasy should reject invalid tokens', () => {
      const secret = speakeasy.generateSecret();

      const verified = speakeasy.totp.verify({
        secret: secret.base32,
        encoding: 'base32',
        token: '000000',
        window: 0,
      });

      expect(verified).toBe(false);
    });
  });

  describe('Backup Codes', () => {
    test('backup codes should be unique', () => {
      const codes = Array.from({ length: 10 }, () =>
        require('crypto').randomBytes(4).toString('hex').toUpperCase()
      );

      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);

      // Check format
      codes.forEach(code => {
        expect(code).toMatch(/^[0-9A-F]{8}$/);
      });
    });

    test('hashed backup codes should be verifiable', () => {
      const codes = ['ABCD1234', 'EFGH5678', '12345678'];
      const hashedCodes = codes.map(code => hash(code));

      // Should verify correct codes
      expect(verifyHash('ABCD1234', hashedCodes[0])).toBe(true);
      expect(verifyHash('EFGH5678', hashedCodes[1])).toBe(true);

      // Should reject wrong codes
      expect(verifyHash('WRONG123', hashedCodes[0])).toBe(false);
      expect(verifyHash('abcd1234', hashedCodes[0])).toBe(false); // Case sensitive
    });
  });

  describe('Phone Verification Code Generation', () => {
    test('should generate 6-digit codes', () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      expect(code).toHaveLength(6);
      expect(parseInt(code, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code, 10)).toBeLessThanOrEqual(999999);
    });

    test('phone numbers should be validated correctly', () => {
      const validPhoneNumbers = ['+447123456789', '+14155552671', '+61412345678'];

      const invalidPhoneNumbers = [
        '0123456789', // Starts with 0
        'not-a-number',
        '+0000000000', // Invalid country code starting with 0
      ];

      const phoneRegex = /^\+?[1-9]\d{1,14}$/;

      validPhoneNumbers.forEach(phone => {
        expect(phoneRegex.test(phone.replace(/\s/g, ''))).toBe(true);
      });

      invalidPhoneNumbers.forEach(phone => {
        expect(phoneRegex.test(phone.replace(/\s/g, ''))).toBe(false);
      });
    });
  });

  describe('Email Verification Token Generation', () => {
    test('should generate secure random tokens', () => {
      const token1 = require('crypto').randomBytes(32).toString('hex');
      const token2 = require('crypto').randomBytes(32).toString('hex');

      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });
  });

  describe('2FA Secret Encryption', () => {
    test('should encrypt and decrypt 2FA secrets correctly', () => {
      const secret = speakeasy.generateSecret();
      const encrypted = encrypt(secret.base32);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(secret.base32);

      // Verify the decrypted secret still works with speakeasy
      const token = speakeasy.totp({
        secret: decrypted,
        encoding: 'base32',
      });

      const verified = speakeasy.totp.verify({
        secret: decrypted,
        encoding: 'base32',
        token,
        window: 2,
      });

      expect(verified).toBe(true);
    });
  });
});
