/**
 * Test for photo upload storage configuration
 * Verifies MongoDB-only storage is configured and legacy upload directories
 * exist in the repo for backward-compatible static serving of old /uploads/ URLs
 */

const fs = require('fs');
const path = require('path');

describe('Photo Upload Storage Configuration', () => {
  test('upload directories exist in repo for legacy /uploads/ URL backward-compatibility serving', () => {
    // These directories are committed to the repo so express.static('/uploads') can serve
    // any legacy /uploads/ URLs that existed before the MongoDB-only migration.
    // Note: the photo-upload module no longer creates these — they're static assets in the repo.
    require('../../photo-upload');

    const uploadDirs = [
      path.join(__dirname, '..', '..', 'uploads', 'original'),
      path.join(__dirname, '..', '..', 'uploads', 'thumbnails'),
      path.join(__dirname, '..', '..', 'uploads', 'optimized'),
      path.join(__dirname, '..', '..', 'uploads', 'large'),
      path.join(__dirname, '..', '..', 'public', 'uploads'),
    ];

    // Verify each directory exists
    uploadDirs.forEach(dir => {
      expect(fs.existsSync(dir)).toBe(true);
      const stats = fs.statSync(dir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  test('should have .gitkeep files in upload subdirectories', () => {
    const gitkeepFiles = [
      path.join(__dirname, '..', '..', 'uploads', 'original', '.gitkeep'),
      path.join(__dirname, '..', '..', 'uploads', 'thumbnails', '.gitkeep'),
      path.join(__dirname, '..', '..', 'uploads', 'optimized', '.gitkeep'),
      path.join(__dirname, '..', '..', 'uploads', 'large', '.gitkeep'),
    ];

    // Verify each .gitkeep file exists
    gitkeepFiles.forEach(file => {
      expect(fs.existsSync(file)).toBe(true);
    });
  });

  test('photo-upload module uses MongoDB-only storage (no STORAGE_TYPE or saveToLocal)', () => {
    // Read the module source to confirm MongoDB-only storage architecture
    const moduleSource = fs.readFileSync(
      path.join(__dirname, '..', '..', 'photo-upload.js'),
      'utf8'
    );

    // Should NOT contain local filesystem fallback code
    expect(moduleSource).not.toContain('STORAGE_TYPE');
    expect(moduleSource).not.toContain('saveToLocal');
    expect(moduleSource).not.toContain('UPLOAD_DIRS');

    // MUST contain MongoDB save functions
    expect(moduleSource).toContain('saveToMongoDB');
    expect(moduleSource).toContain("collection('photos')");
  });
});
