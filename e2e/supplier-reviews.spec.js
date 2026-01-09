import { test, expect } from '@playwright/test';

// Browser-specific timeout constants for webkit compatibility
const WEBKIT_INITIAL_WAIT = 5000;
const WEBKIT_WAIT_TIMEOUT = 20000;
const DEFAULT_INITIAL_WAIT = 2000;
const DEFAULT_WAIT_TIMEOUT = 10000;

test.describe('Supplier Reviews Widget Integration', () => {
  test('should display review widget on supplier profile page', async ({ page }) => {
    await page.goto('/suppliers.html');
    await page.waitForLoadState('networkidle');
    const supplierLink = page.locator('a[href*="/supplier.html?id="]').first();
    if ((await supplierLink.count()) > 0) {
      await supplierLink.click();
      await page.waitForLoadState('networkidle');
      const reviewWidget = page.locator('#reviews-widget');
      await expect(reviewWidget).toBeVisible();
      const writeReviewBtn = page.locator('#btn-write-review');
      await expect(writeReviewBtn).toBeVisible();
    }
  });

  test('should load reviews resources', async ({ page, browserName }) => {
    await page.goto('/supplier.html?id=test');
    await page.waitForLoadState('networkidle');
    // Webkit needs significantly more time to load and execute JavaScript
    const initialWait = browserName === 'webkit' ? WEBKIT_INITIAL_WAIT : DEFAULT_INITIAL_WAIT;
    await page.waitForTimeout(initialWait);

    const reviewsCssLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => link.href.includes('reviews.css'));
    });
    expect(reviewsCssLoaded).toBe(true);

    // Webkit needs more time for JavaScript initialization
    const waitTimeout = browserName === 'webkit' ? WEBKIT_WAIT_TIMEOUT : DEFAULT_WAIT_TIMEOUT;
    const reviewsManagerExists = await page.waitForFunction(
      () => typeof window.reviewsManager !== 'undefined',
      { timeout: waitTimeout }
    );
    expect(reviewsManagerExists).toBeTruthy();
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    await page.goto('/suppliers.html');
    await page.waitForLoadState('networkidle');
    const supplierLink = page.locator('a[href*="/supplier.html?id="]').first();
    if ((await supplierLink.count()) > 0) {
      await supplierLink.click();
      await page.waitForLoadState('networkidle');
      const reviewWidget = page.locator('#reviews-widget');
      const ariaLabel = await reviewWidget.getAttribute('aria-label');
      expect(ariaLabel).toBe('Customer reviews and ratings');
    }
  });

  test('should handle missing supplier ID gracefully', async ({ page, browserName }) => {
    await page.goto('/supplier.html');
    await page.waitForLoadState('networkidle');
    // Wait for page to render - webkit needs more time
    const renderWait = browserName === 'webkit' ? 3000 : 2000;
    await page.waitForTimeout(renderWait);

    const container = page.locator('#supplier-container');
    // Wait for the container to finish loading - it might show "Loading supplier…" initially
    const contentWait = browserName === 'webkit' ? 5000 : 3000;
    await page.waitForTimeout(contentWait);

    const content = await container.textContent();
    // Be more flexible - accept either the error message or a loading state
    const isErrorShown =
      content.includes('No supplier ID provided') ||
      content.includes('Supplier not found') ||
      content.includes('Error loading supplier');
    expect(isErrorShown).toBe(true);
  });
});
