/**
 * Integration tests for messenger client-side fixes.
 * Validates correctness of file content/structure without importing
 * Node-native modules (e.g. mongodb) that are absent from this test env.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MESSENGER_DIR = path.resolve(__dirname, '..', '..', 'public', 'messenger');
const SERVICES_DIR = path.resolve(__dirname, '..', '..', 'services');

describe('Messenger client-side fixes', () => {
  let indexHtml;
  let messengerAppSrc;
  let messengerApiSrc;
  let chatViewSrc;
  let conversationListSrc;
  let contactPickerSrc;
  let triggerSrc;
  let serviceSrc;

  beforeAll(() => {
    indexHtml = fs.readFileSync(path.join(MESSENGER_DIR, 'index.html'), 'utf8');
    messengerAppSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerAppV4.js'), 'utf8');
    messengerApiSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerAPI.js'), 'utf8');
    chatViewSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'ChatViewV4.js'), 'utf8');
    conversationListSrc = fs.readFileSync(
      path.join(MESSENGER_DIR, 'js', 'ConversationListV4.js'),
      'utf8'
    );
    contactPickerSrc = fs.readFileSync(
      path.join(MESSENGER_DIR, 'js', 'ContactPickerV4.js'),
      'utf8'
    );
    triggerSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerTrigger.js'), 'utf8');
    serviceSrc = fs.readFileSync(path.join(SERVICES_DIR, 'messenger-v4.service.js'), 'utf8');
  });

  // ── Favicon fix ─────────────────────────────────────────────────────────────

  it('index.html uses /favicon.svg (correct path)', () => {
    expect(indexHtml).toContain('href="/favicon.svg"');
  });

  it('index.html does NOT reference the broken /assets/icons/favicon.svg path', () => {
    expect(indexHtml).not.toContain('/assets/icons/favicon.svg');
  });

  // ── MessengerAPI CSRF freshness ──────────────────────────────────────────────

  it('MessengerAPI does not cache csrfToken in constructor (reads fresh per-request)', () => {
    expect(messengerApiSrc).not.toContain('this.csrfToken = this.getCsrfToken()');
  });

  it('MessengerAPI calls getCsrfToken() in request() not this.csrfToken', () => {
    expect(messengerApiSrc).toContain('getCsrfToken()');
    // Should NOT rely on a stored property
    expect(messengerApiSrc).not.toMatch(/config\.headers\[.X-CSRF-Token.\]\s*=\s*this\.csrfToken/);
  });

  // ── markAsUnread sends correct payload ──────────────────────────────────────

  it('MessengerAPI.markAsUnread sends { markUnread: true } (not the old { isUnread: true })', () => {
    expect(messengerApiSrc).toContain('markUnread: true');
    expect(messengerApiSrc).not.toContain('isUnread: true');
  });

  // ── Server-side markUnread support ─────────────────────────────────────────

  it('messenger-v4.service.js handles markUnread to increment unreadCount', () => {
    expect(serviceSrc).toContain('updates.markUnread');
    expect(serviceSrc).toContain('unreadCount');
  });

  // ── getContacts supports role filter ────────────────────────────────────────

  it('MessengerAPI.getContacts accepts and forwards role option as query param', () => {
    expect(messengerApiSrc).toContain('options.role');
    expect(messengerApiSrc).toContain("params.append('role'");
  });

  // ── ContactPickerV4 passes role to API ──────────────────────────────────────

  it('ContactPickerV4.search passes role=supplier for customer users', () => {
    expect(contactPickerSrc).toContain("role: 'supplier'");
  });

  // ── MessengerTrigger uses correct auth global ────────────────────────────────

  it('MessengerTrigger uses AuthStateManager (not the non-existent AuthState)', () => {
    expect(triggerSrc).toContain('AuthStateManager');
    // The old broken check should be gone
    expect(triggerSrc).not.toContain('window.AuthState && window.AuthState.isAuthenticated');
  });

  // ── handleDeepLink handles ?new=true ───────────────────────────────────────

  it("handleDeepLink checks openNew === 'true' (from MessengerTrigger ?new=true)", () => {
    expect(messengerAppSrc).toContain("openNew === 'true'");
  });

  it("handleDeepLink also handles openNew === '1' (legacy)", () => {
    expect(messengerAppSrc).toContain("openNew === '1'");
  });

  // ── messenger:open-contact-by-id is handled ────────────────────────────────

  it('MessengerAppV4 listens for messenger:open-contact-by-id event', () => {
    expect(messengerAppSrc).toContain("'messenger:open-contact-by-id'");
  });

  // ── Composer guards against null conversationId ─────────────────────────────

  it('ChatViewV4 uses server hasMore flag for infinite scroll pagination', () => {
    expect(chatViewSrc).toContain('data.hasMore');
  });

  it('ChatViewV4 hasMore falls back to count heuristic when server omits the flag', () => {
    // The fallback expression: data.hasMore !== undefined ? data.hasMore : messages.length >= 40
    expect(chatViewSrc).toMatch(/data\.hasMore !== undefined/);
    // Both the initial load (>=40) and pagination (>=30) fallbacks are present
    expect(chatViewSrc).toContain('messages.length >= 40');
    expect(chatViewSrc).toContain('older.length >= 30');
  });

  // ── Right-click context menu ────────────────────────────────────────────────

  it('ConversationListV4 has contextmenu event listener on items', () => {
    expect(conversationListSrc).toContain("'contextmenu'");
  });

  it('ConversationListV4 right-click menu dispatches messenger:mark-unread', () => {
    expect(conversationListSrc).toContain("'messenger:mark-unread'");
  });

  it('ConversationListV4 right-click menu dispatches messenger:delete-conversation', () => {
    expect(conversationListSrc).toContain("'messenger:delete-conversation'");
  });

  // ── Delete conversation cleans up socket/context ────────────────────────────

  it('MessengerAppV4 delete handler calls contextBanner.hide() on delete', () => {
    expect(messengerAppSrc).toContain('contextBanner?.hide()');
  });

  it('MessengerAppV4 delete handler leaves WebSocket conversation room', () => {
    expect(messengerAppSrc).toContain('socket?.leaveConversation(id)');
  });

  // ── Uses branded confirm dialog ──────────────────────────────────────────────

  it('MessengerAppV4 uses MessengerModals.showConfirm for delete (not native confirm)', () => {
    // Should reference showConfirm for delete conversation
    expect(messengerAppSrc).toContain('showConfirm');
  });

  it('MessengerAppV4 calls showEditPrompt (correct method name, not showEdit)', () => {
    expect(messengerAppSrc).toContain('showEditPrompt');
    expect(messengerAppSrc).not.toContain('showEdit(');
  });

  // ── Security: URL sanitization ──────────────────────────────────────────────

  it('MessageBubbleV4 has safeUrl() method to block javascript: URIs in file hrefs', () => {
    const bubbleSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessageBubbleV4.js'), 'utf8');
    expect(bubbleSrc).toContain('static safeUrl(');
    expect(bubbleSrc).toContain('javascript');
    // File attachment href uses safeUrl, not just escape
    expect(bubbleSrc).toContain('MessageBubbleV4.safeUrl(attachment.url)');
  });

  it('ContextBannerV4 sanitises context.url before assigning to link.href', () => {
    const bannerSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'ContextBannerV4.js'), 'utf8');
    expect(bannerSrc).toContain('_safeUrl(');
    // Should NOT assign href directly from context.url without sanitisation
    expect(bannerSrc).not.toContain('link.href = context.url');
  });

  it('ContextBannerV4 only allows relative (same-origin) paths for thumbnail src', () => {
    const bannerSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'ContextBannerV4.js'), 'utf8');
    // Validates imageUrl starts with '/' (relative path)
    expect(bannerSrc).toContain('/^\\//');
  });

  // ── MessengerState filter fixes ─────────────────────────────────────────────

  it('MessengerState.getFilteredConversations excludes archived from the all tab', () => {
    const stateSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerState.js'), 'utf8');
    // The 'all' else branch should filter out archived conversations
    expect(stateSrc).toContain('isArchived');
  });

  it('MessengerState.getFilteredConversations uses currentUser.id || currentUser._id for uid lookup', () => {
    const stateSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerState.js'), 'utf8');
    expect(stateSrc).toContain('currentUser?.id || this.currentUser?._id');
  });

  // ── selectConversation immediately updates local unread count ───────────────

  it('MessengerAppV4 selectConversation updates local unreadCount after mark-read API call', () => {
    // Should mutate the participant's unreadCount in local state (not wait for next full reload)
    expect(messengerAppSrc).toContain('participant.unreadCount = 0');
    expect(messengerAppSrc).toContain('state.updateConversation(conv)');
  });

  // ── Incoming message unread badge increment ─────────────────────────────────

  it('MessengerAppV4 new-message handler increments local unreadCount for background convs', () => {
    // Should optimistically update me.unreadCount when a WS message arrives for a non-active conv
    expect(messengerAppSrc).toContain('me.unreadCount = (me.unreadCount || 0) + 1');
  });

  // ── MessengerAPI query param alignment ─────────────────────────────────────

  it("MessengerAPI.getConversations sends 'unread=true' (matching server param, not 'unreadOnly')", () => {
    expect(messengerApiSrc).toContain("params.append('unread', 'true')");
    expect(messengerApiSrc).not.toContain("params.append('unreadOnly'");
  });

  // ── MessengerModals keyboard accessibility ──────────────────────────────────

  it('MessengerModals.showConfirm Enter key only confirms when confirm button has focus', () => {
    const modalsSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerModals.js'), 'utf8');
    // Should guard against confirming when cancel button has focus
    expect(modalsSrc).toContain('document.activeElement !== cancelBtn');
  });

  it('MessengerModals uses requestAnimationFrame (not setTimeout) for focus management', () => {
    const modalsSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerModals.js'), 'utf8');
    expect(modalsSrc).not.toMatch(/setTimeout.*focus.*100/);
    expect(modalsSrc).toContain('requestAnimationFrame');
  });

  // ── Admin XSS hardening ─────────────────────────────────────────────────────

  it('admin-init.js escapes user.name and user.email before inserting into table rows', () => {
    const adminSrc = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'public', 'assets', 'js', 'pages', 'admin-init.js'),
      'utf8'
    );
    expect(adminSrc).toContain("escapeHtml(u.name || '')");
    expect(adminSrc).toContain("escapeHtml(u.email || '')");
    // Should also escape role names in analytics
    expect(adminSrc).toContain('escapeHtml(r)');
  });

  // ── CSRF token base64 safety ────────────────────────────────────────────────

  it('MessengerAPI.getCsrfToken uses indexOf (not split) so base64 tokens with = work', () => {
    expect(messengerApiSrc).toContain("trimmed.indexOf('=')");
    // Should NOT use the broken split('=') destructuring (outside comments)
    const codeWithoutComments = messengerApiSrc.replace(/\/\/[^\n]*/g, '');
    expect(codeWithoutComments).not.toContain("split('=')");
  });

  it('MessengerAPI.getCsrfToken falls back to window.__CSRF_TOKEN__ and window.csrfToken', () => {
    expect(messengerApiSrc).toContain('window.__CSRF_TOKEN__');
    expect(messengerApiSrc).toContain('window.csrfToken');
  });

  // ── Archive active conversation navigates back ──────────────────────────────

  it('MessengerAppV4 archive handler resets chat view when active conversation is archived', () => {
    expect(messengerAppSrc).toContain("'messenger:archive-conversation'");
    // Should check if the archived id matches the active conversation
    expect(messengerAppSrc).toContain('id === this._activeConversationId');
  });

  // ── Optimistic pin/archive state update ─────────────────────────────────────

  it('_togglePin does optimistic local state update (me.isPinned) instead of full reload', () => {
    expect(messengerAppSrc).toContain('me.isPinned = newPinned');
  });

  it('_toggleArchive does optimistic local state update (me.isArchived) instead of full reload', () => {
    expect(messengerAppSrc).toContain('me.isArchived = newArchived');
  });

  // ── conversation-deleted WebSocket event ────────────────────────────────────

  it('MessengerSocket forwards messenger:v4:conversation-deleted to window event', () => {
    const socketSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessengerSocket.js'), 'utf8');
    expect(socketSrc).toContain("'messenger:v4:conversation-deleted'");
    expect(socketSrc).toContain("'messenger:conversation-deleted'");
  });

  it('MessengerAppV4 handles messenger:conversation-deleted event from other sessions', () => {
    expect(messengerAppSrc).toContain("'messenger:conversation-deleted'");
  });

  // ── A) Image unavailable placeholder readability ────────────────────────────

  it('messenger-v4-polish.css error label uses white text (color: #fff)', () => {
    const cssSrc = fs.readFileSync(
      path.join(MESSENGER_DIR, 'css', 'messenger-v4-polish.css'),
      'utf8'
    );
    expect(cssSrc).toContain('.messenger-v4__attachment-error-label');
    // Must use white (#fff) so text is readable on the dark bubble background
    expect(cssSrc).toMatch(/\.messenger-v4__attachment-error-label\s*\{[^}]*color:\s*#fff/);
  });

  it('messenger-v4-polish.css error label has a secondary hint class defined', () => {
    const cssSrc = fs.readFileSync(
      path.join(MESSENGER_DIR, 'css', 'messenger-v4-polish.css'),
      'utf8'
    );
    expect(cssSrc).toContain('.messenger-v4__attachment-error-hint');
  });

  it('MessageBubbleV4 onerror handler adds title attribute for accessibility', () => {
    const bubbleSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessageBubbleV4.js'), 'utf8');
    expect(bubbleSrc).toContain("w.title='Image unavailable'");
  });

  it('MessageBubbleV4 onerror handler appends a secondary hint about file removal', () => {
    const bubbleSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'MessageBubbleV4.js'), 'utf8');
    expect(bubbleSrc).toContain('messenger-v4__attachment-error-hint');
    expect(bubbleSrc).toContain('The file may have been removed');
  });

  // ── C) Mark read/unread toggle ──────────────────────────────────────────────

  it('ChatViewV4 _updateMarkUnreadBtn updates aria-label based on unread state', () => {
    expect(chatViewSrc).toContain('_updateMarkUnreadBtn(');
    expect(chatViewSrc).toContain("'Mark as read'");
    expect(chatViewSrc).toContain("'Mark as unread'");
  });

  it('ChatViewV4 mark-unread button dispatches messenger:mark-read when conversation is unread', () => {
    expect(chatViewSrc).toContain("'messenger:mark-read'");
  });

  it('ChatViewV4 mark-unread button dispatches messenger:mark-unread when conversation is read', () => {
    expect(chatViewSrc).toContain("'messenger:mark-unread'");
  });

  it('ChatViewV4 _renderHeader calls _updateMarkUnreadBtn to reflect conversation state', () => {
    expect(chatViewSrc).toContain('_updateMarkUnreadBtn(');
  });

  it('MessengerAppV4 handles messenger:mark-read event (toggle counterpart)', () => {
    expect(messengerAppSrc).toContain("'messenger:mark-read'");
  });

  it('MessengerAppV4 mark-read handler calls api.markAsRead', () => {
    expect(messengerAppSrc).toContain('api.markAsRead(id)');
  });

  it('MessengerAppV4 mark-unread handler does optimistic local state update', () => {
    expect(messengerAppSrc).toMatch(/mark-unread[\s\S]*?me\.unreadCount\s*=/);
  });

  it('MessengerAppV4 mark-unread handler calls chatView._updateMarkUnreadBtn(true)', () => {
    expect(messengerAppSrc).toContain('chatView._updateMarkUnreadBtn(true)');
  });

  it('MessengerAppV4 mark-read handler calls chatView._updateMarkUnreadBtn(false)', () => {
    expect(messengerAppSrc).toContain('chatView._updateMarkUnreadBtn(false)');
  });

  // ── D) New conversation plus icon and defensive picker handling ─────────────

  it('ConversationListV4 empty-state CTA includes a plus sign prefix', () => {
    expect(conversationListSrc).toContain('+ New Conversation');
  });

  it('MessengerAppV4 open-contact-picker handler warns when contact picker is unavailable', () => {
    expect(messengerAppSrc).toContain('Contact picker is not available');
  });
});
