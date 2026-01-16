/**
 * Admin Feature Flags Save Button E2E Test
 * Tests that the Save Feature Flags button correctly sends API request
 *
 * This test verifies the fix for the issue where clicking "Save Feature Flags"
 * would get stuck in "Saving..." state without making an API call.
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Feature Flags Save Button', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth endpoint to return admin user
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin1', role: 'admin', name: 'Admin User', email: 'admin@test.com' },
        }),
      });
    });

    // Mock CSRF token endpoint
    await page.route('**/api/csrf-token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-token-123' }),
      });
    });

    // Mock db-status endpoint
    await page.route('**/api/admin/db-status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dbType: 'mongodb',
          initialized: true,
          state: 'completed',
          connected: true,
        }),
      });
    });

    // Mock audit logs endpoint
    await page.route('**/api/admin/audit-logs**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [] }),
      });
    });

    // Mock site settings endpoint
    await page.route('**/api/admin/settings/site', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'EventFlow',
          tagline: 'Test Site',
          contactEmail: 'contact@test.com',
          supportEmail: 'support@test.com',
        }),
      });
    });

    // Mock maintenance settings endpoint
    await page.route('**/api/admin/settings/maintenance', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: false,
          message: "We're performing scheduled maintenance. We'll be back soon!",
        }),
      });
    });

    // Mock system info endpoint
    await page.route('**/api/admin/settings/system-info', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 'v17.0.0',
          environment: 'Test',
          database: 'MongoDB',
          uptime: '1h 23m',
        }),
      });
    });

    // Mock GET feature flags endpoint
    await page.route('**/api/admin/settings/features', async route => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            registration: true,
            supplierApplications: true,
            reviews: true,
            photoUploads: true,
            supportTickets: true,
            pexelsCollage: false,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin@test.com',
          }),
        });
      } else {
        // Don't handle PUT here - we want to verify it's called
        route.continue();
      }
    });
  });

  test('Save Feature Flags button sends API request when clicked', async ({ page }) => {
    // Track API requests
    const apiRequests = [];
    page.on('request', request => {
      if (request.url().includes('/api/admin/settings/features')) {
        apiRequests.push({
          method: request.method(),
          url: request.url(),
          headers: request.headers(),
        });
      }
    });

    // Mock the PUT request (which we want to verify is called)
    let putRequestReceived = false;
    await page.route('**/api/admin/settings/features', async route => {
      if (route.request().method() === 'PUT') {
        putRequestReceived = true;
        
        // Verify CSRF token is present
        const headers = route.request().headers();
        expect(headers['x-csrf-token']).toBe('test-token-123');
        
        // Get the request body
        const postData = route.request().postDataJSON();
        expect(postData).toBeDefined();
        expect(postData).toHaveProperty('registration');
        expect(postData).toHaveProperty('pexelsCollage');
        
        // Respond with success
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            features: {
              ...postData,
              updatedAt: new Date().toISOString(),
              updatedBy: 'admin@test.com',
            },
          }),
        });
      } else {
        // GET request
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            registration: true,
            supplierApplications: true,
            reviews: true,
            photoUploads: true,
            supportTickets: true,
            pexelsCollage: false,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin@test.com',
          }),
        });
      }
    });

    // Navigate to admin settings page
    await page.goto('/admin-settings.html');

    // Wait for the page to load and feature flags to be fetched
    await page.waitForSelector('#saveFeatureFlags', { timeout: 10000 });

    // Wait for feature flags to be loaded (button will be disabled initially)
    await page.waitForTimeout(1000);

    // Toggle the pexelsCollage checkbox to enable the save button
    const pexelsCheckbox = page.locator('#featurePexelsCollage');
    await pexelsCheckbox.click();

    // Wait for save button to become enabled
    await page.waitForTimeout(500);

    // Verify button is now enabled
    const saveButton = page.locator('#saveFeatureFlags');
    const isDisabled = await saveButton.isDisabled();
    expect(isDisabled).toBe(false);

    // Click the Save Feature Flags button
    await saveButton.click();

    // Wait for the API request to be sent
    await page.waitForTimeout(1000);

    // Verify that a PUT request was sent
    expect(putRequestReceived).toBe(true);

    // Verify button doesn't get stuck in loading state
    // After success, button should be re-enabled or disabled based on state
    await page.waitForTimeout(500);
    const buttonText = await saveButton.textContent();
    expect(buttonText).not.toContain('Saving...');
  });

  test('Save Feature Flags button shows proper loading state', async ({ page }) => {
    // Mock a slow PUT request to observe loading state
    await page.route('**/api/admin/settings/features', async route => {
      if (route.request().method() === 'PUT') {
        // Delay response to see loading state
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            features: {
              registration: true,
              supplierApplications: true,
              reviews: true,
              photoUploads: true,
              supportTickets: true,
              pexelsCollage: true,
              updatedAt: new Date().toISOString(),
              updatedBy: 'admin@test.com',
            },
          }),
        });
      } else {
        // GET request
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            registration: true,
            supplierApplications: true,
            reviews: true,
            photoUploads: true,
            supportTickets: true,
            pexelsCollage: false,
            updatedAt: new Date().toISOString(),
            updatedBy: 'admin@test.com',
          }),
        });
      }
    });

    // Navigate to admin settings page
    await page.goto('/admin-settings.html');

    // Wait for the page to load
    await page.waitForSelector('#saveFeatureFlags');
    await page.waitForTimeout(1000);

    // Toggle a checkbox to enable save
    await page.locator('#featurePexelsCollage').click();
    await page.waitForTimeout(500);

    // Click save button
    const saveButton = page.locator('#saveFeatureFlags');
    await saveButton.click();

    // Button should show loading text initially
    await page.waitForTimeout(100);
    const loadingText = await saveButton.textContent();
    expect(loadingText).toBe('Saving...');

    // Wait for response
    await page.waitForTimeout(1500);

    // After completion, button should not be stuck in loading state
    const finalText = await saveButton.textContent();
    expect(finalText).not.toBe('Saving...');
    expect(finalText).toBe('Save Feature Flags');
  });
});
