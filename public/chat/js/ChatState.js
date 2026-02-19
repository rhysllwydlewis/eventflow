/**
 * Chat State Manager (v5)
 * Centralized state management with event emitter pattern
 */

'use strict';

class ChatState {
  constructor() {
    this.state = {
      conversations: [],
      activeConversationId: null,
      messages: new Map(), // conversationId -> messages array
      typingUsers: new Map(), // conversationId -> Set of userIds
      onlineUsers: new Set(),
      currentUser: null,
      filter: 'all',
      searchQuery: '',
    };

    this.listeners = new Map(); // event -> Set of callbacks
    this.typingTimeouts = new Map(); // conversationId:userId -> timeout
  }

  /**
   * Subscribe to state changes
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Emit an event to all listeners
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Set current user
   */
  setCurrentUser(user) {
    this.state.currentUser = user;
    this.emit('user:set', user);
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.state.currentUser;
  }

  /**
   * Set conversations
   */
  setConversations(conversations) {
    this.state.conversations = conversations;
    this.emit('conversations:updated', conversations);
  }

  /**
   * Add a conversation
   */
  addConversation(conversation) {
    const exists = this.state.conversations.find(c => c._id === conversation._id);
    if (!exists) {
      this.state.conversations.unshift(conversation);
      this.emit('conversations:updated', this.state.conversations);
      this.emit('conversation:added', conversation);
    }
  }

  /**
   * Update a conversation
   */
  updateConversation(conversationId, updates) {
    const index = this.state.conversations.findIndex(c => c._id === conversationId);
    if (index !== -1) {
      this.state.conversations[index] = {
        ...this.state.conversations[index],
        ...updates,
      };
      this.emit('conversations:updated', this.state.conversations);
      this.emit('conversation:updated', this.state.conversations[index]);
    }
  }

  /**
   * Remove a conversation
   */
  removeConversation(conversationId) {
    this.state.conversations = this.state.conversations.filter(c => c._id !== conversationId);
    this.emit('conversations:updated', this.state.conversations);
    this.emit('conversation:removed', conversationId);
  }

  /**
   * Get all conversations
   */
  getConversations() {
    return this.state.conversations;
  }

  /**
   * Get filtered conversations
   */
  getFilteredConversations() {
    let conversations = this.state.conversations;

    // Apply filter
    const userId = this.state.currentUser?.userId || this.state.currentUser?.id;
    if (userId) {
      switch (this.state.filter) {
        case 'unread':
          conversations = conversations.filter(c => {
            const participant = c.participants?.find(p => p.userId === userId);
            return participant && participant.unreadCount > 0;
          });
          break;
        case 'pinned':
          conversations = conversations.filter(c => {
            const participant = c.participants?.find(p => p.userId === userId);
            return participant && participant.isPinned;
          });
          break;
        case 'archived':
          conversations = conversations.filter(c => {
            const participant = c.participants?.find(p => p.userId === userId);
            return participant && participant.isArchived;
          });
          break;
      }
    }

    // Apply search
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      conversations = conversations.filter(c => {
        const lastMessage = c.lastMessage?.content?.toLowerCase() || '';
        const participants = c.participants?.map(p => p.displayName?.toLowerCase() || '').join(' ') || '';
        return lastMessage.includes(query) || participants.includes(query);
      });
    }

    return conversations;
  }

  /**
   * Set active conversation
   */
  setActiveConversation(conversationId) {
    this.state.activeConversationId = conversationId;
    this.emit('conversation:active', conversationId);
  }

  /**
   * Get active conversation
   */
  getActiveConversation() {
    return this.state.conversations.find(c => c._id === this.state.activeConversationId);
  }

  /**
   * Get active conversation ID
   */
  getActiveConversationId() {
    return this.state.activeConversationId;
  }

  /**
   * Set messages for a conversation
   */
  setMessages(conversationId, messages) {
    this.state.messages.set(conversationId, messages);
    if (conversationId === this.state.activeConversationId) {
      this.emit('messages:updated', messages);
    }
  }

  /**
   * Prepend messages (for infinite scroll)
   */
  prependMessages(conversationId, messages) {
    const existing = this.state.messages.get(conversationId) || [];
    this.state.messages.set(conversationId, [...messages, ...existing]);
    if (conversationId === this.state.activeConversationId) {
      this.emit('messages:updated', this.state.messages.get(conversationId));
    }
  }

  /**
   * Add a message
   */
  addMessage(conversationId, message) {
    const messages = this.state.messages.get(conversationId) || [];
    // Check if message already exists
    const exists = messages.find(m => m._id === message._id);
    if (!exists) {
      messages.push(message);
      this.state.messages.set(conversationId, messages);
      if (conversationId === this.state.activeConversationId) {
        this.emit('messages:updated', messages);
      }
      this.emit('message:added', { conversationId, message });
    }
  }

  /**
   * Update a message
   */
  updateMessage(conversationId, messageId, updates) {
    const messages = this.state.messages.get(conversationId);
    if (messages) {
      const index = messages.findIndex(m => m._id === messageId);
      if (index !== -1) {
        messages[index] = { ...messages[index], ...updates };
        this.state.messages.set(conversationId, messages);
        if (conversationId === this.state.activeConversationId) {
          this.emit('messages:updated', messages);
        }
        this.emit('message:updated', { conversationId, message: messages[index] });
      }
    }
  }

  /**
   * Remove a message
   */
  removeMessage(conversationId, messageId) {
    const messages = this.state.messages.get(conversationId);
    if (messages) {
      const filtered = messages.filter(m => m._id !== messageId);
      this.state.messages.set(conversationId, filtered);
      if (conversationId === this.state.activeConversationId) {
        this.emit('messages:updated', filtered);
      }
      this.emit('message:removed', { conversationId, messageId });
    }
  }

  /**
   * Get messages for a conversation
   */
  getMessages(conversationId) {
    return this.state.messages.get(conversationId) || [];
  }

  /**
   * Get active conversation messages
   */
  getActiveMessages() {
    if (!this.state.activeConversationId) return [];
    return this.state.messages.get(this.state.activeConversationId) || [];
  }

  /**
   * Add typing user
   */
  addTypingUser(conversationId, userId, userName) {
    if (!this.state.typingUsers.has(conversationId)) {
      this.state.typingUsers.set(conversationId, new Map());
    }
    this.state.typingUsers.get(conversationId).set(userId, userName);

    // Clear existing timeout
    const timeoutKey = `${conversationId}:${userId}`;
    if (this.typingTimeouts.has(timeoutKey)) {
      clearTimeout(this.typingTimeouts.get(timeoutKey));
    }

    // Set timeout to auto-remove after 3 seconds
    const timeout = setTimeout(() => {
      this.removeTypingUser(conversationId, userId);
    }, 3000);
    this.typingTimeouts.set(timeoutKey, timeout);

    if (conversationId === this.state.activeConversationId) {
      this.emit('typing:updated', this.getTypingUsers(conversationId));
    }
  }

  /**
   * Remove typing user
   */
  removeTypingUser(conversationId, userId) {
    const users = this.state.typingUsers.get(conversationId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.state.typingUsers.delete(conversationId);
      }
    }

    const timeoutKey = `${conversationId}:${userId}`;
    if (this.typingTimeouts.has(timeoutKey)) {
      clearTimeout(this.typingTimeouts.get(timeoutKey));
      this.typingTimeouts.delete(timeoutKey);
    }

    if (conversationId === this.state.activeConversationId) {
      this.emit('typing:updated', this.getTypingUsers(conversationId));
    }
  }

  /**
   * Get typing users for a conversation
   */
  getTypingUsers(conversationId) {
    const users = this.state.typingUsers.get(conversationId);
    return users ? Array.from(users.entries()).map(([userId, userName]) => ({ userId, userName })) : [];
  }

  /**
   * Set online status for a user
   */
  setUserOnline(userId, isOnline) {
    if (isOnline) {
      this.state.onlineUsers.add(userId);
    } else {
      this.state.onlineUsers.delete(userId);
    }
    this.emit('presence:updated', { userId, isOnline });
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.state.onlineUsers.has(userId);
  }

  /**
   * Set filter
   */
  setFilter(filter) {
    this.state.filter = filter;
    this.emit('filter:changed', filter);
  }

  /**
   * Get filter
   */
  getFilter() {
    return this.state.filter;
  }

  /**
   * Set search query
   */
  setSearchQuery(query) {
    this.state.searchQuery = query;
    this.emit('search:changed', query);
  }

  /**
   * Get search query
   */
  getSearchQuery() {
    return this.state.searchQuery;
  }

  /**
   * Clear all state
   */
  clear() {
    this.state.conversations = [];
    this.state.activeConversationId = null;
    this.state.messages.clear();
    this.state.typingUsers.clear();
    this.state.onlineUsers.clear();
    this.state.filter = 'all';
    this.state.searchQuery = '';

    // Clear all timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();

    this.emit('state:cleared', null);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatState;
}
