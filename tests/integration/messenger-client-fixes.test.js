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
    conversationListSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'ConversationListV4.js'), 'utf8');
    contactPickerSrc = fs.readFileSync(path.join(MESSENGER_DIR, 'js', 'ContactPickerV4.js'), 'utf8');
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
    expect(messengerApiSrc).toContain("options.role");
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
    expect(triggerSrc).not.toContain("window.AuthState && window.AuthState.isAuthenticated");
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
    expect(messengerAppSrc).toContain("showConfirm");
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
    expect(bannerSrc).toContain("/^\\//");
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
});
