/**
 * Messaging System for EventFlow
 * Handles conversations between customers and suppliers
 * Uses Firebase Firestore for real-time updates or falls back to MongoDB API
 */

import { isFirebaseAvailable } from './firebase-config.js';

class MessagingSystem {
  constructor() {
    this.unsubscribers = [];
    this.useFirebase = isFirebaseAvailable;
  }

  /**
   * Listen to user's conversations
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUserConversations(userId, userType, callback) {
    if (!this.useFirebase) {
      // Fallback: Use MongoDB API
      this.fetchConversationsFromAPI(userId, userType, callback);
      return () => {}; // No-op unsubscribe
    }

    // Firebase implementation would go here
    callback([]);
    return () => {};
  }

  /**
   * Listen to messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToMessages(conversationId, callback) {
    if (!this.useFirebase) {
      // Fallback: Use MongoDB API
      this.fetchMessagesFromAPI(conversationId, callback);
      return () => {}; // No-op unsubscribe
    }

    // Firebase implementation would go here
    callback([]);
    return () => {};
  }

  /**
   * Send a message
   * @param {string} conversationId - Conversation ID
   * @param {Object} messageData - Message data
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(conversationId, messageData) {
    if (!this.useFirebase) {
      // Fallback: Use MongoDB API
      return this.sendMessageViaAPI(conversationId, messageData);
    }

    // TODO: Firebase implementation when available
    return this.sendMessageViaAPI(conversationId, messageData);
  }

  /**
   * Mark messages as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async markMessagesAsRead(conversationId, userId) {
    if (!this.useFirebase) {
      // Fallback: Use MongoDB API
      return this.markMessagesAsReadViaAPI(conversationId, userId);
    }

    return Promise.resolve();
  }

  /**
   * Listen to unread count
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUnreadCount(userId, userType, callback) {
    if (!this.useFirebase) {
      // Fallback: Use MongoDB API
      this.fetchUnreadCountFromAPI(userId, userType, callback);
      return () => {}; // No-op unsubscribe
    }

    callback(0);
    return () => {};
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
   * Clean up all subscriptions
   */
  cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}

// Create and export singleton instance
const messagingSystem = new MessagingSystem();

export default messagingSystem;
