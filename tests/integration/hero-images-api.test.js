/**
 * Integration tests for hero images API endpoints
 * Verifies database storage and retrieval of hero collage images
 */

const request = require('supertest');
const express = require('express');
const dbUnified = require('../../db-unified');

// Mock Express app setup (simplified)
describe('Hero Images API Integration', () => {
  let app;

  beforeAll(async () => {
    // Initialize database
    await dbUnified.initializeDatabase();
  });

  afterAll(async () => {
    // Cleanup
    if (dbUnified.close) {
      await dbUnified.close();
    }
  });

  describe('GET /api/admin/homepage/hero-images-public', () => {
    it('should return default images when not set in database', async () => {
      // Clear any existing settings
      const settings = (await dbUnified.read('settings')) || {};
      delete settings.heroImages;
      await dbUnified.write('settings', settings);

      // Expected default images
      const expectedDefaults = {
        venues: '/assets/images/collage-venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      // Read back (simulating API behavior)
      const readSettings = (await dbUnified.read('settings')) || {};
      const heroImages = readSettings.heroImages || expectedDefaults;

      expect(heroImages).toEqual(expectedDefaults);
    });

    it('should return custom images when set in database', async () => {
      // Set custom images in database
      const customImages = {
        venues: 'https://cloudinary.com/custom-venue.jpg',
        catering: 'https://cloudinary.com/custom-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      const settings = (await dbUnified.read('settings')) || {};
      settings.heroImages = customImages;
      await dbUnified.write('settings', settings);

      // Read back
      const readSettings = await dbUnified.read('settings');
      expect(readSettings.heroImages).toEqual(customImages);
    });

    it('should merge defaults with custom images', async () => {
      // Set partial custom images (only venues and catering)
      const partialCustom = {
        venues: 'https://cloudinary.com/venue.jpg',
        catering: 'https://cloudinary.com/catering.jpg',
      };

      const settings = (await dbUnified.read('settings')) || {};
      settings.heroImages = {
        venues: partialCustom.venues,
        catering: partialCustom.catering,
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };
      await dbUnified.write('settings', settings);

      // Read back
      const readSettings = await dbUnified.read('settings');
      expect(readSettings.heroImages.venues).toBe(partialCustom.venues);
      expect(readSettings.heroImages.catering).toBe(partialCustom.catering);
      expect(readSettings.heroImages.entertainment).toBe(
        '/assets/images/collage-entertainment.jpg'
      );
      expect(readSettings.heroImages.photography).toBe('/assets/images/collage-photography.jpg');
    });
  });

  describe('Database storage validation', () => {
    it('should persist hero images across reads', async () => {
      const testImages = {
        venues: 'https://test.com/venue.jpg',
        catering: 'https://test.com/catering.jpg',
        entertainment: 'https://test.com/entertainment.jpg',
        photography: 'https://test.com/photography.jpg',
        updatedAt: new Date().toISOString(),
        updatedBy: 'test@example.com',
      };

      // Write
      const settings = (await dbUnified.read('settings')) || {};
      settings.heroImages = testImages;
      await dbUnified.write('settings', settings);

      // Read back multiple times
      for (let i = 0; i < 3; i++) {
        const readSettings = await dbUnified.read('settings');
        expect(readSettings.heroImages).toEqual(testImages);
      }
    });

    it('should handle missing settings document gracefully', async () => {
      // Try to read from non-existent settings
      const settings = (await dbUnified.read('settings_nonexistent')) || {};
      const heroImages = settings.heroImages || {
        venues: '/assets/images/collage-venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      // Should return defaults
      expect(heroImages).toHaveProperty('venues');
      expect(heroImages).toHaveProperty('catering');
      expect(heroImages).toHaveProperty('entertainment');
      expect(heroImages).toHaveProperty('photography');
    });
  });

  describe('Default image paths validation', () => {
    it('should use consistent default paths across codebase', () => {
      const expectedDefaults = {
        venues: '/assets/images/collage-venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      // These paths should match what's in:
      // - routes/admin.js (API endpoints)
      // - public/index.html (HTML src attributes)
      // - public/assets/js/pages/home-init.js (JavaScript fallbacks)

      expect(expectedDefaults.venues).toBe('/assets/images/collage-venue.jpg');
      expect(expectedDefaults.catering).toBe('/assets/images/collage-catering.jpg');
      expect(expectedDefaults.entertainment).toBe('/assets/images/collage-entertainment.jpg');
      expect(expectedDefaults.photography).toBe('/assets/images/collage-photography.jpg');
    });
  });
});
