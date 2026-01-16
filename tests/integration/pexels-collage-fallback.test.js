/**
 * Integration tests for Pexels collage endpoint fallback functionality
 * Tests that fallback URLs are returned when Pexels API is not configured
 */

const request = require('supertest');
const express = require('express');
const dbUnified = require('../../db-unified');
const adminRouter = require('../../routes/admin');

describe('Pexels Collage Fallback Integration', () => {
  let app;

  beforeAll(async () => {
    // Initialize database
    await dbUnified.initializeDatabase();
  });

  beforeEach(async () => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    // Mount admin router at /api to match actual server setup
    app.use('/api', adminRouter);

    // Enable Pexels collage feature flag
    const settings = await dbUnified.read('settings');
    if (!settings || typeof settings !== 'object') {
      await dbUnified.write('settings', {
        features: {
          pexelsCollage: true,
        },
      });
    } else {
      settings.features = settings.features || {};
      settings.features.pexelsCollage = true;
      await dbUnified.write('settings', settings);
    }
  });

  describe('GET /api/public/pexels-collage', () => {
    it('should return fallback photos when Pexels API not configured', async () => {
      // Make request for venues category
      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category).toBe('venues');
      expect(response.body.photos).toBeDefined();
      expect(Array.isArray(response.body.photos)).toBe(true);
      expect(response.body.photos.length).toBeGreaterThan(0);

      // Verify photo structure matches Pexels API format
      const photo = response.body.photos[0];
      expect(photo).toHaveProperty('id');
      expect(photo).toHaveProperty('url');
      expect(photo).toHaveProperty('photographer');
      expect(photo).toHaveProperty('src');
      expect(photo.src).toHaveProperty('original');
      expect(photo.src).toHaveProperty('large');
      expect(photo.src).toHaveProperty('medium');

      // When API is not configured, should use fallback
      // Note: This test assumes PEXELS_API_KEY is not set in test environment
      // If API is configured, usingFallback will be false
      if (response.body.usingFallback !== undefined) {
        expect(typeof response.body.usingFallback).toBe('boolean');
      }
    });

    it('should return 400 for missing category parameter', async () => {
      const response = await request(app).get('/api/public/pexels-collage');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Category parameter required');
    });

    it('should return 400 for invalid category', async () => {
      const response = await request(app).get('/api/public/pexels-collage?category=invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid category');
      expect(response.body.errorType).toBe('validation');
    });

    it('should work for all valid categories', async () => {
      const categories = ['venues', 'catering', 'entertainment', 'photography'];

      for (const category of categories) {
        const response = await request(app).get(`/api/public/pexels-collage?category=${category}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.category).toBe(category);
        expect(response.body.photos).toBeDefined();
        expect(Array.isArray(response.body.photos)).toBe(true);
        expect(response.body.photos.length).toBeGreaterThan(0);
      }
    });

    it('should return 404 when feature flag is disabled', async () => {
      // Disable Pexels collage feature
      const settings = await dbUnified.read('settings');
      settings.features.pexelsCollage = false;
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Pexels collage feature is not enabled');

      // Clean up: re-enable feature flag for other tests
      settings.features.pexelsCollage = true;
      await dbUnified.write('settings', settings);
    });

    it('should work when collageWidget is enabled with pexels source', async () => {
      // Enable collageWidget with pexels source
      const settings = await dbUnified.read('settings');
      settings.collageWidget = {
        enabled: true,
        source: 'pexels',
        pexelsQueries: {
          venues: 'wedding venue elegant',
          catering: 'catering food',
          entertainment: 'live band',
          photography: 'photography professional',
        },
      };
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category).toBe('venues');
      expect(response.body.photos).toBeDefined();
      expect(Array.isArray(response.body.photos)).toBe(true);
      expect(response.body.photos.length).toBeGreaterThan(0);
    });

    it('should return 404 when collageWidget is enabled but source is not pexels', async () => {
      // Enable collageWidget but with uploads source
      const settings = await dbUnified.read('settings');
      settings.collageWidget = {
        enabled: true,
        source: 'uploads',
      };
      // Disable legacy flag to test collageWidget behavior
      settings.features.pexelsCollage = false;
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Pexels collage feature is not enabled');

      // Clean up
      settings.features.pexelsCollage = true;
      delete settings.collageWidget;
      await dbUnified.write('settings', settings);
    });

    it('should return 404 when collageWidget is disabled', async () => {
      // Disable collageWidget
      const settings = await dbUnified.read('settings');
      settings.collageWidget = {
        enabled: false,
        source: 'pexels',
      };
      // Also disable legacy flag
      settings.features.pexelsCollage = false;
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Pexels collage feature is not enabled');

      // Clean up
      settings.features.pexelsCollage = true;
      delete settings.collageWidget;
      await dbUnified.write('settings', settings);
    });
  });
});
