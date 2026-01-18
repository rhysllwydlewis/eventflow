/**
 * Hero Section Mobile Improvements E2E Tests
 * Tests for mobile hero section UX improvements and video loading
 */

const { test, expect } = require('@playwright/test');

// Mobile viewport sizes to test
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
};

test.describe('Hero Tags Visibility at Different Breakpoints', () => {
  test('should hide hero tags on mobile (< 768px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const heroTags = page.locator('.hero-tags');
    const tagCount = await heroTags.count();

    if (tagCount > 0) {
      // Check if tags are hidden via CSS
      const display = await heroTags.evaluate(el => window.getComputedStyle(el).display);
      expect(display).toBe('none');

      // Verify tags are not keyboard-accessible on mobile
      const firstTag = page.locator('.hero-tag').first();
      const isVisible = await firstTag.isVisible();
      expect(isVisible).toBe(false);
    }
  });

  test('should show hero tags on tablet (>= 768px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/');

    const heroTags = page.locator('.hero-tags');
    const tagCount = await heroTags.count();

    if (tagCount > 0) {
      // Check if tags are visible via CSS
      const display = await heroTags.evaluate(el => window.getComputedStyle(el).display);
      expect(display).not.toBe('none');
    }
  });

  test('should show hero tags on desktop (>= 768px)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');

    const heroTags = page.locator('.hero-tags');
    const tagCount = await heroTags.count();

    if (tagCount > 0) {
      // Check if tags are visible via CSS
      const display = await heroTags.evaluate(el => window.getComputedStyle(el).display);
      expect(display).not.toBe('none');
    }
  });

  test('should not allow keyboard focus on hidden tags on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const firstTag = page.locator('.hero-tag').first();
    const tagCount = await firstTag.count();

    if (tagCount > 0) {
      // Try to focus the tag
      await firstTag.focus().catch(() => {
        // Expected to fail since element is hidden
      });

      // Verify it's not focused
      const isFocused = await firstTag.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(false);
    }
  });
});

test.describe('Hero Video Element Loading', () => {
  test('should have video element in DOM', async ({ page }) => {
    await page.goto('/');

    const videoElement = page.locator('#hero-pexels-video');
    await expect(videoElement).toBeAttached();
  });

  test('should have video source element', async ({ page }) => {
    await page.goto('/');

    const videoSource = page.locator('#hero-video-source');
    await expect(videoSource).toBeAttached();
  });

  test('should have video credit element', async ({ page }) => {
    await page.goto('/');

    const videoCredit = page.locator('#hero-video-credit');
    await expect(videoCredit).toBeAttached();
  });

  test('should attempt to load video or show poster', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for video initialization
    await page.waitForTimeout(2000);

    const videoElement = page.locator('#hero-pexels-video');
    const videoSource = page.locator('#hero-video-source');

    // Check if video source has been set
    const srcAttribute = await videoSource.getAttribute('src');

    // Video should either have a source URL or be showing poster
    const hasSource = srcAttribute && srcAttribute.length > 0;
    const isVisible = await videoElement.isVisible();

    // Video element should be visible (either showing video or poster)
    expect(isVisible).toBe(true);

    if (hasSource) {
      console.log('Video source loaded:', srcAttribute);
    } else {
      console.log('Video showing poster as fallback');
    }
  });

  test('should show appropriate credit text', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for video initialization
    await page.waitForTimeout(2000);

    const videoCredit = page.locator('#hero-video-credit');
    const creditText = await videoCredit.textContent();
    const creditDisplay = await videoCredit.evaluate(el => window.getComputedStyle(el).display);

    if (creditDisplay !== 'none') {
      // Credit should contain either "Video by" or "Photo by"
      const hasValidCredit = creditText.includes('Video by') || creditText.includes('Photo by');
      expect(hasValidCredit).toBe(true);
    }
  });

  test('should not have inline onerror handler', async ({ page }) => {
    await page.goto('/');

    const videoElement = page.locator('#hero-pexels-video');
    const onerrorAttr = await videoElement.getAttribute('onerror');

    // Should not have inline onerror handler
    expect(onerrorAttr).toBeNull();
  });
});

test.describe('Hero Search Form Mobile Sizing', () => {
  test('should have full-width search card on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const searchCard = page.locator('.hero-search-card');
    const cardCount = await searchCard.count();

    if (cardCount > 0) {
      const cardBox = await searchCard.boundingBox();
      const viewportWidth = VIEWPORTS.mobile.width;

      // Card should span almost full width (accounting for small padding)
      // With -16px margins on both sides, it should extend beyond viewport
      // So we check if it's at least as wide as viewport
      expect(cardBox.width).toBeGreaterThanOrEqual(viewportWidth - 40);
    }
  });

  test('should have full-width category dropdown on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const categoryWrapper = page.locator('.hero-category-wrapper');
    const wrapperCount = await categoryWrapper.count();

    if (wrapperCount > 0) {
      const wrapperBox = await categoryWrapper.boundingBox();
      const searchCard = page.locator('.hero-search-card');
      const cardBox = await searchCard.boundingBox();

      // Category wrapper should use most of the card width
      expect(wrapperBox.width).toBeGreaterThan(cardBox.width * 0.85);
    }
  });

  test('should have full-width search input on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const searchInputWrapper = page.locator('.hero-search-input-wrapper');
    const wrapperCount = await searchInputWrapper.count();

    if (wrapperCount > 0) {
      const wrapperBox = await searchInputWrapper.boundingBox();
      const searchCard = page.locator('.hero-search-card');
      const cardBox = await searchCard.boundingBox();

      // Input wrapper should use most of the card width
      expect(wrapperBox.width).toBeGreaterThan(cardBox.width * 0.85);
    }
  });

  test('should have fixed-width search button on mobile (not full-width)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const searchButton = page.locator('.hero-search-button');
    const buttonCount = await searchButton.count();

    if (buttonCount > 0) {
      const buttonBox = await searchButton.boundingBox();

      // Button should be fixed width (50px) on mobile, NOT full-width
      // This ensures it stays at the right end of the search input
      expect(buttonBox.width).toBe(50);
      expect(buttonBox.height).toBeGreaterThanOrEqual(44); // Accessibility minimum
    }
  });

  test('should position search button at right end of input on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const searchInputWrapper = page.locator('.hero-search-input-wrapper');
    const searchButton = page.locator('.hero-search-button');

    if ((await searchInputWrapper.count()) > 0 && (await searchButton.count()) > 0) {
      const inputBox = await searchInputWrapper.boundingBox();
      const buttonBox = await searchButton.boundingBox();

      // Button should be to the right of input (on the same visual row)
      expect(buttonBox.x).toBeGreaterThan(inputBox.x);

      // They should be on approximately the same Y level (within 50px accounting for padding/border)
      // The key is that button is NOT below the input as a separate full-width element
      const yDifference = Math.abs(inputBox.y - buttonBox.y);
      expect(yDifference).toBeLessThan(50);

      // Button should be fixed width, not full-width
      expect(buttonBox.width).toBe(50);
    }
  });

  test('should have proper touch target size for search button', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const searchButton = page.locator('.hero-search-button');
    const buttonCount = await searchButton.count();

    if (buttonCount > 0) {
      const buttonBox = await searchButton.boundingBox();

      // Button should meet accessibility minimum (44x44px)
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
      // Width is full-width on mobile, so just check it's reasonable
      expect(buttonBox.width).toBeGreaterThan(44);
    }
  });

  test('should have reduced gap between elements on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');

    const searchRow = page.locator('.hero-search-row');
    const rowCount = await searchRow.count();

    if (rowCount > 0) {
      const gap = await searchRow.evaluate(el => window.getComputedStyle(el).gap);

      // Gap should be 10px on mobile (reduced from 12px)
      expect(gap).toBe('10px');
    }
  });
});

test.describe('Hero Search Form Accessibility', () => {
  test('should have visible focus states on all interactive elements', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');

    // Test category select focus
    const categorySelect = page.locator('.hero-category-select');
    if ((await categorySelect.count()) > 0) {
      await categorySelect.focus();
      const focusStyles = await categorySelect.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderColor: styles.borderColor,
          boxShadow: styles.boxShadow,
        };
      });
      // Should have focus styles (green border)
      expect(focusStyles.borderColor).not.toBe('rgba(226, 232, 240, 0.8)');
    }

    // Test search input focus
    const searchInput = page.locator('.hero-search-input');
    if ((await searchInput.count()) > 0) {
      await searchInput.focus();
      const focusStyles = await searchInput.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          borderColor: styles.borderColor,
          boxShadow: styles.boxShadow,
        };
      });
      // Should have focus styles (green border and shadow)
      expect(focusStyles.boxShadow).not.toBe('none');
    }

    // Test search button focus
    const searchButton = page.locator('.hero-search-button');
    if ((await searchButton.count()) > 0) {
      await searchButton.focus();
      const focusStyles = await searchButton.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
        };
      });
      // Should have outline on focus
      expect(focusStyles.outline).not.toBe('none');
    }
  });

  test('should have focus states on hero tags (desktop only)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');

    const firstTag = page.locator('.hero-tag').first();
    const tagCount = await firstTag.count();

    if (tagCount > 0 && (await firstTag.isVisible())) {
      await firstTag.focus();
      const focusStyles = await firstTag.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
        };
      });
      // Should have outline on focus
      expect(focusStyles.outline).not.toBe('none');
    }
  });
});

test.describe('Hero Section - No Regressions', () => {
  test('should not break desktop layout', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');

    const heroSection = page.locator('.hero-modern');
    await expect(heroSection).toBeVisible();

    // Check that hero grid is displayed properly on desktop
    const heroGrid = page.locator('.hero-grid');
    if ((await heroGrid.count()) > 0) {
      const gridDisplay = await heroGrid.evaluate(el => window.getComputedStyle(el).display);
      // Should use grid on desktop
      expect(gridDisplay).toBe('grid');
    }
  });

  test('should not break tablet layout', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/');

    const heroSection = page.locator('.hero-modern');
    await expect(heroSection).toBeVisible();

    // Hero section should be visible and functional
    const searchCard = page.locator('.hero-search-card');
    await expect(searchCard).toBeVisible();
  });
});
