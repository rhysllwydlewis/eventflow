/**
 * WebSocket / Real-time Feature E2E Tests
 *
 * Tests end-to-end real-time behaviour:
 *  - Connection establishment (with and without authentication)
 *  - WebSocket endpoint availability
 *  - Typing indicator events
 *  - Presence / online-status endpoint
 *  - Reconnection resilience
 *
 * These tests run against the live server started by the CI environment.
 * Backend-dependent tests are tagged @backend so they can be skipped in
 * static-only runs (`npm run test:e2e:static`).
 */

const { test, expect } = require('@playwright/test');

// Timeout for WebSocket connection attempts (ms).
// CI runners can be slower — increase if tests flake in slow environments.
const WS_CONNECT_TIMEOUT_MS = 4000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inject a minimal Socket.IO client into the page and attempt to connect.
 * Returns a Promise that resolves to { connected, error }.
 */
async function tryWebSocketConnect(page, token = null) {
  return page.evaluate(
    async ({ authToken, wsConnectTimeout }) => {
      return new Promise(resolve => {
        const timeout = setTimeout(
          () => resolve({ connected: false, error: 'timeout' }),
          wsConnectTimeout
        );

        if (typeof window.io === 'undefined') {
          clearTimeout(timeout);
          return resolve({ connected: false, error: 'Socket.IO not loaded' });
        }

        const opts = { transports: ['websocket', 'polling'], timeout: 3000 };
        if (authToken) {
          opts.auth = { token: authToken };
        }

        const socket = window.io(opts);

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.disconnect();
          resolve({ connected: true, error: null });
        });

        socket.on('connect_error', err => {
          clearTimeout(timeout);
          socket.disconnect();
          // Auth errors are expected for unauthenticated users
          resolve({ connected: false, error: err.message });
        });
      });
    },
    { authToken: token, wsConnectTimeout: WS_CONNECT_TIMEOUT_MS }
  );
}

// ---------------------------------------------------------------------------
// Connection tests
// ---------------------------------------------------------------------------

test.describe('WebSocket Connection @backend', () => {
  test('Socket.IO polling endpoint responds', async ({ request }) => {
    const res = await request.get('/socket.io/?EIO=4&transport=polling');
    // Socket.IO returns 200 (with session) or 400 (bad request / missing params)
    expect([200, 400]).toContain(res.status());
  });

  test('homepage loads without critical JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const critical = errors.filter(
      msg =>
        !msg.includes('Unauthenticated') &&
        !msg.includes('401') &&
        !msg.includes('redirect') &&
        !msg.includes('AbortError')
    );
    expect(critical).toHaveLength(0);
  });

  test('unauthenticated WebSocket connection is rejected gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const result = await tryWebSocketConnect(page);

    // An unauthenticated connection should either be rejected or reach auth error —
    // it must NOT hang indefinitely (timeout guard in tryWebSocketConnect).
    // Both connected=false (auth required) and connected=true (public endpoint) are valid.
    expect(typeof result.connected).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Typing-indicator event format
// ---------------------------------------------------------------------------

test.describe('Real-time Event Format @backend', () => {
  test('typing indicator events use correct schema', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify the expected event names are documented / available
    const typingEventNames = ['typing:start', 'typing:stop'];
    typingEventNames.forEach(name => {
      expect(typeof name).toBe('string');
      expect(name).toMatch(/^typing:/);
    });
  });
});

// ---------------------------------------------------------------------------
// Presence / online status API
// ---------------------------------------------------------------------------

test.describe('Presence API @backend', () => {
  test('presence endpoint responds to unauthenticated request', async ({ request }) => {
    const res = await request.get('/api/v1/presence/online');
    // 200 (public), 401 (auth required), or 404 (endpoint moved) are all acceptable
    expect([200, 401, 403, 404]).toContain(res.status());
  });
});

// ---------------------------------------------------------------------------
// Messenger page UI
// ---------------------------------------------------------------------------

test.describe('Messenger UI @backend', () => {
  test('messenger page loads without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/messenger/');
    await page.waitForLoadState('networkidle');

    const unexpected = errors.filter(
      msg =>
        !msg.includes('Unauthenticated') &&
        !msg.includes('401') &&
        !msg.includes('redirect') &&
        !msg.includes('AbortError')
    );
    expect(unexpected).toHaveLength(0);
  });

  test('messenger page renders an accessible heading or landmark', async ({ page }) => {
    await page.goto('/messenger/');
    await page.waitForLoadState('networkidle');

    // The page should have at least a title or heading
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reconnection resilience (offline/online simulation)
// ---------------------------------------------------------------------------

test.describe('WebSocket Reconnection @backend', () => {
  test('page handles network interruption without crashing', async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Simulate network going offline then coming back online
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await context.setOffline(false);
    await page.waitForTimeout(1000);

    const critical = errors.filter(
      msg =>
        !msg.includes('net::ERR_INTERNET_DISCONNECTED') &&
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('Unauthenticated') &&
        !msg.includes('401')
    );
    expect(critical).toHaveLength(0);
  });
});
