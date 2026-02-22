/**
 * API Version Configuration
 * Centralized API version management to prevent version drift
 *
 * This file defines the current API version being used by the frontend.
 * All API calls should use these constants rather than hardcoded version strings.
 */

const API_VERSION = {
  // Current API version (primary) - v4 is the gold standard
  CURRENT: 'v4',

  // Base API path
  BASE: '/api',

  // Full versioned path
  get PATH() {
    return `${this.BASE}/${this.CURRENT}`;
  },

  // Messenger v4 endpoints (gold standard)
  MESSENGER: {
    get BASE() {
      return `${API_VERSION.BASE}/v4/messenger`;
    },
    CONVERSATIONS: '/conversations',
    MESSAGES: '/messages',
    UNREAD: '/unread',
    SEARCH: '/search',
    CONTACTS: '/contacts',
    TYPING: '/typing',
    READ_RECEIPT: '/read',
    REACTIONS: '/reactions',
    ATTACHMENTS: '/attachments',
  },

  // Helper methods for v4 messenger API
  messenger: {
    // Conversations
    conversations: () => `${API_VERSION.MESSENGER.BASE}/conversations`,
    conversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}`,
    createConversation: () => `${API_VERSION.MESSENGER.BASE}/conversations`,
    archiveConversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}/archive`,
    unarchiveConversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}/unarchive`,
    pinConversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}/pin`,
    unpinConversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}/unpin`,
    muteConversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}/mute`,
    unmuteConversation: id => `${API_VERSION.MESSENGER.BASE}/conversations/${id}/unmute`,

    // Messages
    messages: conversationId =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/messages`,
    sendMessage: conversationId =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/messages`,
    editMessage: (conversationId, messageId) =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/messages/${messageId}`,
    deleteMessage: (conversationId, messageId) =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/messages/${messageId}`,

    // Read receipts and reactions
    markAsRead: conversationId =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/read`,
    toggleReaction: (conversationId, messageId) =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/messages/${messageId}/react`,

    // Typing indicator
    setTyping: conversationId =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/typing`,

    // Search and contacts
    searchMessages: () => `${API_VERSION.MESSENGER.BASE}/search`,
    searchContacts: () => `${API_VERSION.MESSENGER.BASE}/contacts/search`,

    // Unread count
    unreadCount: () => `${API_VERSION.MESSENGER.BASE}/unread`,

    // Attachments
    uploadAttachment: conversationId =>
      `${API_VERSION.MESSENGER.BASE}/conversations/${conversationId}/attachments`,
  },
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_VERSION;
}

// Make available globally in browser
if (typeof window !== 'undefined') {
  window.API_VERSION = API_VERSION;
}
