/**
 * Visual Regression Tests
 * Screenshot tests for mobile menu and hero search stability
 */

import { test, expect } from '@playwright/test';

// Mobile viewport for consistent screenshots
const MOBILE_VIEWPORT = { width: 395, height: 653 };

test.describe('Visual Regression - Mobile Menu @visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
  });

  test('index.html - menu closed', async ({ page }) => {
    await page.goto('/index.html');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Disable animations for stable screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Ensure menu is closed
    const menu = page.locator('#ef-mobile-menu');
    await expect(menu).not.toHaveClass(/open/);

    // Take screenshot
    await expect(page).toHaveScreenshot('mobile-menu-closed.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('index.html - menu open', async ({ page }) => {
    await page.goto('/index.html');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Disable animations for stable screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Open menu
    const toggle = page.locator('#ef-mobile-toggle');
    await toggle.click();
    await page.waitForTimeout(500);

    // Verify menu is open
    const menu = page.locator('#ef-mobile-menu');
    await expect(menu).toHaveClass(/open/);

    // Take screenshot
    await expect(page).toHaveScreenshot('mobile-menu-open.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });

  test('index.html - hero search button layout', async ({ page }) => {
    await page.goto('/index.html');

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Disable animations for stable screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Ensure menu is closed for consistency
    const menu = page.locator('#ef-mobile-menu');
    await expect(menu).not.toHaveClass(/open/);

    // Verify search button is present
    const searchButton = page.locator('.hero-search-button');
    if ((await searchButton.count()) > 0) {
      await expect(searchButton).toBeVisible();
    }

    // Take screenshot focused on hero area
    await expect(page).toHaveScreenshot('hero-search-layout.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});

test.describe('Visual Regression - Cross-browser Stability @visual', () => {
  test('menu open state should be consistent across browsers', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/index.html');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Disable animations
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `,
    });

    // Open and close menu to test stability
    const toggle = page.locator('#ef-mobile-toggle');
    const menu = page.locator('#ef-mobile-menu');

    // Open
    await toggle.click();
    await page.waitForTimeout(300);
    await expect(menu).toHaveClass(/open/);

    // Close
    await toggle.click();
    await page.waitForTimeout(300);
    await expect(menu).not.toHaveClass(/open/);

    // Final state screenshot
    await expect(page).toHaveScreenshot('menu-toggle-stability.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});
