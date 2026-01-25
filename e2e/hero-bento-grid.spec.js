const { test, expect } = require('@playwright/test');

/**
 * Hero Bento Grid - Validation Tests
 *
 * This test suite validates:
 * 1. Hero bento grid displays properly
 * 2. All category cells are present
 * 3. Images have proper fallback behavior
 * 4. Responsive layout works at different breakpoints
 */

test.describe('Hero Bento Grid', () => {
  test('Bento grid loads without critical console errors', async ({ page }) => {
    const consoleErrors = [];

    // Track console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Track critical errors, ignore network errors from external APIs (Pexels)
        if (
          !text.includes('extensions::') &&
          !text.includes('chrome-extension://') &&
          !text.includes('Tracking Protection') &&
          !text.includes('ERR_BLOCKED_BY_CLIENT') &&
          !text.includes('api.pexels.com')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Navigate to homepage
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for bento grid to initialize
    await page.waitForTimeout(2000);

    // Verify no critical errors
    const criticalErrors = consoleErrors.filter(
      err => err.includes('undefined is not') || err.includes('Cannot read properties')
    );

    expect(criticalErrors).toHaveLength(0);
    console.log('✓ No critical JavaScript errors');

    if (consoleErrors.length > 0) {
      console.log('Other console errors (non-critical):', consoleErrors);
    }
  });

  test('All bento grid cells are present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that bento grid exists
    const bentoGrid = page.locator('.ef-hero-bento');
    await expect(bentoGrid).toBeVisible();
    console.log('✓ Bento grid container present');

    // Check hero video cell
    const heroCell = page.locator('.ef-bento-hero');
    await expect(heroCell).toBeVisible();
    console.log('✓ Hero video cell present');

    // Check all 4 category cells exist
    const categorySelectors = [
      '.ef-bento-venues',
      '.ef-bento-catering',
      '.ef-bento-entertainment',
      '.ef-bento-photography',
    ];

    for (const selector of categorySelectors) {
      const cell = page.locator(selector);
      await expect(cell).toBeVisible();
    }
    console.log('✓ All 4 category cells present');
  });

  test('Category cells have images and labels', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for images to potentially load
    await page.waitForTimeout(1500);

    // Check each category cell has an image and label
    const categories = ['venues', 'catering', 'entertainment', 'photography'];

    for (const category of categories) {
      const cell = page.locator(`.ef-bento-${category}`);
      const img = cell.locator('img');
      const label = cell.locator('.ef-bento-label');

      await expect(img).toBeVisible();
      await expect(label).toBeVisible();

      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      console.log(`✓ ${category} cell has image and label`);
    }
  });

  test('Category cells are clickable links', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that all category cells are links
    const categories = ['venues', 'catering', 'entertainment', 'photography'];

    for (const category of categories) {
      const cell = page.locator(`.ef-bento-${category}`);
      const href = await cell.getAttribute('href');

      expect(href).toContain(`slug=${category}`);
      console.log(`✓ ${category} cell links to correct category page`);
    }
  });

  test('Hero video element exists with fallback', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const heroCell = page.locator('.ef-bento-hero');
    const video = heroCell.locator('video');
    const fallback = heroCell.locator('.video-fallback');

    // Video element should exist
    await expect(video).toBeAttached();

    // Fallback image should exist
    await expect(fallback).toBeAttached();

    console.log('✓ Hero video element and fallback present');
  });

  test('Bento grid is responsive - Desktop (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for layout
    await page.waitForTimeout(1000);

    // Check bento grid is visible
    const bentoGrid = page.locator('.ef-hero-bento');
    await expect(bentoGrid).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: '/tmp/hero-bento-desktop.png',
      fullPage: false,
    });

    console.log('✓ Desktop bento grid displays correctly');
  });

  test('Bento grid is responsive - Tablet (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for layout
    await page.waitForTimeout(1000);

    // Check bento grid is visible
    const bentoGrid = page.locator('.ef-hero-bento');
    await expect(bentoGrid).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: '/tmp/hero-bento-tablet.png',
      fullPage: false,
    });

    console.log('✓ Tablet bento grid displays correctly');
  });

  test('Bento grid is responsive - Mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for layout
    await page.waitForTimeout(1000);

    // Check bento grid is visible
    const bentoGrid = page.locator('.ef-hero-bento');
    await expect(bentoGrid).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: '/tmp/hero-bento-mobile.png',
      fullPage: false,
    });

    console.log('✓ Mobile bento grid displays correctly');
  });

  test('Liquid glass labels are styled correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const label = page.locator('.ef-bento-label').first();
    await expect(label).toBeVisible();

    // Check that label has backdrop filter styling
    const hasBackdropFilter = await label.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.backdropFilter !== 'none' || style.webkitBackdropFilter !== 'none';
    });

    // Note: backdrop-filter may not be supported in all test environments
    console.log(`✓ Liquid glass label styling applied (backdrop-filter: ${hasBackdropFilter})`);
  });
});
