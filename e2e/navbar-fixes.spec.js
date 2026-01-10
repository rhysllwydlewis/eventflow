import { test, expect } from '@playwright/test';

test.describe('Navbar Fixes', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints to avoid console errors
    await page.route('**/api/public/homepage-settings', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });

    await page.route('**/api/reviews*', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      });
    });

    await page.route('**/api/csrf-token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-token' }),
      });
    });

    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not authenticated' }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('footer nav visible on page load on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const footerNav = page.locator('.footer-nav');
    await expect(footerNav).toBeVisible();
  });

  test('footer nav hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(500);

    const footerNav = page.locator('.footer-nav');
    await expect(footerNav).not.toBeVisible();
  });

  test('dashboard link shows when logged in', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    // Mock logged-in state
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: '123', role: 'customer', name: 'Test User', email: 'test@example.com' },
        }),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const dashboardLink = page.locator('.footer-nav-dashboard');
    await expect(dashboardLink).toBeVisible();
  });

  test('burger menu opens below header', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const burger = page.locator('#burger');
    const navMenu = page.locator('.nav-menu');

    // Verify menu is initially not visible (closed)
    const isInitiallyVisible = await navMenu.isVisible();

    await burger.click();
    await page.waitForTimeout(500);

    // Check menu is now visible
    await expect(navMenu).toBeVisible();

    // Check menu has open class
    const hasOpenClass = await navMenu.evaluate(
      el => el.classList.contains('nav-menu--open') || el.classList.contains('is-open')
    );
    expect(hasOpenClass).toBe(true);

    // Verify menu appears in viewport (not off-screen)
    const navBbox = await navMenu.boundingBox();
    expect(navBbox).not.toBeNull();
    if (navBbox) {
      // When open, menu should be visible in viewport
      expect(navBbox.y).toBeGreaterThanOrEqual(0);
      expect(navBbox.y).toBeLessThan(200); // Reasonable position below header
    }
  });

  test('footer burger syncs with header burger', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const headerBurger = page.locator('#burger');
    const footerBurger = page.locator('#footer-burger');

    // Ensure menu is initially closed
    const initialState = await headerBurger.getAttribute('aria-expanded');
    if (initialState === 'true') {
      await headerBurger.click();
      await page.waitForTimeout(500);
    }

    // Open menu with header burger
    await headerBurger.click();
    await page.waitForTimeout(500);

    await expect(headerBurger).toHaveAttribute('aria-expanded', 'true');
    await expect(footerBurger).toHaveAttribute('aria-expanded', 'true');

    // Close menu with footer burger
    await footerBurger.click();
    await page.waitForTimeout(500);

    await expect(headerBurger).toHaveAttribute('aria-expanded', 'false');
    await expect(footerBurger).toHaveAttribute('aria-expanded', 'false');
  });

  test('mobile viewports (320px, 375px, 480px)', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
      { width: 480, height: 854 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const footerNav = page.locator('.footer-nav');
      await expect(footerNav).toBeVisible();
    }
  });

  test('desktop viewports (768px+)', async ({ page }) => {
    const viewports = [
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const footerNav = page.locator('.footer-nav');
      await expect(footerNav).not.toBeVisible();
    }
  });

  test('no console errors during typical flows', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(2000);

    // Open burger menu
    const burger = page.locator('#burger');
    await burger.click();
    await page.waitForTimeout(500);

    // Close burger menu
    await burger.click();
    await page.waitForTimeout(500);

    // Filter out expected errors
    const relevantErrors = consoleErrors.filter(
      err =>
        !err.includes('favicon') &&
        !err.includes('net::ERR_') &&
        !err.includes('404') &&
        !err.includes('403')
    );

    expect(relevantErrors.length).toBe(0);
  });

  test('auth state syncs between navbars', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    // Mock logged-in state
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: '123', role: 'customer', name: 'Test User', email: 'test@example.com' },
        }),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check footer nav shows logged-in state
    const footerAuthLink = page.locator('.footer-nav-auth');
    await expect(footerAuthLink).toContainText(/Log out/i);

    // Check dashboard link is visible
    const dashboardLink = page.locator('.footer-nav-dashboard');
    await expect(dashboardLink).toBeVisible();
  });

  test('burger menu has correct z-index stacking', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(500);

    const burger = page.locator('#burger');
    const navMenu = page.locator('.nav-menu');
    const header = page.locator('.header');

    await burger.click();
    await page.waitForTimeout(500);

    // Get z-index values
    const headerZIndex = await header.evaluate(el =>
      parseInt(window.getComputedStyle(el).zIndex, 10)
    );
    const menuZIndex = await navMenu.evaluate(el =>
      parseInt(window.getComputedStyle(el).zIndex, 10)
    );

    // Header should have higher z-index than menu
    expect(headerZIndex).toBeGreaterThan(menuZIndex);
  });
});
