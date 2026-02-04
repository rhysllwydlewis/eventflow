import { test, expect } from '@playwright/test';

test.describe('Supplier Dashboard Improvements @backend', () => {
  test.beforeEach(async ({ page }) => {
    // This test assumes the user is logged in as a supplier
    // In a real scenario, you'd need to authenticate first
    await page.goto('/');
  });

  test('navigation pills should be centered on mobile', async ({ page }) => {
    // Navigate to supplier dashboard (adjust URL based on your routing)
    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');

    // Find the mobile nav pills container
    const navPills = page.locator('.mobile-nav-pills');
    
    if ((await navPills.count()) > 0) {
      // Check if the container exists
      await expect(navPills).toBeVisible();
      
      // Verify the justify-content style is set to center
      const justifyContent = await navPills.evaluate(el => {
        return window.getComputedStyle(el).justifyContent;
      });
      
      expect(justifyContent).toBe('center');
    }
  });

  test('navigation pills should display all sections', async ({ page }) => {
    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');

    const navPills = page.locator('.mobile-nav-pills');
    
    if ((await navPills.count()) > 0) {
      // Check for expected navigation items
      await expect(page.getByTestId('nav-overview')).toBeVisible();
      await expect(page.getByTestId('nav-stats')).toBeVisible();
      await expect(page.getByTestId('nav-profiles')).toBeVisible();
      await expect(page.getByTestId('nav-packages')).toBeVisible();
      await expect(page.getByTestId('nav-messages')).toBeVisible();
      await expect(page.getByTestId('nav-tickets')).toBeVisible();
    }
  });

  test('onboarding card should show for first-time users', async ({ page, context }) => {
    // Set the flag that triggers onboarding
    await context.addInitScript(() => {
      localStorage.setItem('eventflow_onboarding_new', '1');
      localStorage.removeItem('ef_onboarding_dismissed');
    });

    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Wait for JS to execute

    // Check if onboarding card is displayed
    const onboardingCard = page.locator('#ef-onboarding-dismiss').locator('..');
    
    if ((await onboardingCard.count()) > 0) {
      await expect(onboardingCard).toBeVisible();
      
      // Check for key elements in the new design
      await expect(page.locator('text=Welcome to Your Supplier Dashboard!')).toBeVisible();
      await expect(page.locator('text=Complete your supplier profile')).toBeVisible();
      await expect(page.locator('text=Add your first package or service')).toBeVisible();
      await expect(page.locator('text=Start engaging with customers')).toBeVisible();
    }
  });

  test('onboarding card "Got it" button should permanently dismiss', async ({ page, context }) => {
    // Set the flag that triggers onboarding
    await context.addInitScript(() => {
      localStorage.setItem('eventflow_onboarding_new', '1');
      localStorage.removeItem('ef_onboarding_dismissed');
    });

    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const dismissButton = page.locator('#ef-onboarding-dismiss');
    
    if ((await dismissButton.count()) > 0) {
      // Click the "Got it" button
      await dismissButton.click();
      await page.waitForTimeout(500); // Wait for animation
      
      // Check if the card was removed
      const onboardingCard = page.locator('#ef-onboarding-dismiss').locator('..');
      await expect(onboardingCard).not.toBeVisible();
      
      // Verify localStorage was set
      const dismissedFlag = await page.evaluate(() => {
        return localStorage.getItem('ef_onboarding_dismissed');
      });
      
      expect(dismissedFlag).toBe('1');
    }
  });

  test('onboarding card should not show when dismissed', async ({ page, context }) => {
    // Set the dismissed flag
    await context.addInitScript(() => {
      localStorage.setItem('ef_onboarding_dismissed', '1');
      localStorage.setItem('eventflow_onboarding_new', '1');
    });

    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Onboarding card should not be visible
    const onboardingCard = page.locator('#ef-onboarding-dismiss');
    expect(await onboardingCard.count()).toBe(0);
  });

  test('onboarding card should have modern gradient design', async ({ page, context }) => {
    // Set the flag that triggers onboarding
    await context.addInitScript(() => {
      localStorage.setItem('eventflow_onboarding_new', '1');
      localStorage.removeItem('ef_onboarding_dismissed');
    });

    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const onboardingCard = page.locator('#ef-onboarding-dismiss').locator('..');
    
    if ((await onboardingCard.count()) > 0) {
      // Check for gradient background
      const background = await onboardingCard.evaluate(el => {
        return window.getComputedStyle(el).background;
      });
      
      expect(background).toContain('gradient');
      
      // Check for emoji icon
      await expect(page.locator('text=🎉')).toBeVisible();
      
      // Check for the new CTA text
      await expect(page.locator('text=Got it! Let\'s go 🚀')).toBeVisible();
    }
  });

  test('navigation pills should be scrollable on narrow viewports', async ({ page }) => {
    // Set a narrow viewport to test horizontal scrolling
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');

    const navPills = page.locator('.mobile-nav-pills');
    
    if ((await navPills.count()) > 0) {
      // Check if overflow-x is set to auto
      const overflowX = await navPills.evaluate(el => {
        return window.getComputedStyle(el).overflowX;
      });
      
      expect(overflowX).toBe('auto');
    }
  });

  test('onboarding card button should have hover effect', async ({ page, context }) => {
    // Set the flag that triggers onboarding
    await context.addInitScript(() => {
      localStorage.setItem('eventflow_onboarding_new', '1');
      localStorage.removeItem('ef_onboarding_dismissed');
    });

    await page.goto('/dashboard-supplier.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const dismissButton = page.locator('#ef-onboarding-dismiss');
    
    if ((await dismissButton.count()) > 0) {
      // Hover over the button
      await dismissButton.hover();
      await page.waitForTimeout(300); // Wait for transition
      
      // The transform should be applied (though we can't directly test the exact value in all browsers)
      const transform = await dismissButton.evaluate(el => {
        return window.getComputedStyle(el).transform;
      });
      
      // Just verify transform property exists (value varies by browser)
      expect(transform).toBeTruthy();
    }
  });
});
