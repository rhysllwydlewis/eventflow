/**
 * Messaging System for EventFlow
 * Handles conversations between customers and suppliers
 * Uses MongoDB API exclusively
 *
 * NOTE: This module has been migrated from Firebase to MongoDB.
 * All operations now use the EventFlow REST API backed by MongoDB.
 */

// Check if running in development environment
const isDevelopment =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

/**
 * Get CSRF token from meta tag or cookie
 * @returns {string|null} CSRF token
 */
function getCsrfToken() {
  // Try meta tag first (if present)
  const meta = document.querySelector('meta[name="csrf-token"]');
  if (meta) {
    return meta.getAttribute('content');
  }
  
  // Fallback to cookie (primary method in EventFlow)
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    
    const name = trimmed.substring(0, eqIndex);
    const value = trimmed.substring(eqIndex + 1);
    
    // Check both cookie names (csrf is canonical, csrfToken is legacy)
    if (name === 'csrf' || name === 'csrfToken') {
      try {
        const token = decodeURIComponent(value || '');
        if (token) return token;
      } catch (e) {
        // Skip malformed cookie value
        console.warn('Malformed CSRF cookie value:', e);
        continue;
      }
    }
  }
  
  // Fallback to global variables if set by csrf-handler.js
  if (window.__CSRF_TOKEN__) return window.__CSRF_TOKEN__;
  if (window.csrfToken) return window.csrfToken;
  
  return null;
}

/**
 * Retry helper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Result of successful attempt
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error, response) => {
      // Retry on network errors or 5xx errors
      if (!response) return true;
      if (response.retriable === true) return true;
      if (response.status >= 500) return true;
      if (response.status === 408 || response.status === 429 || response.status === 504) return true;
      return false;
    }
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      return result;
    } catch (error) {
      lastError = error;
      
      // Parse error response if available
      const errorResponse = error.response || error.data || {};
      
      // Don't retry if explicitly marked as non-retriable
      if (errorResponse.retriable === false) {
        throw error;
      }
      
      // Check if we should retry
      if (attempt < maxAttempts && shouldRetry(error, errorResponse)) {
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
        const jitter = Math.random() * 0.3 * delay; // Add up to 30% jitter
        const actualDelay = delay + jitter;
        
        if (isDevelopment) {
          console.log(`Retry attempt ${attempt}/${maxAttempts} after ${Math.round(actualDelay)}ms`);
        }
        
        await new Promise(resolve => setTimeout(resolve, actualDelay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

class MessagingSystem {
  constructor() {
    this.pollingIntervals = [];
    this.apiBase = '/api';
    this.badgeElement = null;
    this.lastUnreadCount = -1; // Initialize to -1 so first update (even 0) triggers animation
    this._pollingNotificationShown = false; // Track if we've shown the polling notification
    this._unreadErrorLogged = false; // Track if we've logged unread count errors
    this.socket = null;
    this.isConnected = false;
    this.activeConversations = new Set(); // Track active conversation subscriptions
    this.conversationCallbacks = new Map(); // conversationId -> callback
    this.messageCallbacks = new Map(); // conversationId -> callback
    this.typingTimeouts = new Map(); // conversationId -> timeoutId
    this._socketInitialized = false;
    this._hasDisconnected = false; // Track if we've ever disconnected (to show reconnect toast)
    this._typingDebounceTimers = new Map(); // Debounce typing status sends
    
    // Conversation list cache (Issue #16 - State persistence)
    this.conversationListCache = null;
    this.conversationListCacheTime = 0;
    this.CACHE_TTL = 30000; // Cache for 30 seconds
  }

  /**
   * Initialize WebSocket connection
   */
  initWebSocket() {
    if (this._socketInitialized) {
      return;
    }

    // Load Socket.IO from CDN if not already loaded
    if (!window.io) {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
      script.onload = () => {
        this.connectWebSocket();
      };
      script.onerror = () => {
        console.error('Failed to load Socket.IO - falling back to polling');
        if (typeof EFToast !== 'undefined') {
          EFToast.warning('Real-time messaging unavailable, using polling mode');
        }
      };
      document.head.appendChild(script);
    } else {
      this.connectWebSocket();
    }

    this._socketInitialized = true;
  }

  /**
   * Connect to WebSocket server
   */
  connectWebSocket() {
    if (!window.io) {
      console.error('Socket.IO not available');
      return;
    }

    // Connect to WebSocket server
    this.socket = window.io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      if (isDevelopment) {
        console.log('Messaging WebSocket connected');
      }

      // Emit connection status event
      this.emitConnectionStatus('online');

      // Re-subscribe to active conversations
      this.activeConversations.forEach(conversationId => {
        this.socket.emit('subscribe_conversation', { conversationId });
      });

      // Stop polling since we're connected
      this.stopFallbackPolling();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this._hasDisconnected = true; // Mark that we've disconnected
      if (isDevelopment) {
        console.log('Messaging WebSocket disconnected');
      }

      // Emit connection status event
      this.emitConnectionStatus('offline');

      // Start fallback polling with reduced frequency
      this.startFallbackPolling();
    });

    this.socket.on('connect_error', error => {
      console.error('WebSocket connection error:', error);
      if (typeof EFToast !== 'undefined') {
        EFToast.error('Connection error - using polling mode', { duration: 3000 });
      }
    });

    // Listen for new messages
    this.socket.on('new_message', data => {
      this.handleNewMessage(data);
    });

    // Listen for conversation updates
    this.socket.on('conversation:updated', data => {
      this.handleConversationUpdate(data);
    });

    // Listen for typing status
    this.socket.on('typing:status', data => {
      this.handleTypingStatus(data);
    });

    // Listen for read receipts
    this.socket.on('message:read', data => {
      this.handleMessageRead(data);
    });

    // Authenticate with user if available
    const user = this.getUserFromStorage();
    if (user && user.id) {
      this.socket.emit('auth', { userId: user.id });
    }
  }

  /**
   * Get user from storage
   */
  getUserFromStorage() {
    const authState = window.__authState || window.AuthStateManager;
    if (authState && typeof authState.getUser === 'function') {
      return authState.getUser();
    }
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  /**
   * Emit connection status as custom DOM event
   */
  emitConnectionStatus(status) {
    const event = new CustomEvent('messaging:connection', {
      detail: { status, timestamp: new Date() },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle new message from WebSocket
   */
  handleNewMessage(data) {
    const { conversationId, message, senderName } = data;

    // Call the message callback if registered
    const callback = this.messageCallbacks.get(conversationId);
    if (callback) {
      // Fetch fresh messages to ensure consistency
      this.fetchMessagesFromAPI(conversationId, callback);
    }

    // Trigger conversation list update
    const conversationCallback = this.conversationCallbacks.get('all');
    if (conversationCallback) {
      const user = this.getUserFromStorage();
      if (user) {
        this.fetchConversationsFromAPI(user.id, user.type || 'customer', conversationCallback);
      }
    }

    // Trigger notification system integration
    this.triggerMessageNotification({
      conversationId,
      senderName: senderName || 'Someone',
      messagePreview: message?.content?.substring(0, 100) || 'New message',
      timestamp: new Date(),
    });

    // Play notification sound if enabled (keep existing)
    if (typeof EFToast !== 'undefined') {
      EFToast.info('New message received', { duration: 3000 });
    }
  }

  /**
   * Trigger notification system for new messages
   * Integrates with notifications.js notification bell
   */
  triggerMessageNotification(data) {
    const { conversationId, senderName, messagePreview, timestamp } = data;

    // Dispatch custom event for notification system to catch
    const event = new CustomEvent('messaging:notification', {
      detail: {
        type: 'message',
        title: 'New Message',
        message: `${senderName}: ${messagePreview}`,
        actionUrl: `/messages.html?conversation=${conversationId}`,
        timestamp: timestamp,
        metadata: {
          conversationId,
          threadId: conversationId, // Include threadId for compatibility
          senderName,
          messagePreview,
        },
      },
    });
    window.dispatchEvent(event);

    // Also manually trigger notification system if available
    if (window.EventFlowNotifications) {
      window.EventFlowNotifications.info(`${senderName}: ${messagePreview}`, 5000);
    }
  }

  /**
   * Handle conversation update from WebSocket
   */
  handleConversationUpdate(_data) {
    // Refresh conversation list
    const callback = this.conversationCallbacks.get('all');
    if (callback) {
      const user = this.getUserFromStorage();
      if (user) {
        this.fetchConversationsFromAPI(user.id, user.type || 'customer', callback);
      }
    }
  }

  /**
   * Handle typing status from WebSocket
   */
  handleTypingStatus(data) {
    const { conversationId, userId, isTyping } = data;

    // Emit custom DOM event for UI to handle
    const event = new CustomEvent('messaging:typing', {
      detail: { conversationId, userId, isTyping },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle message read from WebSocket
   */
  handleMessageRead(data) {
    const { conversationId, messageId, userId } = data;

    // Emit custom DOM event for UI to handle
    const event = new CustomEvent('messaging:read', {
      detail: { conversationId, messageId, userId },
    });
    window.dispatchEvent(event);
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId) {
    this.activeConversations.add(conversationId);

    if (this.isConnected && this.socket) {
      this.socket.emit('subscribe_conversation', { conversationId });
      console.log('Joined conversation:', conversationId);
    }
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId) {
    this.activeConversations.delete(conversationId);

    if (this.isConnected && this.socket) {
      this.socket.emit('unsubscribe_conversation', { conversationId });
      console.log('Left conversation:', conversationId);
    }

    // Clean up callbacks
    this.messageCallbacks.delete(conversationId);

    // Clean up typing timeouts for this conversation
    const typingTimeout = this.typingTimeouts.get(conversationId);
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      this.typingTimeouts.delete(conversationId);
    }

    // Clean up debounce timers for this conversation
    for (const [key, timer] of this._typingDebounceTimers.entries()) {
      if (key.startsWith(conversationId)) {
        clearTimeout(timer);
        this._typingDebounceTimers.delete(key);
      }
    }
  }

  /**
   * Send typing status
   */
  sendTypingStatus(conversationId, isTyping) {
    if (this.isConnected && this.socket) {
      // Debounce typing status sends to reduce WebSocket traffic
      const debounceKey = `${conversationId}_${isTyping}`;

      // Clear existing debounce timer
      if (this._typingDebounceTimers.has(debounceKey)) {
        return; // Don't send if already sent recently
      }

      this.socket.emit('typing', { conversationId, isTyping });

      // Set debounce timer (1 second)
      const debounceTimer = setTimeout(() => {
        this._typingDebounceTimers.delete(debounceKey);
      }, 1000);
      this._typingDebounceTimers.set(debounceKey, debounceTimer);

      // Auto-stop typing after 3 seconds
      if (isTyping) {
        const existingTimeout = this.typingTimeouts.get(conversationId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          this.sendTypingStatus(conversationId, false);
          this.typingTimeouts.delete(conversationId);
        }, 3000);

        this.typingTimeouts.set(conversationId, timeout);
      } else {
        // Clear typing timeout when explicitly stopped
        const existingTimeout = this.typingTimeouts.get(conversationId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          this.typingTimeouts.delete(conversationId);
        }
      }
    }
  }

  /**
   * Start fallback polling with reduced frequency
   */
  startFallbackPolling() {
    // Only start if not already polling
    if (this.pollingIntervals.length > 0) {
      return; // Already polling
    }

    // Show notification about fallback mode (only once)
    if (!this._pollingNotificationShown && typeof EFToast !== 'undefined') {
      this._pollingNotificationShown = true;
      EFToast.info('Using fallback polling mode (30s intervals)', { duration: 4000 });
    }

    // Poll active conversations every 30 seconds (reduced load)
    const pollInterval = setInterval(() => {
      if (!this.isConnected) {
        // Refresh all active conversations
        this.activeConversations.forEach(conversationId => {
          const callback = this.messageCallbacks.get(conversationId);
          if (callback) {
            this.fetchMessagesFromAPI(conversationId, callback);
          }
        });

        // Refresh conversation list
        const conversationCallback = this.conversationCallbacks.get('all');
        if (conversationCallback) {
          const user = this.getUserFromStorage();
          if (user) {
            this.fetchConversationsFromAPI(user.id, user.type || 'customer', conversationCallback);
          }
        }
      }
    }, 30000); // Poll every 30 seconds instead of 3-5

    this.pollingIntervals.push(pollInterval);
  }

  /**
   * Stop fallback polling
   */
  stopFallbackPolling() {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals = [];
  }

  /**
   * Listen to user's conversations using polling
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUserConversations(userId, userType, callback) {
    // Initialize WebSocket if not already done
    this.initWebSocket();

    // Store callback for conversation updates
    this.conversationCallbacks.set('all', callback);

    // Initial fetch
    this.fetchConversationsFromAPI(userId, userType, callback);

    // If WebSocket is connected, rely on real-time updates
    // Otherwise, poll with reduced frequency (30s)
    if (!this.isConnected) {
      const pollInterval = setInterval(() => {
        if (!this.isConnected) {
          this.fetchConversationsFromAPI(userId, userType, callback);
        }
      }, 30000); // Poll every 30 seconds as fallback

      this.pollingIntervals.push(pollInterval);
    }

    // Return unsubscribe function
    return () => {
      this.conversationCallbacks.delete('all');
      this.pollingIntervals.forEach(interval => clearInterval(interval));
      this.pollingIntervals = [];
    };
  }

  /**
   * Listen to messages in a conversation using polling
   * @param {string} conversationId - Conversation ID
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToMessages(conversationId, callback) {
    // Initialize WebSocket if not already done
    this.initWebSocket();

    // Join the conversation room
    this.joinConversation(conversationId);

    // Store callback for this conversation
    this.messageCallbacks.set(conversationId, callback);

    // Initial fetch
    this.fetchMessagesFromAPI(conversationId, callback);

    // If WebSocket is not connected, poll with reduced frequency
    let pollInterval = null;
    if (!this.isConnected) {
      pollInterval = setInterval(() => {
        if (!this.isConnected) {
          this.fetchMessagesFromAPI(conversationId, callback);
        }
      }, 30000); // Poll every 30 seconds as fallback

      this.pollingIntervals.push(pollInterval);
    }

    // Return unsubscribe function
    return () => {
      this.leaveConversation(conversationId);
      if (pollInterval) {
        clearInterval(pollInterval);
        this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
      }
    };
  }

  /**
   * Send a message via MongoDB API
   * @param {string} conversationId - Conversation ID
   * @param {Object} messageData - Message data
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(conversationId, messageData) {
    try {
      const messageId = await this.sendMessageViaAPI(conversationId, messageData);

      // Also emit via WebSocket if connected for immediate delivery
      if (this.isConnected && this.socket) {
        this.socket.emit('message:send', {
          conversationId,
          messageData,
        });
      }

      return messageId;
    } catch (error) {
      // Show error toast
      if (typeof EFToast !== 'undefined') {
        EFToast.error('Failed to send message. Please try again.', { duration: 5000 });
      }
      throw error;
    }
  }

  /**
   * Mark messages as read via MongoDB API
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (not used by v2 API, kept for backward compatibility)
   * @returns {Promise<void>}
   */
  async markMessagesAsRead(conversationId, userId) {
    await this.markMessagesAsReadViaAPI(conversationId);

    // Also emit via WebSocket if connected for immediate read receipt
    if (this.isConnected && this.socket) {
      this.socket.emit('conversation:read', { conversationId });
    }

    // Notify notification system to mark related notifications as read
    window.dispatchEvent(
      new CustomEvent('messaging:marked-read', {
        detail: { conversationId },
      })
    );
  }

  /**
   * Listen to unread count
   * @param {string} userId - User ID
   * @param {string} userType - 'customer' | 'supplier'
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUnreadCount(userId, userType, callback) {
    // Initialize WebSocket if not already done
    this.initWebSocket();

    // Initial fetch
    this.fetchUnreadCountFromAPI(userId, userType, callback);

    // Listen for real-time unread count updates via conversation updates
    // Only fetch when connection comes back online
    const handleUpdate = event => {
      if (event.detail.status === 'online') {
        this.fetchUnreadCountFromAPI(userId, userType, callback);
      }
    };

    window.addEventListener('messaging:connection', handleUpdate);

    // Poll for updates every 30 seconds as fallback
    const pollInterval = setInterval(() => {
      this.fetchUnreadCountFromAPI(userId, userType, callback);
    }, 30000);

    this.pollingIntervals.push(pollInterval);

    // Return unsubscribe function
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('messaging:connection', handleUpdate);
      this.pollingIntervals = this.pollingIntervals.filter(i => i !== pollInterval);
    };
  }

  // MongoDB API fallback methods
  async fetchConversationsFromAPI(userId, userType, callback) {
    try {
      // Check cache first (Issue #16 - State persistence)
      const now = Date.now();
      if (this.conversationListCache && (now - this.conversationListCacheTime) < this.CACHE_TTL) {
        if (isDevelopment) {
          console.log('Using cached conversation list');
        }
        callback(this.conversationListCache);
        return;
      }

      // Use API utility for timeout and retry handling
      const data = await window.api.get(
        `/messages/conversations?userId=${userId}&userType=${userType}`
      );
      const conversations = data.conversations || [];
      
      // Update cache
      this.conversationListCache = conversations;
      this.conversationListCacheTime = now;
      
      callback(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      // On error, return cached data if available, otherwise empty array
      callback(this.conversationListCache || []);
    }
  }

  /**
   * Invalidate conversation list cache
   * Call this method after state-changing operations like sending messages or marking as read
   * to ensure the next fetch retrieves fresh data from the server
   * @returns {void}
   */
  invalidateConversationCache() {
    this.conversationListCache = null;
    this.conversationListCacheTime = 0;
  }

  async fetchMessagesFromAPI(conversationId, callback) {
    try {
      // Use API utility for timeout and retry handling
      const data = await window.api.get(`/v2/messages/${conversationId}`);
      callback(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      callback([]);
    }
  }

  async sendMessageViaAPI(conversationId, messageData) {
    try {
      // Transform messageData to match v2 API expectations
      // v2 API expects 'content' field, but maintain backward compatibility with 'message'
      const payload = { ...messageData };
      if (payload.message && !payload.content) {
        payload.content = payload.message;
        delete payload.message;
      }

      // Use API utility for timeout and retry handling
      const data = await window.api.post(`/v2/messages/${conversationId}`, payload);
      
      // Invalidate conversation cache after sending message (Issue #16)
      this.invalidateConversationCache();
      
      return data.messageId || (data.message && data.message.id);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async markMessagesAsReadViaAPI(conversationId) {
    try {
      // Use correct v2 endpoint with API utility for timeout and retry
      await window.api.post(`/v2/messages/threads/${conversationId}/read`, {});
      
      // Invalidate conversation cache after marking as read (Issue #16)
      this.invalidateConversationCache();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  async fetchUnreadCountFromAPI(userId, userType, callback) {
    try {
      // Use the authenticated endpoint with API utility for timeout and retry
      const data = await window.api.get('/v2/messages/unread');
      callback(data.count || 0);
    } catch (error) {
      // Gracefully handle errors without console spam
      if (!this._unreadErrorLogged) {
        this._unreadErrorLogged = true;
        console.warn('Unable to fetch unread count:', error.message);
      }
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
      return 'Unknown time';
    }

    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      try {
        date = new Date(timestamp);
      } catch (e) {
        console.error('Invalid timestamp:', timestamp);
        return 'Unknown time';
      }
    }

    // Validate date is valid
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }

    // Use relative time for recent messages, full date for older
    const now = new Date();
    const diff = now - date;

    // Handle future dates (clock skew or incorrect system time)
    if (diff < 0) {
      return date.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

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
      // For older messages, show friendly date without seconds
      return date.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  /**
   * Clean up all polling intervals
   */
  cleanup() {
    // Clear all polling intervals
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals = [];

    // Clear all typing timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();

    // Clear all debounce timers
    this._typingDebounceTimers.forEach(timer => clearTimeout(timer));
    this._typingDebounceTimers.clear();

    // Leave all active conversations
    const conversationsToLeave = Array.from(this.activeConversations);
    conversationsToLeave.forEach(conversationId => {
      this.leaveConversation(conversationId);
    });
    this.activeConversations.clear();

    // Disconnect WebSocket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
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
    this.typingUsers = new Map(); // conversationId -> Set of userIds
    this.connectionStatusElement = null;
    this._setupEventListeners();
  }

  /**
   * Setup event listeners for messaging events
   */
  _setupEventListeners() {
    // Listen for typing status updates
    window.addEventListener('messaging:typing', event => {
      this.handleTypingStatus(event.detail);
    });

    // Listen for read receipts
    window.addEventListener('messaging:read', event => {
      this.handleReadReceipt(event.detail);
    });

    // Listen for connection status changes
    window.addEventListener('messaging:connection', event => {
      this.handleConnectionStatus(event.detail);
    });
  }

  /**
   * Handle typing status update
   */
  handleTypingStatus({ conversationId, userId, isTyping }) {
    if (!this.typingUsers.has(conversationId)) {
      this.typingUsers.set(conversationId, new Set());
    }

    const typingSet = this.typingUsers.get(conversationId);

    if (isTyping) {
      typingSet.add(userId);
    } else {
      typingSet.delete(userId);
    }

    // Clean up empty sets
    if (typingSet.size === 0) {
      this.typingUsers.delete(conversationId);
    }

    // Emit custom event for UI components
    const event = new CustomEvent('messagingManager:typingUpdate', {
      detail: {
        conversationId,
        typingUserIds: Array.from(typingSet),
        isTyping: typingSet.size > 0,
      },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle read receipt
   */
  handleReadReceipt({ conversationId, messageId, userId }) {
    // Emit custom event for UI components
    const event = new CustomEvent('messagingManager:readReceipt', {
      detail: { conversationId, messageId, userId },
    });
    window.dispatchEvent(event);
  }

  /**
   * Handle connection status change
   */
  handleConnectionStatus({ status }) {
    this.updateConnectionIndicator(status);

    // Only show toasts after initial connection (not on first connect)
    if (status === 'offline' && typeof EFToast !== 'undefined') {
      EFToast.warning('Connection lost - using fallback mode', { duration: 4000 });
    } else if (
      status === 'online' &&
      this.messagingSystem._hasDisconnected &&
      typeof EFToast !== 'undefined'
    ) {
      // Only show reconnect success if we've previously disconnected
      EFToast.success('Reconnected - real-time messaging active', { duration: 3000 });
    }
  }

  /**
   * Update connection status indicator
   */
  updateConnectionIndicator(status) {
    if (!this.connectionStatusElement) {
      // Try to find existing indicator
      this.connectionStatusElement =
        document.getElementById('messaging-connection-status') ||
        document.querySelector('[data-messaging-status]');

      // Create if doesn't exist
      if (!this.connectionStatusElement) {
        this.connectionStatusElement = document.createElement('div');
        this.connectionStatusElement.id = 'messaging-connection-status';
        this.connectionStatusElement.className = 'messaging-connection-status';
        this.connectionStatusElement.setAttribute('aria-live', 'assertive');
        this.connectionStatusElement.setAttribute('aria-atomic', 'true');

        // Find a suitable container (messaging header, navbar, etc.)
        const container =
          document.querySelector('.messaging-header') ||
          document.querySelector('.navbar') ||
          document.body;
        container.appendChild(this.connectionStatusElement);
      }
    }

    // Update the indicator
    this.connectionStatusElement.className = `messaging-connection-status messaging-connection-status--${status}`;
    this.connectionStatusElement.innerHTML = `
      <span class="status-dot"></span>
      <span class="status-text">${status === 'online' ? 'Online' : 'Offline'}</span>
    `;

    // Add styles if not already added
    if (!document.getElementById('messaging-connection-styles')) {
      const style = document.createElement('style');
      style.id = 'messaging-connection-styles';
      style.textContent = `
        .messaging-connection-status {
          position: fixed;
          top: 70px;
          right: 20px;
          z-index: 1000;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        .messaging-connection-status--online {
          background: rgba(212, 237, 218, 0.95);
          color: #155724;
          border: 1px solid rgba(40, 167, 69, 0.3);
        }
        .messaging-connection-status--offline {
          background: rgba(248, 215, 218, 0.95);
          color: #721c24;
          border: 1px solid rgba(220, 53, 69, 0.3);
        }
        .messaging-connection-status .status-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        .messaging-connection-status--online .status-dot {
          background: #28a745;
          box-shadow: 0 0 6px rgba(40, 167, 69, 0.5);
        }
        .messaging-connection-status--offline .status-dot {
          background: #dc3545;
          box-shadow: 0 0 6px rgba(220, 53, 69, 0.5);
        }
        .messaging-connection-status .status-text {
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        @media (max-width: 768px) {
          .messaging-connection-status {
            top: 60px;
            right: 10px;
            padding: 4px 10px;
            font-size: 11px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Get typing status for a conversation
   */
  getTypingUsers(conversationId) {
    return Array.from(this.typingUsers.get(conversationId) || []);
  }

  /**
   * Check if anyone is typing in a conversation
   */
  isTyping(conversationId) {
    const typingSet = this.typingUsers.get(conversationId);
    return typingSet && typingSet.size > 0;
  }

  /**
   * Mark messages as read in a thread
   * @param {string} threadId - Thread/conversation ID
   * @returns {Promise<boolean>} Success status
   */
  async markMessagesAsRead(threadId) {
    try {
      // Use API utility for timeout and retry
      await window.api.post(`/v2/messages/threads/${threadId}/read`, {});
      await this.refreshUnreadCount();
      return true;
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
      // Use API utility for timeout and retry
      const data = await window.api.get('/v2/messages/unread');
      const count = data.count || data.unreadCount || 0;

      this.updateBadge(count);

      const event = new CustomEvent('unreadCountUpdated', {
        detail: { count },
      });
      window.dispatchEvent(event);

      return count;
    } catch (error) {
      // Gracefully handle errors without console spam
      if (!this._unreadRefreshErrorLogged) {
        this._unreadRefreshErrorLogged = true;
        console.warn('Unable to refresh unread count, showing zero');
      }
      this.updateBadge(0);
      return 0;
    }
  }

  /**
   * Update badge element with count
   * @param {number} count - Unread message count
   */
  updateBadge(count) {
    // Delegate to centralized badge manager if available
    if (window.unreadBadgeManager) {
      window.unreadBadgeManager.updateAll(count);
      this.lastUnreadCount = count;
      return;
    }

    // Fallback for backward compatibility
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

  /**
   * Create a typing indicator element for a conversation
   * @param {string} containerSelector - CSS selector for container element
   * @returns {HTMLElement} Typing indicator element
   */
  createTypingIndicator(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.warn('Container not found for typing indicator:', containerSelector);
      return null;
    }

    // Check if indicator already exists
    let indicator = container.querySelector('.typing-indicator');
    if (indicator) {
      return indicator;
    }

    // Create indicator
    indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.style.display = 'none';
    indicator.innerHTML = `
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-text">typing...</span>
    `;

    container.appendChild(indicator);

    // Add styles if not already added
    if (!document.getElementById('typing-indicator-styles')) {
      const style = document.createElement('style');
      style.id = 'typing-indicator-styles';
      style.textContent = `
        .typing-indicator {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          color: #6b7280;
          font-size: 13px;
          font-style: italic;
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
          animation: typing-bounce 1.4s infinite ease-in-out;
        }
        .typing-dot:nth-child(1) {
          animation-delay: -0.32s;
        }
        .typing-dot:nth-child(2) {
          animation-delay: -0.16s;
        }
        @keyframes typing-bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .typing-text {
          margin-left: 4px;
        }
      `;
      document.head.appendChild(style);
    }

    return indicator;
  }

  /**
   * Show typing indicator
   * @param {HTMLElement} indicator - Typing indicator element
   * @param {string} userName - Optional user name to display
   */
  showTypingIndicator(indicator, userName = null) {
    if (!indicator) {
      return;
    }

    if (userName) {
      const textSpan = indicator.querySelector('.typing-text');
      if (textSpan) {
        textSpan.textContent = `${userName} is typing...`;
      }
    }

    indicator.style.display = 'inline-flex';
  }

  /**
   * Hide typing indicator
   * @param {HTMLElement} indicator - Typing indicator element
   */
  hideTypingIndicator(indicator) {
    if (!indicator) {
      return;
    }
    indicator.style.display = 'none';
  }

  /**
   * Cleanup - Stop all polling, disconnect socket, clear timers
   * Call this before page unload to prevent memory leaks
   */
  cleanup() {
    // Stop all polling intervals
    this.pollingIntervals.forEach(intervalId => clearInterval(intervalId));
    this.pollingIntervals = [];

    // Clear typing timeouts
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();

    // Clear typing debounce timers
    this._typingDebounceTimers.forEach(timer => clearTimeout(timer));
    this._typingDebounceTimers.clear();

    // Disconnect WebSocket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Clear conversation callbacks
    this.conversationCallbacks.clear();
    this.messageCallbacks.clear();
    this.activeConversations.clear();

    console.log('MessagingSystem cleaned up');
  }
}

// ============================================
// PHASE 1: BULK OPERATIONS & MANAGEMENT
// ============================================

/**
 * SelectionManager - Handles message selection state
 */
class SelectionManager {
  constructor() {
    this.selectedItems = new Set();
    this.isSelectingAll = false;
  }

  toggle(itemId) {
    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
    } else {
      this.selectedItems.add(itemId);
    }
    return this.selectedItems.has(itemId);
  }

  selectAll(items) {
    this.selectedItems.clear();
    items.forEach(item => this.selectedItems.add(item));
    this.isSelectingAll = true;
  }

  deselectAll() {
    this.selectedItems.clear();
    this.isSelectingAll = false;
  }

  getSelectedCount() {
    return this.selectedItems.size;
  }

  getSelectedIds() {
    return Array.from(this.selectedItems);
  }

  isSelected(itemId) {
    return this.selectedItems.has(itemId);
  }

  hasSelection() {
    return this.selectedItems.size > 0;
  }
}

/**
 * BulkOperationManager - Handles bulk operations on messages
 */
class BulkOperationManager {
  constructor() {
    this.undoQueue = [];
  }

  async bulkDelete(messageIds, threadId, reason = '') {
    return retryWithBackoff(async (attempt) => {
      try {
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
          throw new Error('CSRF token not found');
        }

        if (isDevelopment && attempt > 1) {
          console.log(`Bulk delete attempt ${attempt}`);
        }

        const response = await fetch('/api/v2/messages/bulk-delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({ messageIds, threadId, reason }),
        });

        const result = await response.json().catch(() => ({ error: 'Request failed' }));

        if (!response.ok) {
          const error = new Error(result.error || `Request failed with status ${response.status}`);
          error.response = result;
          error.status = response.status;
          throw error;
        }

        // Store undo information
        this.undoQueue.push({
          operationId: result.operationId,
          undoToken: result.undoToken,
          type: 'delete',
          count: result.deletedCount,
          expiresAt: Date.now() + 30000, // 30 seconds
        });

        return result;
      } catch (error) {
        if (isDevelopment) {
          console.error('Bulk delete error:', error);
        }
        throw error;
      }
    }, {
      maxAttempts: 3,
      baseDelay: 1000
    });
  }

  async bulkMarkRead(messageIds, isRead) {
    return retryWithBackoff(async (attempt) => {
      try {
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
          throw new Error('CSRF token not found');
        }

        if (isDevelopment && attempt > 1) {
          console.log(`Bulk mark read attempt ${attempt}`);
        }

        const response = await fetch('/api/v2/messages/bulk-mark-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({ messageIds, isRead }),
        });

        const result = await response.json().catch(() => ({ error: 'Request failed' }));

        if (!response.ok) {
          const error = new Error(result.error || `Request failed with status ${response.status}`);
          error.response = result;
          error.status = response.status;
          throw error;
        }

        return result;
      } catch (error) {
        if (isDevelopment) {
          console.error('Bulk mark read error:', error);
        }
        throw error;
      }
    }, {
      maxAttempts: 3,
      baseDelay: 1000
    });
  }

  async flagMessage(messageId, isFlagged) {
    try {
      const csrfToken = getCsrfToken();

      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      const response = await fetch(`/api/v2/messages/${messageId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ isFlagged }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Flag message error:', error);
      throw error;
    }
  }

  async archiveMessage(messageId, action) {
    try {
      const csrfToken = getCsrfToken();

      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      const response = await fetch(`/api/v2/messages/${messageId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Archive message error:', error);
      throw error;
    }
  }

  async undo(operationId, undoToken) {
    try {
      const csrfToken = getCsrfToken();

      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      const response = await fetch(`/api/v2/messages/operations/${operationId}/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ undoToken }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();

      // Remove from undo queue
      this.undoQueue = this.undoQueue.filter(op => op.operationId !== operationId);

      return result;
    } catch (error) {
      console.error('Undo error:', error);
      throw error;
    }
  }

  getUndoQueue() {
    // Filter expired operations
    const now = Date.now();
    this.undoQueue = this.undoQueue.filter(op => op.expiresAt > now);
    return this.undoQueue;
  }

  getLastOperation() {
    const queue = this.getUndoQueue();
    return queue.length > 0 ? queue[queue.length - 1] : null;
  }
}

/**
 * SortFilterManager - Handles sorting and filtering of messages
 */
class SortFilterManager {
  constructor() {
    this.sortMethod = 'date-desc';
    this.filters = {
      readStatus: 'all',
      hasAttachments: null,
      flagged: false,
      archived: false,
      dateFrom: null,
      dateTo: null,
      status: null,
    };
    this.loadPreferences();
  }

  setSortMethod(method) {
    this.sortMethod = method;
    this.savePreferences();
  }

  getSortMethod() {
    return this.sortMethod;
  }

  setFilter(filterName, value) {
    if (Object.prototype.hasOwnProperty.call(this.filters, filterName)) {
      this.filters[filterName] = value;
      this.savePreferences();
    }
  }

  getFilter(filterName) {
    return this.filters[filterName];
  }

  getAllFilters() {
    return { ...this.filters };
  }

  clearFilters() {
    this.filters = {
      readStatus: 'all',
      hasAttachments: null,
      flagged: false,
      archived: false,
      dateFrom: null,
      dateTo: null,
      status: null,
    };
    this.savePreferences();
  }

  getActiveFilterCount() {
    let count = 0;
    if (this.filters.readStatus !== 'all') {
      count++;
    }
    if (this.filters.hasAttachments !== null) {
      count++;
    }
    if (this.filters.flagged) {
      count++;
    }
    if (this.filters.archived) {
      count++;
    }
    if (this.filters.dateFrom || this.filters.dateTo) {
      count++;
    }
    if (this.filters.status) {
      count++;
    }
    return count;
  }

  async fetchMessagesWithFilters(threadId) {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('sortBy', this.sortMethod);

      if (this.filters.readStatus !== 'all') {
        params.append('filterBy', this.filters.readStatus);
      }
      if (this.filters.hasAttachments !== null) {
        params.append('hasAttachments', this.filters.hasAttachments);
      }
      if (this.filters.flagged) {
        params.append('filterBy', 'flagged');
      }
      if (this.filters.archived) {
        params.append('filterBy', 'archived');
      }
      if (this.filters.dateFrom) {
        params.append('dateFrom', this.filters.dateFrom);
      }
      if (this.filters.dateTo) {
        params.append('dateTo', this.filters.dateTo);
      }
      if (this.filters.status) {
        params.append('status', this.filters.status);
      }

      const response = await fetch(`/api/v2/messages/${threadId}?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Fetch messages with filters error:', error);
      throw error;
    }
  }

  savePreferences() {
    try {
      const prefs = {
        sortMethod: this.sortMethod,
        filters: this.filters,
      };
      localStorage.setItem('messaging_preferences', JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  loadPreferences() {
    try {
      const stored = localStorage.getItem('messaging_preferences');
      if (stored) {
        const prefs = JSON.parse(stored);
        if (prefs.sortMethod) {
          this.sortMethod = prefs.sortMethod;
        }
        if (prefs.filters) {
          this.filters = { ...this.filters, ...prefs.filters };
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  }
}

// Create and export singleton instance
const messagingSystem = new MessagingSystem();
const messagingManager = new MessagingManager();

// Phase 1 instances
const selectionManager = new SelectionManager();
const bulkOperationManager = new BulkOperationManager();
const sortFilterManager = new SortFilterManager();

// Register cleanup on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    messagingSystem.cleanup();
  });
}

export default messagingSystem;
export {
  MessagingManager,
  messagingManager,
  SelectionManager,
  selectionManager,
  BulkOperationManager,
  bulkOperationManager,
  SortFilterManager,
  sortFilterManager,
};
