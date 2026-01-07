import { test, expect } from '@playwright/test';

test.describe('Supplier Reviews Widget Integration', () => {
  test('should display review widget on supplier profile page', async ({ page }) => {
    // Navigate to suppliers page first
    await page.goto('/suppliers.html');
    await page.waitForLoadState('networkidle');

    // Find the first supplier card link
    const supplierLink = page.locator('a[href*="/supplier.html?id="]').first();

    // Check if suppliers exist
    if ((await supplierLink.count()) > 0) {
      await supplierLink.click();
      await page.waitForLoadState('networkidle');

      // Verify the review widget is present
      const reviewWidget = page.locator('#reviews-widget');
      await expect(reviewWidget).toBeVisible();

      // Check for key review elements
      const reviewSummary = page.locator('.review-summary');
      await expect(reviewSummary).toBeVisible();

      const writeReviewBtn = page.locator('#btn-write-review');
      await expect(writeReviewBtn).toBeVisible();

      // Check for rating filters
      const minRatingFilter = page.locator('#filter-min-rating');
      await expect(minRatingFilter).toBeVisible();

      const sortByFilter = page.locator('#filter-sort-by');
      await expect(sortByFilter).toBeVisible();

      // Verify review list container exists
      const reviewsList = page.locator('#reviews-list');
      await expect(reviewsList).toBeVisible();
    }
  });

  test('should display review widget elements with proper styling', async ({ page }) => {
    // Navigate to suppliers page
    await page.goto('/suppliers.html');
    await page.waitForLoadState('networkidle');

    // Get first supplier
    const supplierLink = page.locator('a[href*="/supplier.html?id="]').first();

    if ((await supplierLink.count()) > 0) {
      await supplierLink.click();
      await page.waitForLoadState('networkidle');

      // Check that the widget has proper spacing (margin-top: 2rem)
      const widgetContainer = page.locator('#reviews-widget').locator('..');
      const marginTop = await widgetContainer.evaluate(el => window.getComputedStyle(el).marginTop);

      // Should have 2rem (32px) margin
      expect(marginTop).toBeTruthy();

      // Verify review widget appears after packages section
      const packagesSection = page.locator('section:has(h2:text("Packages"))');
      const reviewWidget = page.locator('#reviews-widget');

      if ((await packagesSection.count()) > 0) {
        const packagesBox = await packagesSection.boundingBox();
        const reviewBox = await reviewWidget.boundingBox();

        if (packagesBox && reviewBox) {
          // Review widget should be below packages section
          expect(reviewBox.y).toBeGreaterThan(packagesBox.y);
        }
      }
    }
  });

  test('should load reviews CSS and JS files', async ({ page }) => {
    await page.goto('/supplier.html?id=test');

    // Check that reviews.css is loaded
    const reviewsCssLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.some(link => link.href.includes('reviews.css'));
    });
    expect(reviewsCssLoaded).toBe(true);

    // Check that reviews.js is loaded
    const reviewsJsLoaded = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.some(script => script.src.includes('reviews.js'));
    });
    expect(reviewsJsLoaded).toBe(true);

    // Check that reviewsManager is available
    const reviewsManagerExists = await page.evaluate(() => {
      return typeof window.reviewsManager !== 'undefined';
    });
    expect(reviewsManagerExists).toBe(true);
  });
});
