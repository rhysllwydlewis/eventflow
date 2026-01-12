/**
 * Auth Redirect Security Tests
 * Ensures auth redirects use relative paths for security
 */

import { test, expect } from '@playwright/test';

test.describe('Auth Redirect Security', () => {
  test('message supplier auth redirects should use relative paths', async ({ page }) => {
    // Go to a package page (we'll use a test approach)
    await page.goto('/package.html?id=test-package');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // If there's a message supplier button, click it (when logged out)
    const authCreateBtn = await page.locator('#auth-create-account').count();
    const authLoginBtn = await page.locator('#auth-login').count();
    
    if (authCreateBtn > 0 || authLoginBtn > 0) {
      // Listen for navigation
      const navigationPromise = page.waitForURL(/\/auth\.html/);
      
      if (authCreateBtn > 0) {
        await page.click('#auth-create-account');
      } else if (authLoginBtn > 0) {
        await page.click('#auth-login');
      }
      
      await navigationPromise;
      
      // Check that the redirect/return parameter is a relative path
      const url = new URL(page.url());
      const returnParam = url.searchParams.get('return') || url.searchParams.get('redirect');
      
      if (returnParam) {
        // Should start with / (relative path)
        expect(returnParam).toMatch(/^\//);
        // Should NOT contain protocol
        expect(returnParam).not.toMatch(/^https?:\/\//);
        // Should NOT contain domain
        expect(returnParam).not.toContain('event-flow.co.uk');
        expect(returnParam).not.toContain('localhost');
        expect(returnParam).not.toContain('127.0.0.1');
      }
    }
  });
  
  test('auth URLs should contain relative paths not full URLs', async ({ page }) => {
    // Test on a simple page
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    
    // Check all auth links on the page
    const authLinks = await page.locator('a[href*="auth.html"]').all();
    
    for (const link of authLinks) {
      const href = await link.getAttribute('href');
      
      if (href && href.includes('redirect=') || href && href.includes('return=')) {
        // Extract the redirect/return parameter value
        const url = new URL(href, 'http://localhost');
        const redirectParam = url.searchParams.get('redirect') || url.searchParams.get('return');
        
        if (redirectParam) {
          // Should be a relative path
          expect(redirectParam).toMatch(/^\//);
          expect(redirectParam).not.toMatch(/^https?:\/\//);
        }
      }
    }
  });
});
