/**
 * API Version Configuration
 * Centralized API version management to prevent version drift
 * 
 * This file defines the current API version being used by the frontend.
 * All API calls should use these constants rather than hardcoded version strings.
 */

const API_VERSION = {
  // Current API version (primary)
  CURRENT: 'v2',
  
  // Base API path
  BASE: '/api',
  
  // Full versioned path
  get PATH() {
    return `${this.BASE}/${this.CURRENT}`;
  },
  
  // Messaging endpoints
  MESSAGING: {
    get BASE() {
      return `${API_VERSION.PATH}/messages`;
    },
    THREADS: '/threads',
    UNREAD: '/unread',
    DRAFTS: '/drafts',
    SENT: '/sent',
    CONVERSATIONS: '/conversations',
    REACTIONS: '/reactions',
    READ: '/read',
    MARK_READ: '/mark-read',
    MARK_UNREAD: '/mark-unread',
    ARCHIVE: '/archive',
    UNARCHIVE: '/unarchive',
    LIMITS: '/limits',
  },
  
  // Helper methods
  messaging: {
    threads: () => `${API_VERSION.MESSAGING.BASE}/threads`,
    thread: (id) => `${API_VERSION.MESSAGING.BASE}/threads/${id}`,
    threadMessages: (id) => `${API_VERSION.MESSAGING.BASE}/${id}`,
    sendMessage: (threadId) => `${API_VERSION.MESSAGING.BASE}/${threadId}`,
    markRead: (threadId) => `${API_VERSION.MESSAGING.BASE}/threads/${threadId}/read`,
    markUnread: (threadId) => `${API_VERSION.MESSAGING.BASE}/threads/${threadId}/mark-unread`,
    archive: (threadId) => `${API_VERSION.MESSAGING.BASE}/threads/${threadId}/archive`,
    unarchive: (threadId) => `${API_VERSION.MESSAGING.BASE}/threads/${threadId}/unarchive`,
    reactions: (messageId) => `${API_VERSION.MESSAGING.BASE}/${messageId}/reactions`,
    unread: () => `${API_VERSION.MESSAGING.BASE}/unread`,
    drafts: () => `${API_VERSION.MESSAGING.BASE}/drafts`,
    sent: () => `${API_VERSION.MESSAGING.BASE}/sent`,
    conversations: () => `${API_VERSION.MESSAGING.BASE}/conversations`,
    limits: () => `${API_VERSION.MESSAGING.BASE}/limits`,
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
