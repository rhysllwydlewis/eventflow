/**
 * Messaging System for EventFlow
 * Handles conversations between customers and suppliers
 * Uses MongoDB API exclusively
 *
 * NOTE: This module has been migrated from Firebase to MongoDB.
 * All operations now use the EventFlow REST API backed by MongoDB.
 */

class MessagingSystem {
  constructor() {
    this.pollingIntervals = [];
    this.apiBase = '/api';
    this.badgeElement = null;
    this.lastUnreadCount = -1; // Initialize to -1 so first update (even 0) triggers animation
    this._pollingNotificationShown = false; // Track if we've shown the polling notification
  }

  /**
   * Listen to user's conversations using polling
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUserConversations(userId, userType, callback) {
    // Show user-facing notification only once
    if (!this._pollingNotificationShown) {
      this._pollingNotificationShown = true;
      if (typeof Toast !== 'undefined' && Toast.info) {
        Toast.info('Using polling for updates (refreshes every 5 seconds)', {
          duration: 5000
        });
      }
    }

    // Initial fetch
    this.fetchConversationsFromAPI(userId, userType, callback);

    // Poll for updates
    const pollInterval = setInterval(() => {
      this.fetchConversationsFromAPI(userId, userType, callback);
    }, 5000); // Poll every 5 seconds

    this.pollingIntervals.push(pollInterval);

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  /**
   * Listen to messages in a conversation using polling
   * @param {string} conversationId - Conversation ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToMessages(conversationId, callback) {
    // Silently use polling - no need to notify for each conversation

    // Initial fetch
    this.fetchMessagesFromAPI(conversationId, callback);

    // Poll for updates
    const pollInterval = setInterval(() => {
      this.fetchMessagesFromAPI(conversationId, callback);
    }, 3000); // Poll every 3 seconds for more responsive messaging

    this.pollingIntervals.push(pollInterval);

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  /**
   * Send a message via MongoDB API
   * @param {string} conversationId - Conversation ID
   * @param {Object} messageData - Message data
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(conversationId, messageData) {
    return this.sendMessageViaAPI(conversationId, messageData);
  }

  /**
   * Mark messages as read via MongoDB API
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async markMessagesAsRead(conversationId, userId) {
    return this.markMessagesAsReadViaAPI(conversationId, userId);
  }

  /**
   * Listen to unread count
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUnreadCount(userId, userType, callback) {
    // MongoDB API - Use polling
    this.fetchUnreadCountFromAPI(userId, userType, callback);

    // Poll for updates every 30 seconds
    const pollInterval = setInterval(() => {
      this.fetchUnreadCountFromAPI(userId, userType, callback);
    }, 30000);

    this.pollingIntervals.push(pollInterval);

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  // MongoDB API fallback methods
  async fetchConversationsFromAPI(userId, userType, callback) {
    try {
      const response = await fetch(
        `/api/messages/conversations?userId=${userId}&userType=${userType}`,
        {
          credentials: 'include',
        }
      );
      if (response.ok) {
        const data = await response.json();
        callback(data.conversations || []);
      } else {
        console.error('Failed to fetch conversations');
        callback([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      callback([]);
    }
  }

  async fetchMessagesFromAPI(conversationId, callback) {
    try {
      const response = await fetch(`/api/messages/${conversationId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        callback(data.messages || []);
      } else {
        console.error('Failed to fetch messages');
        callback([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      callback([]);
    }
  }

  async sendMessageViaAPI(conversationId, messageData) {
    try {
      const response = await fetch(`/api/messages/${conversationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        credentials: 'include',
        body: JSON.stringify(messageData),
      });
      if (response.ok) {
        const data = await response.json();
        return data.messageId;
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async markMessagesAsReadViaAPI(conversationId, userId) {
    try {
      await fetch(`/api/messages/${conversationId}/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  async fetchUnreadCountFromAPI(userId, userType, callback) {
    try {
      const response = await fetch(`/api/messages/unread?userId=${userId}&userType=${userType}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        callback(data.count || 0);
      } else {
        callback(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      callback(0);
    }
  }

  /**
   * Format timestamp for display
   * @param {Object} timestamp - Firestore timestamp or Date
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) {
      return '';
    }

    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Format full timestamp for display
   * @param {Object} timestamp - Firestore timestamp or Date
   * @returns {string} Formatted timestamp
   */
  formatFullTimestamp(timestamp) {
    if (!timestamp) {
      return '';
    }

    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }

    return date.toLocaleString();
  }

  /**
   * Clean up all polling intervals
   */
  cleanup() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals = [];
  }
}

/**
 * MessagingManager - Enhanced messaging with unread badge updates
 */
class MessagingManager {
  constructor() {
    this.messagingSystem = new MessagingSystem();
    this.badgeElement = null;
    this.lastUnreadCount = 0;
  }

  /**
   * Mark messages as read in a thread
   * @param {string} threadId - Thread/conversation ID
   * @returns {Promise<boolean>} Success status
   */
  async markMessagesAsRead(threadId) {
    try {
      const response = await fetch(`/api/messages/threads/${threadId}/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
        credentials: 'include',
      });

      if (response.ok) {
        await this.refreshUnreadCount();
        return true;
      }

      console.error('Failed to mark messages as read');
      return false;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  }

  /**
   * Refresh unread message count
   * @returns {Promise<number>} Unread count
   */
  async refreshUnreadCount() {
    try {
      const response = await fetch('/api/messages/unread', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      const count = data.count || data.unreadCount || 0;

      this.updateBadge(count);

      const event = new CustomEvent('unreadCountUpdated', {
        detail: { count },
      });
      window.dispatchEvent(event);

      return count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * Update badge element with count
   * @param {number} count - Unread message count
   */
  updateBadge(count) {
    if (!this.badgeElement) {
      this.badgeElement =
        document.getElementById('unread-badge') ||
        document.getElementById('message-badge') ||
        document.querySelector('.unread-badge') ||
        document.querySelector('[data-unread-badge]');
    }

    if (!this.badgeElement) {
      return;
    }

    if (count > 0) {
      this.badgeElement.textContent = count > 99 ? '99+' : count.toString();
      this.badgeElement.style.display = 'inline-block';

      if (count !== this.lastUnreadCount) {
        this.animateBadge();
      }
    } else {
      this.badgeElement.style.display = 'none';
    }

    this.lastUnreadCount = count;
  }

  /**
   * Animate badge on count change
   */
  animateBadge() {
    if (!this.badgeElement) {
      return;
    }

    this.badgeElement.classList.add('badge-animate');

    setTimeout(() => {
      this.badgeElement.classList.remove('badge-animate');
    }, 300);

    if (!document.getElementById('badge-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'badge-animation-styles';
      style.textContent = `
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .badge-animate {
          animation: badge-pulse 0.3s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Initialize polling for unread count
   * @param {number} interval - Polling interval in ms (default: 30000)
   */
  startUnreadCountPolling(interval = 30000) {
    this.refreshUnreadCount();

    return setInterval(() => {
      this.refreshUnreadCount();
    }, interval);
  }
}

// Create and export singleton instance
const messagingSystem = new MessagingSystem();
const messagingManager = new MessagingManager();

export default messagingSystem;
export { MessagingManager, messagingManager };
