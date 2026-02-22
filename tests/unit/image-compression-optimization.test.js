/**
 * Tests for image compression optimization
 * Verifies that enhanced compression settings are applied
 */

describe('Image Compression Optimization', () => {
  test('IMAGE_CONFIGS should have optimized quality settings', () => {
    const photoUpload = require('../../photo-upload');

    expect(photoUpload.IMAGE_CONFIGS).toBeDefined();
    expect(photoUpload.IMAGE_CONFIGS.thumbnail.quality).toBe(75);
    expect(photoUpload.IMAGE_CONFIGS.optimized.quality).toBe(82);
    expect(photoUpload.IMAGE_CONFIGS.large.quality).toBe(85);
    expect(photoUpload.IMAGE_CONFIGS.avatar.quality).toBe(85);
  });

  test('processWithMetadataStripping should use optimized JPEG settings', () => {
    const fs = require('fs');
    const path = require('path');
    const uploadValidation = fs.readFileSync(
      path.join(__dirname, '../../utils/uploadValidation.js'),
      'utf8'
    );

    // Verify advanced compression options are enabled
    expect(uploadValidation).toContain('chromaSubsampling');
    expect(uploadValidation).toContain('optimizeScans');
    expect(uploadValidation).toContain('trellisQuantisation');
    expect(uploadValidation).toContain('overshootDeringing');
    expect(uploadValidation).toContain('optimizeQuantizationTable');
    expect(uploadValidation).toContain('mozjpeg: true');
  });

  test('photo-upload should log compression statistics', () => {
    const fs = require('fs');
    const path = require('path');
    const photoUpload = fs.readFileSync(path.join(__dirname, '../../photo-upload.js'), 'utf8');

    // Verify compression statistics logging is present
    expect(photoUpload).toContain('compression statistics');
    expect(photoUpload).toContain('compressionStats');
    expect(photoUpload).toContain('bytesSaved');
    expect(photoUpload).toContain('compressionRatio');
    expect(photoUpload).toContain('actualStorageUsed');
    expect(photoUpload).toContain('storageWithoutCompression');
  });

  test('marketplace image processing should log compression stats', () => {
    const fs = require('fs');
    const path = require('path');
    const photoUpload = fs.readFileSync(path.join(__dirname, '../../photo-upload.js'), 'utf8');

    // Verify marketplace-specific compression logging
    expect(photoUpload).toContain('Marketplace image compression statistics');
  });

  test('quality settings should be reduced for better compression', () => {
    const photoUpload = require('../../photo-upload');

    // Thumbnail quality should be lower (was 80, now 75)
    expect(photoUpload.IMAGE_CONFIGS.thumbnail.quality).toBeLessThan(80);

    // Optimized quality should be lower (was 85, now 82)
    expect(photoUpload.IMAGE_CONFIGS.optimized.quality).toBeLessThan(85);

    // Large quality should be lower (was 90, now 85)
    expect(photoUpload.IMAGE_CONFIGS.large.quality).toBeLessThan(90);

    // Avatar quality should be lower (was 90, now 85)
    expect(photoUpload.IMAGE_CONFIGS.avatar.quality).toBeLessThan(90);
  });
});

describe('Compression Settings Validation', () => {
  test('all IMAGE_CONFIGS should have quality settings', () => {
    const photoUpload = require('../../photo-upload');

    Object.keys(photoUpload.IMAGE_CONFIGS).forEach(key => {
      const config = photoUpload.IMAGE_CONFIGS[key];
      expect(config).toHaveProperty('quality');
      expect(typeof config.quality).toBe('number');
      expect(config.quality).toBeGreaterThan(0);
      expect(config.quality).toBeLessThanOrEqual(100);
    });
  });

  test('compression stats calculation should be present', () => {
    const fs = require('fs');
    const path = require('path');
    const photoUpload = fs.readFileSync(path.join(__dirname, '../../photo-upload.js'), 'utf8');

    // Verify the compression calculation logic exists
    expect(photoUpload).toContain('const originalSize = buffer.length');
    expect(photoUpload).toContain('thumbnail.length');
    expect(photoUpload).toContain('optimized.length');
    expect(photoUpload).toContain('large.length');
    expect(photoUpload).toContain('actualStorageUsed');
    expect(photoUpload).toContain('storageWithoutCompression');
  });
});
