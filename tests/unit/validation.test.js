/**
 * Unit tests for validation middleware
 */

const { passwordOk } = require('../../middleware/validation');

describe('Validation Middleware', () => {
  describe('passwordOk', () => {
    it('should accept valid password with letters and numbers', () => {
      expect(passwordOk('Password123')).toBe(true);
      expect(passwordOk('test1234')).toBe(true);
      expect(passwordOk('MyP@ssw0rd')).toBe(true);
    });

    it('should reject password shorter than 8 characters', () => {
      expect(passwordOk('Pass1')).toBe(false);
      expect(passwordOk('abc123')).toBe(false);
      expect(passwordOk('Test1')).toBe(false);
    });

    it('should reject password without letters', () => {
      expect(passwordOk('12345678')).toBe(false);
      expect(passwordOk('99999999')).toBe(false);
    });

    it('should reject password without numbers', () => {
      expect(passwordOk('password')).toBe(false);
      expect(passwordOk('TestPassword')).toBe(false);
      expect(passwordOk('abcdefgh')).toBe(false);
    });

    it('should reject non-string input', () => {
      expect(passwordOk(null)).toBe(false);
      expect(passwordOk(undefined)).toBe(false);
      expect(passwordOk(123)).toBe(false);
      expect(passwordOk({})).toBe(false);
      expect(passwordOk([])).toBe(false);
    });

    it('should reject empty string', () => {
      expect(passwordOk('')).toBe(false);
    });

    it('should accept password with special characters', () => {
      expect(passwordOk('P@ssw0rd!')).toBe(true);
      expect(passwordOk('Test#1234')).toBe(true);
    });

    it('should accept password with uppercase and lowercase', () => {
      expect(passwordOk('ABCdef123')).toBe(true);
      expect(passwordOk('TeStPaSs1')).toBe(true);
    });

    it('should accept minimum valid password (8 chars, letter + number)', () => {
      expect(passwordOk('aaaaaaa1')).toBe(true);
      expect(passwordOk('1aaaaaaa')).toBe(true);
      expect(passwordOk('test0000')).toBe(true);
    });
  });
});
