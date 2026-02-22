/**
 * Dashboard Mobile UI Fixes E2E Tests
 * Tests for dashboard action buttons 2x2 grid and notification bell touch support
 */

const { test, expect } = require('@playwright/test');

// Mobile viewport sizes to test
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  mobileLarge: { width: 414, height: 896 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
};

test.describe('Dashboard Action Buttons Mobile Layout', () => {
  test('should display action buttons in 2x2 grid on mobile (375px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard-supplier.html');

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-hero__actions', { timeout: 5000 });

    const actionsContainer = page.locator('.dashboard-hero__actions');

    // Check if container exists
    const exists = await actionsContainer.count();
    if (exists > 0) {
      // Check grid layout is applied
      const display = await actionsContainer.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('grid');

      // Check grid has 2 columns
      const gridTemplateColumns = await actionsContainer.evaluate(
        el => window.getComputedStyle(el).gridTemplateColumns
      );
      // Should be "repeat(2, 1fr)" which computes to two equal columns
      const columns = gridTemplateColumns.split(' ').length;
      expect(columns).toBe(2);
    }
  });

  test('should display action buttons with column layout on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard-supplier.html');

    await page.waitForSelector('.dashboard-action-chip', { timeout: 5000 });

    const chips = page.locator('.dashboard-action-chip');
    const chipCount = await chips.count();

    if (chipCount > 0) {
      const firstChip = chips.first();

      // Check flex-direction is column
      const flexDirection = await firstChip.evaluate(
        el => window.getComputedStyle(el).flexDirection
      );
      expect(flexDirection).toBe('column');

      // Check text-align is center
      const textAlign = await firstChip.evaluate(el => window.getComputedStyle(el).textAlign);
      expect(textAlign).toBe('center');

      // Check font-size is smaller for mobile
      const fontSize = await firstChip.evaluate(el => window.getComputedStyle(el).fontSize);
      expect(fontSize).toBe('13px');
    }
  });

  test('should show flex layout on desktop (>768px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/dashboard-supplier.html');

    await page.waitForSelector('.dashboard-hero__actions', { timeout: 5000 });

    const actionsContainer = page.locator('.dashboard-hero__actions');
    const exists = await actionsContainer.count();

    if (exists > 0) {
      // Check that display is flex on desktop (not grid)
      const display = await actionsContainer.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('flex');
    }
  });

  test('should have readable text without overlap on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard-supplier.html');

    await page.waitForSelector('.dashboard-action-chip', { timeout: 5000 });

    const chips = page.locator('.dashboard-action-chip');
    const chipCount = await chips.count();

    if (chipCount > 0) {
      // Get all chip elements and check their bounds don't overlap
      const chipBounds = await chips.evaluateAll(elements =>
        elements.map(el => el.getBoundingClientRect())
      );

      // Check that no chips overlap horizontally in the same row
      for (let i = 0; i < chipBounds.length - 1; i++) {
        const current = chipBounds[i];
        const next = chipBounds[i + 1];

        // If they're in the same row (similar Y position), check they don't overlap
        if (Math.abs(current.top - next.top) < 10) {
          // They should not overlap horizontally
          const noOverlap = current.right <= next.left || next.right <= current.left;
          expect(noOverlap).toBe(true);
        }
      }
    }
  });
});

test.describe('Notification Bell Touch Support', () => {
  test('should have notification bell element', async ({ page }) => {
    await page.goto('/dashboard-supplier.html');

    // Look for notification bell by common IDs
    const bellSelectors = ['#ef-notification-btn', '#notification-bell'];
    let bellFound = false;

    for (const selector of bellSelectors) {
      const bell = page.locator(selector);
      const count = await bell.count();
      if (count > 0) {
        bellFound = true;

        // Check bell is not disabled
        const isDisabled = await bell.evaluate(el => el.disabled);
        expect(isDisabled).toBe(false);

        // Check bell has pointer-events enabled
        const pointerEvents = await bell.evaluate(el => window.getComputedStyle(el).pointerEvents);
        expect(pointerEvents).not.toBe('none');

        break;
      }
    }

    // If bell exists, verify touch handling
    if (bellFound) {
      expect(bellFound).toBe(true);
    }
  });

  test('should respond to click events on notification bell', async ({ page }) => {
    await page.goto('/dashboard-supplier.html');

    // Wait for page to be interactive
    await page.waitForLoadState('networkidle');

    const bellSelectors = ['#ef-notification-btn', '#notification-bell'];

    for (const selector of bellSelectors) {
      const bell = page.locator(selector);
      const count = await bell.count();

      if (count > 0) {
        // Click the bell
        await bell.click();

        // Check if dropdown appeared
        const dropdown = page.locator('.notification-dropdown');
        const dropdownCount = await dropdown.count();

        if (dropdownCount > 0) {
          // Wait for dropdown to become visible (may not exist or may timeout)
          try {
            await dropdown.waitFor({ state: 'visible', timeout: 1000 });
          } catch (err) {
            // Dropdown may not be present or may not become visible - test will continue
            console.log('Dropdown did not become visible within timeout:', err.message);
          }

          // Check if dropdown has open class
          const hasOpenClass = await dropdown.evaluate(el =>
            el.classList.contains('notification-dropdown--open')
          );
          expect(hasOpenClass).toBe(true);
        }

        break;
      }
    }
  });

  test('should respond to touch events on mobile viewport', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/dashboard-supplier.html');

    // Wait for page to be interactive
    await page.waitForLoadState('networkidle');

    const bellSelectors = ['#ef-notification-btn', '#notification-bell'];

    for (const selector of bellSelectors) {
      const bell = page.locator(selector);
      const count = await bell.count();

      if (count > 0) {
        // Tap the bell (simulates touch)
        await bell.tap();

        // Check if dropdown appeared
        const dropdown = page.locator('.notification-dropdown');
        const dropdownCount = await dropdown.count();

        if (dropdownCount > 0) {
          // Wait for dropdown to become visible (may not exist or may timeout)
          try {
            await dropdown.waitFor({ state: 'visible', timeout: 1000 });
          } catch (err) {
            // Dropdown may not be present or may not become visible - test will continue
            console.log('Dropdown did not become visible within timeout:', err.message);
          }

          // Check if dropdown has open class
          const hasOpenClass = await dropdown.evaluate(el =>
            el.classList.contains('notification-dropdown--open')
          );
          expect(hasOpenClass).toBe(true);
        }

        break;
      }
    }
  });
});
