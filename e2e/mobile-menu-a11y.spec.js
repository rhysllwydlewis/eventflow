/**
 * Mobile Menu Accessibility E2E Tests
 * Tests focus trap, ARIA attributes, keyboard navigation, and accessibility compliance
 * Tests run against static HTML (no backend required)
 */

import { test, expect } from '@playwright/test';

// Mobile viewports as specified in requirements
const VIEWPORTS = {
  required1: { width: 395, height: 653 },
  required2: { width: 320, height: 568 },
};

// Pages to test - mix of core and nested paths
const TEST_PAGES = [
  { path: '/index.html', name: 'Home' },
  { path: '/plan.html', name: 'Plan' },
  { path: '/marketplace.html', name: 'Marketplace' },
  { path: '/for-suppliers.html', name: 'For Suppliers' },
  { path: '/supplier/subscription.html', name: 'Supplier Subscription (nested)' },
];

test.describe('Mobile Menu A11Y - Focus Trap & ARIA', () => {
  for (const viewport of Object.values(VIEWPORTS)) {
    test.describe(`Viewport ${viewport.width}×${viewport.height}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(viewport);
      });

      for (const testPage of TEST_PAGES) {
        test(`${testPage.name}: should have correct ARIA attributes`, async ({ page }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Initially closed
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await expect(menu).toHaveAttribute('role', 'dialog');
          await expect(menu).toHaveAttribute('aria-modal', 'true');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(300);

          // Should be open with correct attributes
          await expect(toggle).toHaveAttribute('aria-expanded', 'true');
          await expect(menu).toHaveAttribute('aria-hidden', 'false');
        });

        test(`${testPage.name}: should open menu and show at least 5 links`, async ({ page }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Click to open
          await toggle.click();
          await page.waitForTimeout(300);

          // Menu should be visible
          await expect(menu).toBeVisible();
          await expect(menu).toHaveClass(/open/);

          // Should have minimum height
          const box = await menu.boundingBox();
          expect(box).not.toBeNull();
          expect(box.height).toBeGreaterThan(200);

          // Should have at least 5 links
          const links = menu.locator('a');
          const linkCount = await links.count();
          expect(linkCount).toBeGreaterThanOrEqual(5);
        });

        test(`${testPage.name}: should focus first link on open`, async ({ page }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(400); // Allow time for focus

          // First link should have focus
          const firstLink = menu.locator('a').first();
          await expect(firstLink).toBeFocused();
        });

        test(`${testPage.name}: should trap focus - Tab cycles within menu`, async ({ page }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(400);

          // Get all focusable elements in menu
          const focusableElements = await menu.locator('a, button').all();
          expect(focusableElements.length).toBeGreaterThan(0);

          // Tab through all elements
          for (let i = 0; i < focusableElements.length; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(100);
          }

          // After tabbing through all elements, should cycle back to first
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);

          // Focus should be back on first element
          const firstLink = menu.locator('a').first();
          await expect(firstLink).toBeFocused();
        });

        test(`${testPage.name}: should trap focus - Shift+Tab cycles backwards`, async ({
          page,
        }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(400);

          // First link should have focus
          const firstLink = menu.locator('a').first();
          await expect(firstLink).toBeFocused();

          // Shift+Tab should cycle to last element
          await page.keyboard.press('Shift+Tab');
          await page.waitForTimeout(100);

          // Should be on last focusable element now
          const lastLink = menu.locator('a').last();
          await expect(lastLink).toBeFocused();
        });

        test(`${testPage.name}: should NOT allow focus outside menu when open`, async ({
          page,
        }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(400);

          // Try to focus element outside menu (in main content)
          // This should fail because of inert or aria-hidden
          const mainElement = page.locator('main');
          await expect(mainElement).toBeAttached();

          // Focus should remain within menu
          // Tab multiple times and check focus is still in menu
          for (let i = 0; i < 3; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);

            // Get currently focused element
            const focusedElement = await page.evaluate(() =>
              document.activeElement?.closest('#ef-mobile-menu')
            );
            expect(focusedElement).not.toBeNull();
          }
        });

        test(`${testPage.name}: should close on Escape and return focus`, async ({ page }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(400);
          await expect(menu).toHaveClass(/open/);

          // Press Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          // Menu should be closed
          await expect(menu).not.toHaveClass(/open/);

          // Focus should return to toggle button
          await expect(toggle).toBeFocused();
        });

        test(`${testPage.name}: should close on backdrop click and return focus`, async ({
          page,
        }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Open menu
          await toggle.click();
          await page.waitForTimeout(400);
          await expect(menu).toHaveClass(/open/);

          // Click outside menu (on main content area)
          await page.locator('main').click({ position: { x: 10, y: 300 }, force: true });
          await page.waitForTimeout(300);

          // Menu should be closed
          await expect(menu).not.toHaveClass(/open/);

          // Focus should return to toggle button
          await expect(toggle).toBeFocused();
        });

        test(`${testPage.name}: should handle rapid open/close without breaking`, async ({
          page,
        }) => {
          await page.goto(testPage.path);

          const toggle = page.locator('#ef-mobile-toggle');
          const menu = page.locator('#ef-mobile-menu');

          // Rapidly open and close multiple times
          for (let i = 0; i < 5; i++) {
            await toggle.click();
            await page.waitForTimeout(100);
            await toggle.click();
            await page.waitForTimeout(100);
          }

          // Final state should be consistent (closed)
          await expect(menu).not.toHaveClass(/open/);
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        });
      }
    });
  }
});

test.describe('Mobile Menu A11Y - ARIA Compliance Summary', () => {
  test('should pass all accessibility checks on index.html', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.required1);
    await page.goto('/index.html');

    const toggle = page.locator('#ef-mobile-toggle');
    const menu = page.locator('#ef-mobile-menu');

    // Check all required ARIA attributes exist
    await expect(toggle).toHaveAttribute('aria-expanded');
    await expect(toggle).toHaveAttribute('aria-label');
    await expect(toggle).toHaveAttribute('aria-controls', 'ef-mobile-menu');

    await expect(menu).toHaveAttribute('role', 'dialog');
    await expect(menu).toHaveAttribute('aria-modal', 'true');
    await expect(menu).toHaveAttribute('aria-label');

    // Open menu and verify changes
    await toggle.click();
    await page.waitForTimeout(300);

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toHaveAttribute('aria-hidden', 'false');
  });
});
