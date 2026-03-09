/**
 * Integration tests: Messenger v4 stabilization — notification pipeline,
 * context type validation, route mounts, and unread count consistency.
 *
 * All assertions are static (file/source inspection) so they run without a
 * live database, matching the style of existing integration tests in this
 * directory.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..', '..');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const routerSrc = read('routes/messenger-v4.js');
const svcSrc = read('services/notification.service.js');
const notifSvcSrc = read('services/notificationService.js');
const modelSrc = read('models/ConversationV4.js');
const contextConstantsSrc = read('utils/messengerContextTypes.js');
const routeIndexSrc = read('routes/index.js');
const unreadBadgeSrc = read('public/assets/js/unread-badge-manager.js');
const messengerAppV4Src = read('public/messenger/js/MessengerAppV4.js');
const notifBridgeSrc = read('public/messenger/js/NotificationBridgeV4.js');

// ---------------------------------------------------------------------------
// 1. Consolidated notification service
// ---------------------------------------------------------------------------

describe('Notification service consolidation', () => {
  it('notification.service.js is the canonical service used by routes/notifications.js', () => {
    const notifRoutes = read('routes/notifications.js');
    expect(notifRoutes).toContain("require('../services/notification.service')");
  });

  it('notificationService.js carries a deprecation notice', () => {
    expect(notifSvcSrc).toMatch(/@deprecated/i);
    expect(notifSvcSrc).toContain('notification.service.js');
  });

  it('messenger-v4 route imports NotificationService from the canonical module', () => {
    expect(routerSrc).toContain("require('../services/notification.service')");
  });

  it('messenger-v4 creates a getNotificationService() helper', () => {
    expect(routerSrc).toContain('getNotificationService');
  });

  it('messenger-v4 calls notifyNewMessage after sending a message', () => {
    expect(routerSrc).toContain('notifyNewMessage');
  });

  it('notifyNewMessage actionUrl points to /messenger/ (not legacy /messages.html)', () => {
    const fnStart = svcSrc.indexOf('async notifyNewMessage(');
    const fnEnd = svcSrc.indexOf('async notifyBookingUpdate');
    const fnBody = svcSrc.substring(fnStart, fnEnd > fnStart ? fnEnd : undefined);
    expect(fnBody).toContain('/messenger/?conversation=');
    expect(fnBody).not.toContain('/messages.html');
  });
});

// ---------------------------------------------------------------------------
// 2. Shared context type constants
// ---------------------------------------------------------------------------

describe('Shared messenger context type constants (utils/messengerContextTypes.js)', () => {
  let constants;

  beforeAll(() => {
    constants = require(path.join(ROOT, 'utils/messengerContextTypes'));
  });

  it('exports CONVERSATION_CONTEXT_TYPES array', () => {
    expect(Array.isArray(constants.CONVERSATION_CONTEXT_TYPES)).toBe(true);
    expect(constants.CONVERSATION_CONTEXT_TYPES.length).toBeGreaterThan(0);
  });

  it('exports CONVERSATION_V4_TYPES array', () => {
    expect(Array.isArray(constants.CONVERSATION_V4_TYPES)).toBe(true);
    expect(constants.CONVERSATION_V4_TYPES.length).toBeGreaterThan(0);
  });

  it('CONVERSATION_CONTEXT_TYPES covers all required context categories', () => {
    const { CONVERSATION_CONTEXT_TYPES: types } = constants;
    expect(types).toContain('supplier_profile');
    expect(types).toContain('package');
    expect(types).toContain('marketplace_listing');
    expect(types).toContain('find_a_supplier');
  });

  it('CONVERSATION_V4_TYPES covers all standard conversation types', () => {
    const { CONVERSATION_V4_TYPES: types } = constants;
    expect(types).toContain('direct');
    expect(types).toContain('marketplace');
    expect(types).toContain('enquiry');
    expect(types).toContain('supplier_network');
    expect(types).toContain('support');
  });

  it('model imports from messengerContextTypes instead of defining its own arrays', () => {
    expect(modelSrc).toContain("require('../utils/messengerContextTypes')");
  });

  it('route imports CONVERSATION_CONTEXT_TYPES from model (which re-exports from utils)', () => {
    expect(routerSrc).toContain('CONVERSATION_CONTEXT_TYPES');
  });

  it('route validates context.type against CONVERSATION_CONTEXT_TYPES', () => {
    expect(routerSrc).toContain('CONVERSATION_CONTEXT_TYPES.includes(context.type)');
  });
});

// ---------------------------------------------------------------------------
// 3. Route mounts and deprecated-route cleanup
// ---------------------------------------------------------------------------

describe('Route mounts — messenger-v4 is the active production path', () => {
  it('routes/index.js mounts messenger-v4 at /api/v4/messenger', () => {
    expect(routeIndexSrc).toContain("app.use('/api/v4/messenger'");
  });

  it('routes/index.js redirects /messages to /messenger/', () => {
    expect(routeIndexSrc).toContain("'/messages'");
    expect(routeIndexSrc).toContain("'/messenger/'");
  });

  it('routes/index.js redirects /messages.html to /messenger/', () => {
    expect(routeIndexSrc).toContain("'/messages.html'");
    expect(routeIndexSrc).toContain("'/messenger/'");
  });

  it('messenger-v4 route is initialised via initialize() before mounting', () => {
    expect(routeIndexSrc).toContain('messengerV4.initialize');
  });
});

// ---------------------------------------------------------------------------
// 4. Unread count consistency
// ---------------------------------------------------------------------------

describe('Unread count consistency', () => {
  it('UnreadBadgeManager polls /api/v4/messenger/unread-count (canonical endpoint)', () => {
    expect(unreadBadgeSrc).toContain('/api/v4/messenger/unread-count');
  });

  it('UnreadBadgeManager listens for messenger:unread-count events from MessengerAppV4', () => {
    expect(unreadBadgeSrc).toContain("'messenger:unread-count'");
  });

  it('MessengerAppV4 dispatches messenger:unread-count CustomEvent', () => {
    expect(messengerAppV4Src).toContain("'messenger:unread-count'");
  });

  it('NotificationBridgeV4 listens for messenger:unread-count to update the badge', () => {
    expect(notifBridgeSrc).toContain("'messenger:unread-count'");
  });

  it('messenger-v4 service exposes getUnreadCount for the badge API endpoint', () => {
    const messengerSvcSrc = read('services/messenger-v4.service.js');
    expect(messengerSvcSrc).toContain('getUnreadCount');
  });

  it('messenger-v4 route exposes GET /unread-count endpoint', () => {
    expect(routerSrc).toContain("'/unread-count'");
    expect(routerSrc).toContain('getUnreadCount');
  });
});
