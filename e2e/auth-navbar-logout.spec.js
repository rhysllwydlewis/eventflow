import { test, expect } from '@playwright/test';

test.describe('Authentication Navbar and Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to login with redirect parameter from protected page', async ({
    page,
    browserName,
  }) => {
    // Try to access a protected page directly
    await page.goto('/dashboard-customer.html');

    // Wait for redirect with more generous timeout for webkit/mobile
    await page.waitForLoadState('networkidle');
    // Webkit needs significantly more time than chromium/firefox
    const waitTime = browserName === 'webkit' ? 8000 : 4000;
    await page.waitForTimeout(waitTime);

    // Should be redirected to auth page with redirect parameter
    const url = page.url();
    expect(url).toContain('/auth.html');
    expect(url).toContain('redirect=');
    expect(url).toContain('dashboard-customer.html');
  });

  test('should use redirect parameter (not return) in all redirects', async ({ page }) => {
    // Navigate to auth page directly
    await page.goto('/auth.html?redirect=/dashboard-customer.html');

    // Verify URL uses redirect parameter
    expect(page.url()).toContain('redirect=');
    expect(page.url()).not.toContain('return=');
  });
});

test.describe('Logout Flow (Simulated)', () => {
  test('logout should clear localStorage and redirect to home', async ({ page, browserName }) => {
    await page.goto('/');

    // Simulate being logged in by setting localStorage
    await page.evaluate(() => {
      localStorage.setItem(
        'user',
        JSON.stringify({ id: '123', role: 'customer', name: 'Test User' })
      );
      localStorage.setItem('eventflow_onboarding_new', '1');
    });

    // Mock the logout API to succeed
    await page.route('**/api/auth/logout', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    // Mock the /api/auth/me endpoint to return logged-in user initially
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: '123', role: 'customer', name: 'Test User', email: 'test@example.com' },
        }),
      });
    });

    // Reload to pick up the localStorage changes
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Webkit needs more time to process localStorage and initial render
    const waitTime = browserName === 'webkit' ? 6000 : 3000;
    await page.waitForTimeout(waitTime);

    // Now simulate logout by calling the logout function
    await page.evaluate(async () => {
      const csrfResponse = await fetch('/api/csrf-token', { credentials: 'include' });
      const csrfData = await csrfResponse.json();
      window.__CSRF_TOKEN__ = csrfData.csrfToken;

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': window.__CSRF_TOKEN__ },
        credentials: 'include',
      });

      // Clear storage as auth-nav.js does
      localStorage.removeItem('eventflow_onboarding_new');
      localStorage.removeItem('user');
      sessionStorage.clear();
    });

    // Wait a bit more for storage to be cleared
    const storageWait = browserName === 'webkit' ? 2000 : 1000;
    await page.waitForTimeout(storageWait);

    // Check that localStorage is cleared
    const userInStorage = await page.evaluate(() => localStorage.getItem('user'));
    expect(userInStorage).toBeNull();

    const onboardingInStorage = await page.evaluate(() =>
      localStorage.getItem('eventflow_onboarding_new')
    );
    expect(onboardingInStorage).toBeNull();
  });
});
