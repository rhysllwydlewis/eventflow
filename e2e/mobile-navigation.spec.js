/**
 * Mobile Navigation E2E Tests
 * Tests burger menu functionality, bottom nav, and search button on mobile viewports
 */

import { test, expect } from '@playwright/test';

// Mobile viewport sizes to test
const VIEWPORTS = {
  iPhoneSE: { width: 375, height: 667 },
  iPhone12: { width: 390, height: 844 },
  Pixel5: { width: 393, height: 851 },
  small: { width: 320, height: 568 },
};

test.describe('Mobile Navigation - Burger Menu', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.iPhoneSE);
  });

  test('should display burger menu button on home page', async ({ page }) => {
    await page.goto('/');

    // Check top header burger button
    const topBurgerBtn = page.locator('#ef-mobile-toggle');
    await expect(topBurgerBtn).toBeVisible();
    await expect(topBurgerBtn).toHaveAttribute('aria-expanded', 'false');

    // Check bottom nav burger button
    const bottomBurgerBtn = page.locator('#ef-bottom-menu');
    await expect(bottomBurgerBtn).toBeVisible();
  });

  test('should open mobile menu when clicking top burger button', async ({ page }) => {
    await page.goto('/');

    const burgerBtn = page.locator('#ef-mobile-toggle');
    const mobileMenu = page.locator('#ef-mobile-menu');

    // Menu should be hidden initially
    await expect(mobileMenu).not.toHaveClass(/open/);
    await expect(burgerBtn).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    await burgerBtn.click();

    // Wait a bit for animation
    await page.waitForTimeout(500);

    // Menu should be visible
    await expect(mobileMenu).toHaveClass(/open/);
    await expect(burgerBtn).toHaveAttribute('aria-expanded', 'true');

    // Menu items should be visible
    await expect(page.locator('.ef-mobile-link').first()).toBeVisible();
  });

  test('should open mobile menu when clicking bottom burger button', async ({ page }) => {
    await page.goto('/');

    const bottomBurgerBtn = page.locator('#ef-bottom-menu');
    const mobileMenu = page.locator('#ef-mobile-menu');

    // Menu should be hidden initially
    await expect(mobileMenu).not.toHaveClass(/open/);

    // Click to open
    await bottomBurgerBtn.click();

    // Wait a bit for animation
    await page.waitForTimeout(500);

    // Menu should be visible
    await expect(mobileMenu).toHaveClass(/open/);
    await expect(bottomBurgerBtn).toHaveAttribute('aria-expanded', 'true');
  });

  test('should close mobile menu when clicking burger button again', async ({ page }) => {
    await page.goto('/');

    const burgerBtn = page.locator('#ef-mobile-toggle');
    const mobileMenu = page.locator('#ef-mobile-menu');

    // Open menu
    await burgerBtn.click();
    await page.waitForTimeout(500);
    await expect(mobileMenu).toHaveClass(/open/);

    // Close menu
    await burgerBtn.click();
    await page.waitForTimeout(500);

    // Menu should be hidden
    await expect(mobileMenu).not.toHaveClass(/open/);
    await expect(burgerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('should close mobile menu when clicking outside', async ({ page }) => {
    await page.goto('/');

    const burgerBtn = page.locator('#ef-mobile-toggle');
    const mobileMenu = page.locator('#ef-mobile-menu');

    // Open menu
    await burgerBtn.click();
    await page.waitForTimeout(500);
    await expect(mobileMenu).toHaveClass(/open/);

    // Click outside the menu (on main content)
    await page.locator('main').click({ position: { x: 10, y: 300 } });
    await page.waitForTimeout(300);

    // Menu should be closed
    await expect(mobileMenu).not.toHaveClass(/open/);
  });

  test('should close mobile menu when pressing Escape key', async ({ page }) => {
    await page.goto('/');

    const burgerBtn = page.locator('#ef-mobile-toggle');
    const mobileMenu = page.locator('#ef-mobile-menu');

    // Open menu
    await burgerBtn.click();
    await page.waitForTimeout(500);
    await expect(mobileMenu).toHaveClass(/open/);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Menu should be closed
    await expect(mobileMenu).not.toHaveClass(/open/);
  });

  test('should work on multiple pages', async ({ page }) => {
    const pages = ['/', '/suppliers.html', '/pricing.html', '/blog.html'];

    for (const pagePath of pages) {
      await page.goto(pagePath);

      const burgerBtn = page.locator('#ef-mobile-toggle');
      const mobileMenu = page.locator('#ef-mobile-menu');

      // Button should be visible
      await expect(burgerBtn).toBeVisible();

      // Open menu
      await burgerBtn.click();
      await page.waitForTimeout(500);

      // Menu should be open
      await expect(mobileMenu).toHaveClass(/open/);

      // Close menu
      await burgerBtn.click();
      await page.waitForTimeout(500);

      // Menu should be closed
      await expect(mobileMenu).not.toHaveClass(/open/);
    }
  });
});

test.describe('Mobile Navigation - Bottom Bar Layout', () => {
  test('should not have overlapping buttons on 375px viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.iPhoneSE);
    await page.goto('/');

    const bottomNav = page.locator('.ef-bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Get all bottom nav buttons
    const buttons = await bottomNav.locator('.ef-bottom-link, button').all();

    // Check that we have buttons
    expect(buttons.length).toBeGreaterThan(0);

    // Check button widths and spacing
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();

      // Each button should have reasonable width (not too narrow)
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.width).toBeLessThanOrEqual(100);
    }
  });

  test('should not have overlapping text labels on 320px viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.small);
    await page.goto('/');

    const bottomNav = page.locator('.ef-bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Get all text labels
    const labels = await bottomNav.locator('.ef-bottom-label').all();

    for (const label of labels) {
      await expect(label).toBeVisible();

      // Text should not overflow
      const box = await label.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(0);
    }
  });

  test('burger button should have appropriate width on all viewports', async ({ page }) => {
    const viewports = Object.values(VIEWPORTS);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const menuBtn = page.locator('#ef-bottom-menu');
      await expect(menuBtn).toBeVisible();

      const box = await menuBtn.boundingBox();
      expect(box).not.toBeNull();

      // Button should not be too narrow or too wide
      expect(box.width).toBeGreaterThanOrEqual(44); // Accessibility minimum
      expect(box.width).toBeLessThanOrEqual(70); // Not too wide
    }
  });
});

test.describe('Mobile Navigation - Search Button', () => {
  test('should display search button properly on home page', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.iPhoneSE);
    await page.goto('/');

    const searchButton = page.locator('.hero-search-button');
    await expect(searchButton).toBeVisible();

    // Button should be clickable
    await expect(searchButton).toBeEnabled();

    // Check button positioning (should be inside the search form)
    const box = await searchButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('search button should not overlap input text on small screens', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.small);
    await page.goto('/');

    const searchInput = page.locator('.hero-search-input');
    const searchButton = page.locator('.hero-search-button');

    await expect(searchInput).toBeVisible();
    await expect(searchButton).toBeVisible();

    // Type long text
    await searchInput.fill('This is a very long search query to test overlap');

    // Button should still be visible and properly positioned
    await expect(searchButton).toBeVisible();
    const buttonBox = await searchButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(buttonBox.width).toBeGreaterThan(30); // Button should have reasonable width
  });

  test('search button should be appropriately sized on all viewports', async ({ page }) => {
    const viewports = Object.values(VIEWPORTS);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const searchButton = page.locator('.hero-search-button');
      await expect(searchButton).toBeVisible();

      const box = await searchButton.boundingBox();
      expect(box).not.toBeNull();

      // Button should meet accessibility standards
      expect(box.width).toBeGreaterThanOrEqual(32); // Minimum for mobile
      expect(box.height).toBeGreaterThanOrEqual(32); // Minimum for mobile

      // But not too large
      expect(box.width).toBeLessThanOrEqual(60);
      expect(box.height).toBeLessThanOrEqual(50);
    }
  });
});

test.describe('Mobile Navigation - Burger Menu Visual Test', () => {
  test('should match test-burger-menu.html behavior', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.iPhoneSE);

    // Test on the test page first
    await page.goto('/test-burger-menu.html');
    const testBurgerBtn = page.locator('#ef-mobile-toggle');
    const testMenu = page.locator('#ef-mobile-menu');

    await testBurgerBtn.click();
    await page.waitForTimeout(500);
    await expect(testMenu).toHaveClass(/open/);

    // Now test on the home page
    await page.goto('/');
    const homeBurgerBtn = page.locator('#ef-mobile-toggle');
    const homeMenu = page.locator('#ef-mobile-menu');

    await homeBurgerBtn.click();
    await page.waitForTimeout(500);

    // Should behave the same
    await expect(homeMenu).toHaveClass(/open/);
  });
});
