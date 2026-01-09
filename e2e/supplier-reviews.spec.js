import { test, expect } from '@playwright/test';

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
    const initialWait = browserName === 'webkit' ? 5000 : 2000;
    await page.waitForTimeout(initialWait);

    const reviewsCssLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => link.href.includes('reviews.css'));
    });
    expect(reviewsCssLoaded).toBe(true);

    // Webkit needs more time for JavaScript initialization
    const waitTimeout = browserName === 'webkit' ? 20000 : 10000;
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

  test('should handle missing supplier ID gracefully', async ({ page }) => {
    await page.goto('/supplier.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for page to render

    const container = page.locator('#supplier-container');
    // Wait for the container to finish loading - it might show "Loading supplier…" initially
    await page.waitForTimeout(3000);

    const content = await container.textContent();
    // Be more flexible - accept either the error message or a loading state
    const isErrorShown =
      content.includes('No supplier ID provided') ||
      content.includes('Supplier not found') ||
      content.includes('Error loading supplier');
    expect(isErrorShown).toBe(true);
  });
});
