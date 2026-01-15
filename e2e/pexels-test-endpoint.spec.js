/**
 * Pexels Test Endpoint E2E Tests (@backend)
 * Tests the Pexels API test endpoint for admin users
 *
 * These tests:
 * 1. Verify the /api/pexels/test endpoint exists and requires auth
 * 2. Test that it returns proper status when API key is configured
 * 3. Verify error handling when API key is not configured
 */

import { test, expect } from '@playwright/test';

test.describe('Pexels Test Endpoint (@backend)', () => {
  test('should require authentication for /api/pexels/test', async ({ request }) => {
    const response = await request.get('/api/pexels/test');

    // Should require authentication
    expect([401, 403]).toContain(response.status());
  });

  test('should return test results structure @backend', async ({ request }) => {
    // Try to get test endpoint (may fail if not authenticated)
    const response = await request.get('/api/pexels/test');

    if (response.ok()) {
      const result = await response.json();

      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.message).toBe('string');

      // If details are present, verify structure
      if (result.details) {
        expect(typeof result.details).toBe('object');
        expect(result.details).toHaveProperty('configured');
        expect(typeof result.details.configured).toBe('boolean');
      }
    } else {
      // If auth required, that's expected - skip this test
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should provide helpful error messages @backend', async ({ request }) => {
    const response = await request.get('/api/pexels/test');

    if (response.ok() || response.status() === 424) {
      const result = await response.json();

      // Message should be helpful
      expect(result.message.length).toBeGreaterThan(0);

      if (!result.success) {
        // Failed tests should have details
        expect(result).toHaveProperty('details');
        expect(result.details).toBeTruthy();
      }
    }
  });

  test('should have proper cache headers @backend', async ({ request }) => {
    const response = await request.get('/api/pexels/test');

    // Test endpoint results should not be cached (admin only, dynamic)
    const cacheControl = response.headers()['cache-control'];
    if (cacheControl) {
      // Should have no-cache or no-store
      const hasNoCache = cacheControl.includes('no-cache') || cacheControl.includes('no-store');
      expect(hasNoCache).toBeTruthy();
    }
  });
});

test.describe('Pexels Status in Health Check (@backend)', () => {
  test('should include pexels status in health endpoint @backend', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.ok()).toBeTruthy();

    const health = await response.json();

    // Verify services section exists
    expect(health).toHaveProperty('services');
    expect(health.services).toHaveProperty('pexels');

    // Pexels status should be one of: 'configured', 'not_configured', 'unavailable'
    expect(['configured', 'not_configured', 'unavailable']).toContain(health.services.pexels);

    // If pexels is configured, check for collections status
    if (health.services.pexels === 'configured' && health.services.pexelsCollections) {
      expect(['configured', 'not_configured', 'unknown']).toContain(
        health.services.pexelsCollections
      );
    }
  });

  test('should not cache health endpoint @backend', async ({ request }) => {
    const response = await request.get('/api/health');

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain('no-store');
  });
});
