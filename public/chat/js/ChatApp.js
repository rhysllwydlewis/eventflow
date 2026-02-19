'use strict';

/**
 * ChatApp - Main application controller
 * Initializes and wires together all chat components
 */
class ChatApp {
  constructor() {
    this.chatAPI = null;
    this.chatState = null;
    this.chatSocket = null;
    this.conversationList = null;
    this.chatView = null;
    this.contactPicker = null;
    this.currentUser = null;
    this.isMobile = window.innerWidth <= 768;
    this.isInitialized = false;

    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Show loading state
      this.showLoadingState();

      // Get current user
      await this.loadCurrentUser();

      // Initialize core services
      this.initializeServices();

      // Initialize UI components
      this.initializeComponents();

      // Setup event handlers
      this.setupEventHandlers();

      // Load initial data
      await this.loadInitialData();

      // Connect WebSocket
      this.connectWebSocket();

      // Handle routing
      this.handleRouting();

      // Setup responsive behavior
      this.setupResponsive();

      this.isInitialized = true;
      this.hideLoadingState();

    } catch (error) {
      console.error('Failed to initialize chat app:', error);
      this.showError('Failed to initialize chat. Please refresh the page.');
    }
  }

  /**
   * Get current user from cookie or API
   */
  async loadCurrentUser() {
    try {
      // Try to get user from cookie first
      const userCookie = this.getCookie('user');
      if (userCookie) {
        try {
          this.currentUser = JSON.parse(decodeURIComponent(userCookie));
          return;
        } catch (e) {
          console.warn('Failed to parse user cookie');
        }
      }

      // Fall back to API
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Not authenticated');
      }

      this.currentUser = await response.json();

    } catch (error) {
      console.error('Failed to load current user:', error);
      // Redirect to login
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      throw error;
    }
  }

  /**
   * Get cookie value
   * @param {string} name
   * @returns {string|null}
   */
  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  /**
   * Initialize core services
   */
  initializeServices() {
    this.chatAPI = new ChatAPI();
    this.chatState = new ChatState();
    // Set current user after creating state
    if (this.currentUser) {
      this.chatState.setCurrentUser(this.currentUser);
    }
    this.chatSocket = new ChatSocket(this.chatState);
  }

  /**
   * Initialize UI components
   */
  initializeComponents() {
    const conversationListContainer = document.getElementById('conversationList');
    const chatViewContainer = document.getElementById('chatView');

    if (!conversationListContainer || !chatViewContainer) {
      throw new Error('Required DOM elements not found');
    }

    // Initialize components
    this.conversationList = new ConversationList(conversationListContainer, this.chatState);
    this.chatView = new ChatView(chatViewContainer, this.chatState, this.chatAPI, this.chatSocket);
    this.contactPicker = new ContactPicker(this.chatState, this.chatAPI);
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;
        this.chatState.setFilter(filter);
      });
    });

    // Search input
    const searchInput = document.getElementById('conversationSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.chatState.setSearchQuery(e.target.value);
      });
    }

    // New conversation button
    const newConversationBtn = document.getElementById('newConversationBtn');
    if (newConversationBtn) {
      newConversationBtn.addEventListener('click', () => {
        this.contactPicker.open();
      });
    }

    // Mobile back button
    const backButton = document.querySelector('.chat-header-back');
    if (backButton) {
      backButton.addEventListener('click', () => {
        this.showSidebar();
      });
    }

    // WebSocket events
    this.chatSocket.on('message:new', (message) => {
      this.handleNewMessage(message);
    });

    this.chatSocket.on('message:read', (data) => {
      this.handleMessageRead(data);
    });

    this.chatSocket.on('typing', (data) => {
      this.chatState.updateTyping(data.conversationId, data.userId, data.isTyping);
    });

    this.chatSocket.on('user:online', (data) => {
      this.chatState.updateUserOnlineStatus(data.userId, true);
    });

    this.chatSocket.on('user:offline', (data) => {
      this.chatState.updateUserOnlineStatus(data.userId, false);
    });

    this.chatSocket.on('connected', () => {
      this.updateConnectionStatus(true);
    });

    this.chatSocket.on('disconnected', () => {
      this.updateConnectionStatus(false);
    });

    this.chatSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.showError('Connection error. Reconnecting...');
    });

    // Listen for active conversation changes
    this.chatState.on('conversation:active', (conversationId) => {
      if (conversationId) {
        this.updateURL(conversationId);
        if (this.isMobile) {
          this.showChatView();
        }
      }
    });
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    try {
      this.conversationList.showLoading();
      
      const conversations = await this.chatAPI.getConversations();
      this.chatState.setConversations(conversations);
      
      this.conversationList.hideLoading();
      
    } catch (error) {
      console.error('Failed to load conversations:', error);
      this.conversationList.hideLoading();
      this.showError('Failed to load conversations');
    }
  }

  /**
   * Connect to WebSocket
   */
  connectWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
    
    this.chatSocket.connect(wsUrl, {
      userId: this.currentUser.id,
      token: this.getCookie('token') || ''
    });
  }

  /**
   * Handle routing (deep links)
   */
  handleRouting() {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    
    if (conversationId) {
      this.chatState.setActiveConversation(conversationId);
    }
  }

  /**
   * Update URL with conversation ID
   * @param {string} conversationId
   */
  updateURL(conversationId) {
    const url = new URL(window.location);
    url.searchParams.set('conversation', conversationId);
    window.history.pushState({}, '', url);
  }

  /**
   * Setup responsive behavior
   */
  setupResponsive() {
    const handleResize = () => {
      const wasMobile = this.isMobile;
      this.isMobile = window.innerWidth <= 768;
      
      // If switching from mobile to desktop, show both panels
      if (wasMobile && !this.isMobile) {
        this.showBothPanels();
      }
    };

    window.addEventListener('resize', handleResize);
  }

  /**
   * Show sidebar (mobile)
   */
  showSidebar() {
    const sidebar = document.querySelector('.chat-sidebar');
    const chatContainer = document.querySelector('.chat-container');
    
    if (sidebar) sidebar.classList.remove('hidden');
    if (chatContainer) chatContainer.classList.add('hidden');
  }

  /**
   * Show chat view (mobile)
   */
  showChatView() {
    const sidebar = document.querySelector('.chat-sidebar');
    const chatContainer = document.querySelector('.chat-container');
    
    if (sidebar) sidebar.classList.add('hidden');
    if (chatContainer) chatContainer.classList.remove('hidden');
  }

  /**
   * Show both panels (desktop)
   */
  showBothPanels() {
    const sidebar = document.querySelector('.chat-sidebar');
    const chatContainer = document.querySelector('.chat-container');
    
    if (sidebar) sidebar.classList.remove('hidden');
    if (chatContainer) chatContainer.classList.remove('hidden');
  }

  /**
   * Handle new message from WebSocket
   * @param {Object} message
   */
  handleNewMessage(message) {
    // Add message to state
    const conversation = this.chatState.getConversation(message.conversationId);
    if (conversation) {
      const messages = this.chatState.getMessages(message.conversationId) || [];
      messages.push(message);
      this.chatState.updateMessages(message.conversationId, messages);
      
      // Update conversation last message
      this.chatState.updateConversationLastMessage(message.conversationId, message);
      
      // If not the active conversation, increment unread count
      if (message.conversationId !== this.chatState.activeConversationId && 
          message.senderId !== this.currentUser.id) {
        this.chatState.incrementUnreadCount(message.conversationId);
        
        // Play notification sound or show notification
        this.showNotification(conversation.name, message.content);
      }
      
      // If active conversation, mark as read
      if (message.conversationId === this.chatState.activeConversationId) {
        this.chatAPI.markAsRead(message.conversationId).catch(err => {
          console.error('Failed to mark as read:', err);
        });
      }
    }
  }

  /**
   * Handle message read status update
   * @param {Object} data
   */
  handleMessageRead(data) {
    const messages = this.chatState.getMessages(data.conversationId);
    if (messages) {
      messages.forEach(msg => {
        if (msg.id === data.messageId) {
          msg.read = true;
        }
      });
      this.chatState.updateMessages(data.conversationId, messages);
    }
  }

  /**
   * Update connection status indicator
   * @param {boolean} isConnected
   */
  updateConnectionStatus(isConnected) {
    let statusIndicator = document.getElementById('connectionStatus');
    
    if (!statusIndicator) {
      statusIndicator = document.createElement('div');
      statusIndicator.id = 'connectionStatus';
      statusIndicator.className = 'connection-status';
      document.body.appendChild(statusIndicator);
    }

    if (isConnected) {
      statusIndicator.textContent = 'Connected';
      statusIndicator.className = 'connection-status connected';
      setTimeout(() => {
        statusIndicator.style.display = 'none';
      }, 2000);
    } else {
      statusIndicator.textContent = 'Disconnected';
      statusIndicator.className = 'connection-status disconnected';
      statusIndicator.style.display = 'block';
    }
  }

  /**
   * Show notification
   * @param {string} title
   * @param {string} body
   */
  showNotification(title, body) {
    // Check if notifications are supported and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/images/logo.png',
        badge: '/images/badge.png',
        tag: 'chat-message'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Request permission
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body: body,
            icon: '/images/logo.png'
          });
        }
      });
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'appLoading';
    loadingOverlay.className = 'app-loading';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading chat...</div>
    `;
    document.body.appendChild(loadingOverlay);
  }

  /**
   * Hide loading state
   */
  hideLoadingState() {
    const loadingOverlay = document.getElementById('appLoading');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    let errorToast = document.getElementById('errorToast');
    
    if (!errorToast) {
      errorToast = document.createElement('div');
      errorToast.id = 'errorToast';
      errorToast.className = 'error-toast';
      document.body.appendChild(errorToast);
    }

    errorToast.textContent = message;
    errorToast.classList.add('show');

    setTimeout(() => {
      errorToast.classList.remove('show');
    }, 5000);
  }

  /**
   * Destroy the application
   */
  destroy() {
    if (this.chatSocket) {
      this.chatSocket.disconnect();
    }

    if (this.conversationList) {
      this.conversationList.destroy();
    }

    if (this.chatView) {
      this.chatView.destroy();
    }

    if (this.contactPicker) {
      this.contactPicker.destroy();
    }
  }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
  });
} else {
  window.chatApp = new ChatApp();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatApp;
}
