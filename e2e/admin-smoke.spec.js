/**
 * Admin Pages Smoke Test
 *
 * Iterates through all allowlisted admin pages and asserts:
 * - No native browser dialogs (alert/confirm/prompt) appear
 * - No console errors occur
 * - The admin navbar element is visible
 *
 * Uses route mocking so no backend is required (static-mode friendly).
 */

import { test, expect } from '@playwright/test';

// Allowlisted admin pages — must match middleware/adminPages.js ADMIN_PAGES
const ADMIN_PAGES = [
  '/admin.html',
  '/admin-audit.html',
  '/admin-content-dates.html',
  '/admin-content.html',
  '/admin-homepage.html',
  '/admin-marketplace.html',
  '/admin-messenger.html',
  '/admin-packages.html',
  '/admin-payments.html',
  '/admin-pexels.html',
  '/admin-photos.html',
  '/admin-reports.html',
  '/admin-settings.html',
  '/admin-supplier-detail.html',
  '/admin-suppliers.html',
  '/admin-tickets.html',
  '/admin-user-detail.html',
  '/admin-users.html',
];

// Browser-specific timeouts
const WEBKIT_WAIT = 3000;
const DEFAULT_WAIT = 1500;

// Console error patterns that are acceptable (e.g. expected 404s, etc.)
const IGNORED_CONSOLE_ERRORS = [
  /Failed to load resource.*404/i,
  /net::ERR_/i,
  /favicon/i,
  /Failed to fetch/i,
  // Pexels API key not configured in test environment
  /pexels/i,
];

function isIgnoredError(msg) {
  return IGNORED_CONSOLE_ERRORS.some(re => re.test(msg));
}

test.describe('Admin Pages - Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // ── API Mocks ──────────────────────────────────────────────────────────

    // Auth: return admin user
    await page.route('**/api/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'admin1', role: 'admin', name: 'Admin User', email: 'admin@test.com' },
        }),
      })
    );

    // CSRF token
    await page.route('**/api/csrf-token', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' }),
      })
    );
    await page.route('**/api/v1/csrf-token', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' }),
      })
    );
    await page.route('**/api/v1/auth/csrf', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'test-csrf-token' }),
      })
    );

    // Badge counts
    await page.route('**/api/admin/badge-counts', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ newUsers: 0, pendingPhotos: 0, openTickets: 0, pendingReviews: 0 }),
      })
    );

    // Generic admin API fallback
    await page.route('**/api/admin/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          users: [],
          suppliers: [],
          tickets: [],
          payments: [],
          photos: [],
          reports: [],
          packages: [],
          reviews: [],
          counts: {},
        }),
      })
    );

    // Feature flags / settings
    await page.route('**/api/features**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ features: {} }),
      })
    );

    // Pexels search (won't have API key in test)
    await page.route('**/api/v1/pexels/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ photos: [] }),
      })
    );

    // Audit logs
    await page.route('**/api/audit**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ logs: [], total: 0 }),
      })
    );

    // Homepage / categories
    await page.route('**/api/v1/admin/categories**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ categories: [] }),
      })
    );

    // Messenger / conversations
    await page.route('**/api/conversations**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      })
    );

    // ── Dialog Guard: fail on any native dialog ───────────────────────────
    page.on('dialog', async dialog => {
      const type = dialog.type();
      const message = dialog.message();
      // Dismiss the dialog first so the page doesn't hang
      await dialog.dismiss();
      throw new Error(
        `Native dialog detected on admin page (type: ${type}, message: "${message}"). ` +
          'Admin pages must use AdminShared modals instead of native dialogs.'
      );
    });
  });

  ADMIN_PAGES.forEach(adminPage => {
    test(`${adminPage} loads without native dialogs or console errors`, async ({
      page,
      browserName,
    }) => {
      const consoleErrors = [];

      // Collect console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!isIgnoredError(text)) {
            consoleErrors.push(text);
          }
        }
      });

      await page.goto(adminPage);
      await page.waitForLoadState('networkidle');

      const waitTime = browserName === 'webkit' ? WEBKIT_WAIT : DEFAULT_WAIT;
      await page.waitForTimeout(waitTime);

      // Should still be on the admin page (not redirected away)
      expect(page.url()).toContain(adminPage);

      // Should have admin navbar
      const navbar = page.locator('.admin-top-navbar, .admin-navbar');
      await expect(navbar.first()).toBeVisible({ timeout: 5000 });

      // No console errors
      if (consoleErrors.length > 0) {
        throw new Error(`Console errors on ${adminPage}:\n  ${consoleErrors.join('\n  ')}`);
      }
    });
  });
});
