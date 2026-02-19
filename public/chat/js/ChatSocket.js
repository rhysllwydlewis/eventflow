/**
 * Chat WebSocket Client (v5)
 * Handles real-time communication via Socket.IO
 */

'use strict';

class ChatSocket {
  constructor(chatState) {
    this.chatState = chatState;
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.currentConversationId = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect(userId, userName) {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
    this.authenticate(userId, userName);
  }

  /**
   * Setup all event handlers
   */
  setupEventHandlers() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.chatState.emit('socket:connected', null);
      
      // Re-authenticate on reconnect
      const user = this.chatState.getCurrentUser();
      if (user) {
        this.authenticate(user.userId || user.id, user.name || user.email);
      }
    });

    this.socket.on('disconnect', reason => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;
      this.chatState.emit('socket:disconnected', reason);
    });

    this.socket.on('connect_error', error => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.chatState.emit('socket:error', { error: 'Max reconnection attempts reached' });
      }
    });

    // Authentication
    this.socket.on('auth:success', data => {
      console.log('Authenticated:', data);
      
      // Rejoin current conversation if any
      if (this.currentConversationId) {
        this.joinConversation(this.currentConversationId);
      }
    });

    this.socket.on('auth:error', data => {
      console.error('Authentication error:', data);
      this.chatState.emit('socket:auth-error', data);
    });

    // Chat v5 events
    this.socket.on('chat:v5:message', message => {
      this.handleNewMessage(message);
    });

    this.socket.on('chat:v5:message-updated', message => {
      this.handleMessageUpdate(message);
    });

    this.socket.on('chat:v5:message-deleted', data => {
      this.handleMessageDelete(data);
    });

    this.socket.on('chat:v5:reaction', message => {
      this.handleMessageUpdate(message);
    });

    this.socket.on('chat:v5:read-receipt', data => {
      this.handleReadReceipt(data);
    });

    this.socket.on('chat:v5:user-typing', data => {
      this.handleUserTyping(data);
    });

    this.socket.on('chat:v5:user-stopped-typing', data => {
      this.handleUserStoppedTyping(data);
    });

    // Presence events
    this.socket.on('presence:online', data => {
      if (data.userId) {
        this.chatState.setUserOnline(data.userId, true);
      }
    });

    this.socket.on('presence:offline', data => {
      if (data.userId) {
        this.chatState.setUserOnline(data.userId, false);
      }
    });
  }

  /**
   * Authenticate with the server
   */
  authenticate(userId, userName) {
    if (!this.socket || !this.connected) {
      console.warn('Cannot authenticate: socket not connected');
      return;
    }

    this.socket.emit('auth', { userId, userName });
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId) {
    if (!this.socket || !this.connected) {
      console.warn('Cannot join conversation: socket not connected');
      return;
    }

    // Leave previous conversation
    if (this.currentConversationId && this.currentConversationId !== conversationId) {
      this.leaveConversation(this.currentConversationId);
    }

    this.socket.emit('chat:v5:join-conversation', { conversationId });
    this.currentConversationId = conversationId;
    console.log('Joined conversation:', conversationId);
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId) {
    if (!this.socket || !this.connected) {
      return;
    }

    this.socket.emit('chat:v5:leave-conversation', { conversationId });
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
    console.log('Left conversation:', conversationId);
  }

  /**
   * Send typing indicator
   */
  sendTyping(conversationId) {
    if (!this.socket || !this.connected) {
      return;
    }

    const user = this.chatState.getCurrentUser();
    this.socket.emit('chat:v5:typing-start', {
      conversationId,
      userName: user?.name || user?.email || 'User',
    });
  }

  /**
   * Stop typing indicator
   */
  stopTyping(conversationId) {
    if (!this.socket || !this.connected) {
      return;
    }

    this.socket.emit('chat:v5:typing-stop', { conversationId });
  }

  /**
   * Handle incoming message
   */
  handleNewMessage(message) {
    const conversationId = message.conversationId;
    
    // Add message to state
    this.chatState.addMessage(conversationId, message);
    
    // Update conversation's last message
    const conversation = this.chatState.getConversations().find(c => c._id === conversationId);
    if (conversation) {
      this.chatState.updateConversation(conversationId, {
        lastMessage: {
          content: message.content,
          senderId: message.senderId,
          senderName: message.senderName,
          sentAt: message.createdAt,
          type: message.type,
        },
        updatedAt: message.createdAt,
      });
    }
  }

  /**
   * Handle message update
   */
  handleMessageUpdate(message) {
    this.chatState.updateMessage(message.conversationId, message._id, message);
  }

  /**
   * Handle message deletion
   */
  handleMessageDelete(data) {
    const { messageId } = data;
    // Find which conversation this message belongs to
    for (const [conversationId, messages] of this.chatState.state.messages.entries()) {
      const message = messages.find(m => m._id === messageId);
      if (message) {
        this.chatState.updateMessage(conversationId, messageId, {
          content: '[deleted]',
          deletedAt: new Date(),
        });
        break;
      }
    }
  }

  /**
   * Handle read receipt
   */
  handleReadReceipt(data) {
    const { conversationId, userId, readAt } = data;
    
    // Update conversation unread count
    const conversation = this.chatState.getConversations().find(c => c._id === conversationId);
    if (conversation) {
      const currentUser = this.chatState.getCurrentUser();
      const currentUserId = currentUser?.userId || currentUser?.id;
      
      if (userId === currentUserId) {
        this.chatState.updateConversation(conversationId, {
          'participants.$[elem].unreadCount': 0,
          'participants.$[elem].lastReadAt': readAt,
        });
      }
    }
  }

  /**
   * Handle user typing
   */
  handleUserTyping(data) {
    const { conversationId, userId, userName } = data;
    const currentUser = this.chatState.getCurrentUser();
    const currentUserId = currentUser?.userId || currentUser?.id;
    
    // Don't show typing indicator for current user
    if (userId !== currentUserId) {
      this.chatState.addTypingUser(conversationId, userId, userName);
    }
  }

  /**
   * Handle user stopped typing
   */
  handleUserStoppedTyping(data) {
    const { conversationId, userId } = data;
    this.chatState.removeTypingUser(conversationId, userId);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentConversationId = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatSocket;
}
