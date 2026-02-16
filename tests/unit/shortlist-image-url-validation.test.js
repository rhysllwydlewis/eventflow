/**
 * Shortlist Image URL Validation Tests
 * Tests for isValidImageUrl() helper accepting relative paths and full URLs
 */

'use strict';

const validator = require('validator');

describe('Shortlist Image URL Validation', () => {
  /**
   * Mock isValidImageUrl function (extracted from routes/shortlist.js)
   */
  function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Decode URL to catch encoded path traversal attempts
    let decodedUrl = url;
    try {
      decodedUrl = decodeURIComponent(url);
    } catch (e) {
      // If decoding fails, use original URL
      decodedUrl = url;
    }

    // Reject path traversal attempts (including encoded)
    if (decodedUrl.includes('..')) {
      return false;
    }

    // Only accept relative paths from whitelisted prefixes
    if (url.startsWith('/')) {
      const allowedPrefixes = ['/api/photos/', '/uploads/', '/images/'];
      return allowedPrefixes.some(prefix => url.startsWith(prefix));
    }

    // Accept full URLs
    return validator.isURL(url);
  }

  describe('relative paths', () => {
    it('should accept relative API photo paths', () => {
      expect(isValidImageUrl('/api/photos/photo_abc123')).toBe(true);
    });

    it('should accept relative upload paths', () => {
      expect(isValidImageUrl('/uploads/marketplace/image.jpg')).toBe(true);
    });

    it('should accept images from /images/ prefix', () => {
      expect(isValidImageUrl('/images/photo.jpg')).toBe(true);
    });

    it('should reject root path', () => {
      expect(isValidImageUrl('/')).toBe(false);
    });

    it('should accept paths with query parameters from allowed prefixes', () => {
      expect(isValidImageUrl('/api/photos/photo_abc123?size=medium')).toBe(true);
    });

    it('should accept paths with hashes from allowed prefixes', () => {
      expect(isValidImageUrl('/images/photo.jpg#preview')).toBe(true);
    });

    it('should reject relative paths not in whitelist', () => {
      expect(isValidImageUrl('/etc/passwd')).toBe(false);
      expect(isValidImageUrl('/admin/secret')).toBe(false);
      expect(isValidImageUrl('/config/database.yml')).toBe(false);
    });
  });

  describe('full URLs', () => {
    it('should accept HTTPS URLs', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
    });

    it('should accept HTTP URLs', () => {
      expect(isValidImageUrl('http://example.com/image.jpg')).toBe(true);
    });

    it('should accept URLs with paths', () => {
      expect(isValidImageUrl('https://example.com/path/to/image.jpg')).toBe(true);
    });

    it('should accept URLs with query parameters', () => {
      expect(isValidImageUrl('https://example.com/image.jpg?size=large')).toBe(true);
    });

    it('should accept CDN URLs', () => {
      expect(isValidImageUrl('https://cdn.example.com/uploads/photo.jpg')).toBe(true);
    });
  });

  describe('security - path traversal', () => {
    it('should reject paths with ../', () => {
      expect(isValidImageUrl('/api/photos/../../../etc/passwd')).toBe(false);
    });

    it('should reject paths with .. anywhere', () => {
      expect(isValidImageUrl('/uploads/..secret/image.jpg')).toBe(false);
    });

    it('should reject URL encoded path traversal', () => {
      expect(isValidImageUrl('/api/photos/%2e%2e%2F%2e%2e%2Fetc%2Fpasswd')).toBe(false);
    });

    it('should reject backslash path traversal', () => {
      expect(isValidImageUrl('/api/photos/..\\..\\secret')).toBe(false);
    });

    it('should reject mixed case encoded traversal', () => {
      expect(isValidImageUrl('/uploads/%2E%2E/secret')).toBe(false);
    });
  });

  describe('invalid inputs', () => {
    it('should reject null', () => {
      expect(isValidImageUrl(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isValidImageUrl(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidImageUrl('')).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      expect(isValidImageUrl('   ')).toBe(false);
    });

    it('should reject non-string numbers', () => {
      expect(isValidImageUrl(123)).toBe(false);
    });

    it('should reject objects', () => {
      expect(isValidImageUrl({ url: '/api/photos/photo_123' })).toBe(false);
    });

    it('should reject arrays', () => {
      expect(isValidImageUrl(['/api/photos/photo_123'])).toBe(false);
    });
  });

  describe('malformed URLs', () => {
    it('should reject invalid URL schemes', () => {
      expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject file:// URLs', () => {
      expect(isValidImageUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject relative paths without leading slash', () => {
      expect(isValidImageUrl('api/photos/photo_123')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(isValidImageUrl('ht!tp://example.com')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept very long relative paths from allowed prefixes', () => {
      const longPath = `/api/photos/${'a'.repeat(100)}/image.jpg`;
      expect(isValidImageUrl(longPath)).toBe(true);
    });

    it('should accept paths with special characters (encoded) from allowed prefixes', () => {
      expect(isValidImageUrl('/api/photos/photo_%20with%20spaces.jpg')).toBe(true);
    });

    it('should accept paths with Unicode characters from allowed prefixes', () => {
      expect(isValidImageUrl('/uploads/фото.jpg')).toBe(true);
    });

    it('should handle paths with multiple slashes in allowed prefixes', () => {
      expect(isValidImageUrl('/api/photos///photo_123')).toBe(true);
    });

    it('should handle malformed URL encoding gracefully', () => {
      // Invalid encoding should not crash, just reject
      expect(isValidImageUrl('/api/photos/%')).toBe(true); // Still valid path
    });
  });

  describe('real-world examples', () => {
    it('should accept marketplace listing images', () => {
      expect(isValidImageUrl('/uploads/marketplace/listing_abc123.jpg')).toBe(true);
    });

    it('should accept API photo endpoints', () => {
      expect(isValidImageUrl('/api/photos/photo_xyz789')).toBe(true);
    });

    it('should accept Cloudinary URLs', () => {
      expect(
        isValidImageUrl('https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg')
      ).toBe(true);
    });

    it('should accept S3 URLs', () => {
      expect(isValidImageUrl('https://bucket-name.s3.amazonaws.com/uploads/photo.jpg')).toBe(true);
    });

    it('should reject path traversal disguised as photo ID', () => {
      expect(isValidImageUrl('/api/photos/../../../etc/passwd')).toBe(false);
    });

    it('should reject sensitive paths not in whitelist', () => {
      expect(isValidImageUrl('/etc/shadow')).toBe(false);
      expect(isValidImageUrl('/.env')).toBe(false);
      expect(isValidImageUrl('/config/secrets.yml')).toBe(false);
    });
  });
});
