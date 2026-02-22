/**
 * SEO and Production Safety Tests
 * Validates canonical URLs and test page protection
 */

import { test, expect } from '@playwright/test';

test.describe('SEO Canonical Consistency', () => {
  test('marketplace canonical should be /marketplace', async ({ page }) => {
    await page.goto('/marketplace.html');
    await page.waitForLoadState('domcontentloaded');

    // Check canonical link
    const canonicalLink = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonicalLink).toBe('https://event-flow.co.uk/marketplace');

    // Check og:url
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe('https://event-flow.co.uk/marketplace');
  });

  test('marketplace.html should redirect to /marketplace with real server', async ({ page }) => {
    // This test only works with the full Express server, not static mode
    // In static mode, both /marketplace and /marketplace.html serve the same file
    const isStaticMode =
      process.env.CI === 'true' || !process.env.E2E_MODE || process.env.E2E_MODE === 'static';

    if (isStaticMode) {
      test.skip();
      return;
    }

    const response = await page.goto('/marketplace.html');

    // Should redirect (301)
    expect(response.status()).toBe(301);

    // Final URL should be /marketplace
    expect(page.url()).toContain('/marketplace');
    expect(page.url()).not.toContain('/marketplace.html');
  });

  test('both marketplace URLs should serve the same canonical', async ({ page }) => {
    // Test /marketplace
    await page.goto('/marketplace');
    await page.waitForLoadState('domcontentloaded');
    const canonical1 = await page.locator('link[rel="canonical"]').getAttribute('href');

    // Test /marketplace.html
    await page.goto('/marketplace.html');
    await page.waitForLoadState('domcontentloaded');
    const canonical2 = await page.locator('link[rel="canonical"]').getAttribute('href');

    // Both should have the same canonical
    expect(canonical1).toBe(canonical2);
    expect(canonical1).toBe('https://event-flow.co.uk/marketplace');
  });
});

test.describe('Test Page Protection', () => {
  test('test pages should be blocked in production', async ({ page }) => {
    // Only run this test if NODE_ENV is production
    const isProduction = process.env.NODE_ENV === 'production';

    if (!isProduction) {
      test.skip();
      return;
    }

    const testPages = [
      '/navbar-test.html',
      '/modal-test.html',
      '/test-burger-menu.html',
      '/test-ui-fixes.html',
    ];

    for (const testPage of testPages) {
      const response = await page.goto(testPage, { waitUntil: 'domcontentloaded' });

      // Should return 404
      expect(response.status()).toBe(404);
    }
  });

  test('real user pages should still be accessible', async ({ page }) => {
    const realPages = ['/index.html', '/marketplace', '/plan.html', '/for-suppliers.html'];

    for (const realPage of realPages) {
      const response = await page.goto(realPage, { waitUntil: 'domcontentloaded' });

      // Should return 200
      expect(response.status()).toBe(200);
    }
  });
});
