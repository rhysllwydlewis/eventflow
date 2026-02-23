/**
 * Messenger App - Main Orchestrator
 * Initializes and coordinates all messenger components
 */

'use strict';

class MessengerApp {
  constructor() {
    this.api = new MessengerAPI();
    this.state = new MessengerState();
    this.socket = new MessengerSocket(this.state);
    this.currentUser = null;

    // Components (will be initialized after DOM ready)
    this.conversationList = null;
    this.conversationView = null;
    this.contactPicker = null;
  }

  /**
   * Initialize the app
   */
  async init() {
    try {
      // Load current user
      await this.loadCurrentUser();

      if (!this.currentUser) {
        window.location.href = '/auth';
        return;
      }

      this.state.setCurrentUser(this.currentUser);

      // Initialize WebSocket
      this.socket.connect(this.currentUser.id);

      // Setup event listeners
      this.setupEventListeners();

      // Initialize components
      this.initializeComponents();

      // Handle deep links (e.g., /messenger/?conversation=xxx)
      this.handleDeepLink();

      // Load initial data
      await this.loadConversations();
      await this.loadUnreadCount();

      // Load conversation from URL if specified
      const urlParams = new URLSearchParams(window.location.search);
      const conversationId = urlParams.get('conversation');
      if (conversationId) {
        this.handleConversationSelect(conversationId);
      }
    } catch (error) {
      console.error('Failed to initialize messenger:', error);
      this.showError('Failed to load messenger. Please refresh the page.');
    }
  }

  /**
   * Initialize UI components
   */
  initializeComponents() {
    // Initialize ConversationList
    const conversationListContainer = document.querySelector('#conversationList');
    if (conversationListContainer && window.ConversationList) {
      this.conversationList = new ConversationList(conversationListContainer, this.state, this.api);
    }

    // Initialize ConversationView
    const conversationViewContainer = document.querySelector('#conversationView');
    if (conversationViewContainer && window.ConversationView) {
      this.conversationView = new ConversationView(conversationViewContainer, this.state, this.api);
      this.conversationView.setCurrentUser(this.currentUser);
    }

    // Initialize MessageComposer
    const composerContainer = document.querySelector('.messenger-composer');
    if (composerContainer && window.MessageComposer) {
      this.messageComposer = new MessageComposer(
        composerContainer,
        this.state,
        this.api,
        this.socket
      );
    }

    // Initialize ContactPicker
    const contactPickerModal = document.querySelector('#contactPickerModal');
    if (contactPickerModal && window.ContactPicker) {
      this.contactPicker = new ContactPicker(contactPickerModal, this.state, this.api);
    }

    // Initialize NotificationBridge
    if (window.NotificationBridge) {
      this.notificationBridge = new NotificationBridge(this.state);
    }
  }

  /**
   * Load current user from auth state
   */
  async loadCurrentUser() {
    try {
      // Check if AuthStateManager is available (from auth-state.js)
      if (window.AuthStateManager && typeof window.AuthStateManager.getUser === 'function') {
        const user = window.AuthStateManager.getUser();
        if (user) {
          this.currentUser = user;
          return;
        }
      }

      // Fallback: try v4 API first
      try {
        const response = await fetch('/api/v4/users/me', {
          credentials: 'include',
        });

        if (response.ok) {
          this.currentUser = await response.json();
          return;
        }
      } catch (v4Error) {
        // v4 endpoint might not exist, continue to v1 fallback
      }

      // Final fallback: v1 API (for backward compatibility)
      const response = await fetch('/api/v1/me', {
        credentials: 'include',
      });

      if (response.ok) {
        this.currentUser = await response.json();
      }
    } catch (error) {
      console.error('Failed to load current user:', error);
    }
  }

  /**
   * Load conversations
   */
  async loadConversations() {
    try {
      const response = await this.api.getConversations({
        status: 'active',
      });

      this.state.setConversations(response.conversations || []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      this.showError('Failed to load conversations');
    }
  }

  /**
   * Load unread count
   */
  async loadUnreadCount() {
    try {
      const response = await this.api.getUnreadCount();
      this.state.setUnreadCount(response.count || 0);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // WebSocket events
    window.addEventListener('messenger:new-message', e => {
      const { conversationId } = e.detail;

      // Reload messages if this is the active conversation
      if (this.state.activeConversationId === conversationId) {
        this.loadMessages(conversationId);
      }

      // Reload conversation list to update preview
      this.loadConversations();
      this.loadUnreadCount();
    });

    window.addEventListener('messenger:new-conversation', () => {
      this.loadConversations();
    });

    // State change events
    this.state.on('activeConversationChanged', conversationId => {
      if (conversationId) {
        this.loadMessages(conversationId);
        this.socket.joinConversation(conversationId);

        // Mark as read
        this.api.markAsRead(conversationId).catch(error => {
          console.error('Failed to mark conversation as read:', error);
        });

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('conversation', conversationId);
        window.history.pushState({}, '', url);
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.handleDeepLink();
    });

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        this.logout();
      });
    }
  }

  /**
   * Load messages for a conversation
   */
  async loadMessages(conversationId) {
    try {
      const response = await this.api.getMessages(conversationId);
      this.state.setMessages(conversationId, response.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
      this.showError('Failed to load messages');
    }
  }

  /**
   * Send a message
   */
  async sendMessage(conversationId, content, attachments = [], replyToId = null) {
    try {
      const response = await this.api.sendMessage(conversationId, content, attachments, replyToId);

      // Add message to state
      this.state.addMessage(conversationId, response.message);

      // Notify via WebSocket
      this.socket.notifyNewMessage(conversationId);

      // Update conversation list
      this.loadConversations();

      return response.message;
    } catch (error) {
      console.error('Failed to send message:', error);
      this.showError('Failed to send message');
      throw error;
    }
  }

  /**
   * Handle deep link from URL
   */
  handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get('conversation');
    const newConversation = params.get('new');

    if (conversationId) {
      this.state.setActiveConversation(conversationId);
    } else if (newConversation) {
      // Open contact picker
      if (this.contactPicker) {
        this.contactPicker.open();
      }
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'messenger-toast messenger-toast--error';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      background: rgba(239, 68, 68, 0.95);
      color: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'messenger-toast messenger-toast--success';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 16px 24px;
      background: rgba(16, 185, 129, 0.95);
      color: white;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideUp 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Logout
   */
  async logout() {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      this.socket.disconnect();
      this.state.clear();
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.messengerApp = new MessengerApp();
    window.messengerApp.init();
  });
} else {
  window.messengerApp = new MessengerApp();
  window.messengerApp.init();
}
