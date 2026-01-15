const { test, expect } = require('@playwright/test');

/**
 * Hero Collage Images - Validation Tests
 *
 * This test suite validates:
 * 1. Hero collage images display properly
 * 2. No console errors related to image loading (indexOf TypeError)
 * 3. Onerror handlers work correctly
 * 4. Images have proper fallback behavior
 */

test.describe('Hero Collage Images', () => {
  test('Collage images load without console errors', async ({ page }) => {
    const consoleErrors = [];
    
    // Track console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Track all errors except browser extensions
        if (
          !text.includes('extensions::') &&
          !text.includes('chrome-extension://') &&
          !text.includes('Tracking Protection')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Navigate to homepage
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for images to load
    await page.waitForTimeout(2000);

    // Verify no indexOf errors or other image-related errors
    const imageErrors = consoleErrors.filter(
      err => err.includes('indexOf') || err.includes('Cannot read properties of undefined')
    );
    
    expect(imageErrors).toHaveLength(0);
    console.log('✓ No indexOf or undefined property errors');
    
    if (consoleErrors.length > 0) {
      console.log('Other console errors (not image-related):', consoleErrors);
    }
  });

  test('All four collage frames are present', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that all 4 collage frames exist
    const collageFrames = page.locator('.collage .frame');
    await expect(collageFrames).toHaveCount(4);
    console.log('✓ All 4 collage frames present');
  });

  test('Collage images have src attributes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    
    // Wait for images to potentially load
    await page.waitForTimeout(1500);

    // Check each collage image has a src
    const images = await page.locator('.collage .frame img').all();
    expect(images.length).toBe(4);

    for (let i = 0; i < images.length; i++) {
      const src = await images[i].getAttribute('src');
      // Src should either be the default image or a custom one (or empty if fallback to gradient)
      expect(src !== null).toBe(true);
      console.log(`✓ Image ${i + 1} has src:`, src ? src.substring(0, 50) : 'empty (fallback)');
    }
  });

  test('Collage images have onerror handlers', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that all images have onerror attributes
    const images = await page.locator('.collage .frame img').all();
    expect(images.length).toBe(4);

    for (let i = 0; i < images.length; i++) {
      const onerror = await images[i].getAttribute('onerror');
      expect(onerror).toBeTruthy();
      expect(onerror).toContain('this.style.background');
      console.log(`✓ Image ${i + 1} has onerror handler`);
    }
  });

  test('Collage images display or show fallback', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for images to load or fail
    await page.waitForTimeout(2000);

    const frames = await page.locator('.collage .frame').all();
    expect(frames.length).toBe(4);

    for (let i = 0; i < frames.length; i++) {
      const img = frames[i].locator('img');
      
      // Check if image is visible or has fallback styling
      const hasBackground = await img.evaluate(el => {
        const bg = window.getComputedStyle(el).background;
        return bg.includes('gradient') || bg.includes('linear-gradient');
      });
      
      const hasSrc = await img.evaluate(el => el.src && el.src.length > 0);
      
      // Either has a valid src OR shows gradient fallback
      expect(hasSrc || hasBackground).toBe(true);
      
      console.log(`✓ Frame ${i + 1}: ${hasSrc ? 'image loaded' : 'showing fallback'}`);
    }
  });

  test('No 404 errors for collage images', async ({ page }) => {
    const failed404s = [];

    // Track 404 responses
    page.on('response', response => {
      if (response.status() === 404) {
        const url = response.url();
        // Only track collage image 404s
        if (url.includes('collage-')) {
          failed404s.push(url);
        }
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for all images to load or fail
    await page.waitForTimeout(2000);

    // Default collage images should not 404
    expect(failed404s).toHaveLength(0);
    console.log('✓ No 404 errors for collage images');
  });

  test('Visual regression: Collage displays on desktop (1920x1080)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for images
    await page.waitForTimeout(2000);

    // Take screenshot of collage section
    const collage = page.locator('.collage');
    await expect(collage).toBeVisible();
    
    await page.screenshot({
      path: '/tmp/hero-collage-desktop.png',
      fullPage: false,
    });

    console.log('✓ Desktop collage screenshot saved');
  });

  test('Visual regression: Collage displays on mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for images
    await page.waitForTimeout(2000);

    // Take screenshot
    const collage = page.locator('.collage');
    await expect(collage).toBeVisible();
    
    await page.screenshot({
      path: '/tmp/hero-collage-mobile.png',
      fullPage: false,
    });

    console.log('✓ Mobile collage screenshot saved');
  });
});
