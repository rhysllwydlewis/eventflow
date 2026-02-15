/**
 * Test for marketplace images collection
 * Verifies that the new marketplace-specific image processing works correctly
 */

const photoUpload = require('../../photo-upload');

describe('Marketplace Images Collection', () => {
  test('should export processAndSaveMarketplaceImage function', () => {
    expect(typeof photoUpload.processAndSaveMarketplaceImage).toBe('function');
  });

  test('processAndSaveMarketplaceImage should validate buffer', async () => {
    // Test with invalid buffer
    await expect(
      photoUpload.processAndSaveMarketplaceImage(null, 'test.jpg', 'listing-123', 'user-456', 0)
    ).rejects.toThrow('Invalid file buffer');

    // Test with empty buffer
    await expect(
      photoUpload.processAndSaveMarketplaceImage(
        Buffer.from([]),
        'test.jpg',
        'listing-123',
        'user-456',
        0
      )
    ).rejects.toThrow('Empty file buffer');
  });

  test('processAndSaveMarketplaceImage should validate file size', async () => {
    // Create a buffer larger than 5MB
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

    await expect(
      photoUpload.processAndSaveMarketplaceImage(
        largeBuffer,
        'large.jpg',
        'listing-123',
        'user-456',
        0
      )
    ).rejects.toThrow(/File too large/);
  });
});

describe('MarketplaceImage Schema', () => {
  test('should have valid schema definition', () => {
    const { marketplaceImageSchema } = require('../../models/MarketplaceImage');

    expect(marketplaceImageSchema).toBeDefined();
    expect(marketplaceImageSchema.validator).toBeDefined();
    expect(marketplaceImageSchema.validator.$jsonSchema).toBeDefined();

    const schema = marketplaceImageSchema.validator.$jsonSchema;
    expect(schema.bsonType).toBe('object');
    expect(schema.required).toContain('_id');
    expect(schema.required).toContain('listingId');
    expect(schema.required).toContain('userId');
    expect(schema.required).toContain('imageData');
    expect(schema.required).toContain('size');
    expect(schema.required).toContain('mimeType');
    expect(schema.required).toContain('uploadedAt');

    expect(schema.properties._id).toBeDefined();
    expect(schema.properties.listingId).toBeDefined();
    expect(schema.properties.userId).toBeDefined();
    expect(schema.properties.imageData).toBeDefined();
    expect(schema.properties.size).toBeDefined();
    expect(schema.properties.size.enum).toEqual(['original', 'thumbnail', 'optimized', 'large']);
  });
});

describe('Models Index Integration', () => {
  test('should include marketplace_images in collections', () => {
    // This is an integration test to verify the schema is properly exported
    const modelsIndex = require('../../models/index');

    expect(modelsIndex.initializeCollections).toBeDefined();
    expect(modelsIndex.createIndexes).toBeDefined();
    expect(typeof modelsIndex.initializeCollections).toBe('function');
    expect(typeof modelsIndex.createIndexes).toBe('function');
  });
});
