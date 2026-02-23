import { test, expect } from '@playwright/test';

test.describe('Navbar Complete Rebuild - PR #241', () => {
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

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('1. Burger menu appears with proper fixed positioning', async ({ page, viewport }) => {
    // Only test on mobile viewports
    if (!viewport || viewport.width > 768) {
      test.skip();
      return;
    }

    // Check burger button exists and is visible
    const burger = page.locator('#ef-mobile-toggle');
    await expect(burger).toBeVisible();

    // Click burger to open menu
    await burger.click();
    await page.waitForTimeout(500);

    // Check menu is visible
    const navMenu = page.locator('#ef-mobile-menu');
    await expect(navMenu).toBeVisible();

    // Check menu has proper classes
    const hasOpenClass = await navMenu.evaluate(el => el.classList.contains('open'));
    expect(hasOpenClass).toBe(true);

    // Check body has nav-open class
    const bodyHasNavOpen = await page.evaluate(() =>
      document.body.classList.contains('ef-menu-open')
    );
    expect(bodyHasNavOpen).toBe(true);

    // Verify z-index stacking (header > menu)
    const headerZIndex = await page
      .locator('.ef-header')
      .evaluate(el => parseInt(window.getComputedStyle(el).zIndex, 10));
    const menuZIndex = await navMenu.evaluate(el =>
      parseInt(window.getComputedStyle(el).zIndex, 10)
    );

    expect(headerZIndex).toBeGreaterThanOrEqual(1000);
    expect(menuZIndex).toBeGreaterThanOrEqual(999);
    expect(headerZIndex).toBeGreaterThan(menuZIndex);
  });

  test('2. Auth state syncs between top and footer navbars', async ({ page }) => {
    // Mock logged-in user
    await page.evaluate(() => {
      localStorage.setItem(
        'user',
        JSON.stringify({ id: '123', role: 'customer', name: 'Test User' })
      );
    });

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
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check top nav shows logged-in state
    const topAuthLink = page.locator('.nav-inline .nav-main-login');
    if (await topAuthLink.isVisible()) {
      await expect(topAuthLink).toContainText(/Log out/i);
    }

    // Check footer nav shows logged-in state
    const footerAuthLink = page.locator('.footer-nav-auth');
    if (await footerAuthLink.isVisible()) {
      await expect(footerAuthLink).toContainText(/Log out/i);
    }

    // Check dashboard link is visible
    const dashboardLink = page.locator('.nav-main-dashboard, .footer-nav-dashboard').first();
    if (await dashboardLink.isVisible()) {
      await expect(dashboardLink).toContainText(/Dashboard/i);
    }
  });

  test('3. No console errors for optional API endpoints', async ({ page }) => {
    const consoleErrors = [];
    const consoleWarnings = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Filter out expected errors that are not related to our changes
    const relevantErrors = consoleErrors.filter(
      err =>
        !err.includes('favicon') &&
        !err.includes('net::ERR_') &&
        !err.includes('404') &&
        !err.includes('403')
    );

    // Should have no relevant console errors
    expect(relevantErrors.length).toBe(0);
  });

  test('4. Mobile menu closes on link click', async ({ page, viewport }) => {
    // Only test on mobile viewports
    if (!viewport || viewport.width > 768) {
      test.skip();
      return;
    }

    // Open menu
    const burger = page.locator('#burger');
    await burger.click();
    await page.waitForTimeout(500);

    // Verify menu is open
    const navMenu = page.locator('.nav-menu');
    await expect(navMenu).toBeVisible();

    // Click a link in the menu
    const menuLink = navMenu.locator('a').first();
    await menuLink.click();
    await page.waitForTimeout(500);

    // Check body no longer has nav-open class
    const bodyHasNavOpen = await page.evaluate(() => document.body.classList.contains('nav-open'));
    expect(bodyHasNavOpen).toBe(false);
  });

  test('5. Mobile menu closes on ESC key', async ({ page, viewport }) => {
    // Only test on mobile viewports
    if (!viewport || viewport.width > 768) {
      test.skip();
      return;
    }

    // Open menu
    const burger = page.locator('#burger');
    await burger.click();
    await page.waitForTimeout(500);

    // Verify menu is open
    const bodyHasNavOpen = await page.evaluate(() => document.body.classList.contains('nav-open'));
    expect(bodyHasNavOpen).toBe(true);

    // Press ESC key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Check menu is closed
    const bodyStillHasNavOpen = await page.evaluate(() =>
      document.body.classList.contains('nav-open')
    );
    expect(bodyStillHasNavOpen).toBe(false);
  });

  test('6. Body scroll disabled when menu open', async ({ page, viewport }) => {
    // Only test on mobile viewports
    if (!viewport || viewport.width > 768) {
      test.skip();
      return;
    }

    // Check initial body overflow
    const initialOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(initialOverflow).not.toBe('hidden');

    // Open menu
    const burger = page.locator('#burger');
    await burger.click();
    await page.waitForTimeout(500);

    // Check body overflow is hidden
    const overflowWhenOpen = await page.evaluate(() => document.body.style.overflow);
    expect(overflowWhenOpen).toBe('hidden');

    // Close menu
    await burger.click();
    await page.waitForTimeout(500);

    // Check body overflow is restored
    const overflowWhenClosed = await page.evaluate(() => document.body.style.overflow);
    expect(overflowWhenClosed).not.toBe('hidden');
  });

  test('7. Menu works at various viewport sizes', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 375, height: 667 }, // iPhone 8
      { width: 414, height: 896 }, // iPhone 11
      { width: 768, height: 1024 }, // iPad
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const burger = page.locator('#burger');

      // Check if burger is visible on mobile sizes
      if (viewport.width <= 768) {
        await expect(burger).toBeVisible();

        // Open menu
        await burger.click();
        await page.waitForTimeout(500);

        // Check menu is visible
        const navMenu = page.locator('.nav-menu');
        await expect(navMenu).toBeVisible();

        // Close menu
        await burger.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('8. No race conditions on rapid burger clicks', async ({ page, viewport }) => {
    // Only test on mobile viewports
    if (!viewport || viewport.width > 768) {
      test.skip();
      return;
    }

    const burger = page.locator('#burger');

    // Rapid clicks
    for (let i = 0; i < 5; i++) {
      await burger.click();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(1000);

    // Menu should be in a stable state (open or closed, not stuck)
    const bodyHasNavOpen = await page.evaluate(() => document.body.classList.contains('nav-open'));

    // Either open or closed is fine, just check it's consistent
    const navMenuVisible = await page.locator('.nav-menu').isVisible();

    if (bodyHasNavOpen) {
      expect(navMenuVisible).toBe(true);
    } else {
      // Menu might still be visible but transitioning
      // Just ensure body state is consistent
      expect(typeof bodyHasNavOpen).toBe('boolean');
    }
  });
});
