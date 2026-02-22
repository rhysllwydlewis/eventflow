/**
 * Navigation CSS Regression Tests
 * Tests that navbar.css is the single source of truth for EF header/menu behavior
 * Verifies mobile menu height and visibility are not broken by CSS collisions
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation CSS Regression Tests', () => {
  test('mobile menu should have proper height when opened', async ({ page }) => {
    // Set viewport to 395x653 as specified
    await page.setViewportSize({ width: 395, height: 653 });

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Open the mobile menu
    const burgerBtn = page.locator('#ef-mobile-toggle');
    await burgerBtn.click();
    await page.waitForTimeout(500); // Wait for animation

    // Get menu bounding box
    const menu = page.locator('#ef-mobile-menu');
    await expect(menu).toBeVisible();

    const boundingBox = await menu.boundingBox();

    // Assert menu height > 200px
    expect(boundingBox.height).toBeGreaterThan(200);

    // Assert at least 5 visible links
    const visibleLinks = page.locator('.ef-mobile-link:visible');
    const linkCount = await visibleLinks.count();
    expect(linkCount).toBeGreaterThanOrEqual(5);
  });

  test('mobile menu should use correct z-index hierarchy', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 395, height: 653 });

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Open the mobile menu
    const burgerBtn = page.locator('#ef-mobile-toggle');
    await burgerBtn.click();
    await page.waitForTimeout(500);

    // Check z-index values from CSS variables
    const headerZIndex = await page
      .locator('.ef-header')
      .evaluate(el => window.getComputedStyle(el).zIndex);
    const menuZIndex = await page
      .locator('#ef-mobile-menu')
      .evaluate(el => window.getComputedStyle(el).zIndex);

    // Header should have z-index 2000
    expect(headerZIndex).toBe('2000');

    // Menu should have z-index 2001 (above header)
    expect(menuZIndex).toBe('2001');
  });

  test('mobile menu should have proper height calculation', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 395, height: 653 });

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Open the mobile menu
    const burgerBtn = page.locator('#ef-mobile-toggle');
    await burgerBtn.click();
    await page.waitForTimeout(500);

    // Check computed height of menu
    const menu = page.locator('#ef-mobile-menu');
    const computedHeight = await menu.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        height: styles.height,
        maxHeight: styles.maxHeight,
        overflowY: styles.overflowY,
      };
    });

    // Verify overflow-y is set to auto for scrolling
    expect(computedHeight.overflowY).toBe('auto');

    // Verify height is calculated (not 0 or auto)
    expect(computedHeight.height).not.toBe('0px');
    expect(computedHeight.height).not.toBe('auto');
  });

  test('body should not scroll when mobile menu is open', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 395, height: 653 });

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Open the mobile menu
    const burgerBtn = page.locator('#ef-mobile-toggle');
    await burgerBtn.click();
    await page.waitForTimeout(500);

    // Check body overflow is hidden
    const bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });

    expect(bodyOverflow).toBe('hidden');
  });
});
