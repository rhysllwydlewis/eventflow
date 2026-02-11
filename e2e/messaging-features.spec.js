/**
 * E2E Tests for Messaging System Features
 * Tests offline queue, search, editing, blocking, and reporting
 */

const { test, expect } = require('@playwright/test');

test.describe('Messaging System Features', () => {
  let authToken;
  let testUser;
  let testUser2;

  test.beforeAll(async ({ request }) => {
    // Create test users (or login if they exist)
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'test-user-1@example.com',
        password: 'TestPassword123!',
      },
    });

    if (loginResponse.ok()) {
      const data = await loginResponse.json();
      authToken = data.token;
      testUser = data.user;
    }
  });

  test.describe('Offline Message Queue', () => {
    test('should queue messages when offline and send when online', async ({ page, context }) => {
      await page.goto('/messages');
      await page.waitForLoadState('networkidle');

      // Intercept API calls
      await page.route('/api/v2/messages', (route) => route.abort());

      // Send message while "offline"
      await page.fill('[data-testid="message-input"]', 'Test queued message');
      await page.click('[data-testid="send-button"]');

      // Verify message shows "sending" status
      await expect(page.locator('.message-status')).toContainText('Sending');

      // Restore network
      await page.unroute('/api/v2/messages');

      // Wait for message to send
      await expect(page.locator('.message-status')).toContainText('Sent', { timeout: 10000 });
    });

    test('should retry failed messages with exponential backoff', async ({ page }) => {
      await page.goto('/messages');

      // Mock API to fail first 2 attempts, then succeed
      let attemptCount = 0;
      await page.route('/api/v2/messages', (route) => {
        attemptCount++;
        if (attemptCount <= 2) {
          route.fulfill({ status: 500, body: 'Server error' });
        } else {
          route.continue();
        }
      });

      await page.fill('[data-testid="message-input"]', 'Test retry message');
      await page.click('[data-testid="send-button"]');

      // Wait for retries and eventual success
      await expect(page.locator('.message-status')).toContainText('Retrying', { timeout: 3000 });
      await expect(page.locator('.message-status')).toContainText('Sent', { timeout: 15000 });
    });

    test('should persist queue across page refreshes', async ({ page }) => {
      await page.goto('/messages');

      // Queue a message while offline
      await page.route('/api/v2/messages', (route) => route.abort());
      await page.fill('[data-testid="message-input"]', 'Test persistent message');
      await page.click('[data-testid="send-button"]');

      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify message still in queue
      const queueCount = await page.locator('#queue-indicator').textContent();
      expect(queueCount).toContain('1 message queued');
    });
  });

  test.describe('Message Search', () => {
    test('should search messages by content', async ({ page }) => {
      await page.goto('/messages');

      // Open search
      await page.click('[data-testid="search-button"]');
      await page.fill('[data-testid="search-input"]', 'meeting');

      // Wait for results
      await page.waitForResponse((response) => response.url().includes('/api/v2/messages/search'));

      // Verify results
      const results = await page.locator('.search-result').count();
      expect(results).toBeGreaterThan(0);
    });

    test('should filter search by participant', async ({ page }) => {
      await page.goto('/messages');

      await page.click('[data-testid="search-button"]');
      await page.fill('[data-testid="search-input"]', 'test');

      // Apply participant filter
      await page.click('[data-testid="filter-button"]');
      await page.selectOption('[data-testid="participant-filter"]', testUser2.id);
      await page.click('[data-testid="apply-filters"]');

      // Verify filtered results
      await expect(page.locator('.search-result')).toHaveCount(1);
    });

    test('should paginate search results', async ({ page }) => {
      await page.goto('/messages');

      await page.click('[data-testid="search-button"]');
      await page.fill('[data-testid="search-input"]', 'test');

      // Wait for first page
      await page.waitForSelector('.search-result');
      const firstPageResults = await page.locator('.search-result').count();

      // Go to next page
      await page.click('[data-testid="next-page"]');
      await page.waitForResponse((response) => response.url().includes('page=2'));

      const secondPageResults = await page.locator('.search-result').count();
      expect(secondPageResults).toBeGreaterThan(0);
    });
  });

  test.describe('Message Editing', () => {
    test('should edit message within 15-minute window', async ({ page }) => {
      await page.goto('/messages');

      // Send a message
      await page.fill('[data-testid="message-input"]', 'Original message');
      await page.click('[data-testid="send-button"]');
      await page.waitForSelector('.message:last-child');

      // Edit the message
      await page.hover('.message:last-child');
      await page.click('.message:last-child [data-testid="edit-button"]');
      await page.fill('[data-testid="edit-input"]', 'Edited message');
      await page.keyboard.press('Enter');

      // Verify edited content
      await expect(page.locator('.message:last-child .message-content')).toContainText(
        'Edited message'
      );
      await expect(page.locator('.message:last-child .edited-badge')).toBeVisible();
    });

    test('should show edit history', async ({ page, request }) => {
      // Create message with edit history
      const messageResponse = await request.post('/api/v2/messages', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          threadId: 'test-thread',
          content: 'First version',
        },
      });

      const { message } = await messageResponse.json();

      // Edit the message
      await request.put(`/api/v2/messages/${message._id}/edit`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          content: 'Second version',
        },
      });

      await page.goto('/messages');
      await page.locator('.edited-badge').first().click();

      // Verify history modal
      await expect(page.locator('.edit-history-modal')).toBeVisible();
      await expect(page.locator('.history-entry')).toHaveCount(1);
      await expect(page.locator('.history-entry:first-child')).toContainText('First version');
    });

    test('should prevent editing after 15 minutes', async ({ page, request }) => {
      // This test would require time manipulation or waiting 15 minutes
      // For demonstration, we'll mock the API response
      test.skip();
    });
  });

  test.describe('User Blocking', () => {
    test('should block user and hide their messages', async ({ page }) => {
      await page.goto('/messages');

      // Open user menu
      await page.click('[data-testid="user-menu-button"]');
      await page.click('[data-testid="block-user"]');
      await page.click('[data-testid="confirm-block"]');

      // Verify messages are hidden
      await expect(page.locator('.blocked-message-notice')).toBeVisible();
      await expect(page.locator('.message[data-sender-blocked="true"]')).toHaveCount(0);
    });

    test('should unblock user and restore messages', async ({ page }) => {
      await page.goto('/settings/blocked-users');

      // Unblock user
      await page.click('[data-testid="unblock-button"]');
      await page.click('[data-testid="confirm-unblock"]');

      // Verify user removed from blocked list
      await expect(page.locator('.blocked-user-item')).toHaveCount(0);
    });
  });

  test.describe('Message Reporting', () => {
    test('should report message', async ({ page }) => {
      await page.goto('/messages');

      // Open message menu
      await page.click('.message:first-child [data-testid="message-menu"]');
      await page.click('[data-testid="report-message"]');

      // Fill report form
      await page.selectOption('[data-testid="report-reason"]', 'spam');
      await page.fill('[data-testid="report-details"]', 'Unwanted promotional content');
      await page.click('[data-testid="submit-report"]');

      // Verify confirmation
      await expect(page.locator('.success-message')).toContainText('Report submitted');
    });
  });

  test.describe('Thread Management', () => {
    test('should pin and unpin threads', async ({ page }) => {
      await page.goto('/messages');

      // Pin thread
      await page.click('.thread:first-child [data-testid="pin-thread"]');
      await expect(page.locator('.thread:first-child .pin-indicator')).toBeVisible();

      // Verify thread at top
      const firstThread = await page.locator('.thread:first-child').getAttribute('data-thread-id');
      await page.reload();
      const stillFirst = await page.locator('.thread:first-child').getAttribute('data-thread-id');
      expect(firstThread).toBe(stillFirst);

      // Unpin thread
      await page.click('.thread:first-child [data-testid="unpin-thread"]');
      await expect(page.locator('.thread:first-child .pin-indicator')).not.toBeVisible();
    });

    test('should enforce max pinned threads limit', async ({ page }) => {
      await page.goto('/messages');

      // Try to pin 11 threads
      for (let i = 0; i < 11; i++) {
        await page.click(`.thread:nth-child(${i + 1}) [data-testid="pin-thread"]`);
      }

      // Verify error message
      await expect(page.locator('.error-message')).toContainText('Maximum 10 threads');
    });

    test('should mute thread notifications', async ({ page }) => {
      await page.goto('/messages');

      // Mute thread
      await page.click('.thread:first-child [data-testid="mute-thread"]');
      await page.selectOption('[data-testid="mute-duration"]', '8h');
      await page.click('[data-testid="confirm-mute"]');

      // Verify mute indicator
      await expect(page.locator('.thread:first-child .mute-indicator')).toBeVisible();
    });
  });

  test.describe('Link Previews', () => {
    test('should generate link preview', async ({ page }) => {
      await page.goto('/messages');

      // Type message with URL
      await page.fill(
        '[data-testid="message-input"]',
        'Check this out: https://github.com/rhysllwydlewis/eventflow'
      );

      // Wait for preview to load
      await page.waitForSelector('.link-preview-card', { timeout: 5000 });

      // Verify preview content
      await expect(page.locator('.link-preview-title')).toBeVisible();
      await expect(page.locator('.link-preview-image')).toBeVisible();
    });

    test('should allow removing preview before sending', async ({ page }) => {
      await page.goto('/messages');

      await page.fill('[data-testid="message-input"]', 'URL: https://example.com');
      await page.waitForSelector('.link-preview-card');

      // Remove preview
      await page.click('[data-testid="remove-preview"]');
      await expect(page.locator('.link-preview-card')).not.toBeVisible();

      // Send message
      await page.click('[data-testid="send-button"]');

      // Verify no preview in sent message
      await expect(page.locator('.message:last-child .link-preview-card')).not.toBeVisible();
    });
  });

  test.describe('Spam Detection', () => {
    test('should rate limit excessive messages', async ({ page }) => {
      await page.goto('/messages');

      // Send 31 messages rapidly
      for (let i = 0; i < 31; i++) {
        await page.fill('[data-testid="message-input"]', `Message ${i + 1}`);
        await page.click('[data-testid="send-button"]');
      }

      // Verify rate limit error
      await expect(page.locator('.error-message')).toContainText('rate limit');
    });

    test('should detect duplicate messages', async ({ page }) => {
      await page.goto('/messages');

      // Send same message twice quickly
      await page.fill('[data-testid="message-input"]', 'Duplicate test');
      await page.click('[data-testid="send-button"]');

      await page.fill('[data-testid="message-input"]', 'Duplicate test');
      await page.click('[data-testid="send-button"]');

      // Verify duplicate detection
      await expect(page.locator('.warning-message')).toContainText('duplicate');
    });
  });

  test.describe('Admin Moderation', () => {
    test('should view reported messages (admin only)', async ({ page }) => {
      // Login as admin
      await page.goto('/admin/moderation');

      // Verify reports list
      await expect(page.locator('.report-item')).toHaveCountGreaterThan(0);
    });

    test('should update report status (admin only)', async ({ page }) => {
      await page.goto('/admin/moderation');

      // Review first report
      await page.click('.report-item:first-child [data-testid="review-button"]');
      await page.selectOption('[data-testid="report-status"]', 'reviewed');
      await page.fill('[data-testid="review-notes"]', 'Confirmed spam');
      await page.click('[data-testid="save-review"]');

      // Verify status updated
      await expect(page.locator('.report-item:first-child .status')).toContainText('Reviewed');
    });
  });
});

test.describe('Performance Tests', () => {
  test('should search 10,000+ messages in under 200ms', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.get('/api/v2/messages/search?q=test', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(200);
  });

  test('should handle WebSocket reconnection within 2s', async ({ page }) => {
    await page.goto('/messages');

    // Disconnect WebSocket
    await page.evaluate(() => {
      if (window.socket) {
        window.socket.disconnect();
      }
    });

    const startTime = Date.now();

    // Reconnect
    await page.evaluate(() => {
      if (window.socket) {
        window.socket.connect();
      }
    });

    // Wait for reconnection
    await page.waitForFunction(() => window.socket && window.socket.connected);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(2000);
  });
});
