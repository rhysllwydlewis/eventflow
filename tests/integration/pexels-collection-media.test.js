/**
 * Integration tests for Pexels collection media endpoints
 * Tests the new collection-based photo fetching functionality
 */

const request = require('supertest');
const express = require('express');
const dbUnified = require('../../db-unified');
const adminRouter = require('../../routes/admin');

describe('Pexels Collection Media Integration', () => {
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
        pexelsCollageSettings: {
          queries: {
            venues: 'wedding venue elegant ballroom',
            catering: 'wedding catering food elegant',
            entertainment: 'live band wedding party',
            photography: 'wedding photography professional',
          },
        },
      });
    } else {
      settings.features = settings.features || {};
      settings.features.pexelsCollage = true;
      settings.pexelsCollageSettings = settings.pexelsCollageSettings || {
        queries: {
          venues: 'wedding venue elegant ballroom',
          catering: 'wedding catering food elegant',
          entertainment: 'live band wedding party',
          photography: 'wedding photography professional',
        },
      };
      await dbUnified.write('settings', settings);
    }
  });

  describe('GET /api/public/pexels-collage with collection ID', () => {
    it('should use search when no collection ID is configured', async () => {
      // Make request for venues category
      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category).toBe('venues');
      expect(response.body.photos).toBeDefined();
      expect(Array.isArray(response.body.photos)).toBe(true);

      // When no collection ID is configured, should use search or fallback
      expect(
        ['search', 'fallback'].includes(response.body.source) || response.body.usingFallback
      ).toBe(true);
    });

    it('should return proper structure when collection ID is configured', async () => {
      // Set up collection ID in settings
      const settings = await dbUnified.read('settings');
      settings.features = settings.features || {};
      settings.features.pexelsCollage = true; // Ensure feature is enabled
      settings.pexelsCollageSettings = settings.pexelsCollageSettings || {};
      settings.pexelsCollageSettings.collectionId = 'test-collection-id';
      await dbUnified.write('settings', settings);

      // Make request
      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      // Even if API fails (no real key), should return proper structure
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category).toBe('venues');
      expect(response.body.photos).toBeDefined();
      expect(Array.isArray(response.body.photos)).toBe(true);
    });

    it('should support category-specific collection IDs', async () => {
      // Set up category-specific collection IDs in settings
      const settings = await dbUnified.read('settings');
      settings.features = settings.features || {};
      settings.features.pexelsCollage = true; // Ensure feature is enabled
      settings.pexelsCollageSettings = settings.pexelsCollageSettings || {};
      settings.pexelsCollageSettings.collectionIds = {
        venues: 'venues-collection-id',
        catering: 'catering-collection-id',
      };
      await dbUnified.write('settings', settings);

      // Make request for venues
      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      // Should still return proper response (even if API fails)
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.category).toBe('venues');
    });

    it('should fallback to search when collection fetch fails', async () => {
      // Set up invalid collection ID
      const settings = await dbUnified.read('settings');
      settings.features = settings.features || {};
      settings.features.pexelsCollage = true; // Ensure feature is enabled
      settings.pexelsCollageSettings = settings.pexelsCollageSettings || {};
      settings.pexelsCollageSettings.collectionId = 'invalid-collection';
      await dbUnified.write('settings', settings);

      // Make request
      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      // Should fallback gracefully
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.photos).toBeDefined();
      expect(Array.isArray(response.body.photos)).toBe(true);
    });

    it('should handle missing collection gracefully', async () => {
      // Set up collection ID with API key (if available)
      const settings = await dbUnified.read('settings');
      settings.features = settings.features || {};
      settings.features.pexelsCollage = true; // Ensure feature is enabled
      settings.pexelsCollageSettings = settings.pexelsCollageSettings || {};
      settings.pexelsCollageSettings.collectionId = 'nonexistent-collection';
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-collage?category=venues');

      // Should return fallback or handle error gracefully
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Collection ID configuration structure', () => {
    it('should support global collection ID', async () => {
      const settings = await dbUnified.read('settings');
      settings.pexelsCollageSettings = {
        collectionId: 'global-collection-id',
        queries: {
          venues: 'wedding venue',
        },
      };
      await dbUnified.write('settings', settings);

      const storedSettings = await dbUnified.read('settings');
      expect(storedSettings.pexelsCollageSettings.collectionId).toBe('global-collection-id');
    });

    it('should support per-category collection IDs', async () => {
      const settings = await dbUnified.read('settings');
      settings.pexelsCollageSettings = {
        collectionIds: {
          venues: 'venues-collection',
          catering: 'catering-collection',
        },
        queries: {
          venues: 'wedding venue',
        },
      };
      await dbUnified.write('settings', settings);

      const storedSettings = await dbUnified.read('settings');
      expect(storedSettings.pexelsCollageSettings.collectionIds.venues).toBe('venues-collection');
      expect(storedSettings.pexelsCollageSettings.collectionIds.catering).toBe(
        'catering-collection'
      );
    });
  });
});
