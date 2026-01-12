/**
 * Admin UX E2E Tests
 * Tests admin modal-based input flows, button disabling, and no native dialogs
 * Uses route mocking to simulate backend responses (static-mode friendly)
 *
 * Validates:
 * - Input modals open and validate input
 * - Buttons disable during requests (safeAction)
 * - Double-click prevention (only one request)
 * - Cancel behavior (no request made)
 * - No native dialogs appear during admin flows
 */

import { test, expect } from '@playwright/test';

// Browser-specific timeouts
// WebKit (Safari) requires longer waits due to slower JavaScript execution
// and different event loop timing compared to Chromium and Firefox
const WEBKIT_WAIT = 3000; // 3s for WebKit to ensure JS has fully executed
const DEFAULT_WAIT = 1500; // 1.5s for Chromium/Firefox is usually sufficient

test.describe('Admin UX - No Native Dialogs', () => {
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

    // Mock common admin API endpoints
    await page.route('**/api/admin/badge-counts', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          newUsers: 5,
          pendingPhotos: 3,
          openTickets: 2,
        }),
      });
    });

    await page.route('**/api/csrf-token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' }),
      });
    });

    // Mock users list
    await page.route('**/api/admin/users*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'user1',
              name: 'Test User',
              email: 'test@example.com',
              role: 'customer',
              verified: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/admin/suppliers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.route('**/api/admin/packages*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.route('**/api/admin/metrics*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ counts: {} }),
      });
    });

    await page.route('**/api/admin/photos/pending*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ photos: [] }),
      });
    });

    await page.route('**/api/admin/reviews/pending*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reviews: [] }),
      });
    });

    // Set up listener for native dialogs - should NOT appear
    page.on('dialog', async dialog => {
      // If a native dialog appears, fail the test
      throw new Error(
        `Native dialog detected (type: ${dialog.type()}, message: "${dialog.message()}") - admin pages should use custom modals instead`
      );
    });
  });

  test('should not show native dialogs on admin.html', async ({ page, browserName }) => {
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    // Page should load without any native dialogs
    expect(page.url()).toContain('/admin.html');

    // If we got here without errors, no native dialogs appeared
  });
});

test.describe('Admin UX - Input Modal Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth as admin
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin1', role: 'admin', name: 'Admin User', email: 'admin@test.com' },
        }),
      });
    });

    await page.route('**/api/csrf-token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' }),
      });
    });

    await page.route('**/api/admin/badge-counts', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    // Mock all common endpoints
    await page.route('**/api/admin/suppliers*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.route('**/api/admin/packages*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.route('**/api/admin/metrics*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ counts: {} }),
      });
    });

    await page.route('**/api/admin/photos/pending*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ photos: [] }),
      });
    });

    await page.route('**/api/admin/reviews/pending*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reviews: [] }),
      });
    });

    // Prevent native dialogs
    page.on('dialog', async dialog => {
      throw new Error(`Native dialog detected: ${dialog.type()} - "${dialog.message()}"`);
    });
  });

  test('input modal should open, validate, and submit', async ({ page, browserName }) => {
    // Mock users list with a test user
    await page.route('**/api/admin/users*', route => {
      if (route.request().method() === 'PUT') {
        // Mock update
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'user1',
                name: 'Test User',
                email: 'test@example.com',
                role: 'customer',
                verified: true,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        });
      }
    });

    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    // Click edit button for the test user
    const editButton = page.locator('button[data-action="editUser"][data-id="user1"]');
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Wait for modal to appear using expect
    const modal = page.locator('.admin-modal-overlay, .modal-overlay').first();
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Should have input field
    const inputField = modal.locator('input#admin-input-field, input#edit-user-name').first();
    await expect(inputField).toBeVisible();

    // Type new value
    await inputField.fill('');
    await inputField.fill('Updated Name');

    // Confirm button should be enabled for valid input
    const confirmBtn = modal.locator('.admin-modal-confirm, button:has-text("Save")').first();
    await expect(confirmBtn).toBeEnabled();

    // Click confirm
    await confirmBtn.click();

    // If using fallback sequential modals, handle email modal
    // Use waitForSelector with timeout instead of fixed wait
    const emailModal = page.locator('.admin-modal-overlay').first();
    const isEmailModalVisible = await emailModal.isVisible().catch(() => false);
    if (isEmailModalVisible) {
      const emailInput = emailModal.locator('input#admin-input-field').first();
      await emailInput.fill('updated@example.com');
      const emailConfirm = emailModal.locator('.admin-modal-confirm').first();
      await emailConfirm.click();
    }

    // Modal should close - wait for it to be hidden
    await expect(modal).toBeHidden({ timeout: 2000 });
  });

  test('input modal should validate required fields', async ({ page, browserName }) => {
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    // Evaluate directly in the page to test the modal
    const result = await page.evaluate(async () => {
      if (!window.AdminShared || !window.AdminShared.showInputModal) {
        return { error: 'AdminShared.showInputModal not available' };
      }

      // Open modal programmatically
      const modalPromise = window.AdminShared.showInputModal({
        title: 'Test Modal',
        message: 'Enter a value',
        label: 'Test Input',
        required: true,
      });

      // Wait for modal to render
      await new Promise(resolve => setTimeout(resolve, 200));

      const modal = document.querySelector('.admin-modal-overlay');
      if (!modal) {
        return { error: 'Modal not found' };
      }

      const inputField = modal.querySelector('#admin-input-field');
      const confirmBtn = modal.querySelector('.admin-modal-confirm');

      if (!inputField || !confirmBtn) {
        return { error: 'Input or confirm button not found' };
      }

      // Initially empty - confirm should be disabled
      const initiallyDisabled = confirmBtn.disabled;

      // Type something
      inputField.value = 'test value';
      inputField.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 100));

      const enabledAfterInput = !confirmBtn.disabled;

      // Clear it
      inputField.value = '';
      inputField.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise(resolve => setTimeout(resolve, 100));

      const disabledWhenEmpty = confirmBtn.disabled;

      // Cancel
      const cancelBtn = modal.querySelector('.admin-modal-cancel');
      cancelBtn.click();

      return {
        initiallyDisabled,
        enabledAfterInput,
        disabledWhenEmpty,
      };
    });

    // Verify validation behavior
    expect(result.initiallyDisabled).toBe(true);
    expect(result.enabledAfterInput).toBe(true);
    expect(result.disabledWhenEmpty).toBe(true);
  });

  test('input modal cancel should not trigger action', async ({ page, browserName }) => {
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    const result = await page.evaluate(async () => {
      if (!window.AdminShared || !window.AdminShared.showInputModal) {
        return { error: 'AdminShared.showInputModal not available' };
      }

      const modalPromise = window.AdminShared.showInputModal({
        title: 'Test Modal',
        message: 'Enter a value',
        label: 'Test Input',
      });

      // Wait for modal
      await new Promise(resolve => setTimeout(resolve, 200));

      const modal = document.querySelector('.admin-modal-overlay');
      const cancelBtn = modal?.querySelector('.admin-modal-cancel');
      cancelBtn?.click();

      const modalResult = await modalPromise;

      return {
        confirmed: modalResult.confirmed,
        value: modalResult.value,
      };
    });

    // Verify cancel behavior
    expect(result.confirmed).toBe(false);
    expect(result.value).toBe(null);
  });

  test('input modal ESC key should cancel', async ({ page, browserName }) => {
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    const result = await page.evaluate(async () => {
      if (!window.AdminShared || !window.AdminShared.showInputModal) {
        return { error: 'AdminShared.showInputModal not available' };
      }

      const modalPromise = window.AdminShared.showInputModal({
        title: 'Test Modal',
        message: 'Press ESC to cancel',
        label: 'Test Input',
      });

      // Wait for modal
      await new Promise(resolve => setTimeout(resolve, 200));

      // Press ESC
      const escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escEvent);

      const modalResult = await modalPromise;

      return {
        confirmed: modalResult.confirmed,
        value: modalResult.value,
      };
    });

    // Verify ESC cancels
    expect(result.confirmed).toBe(false);
    expect(result.value).toBe(null);
  });
});

test.describe('Admin UX - Button Disabling (safeAction)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth as admin
    await page.route('**/api/auth/me', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin1', role: 'admin', name: 'Admin User', email: 'admin@test.com' },
        }),
      });
    });

    await page.route('**/api/csrf-token', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' }),
      });
    });

    await page.route('**/api/admin/badge-counts', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
  });

  test('safeAction should disable button during async operation', async ({ page, browserName }) => {
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    // Test safeAction in page context
    const result = await page.evaluate(async () => {
      if (!window.AdminShared || !window.AdminShared.safeAction) {
        return { error: 'AdminShared.safeAction not available' };
      }

      // Create test button
      const btn = document.createElement('button');
      btn.textContent = 'Test Action';
      document.body.appendChild(btn);

      const states = [];

      // Track button state during action
      const action = async () => {
        states.push({ time: 'start', disabled: btn.disabled, text: btn.textContent });
        await new Promise(resolve => setTimeout(resolve, 200));
        states.push({ time: 'during', disabled: btn.disabled, text: btn.textContent });
        return 'success';
      };

      const actionPromise = window.AdminShared.safeAction(btn, action, {
        loadingText: 'Processing...',
      });

      // Check state immediately
      await new Promise(resolve => setTimeout(resolve, 50));
      states.push({ time: 'immediate', disabled: btn.disabled, text: btn.textContent });

      await actionPromise;

      states.push({ time: 'after', disabled: btn.disabled, text: btn.textContent });

      btn.remove();

      return { states };
    });

    // Verify button was disabled during action
    const immediateState = result.states.find(s => s.time === 'immediate');
    expect(immediateState.disabled).toBe(true);
    expect(immediateState.text).toBe('Processing...');

    const afterState = result.states.find(s => s.time === 'after');
    expect(afterState.disabled).toBe(false);
    expect(afterState.text).toBe('Test Action');
  });

  test('safeAction should prevent double-clicks', async ({ page, browserName }) => {
    await page.goto('/admin.html');
    await page.waitForLoadState('networkidle');

    const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
    await page.waitForTimeout(waitTime);

    const result = await page.evaluate(async () => {
      if (!window.AdminShared || !window.AdminShared.safeAction) {
        return { error: 'AdminShared.safeAction not available' };
      }

      const btn = document.createElement('button');
      btn.textContent = 'Test Action';
      document.body.appendChild(btn);

      let callCount = 0;

      const action = async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      };

      // First click
      const promise1 = window.AdminShared.safeAction(btn, action);

      // Immediate second click - should be prevented
      const promise2 = window.AdminShared.safeAction(btn, action);

      await Promise.all([promise1, promise2]);

      btn.remove();

      return { callCount };
    });

    // Action should only be called once (second call prevented by disabled button)
    expect(result.callCount).toBe(1);
  });
});
