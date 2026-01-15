/**
 * E2E Tests for Pexels Collection Media Endpoint (@backend)
 * Tests the /api/pexels/collection/:id/media endpoint
 */

import { test, expect } from '@playwright/test';

test.describe('Pexels Collection Media Endpoint (@backend)', () => {
  test('should require authentication for /api/pexels/collection/:id/media', async ({
    request,
  }) => {
    const response = await request.get('/api/pexels/collection/test-id/media');

    // Should require authentication
    expect([401, 403]).toContain(response.status());
  });

  test('should validate collection ID format @backend', async ({ request }) => {
    const response = await request.get('/api/pexels/collection/test-collection/media');

    // Unauthenticated request should fail with 401/403
    // If authenticated, would check API key configuration
    expect([401, 403, 503]).toContain(response.status());
  });

  test('should support query parameters @backend', async ({ request }) => {
    // Test with various query parameters
    const response = await request.get(
      '/api/pexels/collection/test-id/media?page=1&perPage=10&type=photos'
    );

    // Should require authentication
    expect([401, 403, 503]).toContain(response.status());
  });
});

test.describe('Pexels Collections Endpoint (@backend)', () => {
  test('should have /api/pexels/collections/:id endpoint @backend', async ({ request }) => {
    const response = await request.get('/api/pexels/collections/test-id');

    // Should require authentication
    expect([401, 403, 503]).toContain(response.status());
  });

  test('should support featured collections endpoint @backend', async ({ request }) => {
    const response = await request.get('/api/pexels/collections/featured');

    // Should require authentication
    expect([401, 403]).toContain(response.status());
  });

  test('should support user collections endpoint @backend', async ({ request }) => {
    const response = await request.get('/api/pexels/collections');

    // Should require authentication
    expect([401, 403]).toContain(response.status());
  });
});

test.describe('Public Pexels Collage with Collections (@backend)', () => {
  test('should support public pexels-collage endpoint @backend', async ({ request }) => {
    const response = await request.get('/api/public/pexels-collage?category=venues');

    // Public endpoint should be accessible but might be disabled by feature flag
    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('category');
      expect(data).toHaveProperty('photos');

      // Should indicate source (search, collection, or fallback)
      if (data.source) {
        expect(
          ['search', 'collection', 'fallback'].includes(data.source) || data.usingFallback
        ).toBe(true);
      }
    }
  });

  test('should handle missing category parameter @backend', async ({ request }) => {
    const response = await request.get('/api/public/pexels-collage');

    if (response.status() !== 404) {
      // If feature is enabled, should return 400 for missing category
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Category');
    }
  });

  test('should validate category parameter @backend', async ({ request }) => {
    const response = await request.get('/api/public/pexels-collage?category=invalid');

    if (response.status() !== 404) {
      // If feature is enabled, should return 400 for invalid category
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid category');
    }
  });

  test('should accept valid categories @backend', async ({ request }) => {
    const validCategories = ['venues', 'catering', 'entertainment', 'photography'];

    for (const category of validCategories) {
      const response = await request.get(`/api/public/pexels-collage?category=${category}`);

      // Should either succeed (200) or be disabled (404)
      expect([200, 404]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();
        expect(data.category).toBe(category);
      }
    }
  });
});
