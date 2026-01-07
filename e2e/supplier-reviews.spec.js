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

  test('should load reviews resources', async ({ page }) => {
    await page.goto('/supplier.html?id=test');
    const reviewsCssLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => link.href.includes('reviews.css'));
    });
    expect(reviewsCssLoaded).toBe(true);
    const reviewsManagerExists = await page.waitForFunction(
      () => typeof window.reviewsManager !== 'undefined',
      { timeout: 5000 }
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
    const container = page.locator('#supplier-container');
    const content = await container.textContent();
    expect(content).toContain('No supplier ID provided');
  });
});
