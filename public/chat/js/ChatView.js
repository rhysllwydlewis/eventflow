'use strict';

/**
 * ChatView Component
 * Renders the chat messages view and message input
 */
class ChatView {
  /**
   * @param {HTMLElement} container - Container element for the chat view
   * @param {ChatState} chatState - ChatState instance
   * @param {ChatAPI} chatAPI - ChatAPI instance
   * @param {ChatSocket} chatSocket - ChatSocket instance
   */
  constructor(container, chatState, chatAPI, chatSocket) {
    this.container = container;
    this.chatState = chatState;
    this.chatAPI = chatAPI;
    this.chatSocket = chatSocket;
    this.messages = [];
    this.activeConversation = null;
    this.isTyping = false;
    this.typingUsers = new Set();
    this.isLoadingMore = false;
    this.hasMore = true;
    this.isAtBottom = true;
    this.maxChars = 5000;

    this.messagesContainer = null;
    this.messageInput = null;
    this.sendButton = null;
    this.charCounter = null;
    this.scrollToBottomBtn = null;
    this.typingIndicator = null;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.setupDOM();
    this.bindEvents();
  }

  /**
   * Setup DOM references
   */
  setupDOM() {
    this.messagesContainer = this.container.querySelector('.chat-messages');
    this.messageInput = this.container.querySelector('#messageInput');
    this.sendButton = this.container.querySelector('#sendButton');
    this.charCounter = this.container.querySelector('.char-counter');
    this.scrollToBottomBtn = this.container.querySelector('.scroll-to-bottom');
    this.typingIndicator = this.container.querySelector('.typing-indicator');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // ChatState events
    this.chatState.on('messages:updated', (data) => {
      const activeId = this.activeConversation?._id || this.activeConversation?.id;
      if (data.conversationId === activeId) {
        this.messages = data.messages;
        this.renderMessages();
        if (this.isAtBottom) {
          this.scrollToBottom();
        }
      }
    });

    this.chatState.on('conversation:active', (conversationId) => {
      this.loadConversation(conversationId);
    });

    this.chatState.on('typing:updated', (data) => {
      if (data.conversationId === this.activeConversation?.id) {
        if (data.isTyping) {
          this.typingUsers.add(data.userId);
        } else {
          this.typingUsers.delete(data.userId);
        }
        this.updateTypingIndicator();
      }
    });

    // Message input events
    if (this.messageInput) {
      this.messageInput.addEventListener('input', () => this.handleInput());
      this.messageInput.addEventListener('keydown', (e) => this.handleKeydown(e));
      
      // Typing indicator
      let typingTimeout;
      this.messageInput.addEventListener('input', () => {
        if (this.activeConversation && this.messageInput.value.trim()) {
          this.chatSocket.sendTyping(this.activeConversation.id, true);
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => {
            this.chatSocket.sendTyping(this.activeConversation.id, false);
          }, 3000);
        }
      });
    }

    // Send button
    if (this.sendButton) {
      this.sendButton.addEventListener('click', () => this.sendMessage());
    }

    // Scroll events
    if (this.messagesContainer) {
      this.messagesContainer.addEventListener('scroll', () => this.handleScroll());
    }

    // Scroll to bottom button
    if (this.scrollToBottomBtn) {
      this.scrollToBottomBtn.addEventListener('click', () => this.scrollToBottom(true));
    }
  }

  /**
   * Load a conversation
   * @param {string} conversationId
   */
  async loadConversation(conversationId) {
    if (!conversationId) {
      this.activeConversation = null;
      this.messages = [];
      this.renderEmptyState();
      return;
    }

    try {
      const conversation = this.chatState.getConversation(conversationId);
      this.activeConversation = conversation;
      this.hasMore = true;
      
      // Load messages
      const messages = await this.chatAPI.getMessages(conversationId);
      this.messages = messages;
      this.chatState.updateMessages(conversationId, messages);
      
      this.renderMessages();
      this.scrollToBottom();
      
      // Mark as read
      if (conversation && conversation.unreadCount > 0) {
        await this.chatAPI.markAsRead(conversationId);
        this.chatState.markAsRead(conversationId);
      }

      // Update header
      this.updateHeader();
      
    } catch (error) {
      console.error('Failed to load conversation:', error);
      this.showError('Failed to load messages');
    }
  }

  /**
   * Update conversation header
   */
  updateHeader() {
    const header = this.container.querySelector('.chat-header-info');
    if (!header || !this.activeConversation) return;

    const name = this.escapeHtml(this.activeConversation.name);
    const status = this.activeConversation.online ? 'Online' : 'Offline';
    const statusClass = this.activeConversation.online ? 'online' : 'offline';

    header.innerHTML = `
      <h2 class="chat-header-name">${name}</h2>
      <p class="chat-header-status ${statusClass}">${status}</p>
    `;
  }

  /**
   * Handle message input
   */
  handleInput() {
    if (!this.messageInput) return;

    const value = this.messageInput.value;
    const length = value.length;

    // Auto-expand textarea
    this.messageInput.style.height = 'auto';
    const newHeight = Math.min(this.messageInput.scrollHeight, 120);
    this.messageInput.style.height = newHeight + 'px';

    // Update character counter
    if (this.charCounter) {
      this.charCounter.textContent = `${length}/${this.maxChars}`;
      if (length > this.maxChars) {
        this.charCounter.classList.add('error');
      } else {
        this.charCounter.classList.remove('error');
      }
    }

    // Enable/disable send button
    if (this.sendButton) {
      const canSend = value.trim().length > 0 && length <= this.maxChars;
      this.sendButton.disabled = !canSend;
    }
  }

  /**
   * Handle keydown events
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  /**
   * Send a message
   */
  async sendMessage() {
    if (!this.messageInput || !this.activeConversation) return;

    const content = this.messageInput.value.trim();
    if (!content || content.length > this.maxChars) return;

    const currentUser = this.chatState.getCurrentUser();
    const userId = currentUser?.userId || currentUser?.id;
    
    const tempId = 'temp_' + Date.now();
    const tempMessage = {
      id: tempId,
      conversationId: this.activeConversation._id || this.activeConversation.id,
      senderId: userId,
      content: content,
      timestamp: new Date().toISOString(),
      status: 'sending'
    };

    // Add to UI immediately
    this.messages.push(tempMessage);
    this.renderMessages();
    this.scrollToBottom();

    // Clear input
    this.messageInput.value = '';
    this.handleInput();

    // Stop typing indicator
    this.chatSocket.stopTyping(this.activeConversation._id || this.activeConversation.id);

    try {
      const conversationId = this.activeConversation._id || this.activeConversation.id;
      
      // Send via API
      const result = await this.chatAPI.sendMessage(conversationId, {
        content,
        type: 'text',
      });
      
      const message = result.message;
      
      // Replace temp message with real one
      const index = this.messages.findIndex(m => m.id === tempId);
      if (index !== -1) {
        this.messages[index] = message;
        this.chatState.setMessages(conversationId, this.messages);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Mark message as failed
      const index = this.messages.findIndex(m => m.id === tempId);
      if (index !== -1) {
        this.messages[index].status = 'failed';
        this.renderMessages();
      }
      
      this.showError('Failed to send message');
    }
  }

  /**
   * Handle scroll events
   */
  handleScroll() {
    if (!this.messagesContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = this.messagesContainer;
    
    // Check if at bottom
    this.isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // Toggle scroll to bottom button
    if (this.scrollToBottomBtn) {
      this.scrollToBottomBtn.style.display = this.isAtBottom ? 'none' : 'flex';
    }

    // Load more messages when scrolling to top
    if (scrollTop < 100 && !this.isLoadingMore && this.hasMore) {
      this.loadMoreMessages();
    }
  }

  /**
   * Load more messages (infinite scroll)
   */
  async loadMoreMessages() {
    if (!this.activeConversation || this.isLoadingMore || !this.hasMore) return;

    this.isLoadingMore = true;
    const oldScrollHeight = this.messagesContainer.scrollHeight;

    try {
      const oldestMessage = this.messages[0];
      const before = oldestMessage ? oldestMessage.timestamp : null;
      
      const olderMessages = await this.chatAPI.getMessages(this.activeConversation.id, { before, limit: 20 });
      
      if (olderMessages.length === 0) {
        this.hasMore = false;
      } else {
        this.messages = [...olderMessages, ...this.messages];
        this.renderMessages();
        
        // Restore scroll position
        const newScrollHeight = this.messagesContainer.scrollHeight;
        this.messagesContainer.scrollTop = newScrollHeight - oldScrollHeight;
      }
      
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      this.isLoadingMore = false;
    }
  }

  /**
   * Scroll to bottom
   * @param {boolean} smooth - Use smooth scrolling
   */
  scrollToBottom(smooth = false) {
    if (!this.messagesContainer) return;
    
    const behavior = smooth ? 'smooth' : 'auto';
    this.messagesContainer.scrollTo({
      top: this.messagesContainer.scrollHeight,
      behavior: behavior
    });
    this.isAtBottom = true;
  }

  /**
   * Update typing indicator
   */
  updateTypingIndicator() {
    if (!this.typingIndicator) return;

    if (this.typingUsers.size > 0) {
      this.typingIndicator.style.display = 'flex';
    } else {
      this.typingIndicator.style.display = 'none';
    }
  }

  /**
   * Group messages by date
   * @param {Array} messages
   * @returns {Array}
   */
  groupMessagesByDate(messages) {
    const groups = [];
    let currentDate = null;

    messages.forEach(message => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          type: 'date',
          date: message.timestamp
        });
      }
      
      groups.push({
        type: 'message',
        data: message
      });
    });

    return groups;
  }

  /**
   * Format date divider
   * @param {string|Date} date
   * @returns {string}
   */
  formatDateDivider(date) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }
  }

  /**
   * Format message time
   * @param {string|Date} timestamp
   * @returns {string}
   */
  formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Render a date divider
   * @param {string|Date} date
   * @returns {string}
   */
  renderDateDivider(date) {
    return `
      <div class="date-divider">
        <span>${this.formatDateDivider(date)}</span>
      </div>
    `;
  }

  /**
   * Render a message bubble
   * @param {Object} message
   * @returns {string}
   */
  renderMessage(message) {
    const isSent = message.senderId === this.chatState.currentUser?.id;
    const statusIcon = message.status === 'sending' ? '🕐' : 
                       message.status === 'failed' ? '❌' : 
                       message.read ? '✓✓' : '✓';
    
    return `
      <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${message.id}">
        <div class="message-bubble">
          <div class="message-content">${this.escapeHtml(message.content)}</div>
          <div class="message-meta">
            <span class="message-time">${this.formatMessageTime(message.timestamp)}</span>
            ${isSent ? `<span class="message-status">${statusIcon}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    if (!this.messagesContainer) return;

    this.messagesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-text">Select a conversation to start messaging</div>
      </div>
    `;

    // Disable input
    if (this.messageInput) this.messageInput.disabled = true;
    if (this.sendButton) this.sendButton.disabled = true;
  }

  /**
   * Render messages
   */
  renderMessages() {
    if (!this.messagesContainer) return;

    if (!this.activeConversation) {
      this.renderEmptyState();
      return;
    }

    // Enable input
    if (this.messageInput) this.messageInput.disabled = false;

    const grouped = this.groupMessagesByDate(this.messages);
    
    const html = grouped.map(item => {
      if (item.type === 'date') {
        return this.renderDateDivider(item.date);
      } else {
        return this.renderMessage(item.data);
      }
    }).join('');

    this.messagesContainer.innerHTML = html;
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    // You can implement a toast notification here
    console.error(message);
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.chatState.off('messages:updated');
    this.chatState.off('conversation:active');
    this.chatState.off('typing:updated');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatView;
}
