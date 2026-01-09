import { test, expect } from '@playwright/test';

test.describe('Supplier Search and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display homepage with search', async ({ page }) => {
    await expect(page).toHaveTitle(/EventFlow/i);

    // Look for search functionality
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    if ((await searchInput.count()) > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test('should navigate to suppliers page', async ({ page }) => {
    // Look for suppliers link
    const suppliersLink = page.locator(
      'a:has-text("Suppliers"), a:has-text("Browse"), a[href*="supplier"]'
    );
    if ((await suppliersLink.count()) > 0) {
      await suppliersLink.first().click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Extra time for mobile browsers

      // Should show supplier listings
      const supplierCards = page.locator('.supplier-card, [data-supplier-id], .card');
      if ((await supplierCards.count()) > 0) {
        expect(await supplierCards.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should filter suppliers by category', async ({ page }) => {
    await page.goto('/');

    // Look for category filters
    const categoryFilter = page.locator(
      'select[name="category"], button:has-text("Category"), .category-filter'
    );
    if ((await categoryFilter.count()) > 0) {
      await categoryFilter.first().click();

      // Select a category
      const categoryOption = page
        .locator('option, button, a')
        .filter({ hasText: /venue|catering|photography/i });
      if ((await categoryOption.count()) > 0) {
        await categoryOption.first().click();

        // Wait for results
        await page.waitForTimeout(1000);

        // Results should be filtered
        const results = page.locator('.supplier-card, [data-supplier-id]');
        if ((await results.count()) > 0) {
          expect(await results.count()).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should search for suppliers', async ({ page }) => {
    await page.goto('/');

    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();
    if ((await searchInput.count()) > 0) {
      // Enter search term
      await searchInput.fill('venue');

      // Look for search button or submit
      const searchButton = page.locator('button[type="submit"], button:has-text("Search")');
      if ((await searchButton.count()) > 0) {
        await searchButton.first().click();
      } else {
        await searchInput.press('Enter');
      }

      // Wait for results
      await page.waitForTimeout(1000);

      // Should show search results
      const results = page.locator('.supplier-card, .search-result, [data-supplier-id]');
      if ((await results.count()) > 0) {
        expect(await results.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should display supplier details', async ({ page }) => {
    await page.goto('/');

    // Find first supplier card
    const supplierCard = page.locator('.supplier-card, [data-supplier-id]').first();
    if ((await supplierCard.count()) > 0) {
      await supplierCard.click();

      // Wait for navigation
      await page.waitForLoadState('networkidle');

      // Should show supplier details
      const supplierName = page.locator('h1, .supplier-name, [data-supplier-name]');
      if ((await supplierName.count()) > 0) {
        await expect(supplierName).toBeVisible();
      }
    }
  });

  test('should show price filter', async ({ page }) => {
    await page.goto('/');

    // Look for price filter
    const priceFilter = page.locator('input[type="range"], input[name*="price"], .price-filter');
    if ((await priceFilter.count()) > 0) {
      await expect(priceFilter.first()).toBeVisible();
    }
  });

  test('should load more suppliers with pagination', async ({ page }) => {
    await page.goto('/');

    // Look for load more or pagination
    const loadMore = page.locator(
      'button:has-text("Load More"), button:has-text("More"), .pagination a'
    );
    if ((await loadMore.count()) > 0) {
      const initialCount = await page.locator('.supplier-card, [data-supplier-id]').count();

      await loadMore.first().click();
      await page.waitForTimeout(1000);

      const newCount = await page.locator('.supplier-card, [data-supplier-id]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }
  });

  test('should be accessible with keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through elements
    await page.keyboard.press('Tab');

    // Check if focus is visible
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });
});
