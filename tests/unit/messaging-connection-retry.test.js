/**
 * Tests for messaging connection retry logic improvements
 * Validates exponential backoff, polling fallback, and connection status indicator
 */

const fs = require('fs');
const path = require('path');

// messages.html now redirects to /messenger/ (Messenger v4 migration, Phase 7).
// The original retry/polling logic lived in the old messages.html page.
const messagesHtmlPath = path.join(process.cwd(), 'public/messages.html');
const messagesHtml = fs.readFileSync(messagesHtmlPath, 'utf8');
const messagesHtmlHasRetryLogic = messagesHtml.includes('async function setupRealtimeUpdates()');

(messagesHtmlHasRetryLogic ? describe : describe.skip)('Messaging Connection Retry Logic', () => {
  describe('messages.html setupRealtimeUpdates function', () => {
    const messagesHtml = fs.readFileSync(
      path.join(process.cwd(), 'public/messages.html'),
      'utf8'
    );

    it('increases max retries from 10 to 30', () => {
      const setupFn = messagesHtml
        .split('async function setupRealtimeUpdates()')[1]
        .split('async function')[0];

      expect(setupFn).toContain('const maxRetries = 30');
      expect(setupFn).not.toContain('const maxRetries = 10');
    });

    it('implements exponential backoff with cap at 5 seconds', () => {
      const setupFn = messagesHtml
        .split('async function setupRealtimeUpdates()')[1]
        .split('async function')[0];

      expect(setupFn).toContain('const baseDelay = 100');
      expect(setupFn).toContain('const maxDelay = 5000');
      expect(setupFn).toContain('Math.min(baseDelay * Math.pow(1.5, retries), maxDelay)');
    });

    it('shows connection status during retry attempts', () => {
      const setupFn = messagesHtml
        .split('async function setupRealtimeUpdates()')[1]
        .split('async function')[0];

      expect(setupFn).toContain("showConnectionStatus('connecting',");
      expect(setupFn).toContain('Attempt ${retries}/${maxRetries}');
    });

    it('shows connected status on successful connection', () => {
      const setupFn = messagesHtml
        .split('async function setupRealtimeUpdates()')[1]
        .split('async function')[0];

      expect(setupFn).toContain("showConnectionStatus('connected')");
    });

    it('falls back to polling after max retries', () => {
      const setupFn = messagesHtml
        .split('async function setupRealtimeUpdates()')[1]
        .split('async function')[0];

      expect(setupFn).toContain("showConnectionStatus('polling')");
      expect(setupFn).toContain('startPollingFallback()');
    });
  });

  describe('startPollingFallback function', () => {
    it('reduces polling interval from 30s to 10s', () => {
      const pollingFn = messagesHtml
        .split('function startPollingFallback()')[1]
        .split('function ')[0];

      expect(pollingFn).toContain('const pollInterval = 10000');
      expect(pollingFn).toContain('// 10 seconds');
      expect(pollingFn).not.toContain('30000');
    });

    it('stops polling when WebSocket reconnects', () => {
      const pollingFn = messagesHtml
        .split('function startPollingFallback()')[1]
        .split('function ')[0];

      expect(pollingFn).toContain('if (window.messagingSystem && window.messagingSystem.isConnected)');
      expect(pollingFn).toContain('clearInterval(window.messagingPollTimer)');
      expect(pollingFn).toContain("showConnectionStatus('connected')");
    });

    it('stores timer globally for cleanup', () => {
      const pollingFn = messagesHtml
        .split('function startPollingFallback()')[1]
        .split('function ')[0];

      expect(pollingFn).toContain('window.messagingPollTimer = pollTimer');
    });
  });

  describe('showConnectionStatus function', () => {
    it('displays status messages for all states', () => {
      const statusFn = messagesHtml
        .split('function showConnectionStatus(status, message = \'\')')[1]
        .split('function ')[0];

      expect(statusFn).toContain('Connected - Real-time updates active');
      expect(statusFn).toContain('Connecting...');
      expect(statusFn).toContain('Connection Lost - Using 10-second updates');
      expect(statusFn).toContain('Connection Error - Click Reconnect to retry');
    });

    it('shows reconnect button for polling and error states', () => {
      const statusFn = messagesHtml
        .split('function showConnectionStatus(status, message = \'\')')[1]
        .split('function ')[0];

      expect(statusFn).toContain("(status === 'polling' || status === 'error')");
      expect(statusFn).toContain("'inline-block' : 'none'");
    });

    it('auto-hides after 5 seconds when connected', () => {
      const statusFn = messagesHtml
        .split('function showConnectionStatus(status, message = \'\')')[1]
        .split('function ')[0];

      expect(statusFn).toContain("if (status === 'connected')");
      expect(statusFn).toContain('setTimeout(() => {');
      expect(statusFn).toContain('5000');
    });
  });

  describe('setupRealtimeListeners function', () => {
    it('shows toast notification on reconnect', () => {
      const listenersFn = messagesHtml
        .split('function setupRealtimeListeners()')[1]
        .split('function ')[0];

      expect(listenersFn).toContain("EFToast.success('Real-time messaging reconnected!'");
    });

    it('shows toast notification on disconnect', () => {
      const listenersFn = messagesHtml
        .split('function setupRealtimeListeners()')[1]
        .split('function ')[0];

      expect(listenersFn).toContain("EFToast.warning('Connection lost. Falling back to 10-second updates.'");
    });

    it('starts polling fallback on disconnect', () => {
      const listenersFn = messagesHtml
        .split('function setupRealtimeListeners()')[1]
        .split('function ')[0];

      expect(listenersFn).toContain("socket.on('disconnect',");
      expect(listenersFn).toContain('startPollingFallback()');
    });
  });

  describe('Connection status indicator HTML', () => {
    it('includes connection status indicator element', () => {
      expect(messagesHtml).toContain('id="connection-status"');
      expect(messagesHtml).toContain('class="connection-status"');
    });

    it('includes connection indicator with dot and text', () => {
      expect(messagesHtml).toContain('class="connection-indicator"');
      expect(messagesHtml).toContain('class="connection-dot"');
      expect(messagesHtml).toContain('class="connection-text"');
    });

    it('includes manual reconnect button', () => {
      expect(messagesHtml).toContain('id="manual-reconnect-btn"');
      expect(messagesHtml).toContain('🔄 Reconnect');
    });
  });

  describe('Manual reconnect handler', () => {
    it('attaches click handler to reconnect button', () => {
      expect(messagesHtml).toContain("getElementById('manual-reconnect-btn')?.addEventListener('click'");
    });

    it('stops polling before retrying connection', () => {
      const handlerCode = messagesHtml
        .split("getElementById('manual-reconnect-btn')?.addEventListener('click'")[1]
        .split('});')[0];

      expect(handlerCode).toContain('clearInterval(window.messagingPollTimer)');
      expect(handlerCode).toContain('window.messagingPollTimer = null');
    });

    it('retries WebSocket connection on manual reconnect', () => {
      const handlerCode = messagesHtml
        .split("getElementById('manual-reconnect-btn')?.addEventListener('click'")[1]
        .split('});')[0];

      expect(handlerCode).toContain('await setupRealtimeUpdates()');
    });
  });
});

// messaging.css was removed as part of Messenger v4 migration (Phase 7).
// Connection status styles are now part of the v4 animation stylesheet.
const messagingCssPath = path.join(process.cwd(), 'public/assets/css/messaging.css');
const messagingCssExists = fs.existsSync(messagingCssPath);
const messagingCss = messagingCssExists ? fs.readFileSync(messagingCssPath, 'utf8') : '';

(messagingCssExists ? describe : describe.skip)('Connection Status CSS', () => {

  it('includes connection status styles', () => {
    expect(messagingCss).toContain('.connection-status');
    expect(messagingCss).toContain('.connection-indicator');
    expect(messagingCss).toContain('.connection-dot');
  });

  it('defines status-specific dot colors', () => {
    expect(messagingCss).toContain('.connection-status.connected .connection-dot');
    expect(messagingCss).toContain('.connection-status.connecting .connection-dot');
    expect(messagingCss).toContain('.connection-status.polling .connection-dot');
    expect(messagingCss).toContain('.connection-status.error .connection-dot');
  });

  it('includes pulse animation for connected state', () => {
    expect(messagingCss).toContain('@keyframes pulse');
    expect(messagingCss).toContain('animation: pulse 2s infinite');
  });

  it('includes reconnect button styles', () => {
    expect(messagingCss).toContain('.connection-reconnect-btn');
    expect(messagingCss).toContain('.connection-reconnect-btn:hover');
  });
});
