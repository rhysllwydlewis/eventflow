/**
 * SEO and Production Safety Tests
 * Validates canonical URLs and test page protection
 */

import { test, expect } from '@playwright/test';

test.describe('SEO Canonical Consistency', () => {
  test('marketplace canonical should be /marketplace', async ({ page }) => {
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');
    
    // Check canonical link
    const canonicalLink = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonicalLink).toBe('https://event-flow.co.uk/marketplace');
    
    // Check og:url
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe('https://event-flow.co.uk/marketplace');
  });
  
  test('marketplace.html should redirect to /marketplace', async ({ page }) => {
    const response = await page.goto('/marketplace.html');
    
    // Should redirect (301 or 302)
    expect(response.status()).toBe(301);
    
    // Final URL should be /marketplace
    expect(page.url()).toContain('/marketplace');
    expect(page.url()).not.toContain('/marketplace.html');
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
    const realPages = [
      '/index.html',
      '/marketplace',
      '/plan.html',
      '/for-suppliers.html',
    ];
    
    for (const realPage of realPages) {
      const response = await page.goto(realPage, { waitUntil: 'domcontentloaded' });
      
      // Should return 200
      expect(response.status()).toBe(200);
    }
  });
});
