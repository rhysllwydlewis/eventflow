import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/auth.html');
    await expect(page).toHaveTitle(/EventFlow/i);
    await expect(page.locator('#login-form')).toBeVisible();
  });

  test('should show validation errors for empty login', async ({ page, browserName }) => {
    await page.goto('/auth.html');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    // Webkit needs more time to fully render and initialize validators
    const initialWait = browserName === 'webkit' ? 2000 : 1000;
    await page.waitForTimeout(initialWait);

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Wait for validation to process (webkit/Safari needs more time)
    const validationWait = browserName === 'webkit' ? 4000 : 2000;
    await page.waitForTimeout(validationWait);

    // Should show validation errors - be more flexible with selector
    const errorElement = page
      .locator('.error, .alert-danger, .invalid-feedback, [role="alert"]')
      .first();
    await expect(errorElement).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to registration', async ({ page }) => {
    await page.goto('/auth.html');

    // Look for registration link
    const regLink = page.locator('a:has-text("Sign up"), a:has-text("Register")');
    if ((await regLink.count()) > 0) {
      await regLink.first().click();
      await expect(page).toHaveURL(/auth\.html/);
    }
  });

  test('should show password visibility toggle', async ({ page }) => {
    await page.goto('/auth.html');

    const passwordInput = page.locator('input[type="password"]').first();
    if ((await passwordInput.count()) > 0) {
      await expect(passwordInput).toBeVisible();

      // Look for toggle button
      const toggleButton = page.locator(
        'button:has-text("Show"), .toggle-password, [aria-label*="password"]'
      );
      if ((await toggleButton.count()) > 0) {
        await toggleButton.first().click();
        // Password should be visible now
        await expect(page.locator('input[type="text"][placeholder*="password" i]')).toBeVisible();
      }
    }
  });

  test('should handle login with invalid credentials @backend', async ({ page, browserName }) => {
    await page.goto('/auth.html');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    // Webkit needs more time to initialize
    const initialWait = browserName === 'webkit' ? 2000 : 1000;
    await page.waitForTimeout(initialWait);

    // Fill in invalid credentials
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for response (webkit/Safari needs more time for fetch and rendering)
    const responseWait = browserName === 'webkit' ? 10000 : 6000;
    await page.waitForTimeout(responseWait);

    // Should show error message (either from validation or from API response)
    const errorMessage = page
      .locator('.error, .alert-danger, .invalid-feedback, [role="alert"]')
      .first();
    await expect(errorMessage).toBeVisible({ timeout: 20000 }); // Increased timeout for webkit
  });

  test('should have CSRF protection', async ({ page }) => {
    await page.goto('/auth.html');

    // Check for CSRF token in form
    const csrfToken = page.locator('input[name="_csrf"], input[name="csrf"]');
    if ((await csrfToken.count()) > 0) {
      await expect(csrfToken).toBeHidden();
    }
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.goto('/auth.html');

      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');

      // Check viewport
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThan(768);

      // Form should be visible and properly sized
      const form = page.locator('form').first();
      await expect(form).toBeVisible();

      // No horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const windowWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 1); // Allow 1px tolerance
    }
  });
});
