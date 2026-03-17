/**
 * Package Detail Page – Image Regression Tests
 *
 * Asserts that the package detail page displays real gallery images when a
 * package has images, and never shows a placeholder in that case.
 *
 * Runs in static mode (serve-static.js provides a mock /api/packages/:slug
 * response with gallery entries pointing to real local image assets).
 */

const { test, expect } = require('@playwright/test');

const MOCK_SLUG = 'test-package-detail';
const PLACEHOLDER_PATH = '/assets/images/placeholders/';

test.describe('Package Detail – Image Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/package?slug=${MOCK_SLUG}`);
    // Wait until the loading spinner is gone and content is revealed
    await page.waitForSelector('#package-content', { state: 'visible', timeout: 15000 });
  });

  test('renders the gallery container', async ({ page }) => {
    const galleryContainer = page.locator('#package-gallery-container');
    await expect(galleryContainer).toBeVisible();
  });

  test('gallery shows an <img> element (not the "no images" empty state)', async ({ page }) => {
    const galleryImg = page.locator('#package-gallery-container img').first();
    await expect(galleryImg).toBeVisible({ timeout: 10000 });
  });

  test('first gallery image src is not a placeholder path', async ({ page }) => {
    const galleryImg = page.locator('#package-gallery-container img').first();
    await expect(galleryImg).toBeVisible({ timeout: 10000 });

    const src = await galleryImg.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).not.toContain(PLACEHOLDER_PATH);
  });

  test('first gallery image uses loading="eager"', async ({ page }) => {
    const galleryImg = page.locator('#package-gallery-container img').first();
    await expect(galleryImg).toBeVisible({ timeout: 10000 });

    const loading = await galleryImg.getAttribute('loading');
    expect(loading).toBe('eager');
  });

  test('package title is rendered', async ({ page }) => {
    const title = page.locator('#package-title');
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });
});
