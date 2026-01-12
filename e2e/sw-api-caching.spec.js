/**
 * Service Worker API Caching Security Tests
 * 
 * These tests verify that:
 * 1. Sensitive API endpoints are NOT cached by the service worker
 * 2. Allowlisted public endpoints may be cached only if response headers allow it
 * 3. Responses with no-store/private/no-cache are never cached
 * 
 * This prevents stale security risks where sensitive user data could be served
 * from cache in offline/flaky network scenarios.
 */

import { test, expect } from '@playwright/test';

// Cache name used by the service worker
const CACHE_NAME = 'eventflow-v18-dynamic';

/**
 * Helper function to check if a URL is cached
 */
async function isUrlCached(page, url) {
  return await page.evaluate(async (args) => {
    const { cacheName, url } = args;
    const cache = await caches.open(cacheName);
    const match = await cache.match(url);
    return !!match;
  }, { cacheName: CACHE_NAME, url });
}

/**
 * Helper function to clear all caches
 */
async function clearAllCaches(page) {
  await page.evaluate(async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
  });
}

/**
 * Helper function to register service worker and wait for it to be active
 */
async function registerServiceWorker(page) {
  await page.evaluate(async () => {
    // Unregister any existing service workers first
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/sw.js');
    
    // Wait for it to become active
    await new Promise((resolve) => {
      if (registration.active) {
        resolve();
      } else {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              resolve();
            }
          });
        });
      }
    });
  });
}

test.describe('Service Worker API Caching Security', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all caches before each test
    await page.goto('/');
    await clearAllCaches(page);
  });

  test('Test A - Sensitive API endpoints are NOT cached', async ({ page }) => {
    // Navigate to homepage to ensure service worker context
    await page.goto('/');
    
    // Register and wait for service worker
    await registerServiceWorker(page);
    
    // Wait a bit for SW to fully initialize
    await page.waitForTimeout(1000);

    // Mock a sensitive endpoint response (e.g., /api/auth/me or /api/admin/users)
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'no-store, private',
        },
        body: JSON.stringify({
          user: {
            id: 'usr_test123',
            email: 'test@example.com',
            role: 'customer',
            name: 'Test User',
          },
        }),
      });
    });

    // Make a request to the sensitive endpoint
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/auth/me');
      return {
        status: res.status,
        data: await res.json(),
      };
    });

    expect(response.status).toBe(200);
    expect(response.data.user).toBeDefined();

    // Wait a bit for any caching to happen
    await page.waitForTimeout(500);

    // Check that the response is NOT cached
    const isCached = await isUrlCached(page, '/api/auth/me');
    expect(isCached).toBe(false);

    // Test another sensitive endpoint: /api/admin/users
    await page.route('**/api/admin/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'no-store, private',
        },
        body: JSON.stringify({
          items: [
            { id: 'usr_1', email: 'admin@example.com', role: 'admin' },
          ],
        }),
      });
    });

    const adminResponse = await page.evaluate(async () => {
      const res = await fetch('/api/admin/users');
      return {
        status: res.status,
        data: await res.json(),
      };
    });

    expect(adminResponse.status).toBe(200);
    await page.waitForTimeout(500);

    const isAdminCached = await isUrlCached(page, '/api/admin/users');
    expect(isAdminCached).toBe(false);
  });

  test('Test B - Allowlisted public API endpoint may cache with proper headers', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Register and wait for service worker
    await registerServiceWorker(page);
    await page.waitForTimeout(1000);

    // Mock /api/config with public cache headers
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
        body: JSON.stringify({
          googleMapsApiKey: '',
          version: 'v17.0.0',
        }),
      });
    });

    // Make first request to /api/config
    const response1 = await page.evaluate(async () => {
      const res = await fetch('/api/config');
      return {
        status: res.status,
        data: await res.json(),
      };
    });

    expect(response1.status).toBe(200);
    expect(response1.data.version).toBe('v17.0.0');

    // Wait for caching to complete
    await page.waitForTimeout(500);

    // Check if cached (should be cached since it's allowlisted and has public cache headers)
    const isCached = await isUrlCached(page, '/api/config');
    expect(isCached).toBe(true);

    // Stop mocking to simulate offline
    await page.unroute('**/api/config');

    // Simulate offline by making fetch fail for this URL
    await page.route('**/api/config', async (route) => {
      await route.abort('failed');
    });

    // Make second request - should serve from cache
    const response2 = await page.evaluate(async () => {
      const res = await fetch('/api/config');
      return {
        status: res.status,
        data: await res.json(),
      };
    });

    // Should still work because it's cached
    expect(response2.status).toBe(200);
    expect(response2.data.version).toBe('v17.0.0');
  });

  test('Test C - Responses with no-store are never cached, even if allowlisted', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Register and wait for service worker
    await registerServiceWorker(page);
    await page.waitForTimeout(1000);

    // Mock /api/config but with no-store header (overriding normal caching)
    await page.route('**/api/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          googleMapsApiKey: '',
          version: 'v17.0.0-no-store',
        }),
      });
    });

    // Make request to /api/config
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/config');
      return {
        status: res.status,
        data: await res.json(),
      };
    });

    expect(response.status).toBe(200);
    expect(response.data.version).toBe('v17.0.0-no-store');

    // Wait for any potential caching
    await page.waitForTimeout(500);

    // Check that it's NOT cached (due to no-store header)
    const isCached = await isUrlCached(page, '/api/config');
    expect(isCached).toBe(false);
  });

  test('Test D - Non-allowlisted API endpoint returns 503 when offline', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Register and wait for service worker
    await registerServiceWorker(page);
    await page.waitForTimeout(1000);

    // Mock a non-allowlisted endpoint that will fail
    await page.route('**/api/suppliers', async (route) => {
      await route.abort('failed');
    });

    // Make request to non-allowlisted endpoint while offline
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/suppliers');
        return {
          status: res.status,
          data: await res.json(),
        };
      } catch (error) {
        return {
          error: error.message,
        };
      }
    });

    // Should return 503 with offline message
    expect(response.status).toBe(503);
    expect(response.data.error).toBe('Offline');
    expect(response.data.message).toContain('not available offline');
  });

  test('Test E - Verify Cache-Control headers are set on server responses', async ({ page }) => {
    // Test sensitive endpoint has no-store header
    const authResponse = await page.goto('/api/auth/me');
    const authHeaders = authResponse?.headers();
    
    // Should have no-store header (either from server or expect 401 for unauthenticated)
    if (authResponse?.status() === 200) {
      expect(authHeaders?.['cache-control']).toContain('no-store');
    }

    // Test public endpoint has cacheable headers
    const configResponse = await page.goto('/api/config');
    const configHeaders = configResponse?.headers();
    expect(configResponse?.status()).toBe(200);
    expect(configHeaders?.['cache-control']).toContain('public');
  });
});
