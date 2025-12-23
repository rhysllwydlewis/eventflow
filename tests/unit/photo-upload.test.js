/**
 * Test for photo-upload directory creation
 * Verifies that the upload directories are created properly
 */

const fs = require('fs');
const path = require('path');

describe('Photo Upload Directory Creation', () => {
  test('should create all upload directories on module load', () => {
    // Import the module to trigger directory creation
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
});
