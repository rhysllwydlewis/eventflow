const { test, expect } = require('@playwright/test');

test.describe('Start Page Mobile Fixes - CSS Validation', () => {
  const testUrl = 'http://localhost:8888/test_mobile_css.html';

  test('Issue 1: Container should use column layout on mobile 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(testUrl, { waitUntil: 'networkidle' });

    // Get computed styles
    const container = page.locator('#main-content > .container');
    const flexDirection = await container.evaluate(el => window.getComputedStyle(el).flexDirection);

    const sidebar = page.locator('#plan-summary');
    const sidebarDisplay = await sidebar.evaluate(el => window.getComputedStyle(el).display);

    const mainDiv = page.locator('#main-content > .container > div:first-child');
    const mainWidth = await mainDiv.evaluate(el => {
      const width = window.getComputedStyle(el).width;
      const widthNum = parseFloat(width);
      return { width, widthNum };
    });

    console.log('Mobile 375px Results:');
    console.log('  - Container flex-direction:', flexDirection);
    console.log('  - Sidebar display:', sidebarDisplay);
    console.log('  - Main content width:', mainWidth.width);

    // Assertions
    expect(flexDirection).toBe('column');
    expect(sidebarDisplay).toBe('none');
    expect(mainWidth.widthNum).toBeGreaterThan(300); // Should take most of viewport

    // Take screenshot
    await page.screenshot({
      path: '/tmp/mobile-375px.png',
      fullPage: true,
    });
    console.log('  - Screenshot saved to /tmp/mobile-375px.png');
  });

  test('Issue 1: Container should use column layout on mobile 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto(testUrl, { waitUntil: 'networkidle' });

    const container = page.locator('#main-content > .container');
    const flexDirection = await container.evaluate(el => window.getComputedStyle(el).flexDirection);

    const sidebar = page.locator('#plan-summary');
    const sidebarDisplay = await sidebar.evaluate(el => window.getComputedStyle(el).display);

    console.log('Mobile 320px Results:');
    console.log('  - Container flex-direction:', flexDirection);
    console.log('  - Sidebar display:', sidebarDisplay);

    expect(flexDirection).toBe('column');
    expect(sidebarDisplay).toBe('none');

    await page.screenshot({
      path: '/tmp/mobile-320px.png',
      fullPage: true,
    });
    console.log('  - Screenshot saved to /tmp/mobile-320px.png');
  });

  test('Issue 2: Burger menu should be visible when opened', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(testUrl, { waitUntil: 'networkidle' });

    // Check initial state
    const header = page.locator('.ef-header');
    const headerZIndex = await header.evaluate(el => {
      const zIndex = window.getComputedStyle(el).zIndex;
      return { zIndex, zIndexNum: parseInt(zIndex) };
    });

    const menu = page.locator('#ef-mobile-menu');
    const initialOpacity = await menu.evaluate(el =>
      parseFloat(window.getComputedStyle(el).opacity)
    );

    console.log('Burger Menu - Initial State:');
    console.log('  - Header z-index:', headerZIndex.zIndex);
    console.log('  - Menu initial opacity:', initialOpacity);

    // Click burger menu
    await page.click('.ef-mobile-toggle');
    await page.waitForTimeout(500); // Wait for animation

    // Check opened state
    const menuStyles = await menu.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        zIndex: styles.zIndex,
        zIndexNum: parseInt(styles.zIndex),
        opacity: parseFloat(styles.opacity),
        visibility: styles.visibility,
        pointerEvents: styles.pointerEvents,
      };
    });

    console.log('Burger Menu - Opened State:');
    console.log('  - Menu z-index:', menuStyles.zIndex);
    console.log('  - Menu opacity:', menuStyles.opacity);
    console.log('  - Menu visibility:', menuStyles.visibility);
    console.log('  - Menu pointer-events:', menuStyles.pointerEvents);

    // Assertions
    expect(headerZIndex.zIndexNum).toBeGreaterThanOrEqual(2000);
    expect(menuStyles.zIndexNum).toBeGreaterThanOrEqual(1999);
    expect(menuStyles.opacity).toBe(1);
    expect(menuStyles.visibility).toBe('visible');
    expect(menuStyles.pointerEvents).toBe('auto');

    // Take screenshot with menu open
    await page.screenshot({
      path: '/tmp/mobile-menu-open.png',
      fullPage: true,
    });
    console.log('  - Screenshot saved to /tmp/mobile-menu-open.png');
  });

  test('Desktop: Sidebar should be visible', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(testUrl, { waitUntil: 'networkidle' });

    const sidebar = page.locator('#plan-summary');
    const sidebarDisplay = await sidebar.evaluate(el => window.getComputedStyle(el).display);

    console.log('Desktop 1024px Results:');
    console.log('  - Sidebar display:', sidebarDisplay);

    // On desktop, sidebar should be visible (not "none")
    expect(sidebarDisplay).not.toBe('none');

    await page.screenshot({
      path: '/tmp/desktop-1024px.png',
      fullPage: true,
    });
    console.log('  - Screenshot saved to /tmp/desktop-1024px.png');
  });
});
