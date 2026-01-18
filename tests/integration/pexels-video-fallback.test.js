/**
 * Integration tests for Pexels video endpoint fallback functionality
 * Tests that fallback video URLs are returned when Pexels API is not configured
 */

const request = require('supertest');
const express = require('express');
const dbUnified = require('../../db-unified');
const adminRouter = require('../../routes/admin');

describe('Pexels Video Fallback Integration', () => {
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

    // Enable Pexels collage feature flag with videos enabled
    const settings = await dbUnified.read('settings');
    if (!settings || typeof settings !== 'object') {
      await dbUnified.write('settings', {
        collageWidget: {
          enabled: true,
          source: 'pexels',
          mediaTypes: {
            photos: true,
            videos: true,
          },
        },
      });
    } else {
      settings.collageWidget = settings.collageWidget || {};
      settings.collageWidget.enabled = true;
      settings.collageWidget.source = 'pexels';
      settings.collageWidget.mediaTypes = {
        photos: true,
        videos: true,
      };
      await dbUnified.write('settings', settings);
    }
  });

  describe('GET /api/public/pexels-video', () => {
    it('should return fallback videos when Pexels API not configured', async () => {
      // Make request for wedding videos
      const response = await request(app).get('/api/public/pexels-video?query=wedding');

      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.videos).toBeDefined();
      expect(Array.isArray(response.body.videos)).toBe(true);
      expect(response.body.videos.length).toBeGreaterThan(0);

      // Verify video structure matches expected format
      const video = response.body.videos[0];
      expect(video).toHaveProperty('id');
      expect(video).toHaveProperty('url');
      expect(video).toHaveProperty('user');
      expect(video.user).toHaveProperty('name');
      expect(video.user).toHaveProperty('url');
      expect(video).toHaveProperty('video_files');
      expect(Array.isArray(video.video_files)).toBe(true);
      expect(video.video_files.length).toBeGreaterThan(0);

      // Verify video file structure
      const videoFile = video.video_files[0];
      expect(videoFile).toHaveProperty('quality');
      expect(videoFile).toHaveProperty('link');

      // When API is not configured, should use fallback
      if (response.body.usingFallback !== undefined) {
        expect(typeof response.body.usingFallback).toBe('boolean');
      }
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app).get('/api/public/pexels-video');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Query parameter required');
    });

    it('should return 404 when collage widget is disabled', async () => {
      // Disable collage widget
      const settings = await dbUnified.read('settings');
      settings.collageWidget.enabled = false;
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-video?query=wedding');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not enabled');
    });

    it('should return 400 when videos are disabled in mediaTypes', async () => {
      // Disable videos in mediaTypes
      const settings = await dbUnified.read('settings');
      settings.collageWidget.mediaTypes.videos = false;
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-video?query=wedding');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Videos are not enabled');
    });

    it('should return 400 when source is not pexels', async () => {
      // Change source to uploads
      const settings = await dbUnified.read('settings');
      settings.collageWidget.source = 'uploads';
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-video?query=wedding');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('only supports Pexels source');
    });

    it('should work with legacy pexelsCollage feature flag', async () => {
      // Use legacy feature flag format
      const settings = await dbUnified.read('settings');
      delete settings.collageWidget;
      settings.features = {
        pexelsCollage: true,
      };
      // Need to add collageWidget with videos enabled for legacy support
      settings.collageWidget = {
        mediaTypes: {
          videos: true,
        },
      };
      await dbUnified.write('settings', settings);

      const response = await request(app).get('/api/public/pexels-video?query=wedding');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  afterAll(async () => {
    // Clean up - no close method needed for file-based storage
  });
});
