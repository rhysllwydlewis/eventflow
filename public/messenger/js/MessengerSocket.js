/**
 * Messenger WebSocket Client
 * Handles real-time communication via Socket.IO
 */

'use strict';

class MessengerSocket {
  constructor(state) {
    this.state = state;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Connect to WebSocket server
   */
  connect(userId) {
    if (!window.io) {
      console.error('Socket.IO not available');
      return;
    }

    this.socket = window.io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers(userId);
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers(userId) {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Messenger WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Authenticate
      this.socket.emit('auth', { userId });

      // Rejoin active conversation if any
      if (this.state.activeConversationId) {
        this.joinConversation(this.state.activeConversationId);
      }

      // Dispatch custom event
      window.dispatchEvent(new CustomEvent('messenger:connected'));
    });

    this.socket.on('disconnect', () => {
      console.log('Messenger WebSocket disconnected');
      this.isConnected = false;
      window.dispatchEvent(new CustomEvent('messenger:disconnected'));
    });

    this.socket.on('auth:success', (data) => {
      console.log('Messenger authenticated:', data.userId);
    });

    // Messenger v3 events
    this.socket.on('messenger:new-message', (data) => {
      console.log('New message received:', data);
      window.dispatchEvent(new CustomEvent('messenger:new-message', { detail: data }));
    });

    this.socket.on('messenger:typing', (data) => {
      console.log('Typing indicator:', data);
      this.state.setTyping(data.conversationId, data.userId, data.isTyping);
      window.dispatchEvent(new CustomEvent('messenger:typing', { detail: data }));
    });

    this.socket.on('messenger:new-conversation', (data) => {
      console.log('New conversation:', data);
      window.dispatchEvent(new CustomEvent('messenger:new-conversation', { detail: data }));
    });

    this.socket.on('messenger:message-edited', (data) => {
      console.log('Message edited:', data);
      window.dispatchEvent(new CustomEvent('messenger:message-edited', { detail: data }));
    });

    this.socket.on('messenger:message-deleted', (data) => {
      console.log('Message deleted:', data);
      window.dispatchEvent(new CustomEvent('messenger:message-deleted', { detail: data }));
    });

    this.socket.on('messenger:reaction-updated', (data) => {
      console.log('Reaction updated:', data);
      window.dispatchEvent(new CustomEvent('messenger:reaction-updated', { detail: data }));
    });

    this.socket.on('messenger:conversation-read', (data) => {
      console.log('Conversation marked as read:', data);
      window.dispatchEvent(new CustomEvent('messenger:conversation-read', { detail: data }));
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('Max reconnection attempts reached');
        // Socket.IO will continue trying with exponential backoff
        // For additional resilience, implement HTTP polling in MessengerApp
        window.dispatchEvent(new CustomEvent('messenger:connection-failed'));
      }
    });
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId) {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot join conversation: not connected');
      return;
    }

    this.socket.emit('messenger:join', { conversationId });
    console.log('Joined conversation:', conversationId);
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId) {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('messenger:leave', { conversationId });
    console.log('Left conversation:', conversationId);
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId, isTyping) {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('messenger:typing', { conversationId, isTyping });
  }

  /**
   * Notify about new message
   */
  notifyNewMessage(conversationId) {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('messenger:message', { conversationId });
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Check if connected
   */
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MessengerSocket = MessengerSocket;
}
