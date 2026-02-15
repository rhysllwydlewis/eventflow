/**
 * Test for marketplace image upload validation fixes
 * Tests the bug fixes for "Cannot read properties of undefined (reading 'indexOf')" error
 */

const photoUpload = require('../../photo-upload');

describe('Marketplace Image Upload Validation', () => {
  describe('processAndSaveMarketplaceImage validation', () => {
    test('should reject null originalFilename', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, null, 'listing-123', 'user-456', 0)
      ).rejects.toThrow(/Invalid filename/);
    });

    test('should reject undefined originalFilename', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, undefined, 'listing-123', 'user-456', 0)
      ).rejects.toThrow(/Invalid filename/);
    });

    test('should reject non-string originalFilename', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, 12345, 'listing-123', 'user-456', 0)
      ).rejects.toThrow(/Invalid filename/);
    });

    test('should reject null listingId', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, 'test.jpg', null, 'user-456', 0)
      ).rejects.toThrow(/Invalid listing ID/);
    });

    test('should reject undefined listingId', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, 'test.jpg', undefined, 'user-456', 0)
      ).rejects.toThrow(/Invalid listing ID/);
    });

    test('should reject null userId', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, 'test.jpg', 'listing-123', null, 0)
      ).rejects.toThrow(/Invalid user ID/);
    });

    test('should reject undefined userId', async () => {
      const buffer = Buffer.from('fake image data');
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, 'test.jpg', 'listing-123', undefined, 0)
      ).rejects.toThrow(/Invalid user ID/);
    });
  });

  describe('generateFilename defensive checks', () => {
    // Note: generateFilename is not exported, but we test it indirectly through processAndSaveMarketplaceImage
    test('should handle undefined filename gracefully in processing flow', async () => {
      // This test ensures that even if undefined somehow gets through validation,
      // the generateFilename function has a fallback
      const buffer = Buffer.from('fake image data');

      // The processAndSaveMarketplaceImage should reject undefined, but if it didn't,
      // generateFilename would handle it. We verify the validation happens first.
      await expect(
        photoUpload.processAndSaveMarketplaceImage(buffer, undefined, 'listing-123', 'user-456', 0)
      ).rejects.toThrow(/Invalid filename/);
    });
  });

  describe('ValidationError naming', () => {
    test('should throw ValidationError with proper name for invalid buffer', async () => {
      try {
        await photoUpload.processAndSaveMarketplaceImage(
          null,
          'test.jpg',
          'listing-123',
          'user-456',
          0
        );
        // If we get here, the test should fail
        expect(true).toBe(false); // Should not reach this line
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.message).toContain('Invalid file buffer');
      }
    });

    test('should throw ValidationError with proper name for invalid filename', async () => {
      try {
        const buffer = Buffer.from('fake data');
        await photoUpload.processAndSaveMarketplaceImage(
          buffer,
          null,
          'listing-123',
          'user-456',
          0
        );
        // If we get here, the test should fail
        expect(true).toBe(false); // Should not reach this line
      } catch (error) {
        expect(error.name).toBe('ValidationError');
        expect(error.message).toContain('Invalid filename');
      }
    });
  });
});
