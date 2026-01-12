/**
 * EventFlow WebSocket Client
 * Real-time notifications and messaging client
 */

class WebSocketClient {
  constructor(options = {}) {
    this.socket = null;
    this.userId = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    this.options = {
      autoConnect: options.autoConnect !== false,
      onConnect: options.onConnect || null,
      onDisconnect: options.onDisconnect || null,
      onNotification: options.onNotification || null,
      onMessage: options.onMessage || null,
      onError: options.onError || null,
    };

    this.listeners = new Map();

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  connect() {
    if (this.connected) {
      return;
    }

    // Load socket.io from CDN
    if (typeof io === 'undefined') {
      this.loadSocketIO()
        .then(() => {
          this.initConnection();
        })
        .catch(err => {
          console.error('Failed to load socket.io:', err);
          if (this.options.onError) {
            this.options.onError(err);
          }
        });
    } else {
      this.initConnection();
    }
  }

  loadSocketIO() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
      script.addEventListener('load', resolve);
      script.addEventListener('error', reject);
      document.head.appendChild(script);
    });
  }

  initConnection() {
    try {
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.setupEventHandlers();
    } catch (err) {
      console.error('WebSocket connection error:', err);
      if (this.options.onError) {
        this.options.onError(err);
      }
    }
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;

      // Authenticate if we have user data
      const user = this.getCurrentUser();
      if (user && user.id) {
        this.authenticate(user.id);
      }

      if (this.options.onConnect) {
        this.options.onConnect();
      }
    });

    this.socket.on('disconnect', reason => {
      console.log('WebSocket disconnected:', reason);
      this.connected = false;

      if (this.options.onDisconnect) {
        this.options.onDisconnect(reason);
      }
    });

    this.socket.on('auth:success', data => {
      console.log('WebSocket authenticated:', data);
      this.userId = data.userId;
    });

    this.socket.on('notification', notification => {
      console.log('Notification received:', notification);

      // Show toast notification
      this.showNotification(notification);

      if (this.options.onNotification) {
        this.options.onNotification(notification);
      }
    });

    this.socket.on('message:received', data => {
      console.log('Message received:', data);

      if (this.options.onMessage) {
        this.options.onMessage(data);
      }
    });

    this.socket.on('typing:started', data => {
      this.emit('typing:started', data);
    });

    this.socket.on('typing:stopped', data => {
      this.emit('typing:stopped', data);
    });

    this.socket.on('connect_error', error => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        if (this.options.onError) {
          this.options.onError(new Error('Failed to connect after multiple attempts'));
        }
      }
    });
  }

  authenticate(userId) {
    this.userId = userId;
    if (this.socket && this.connected) {
      this.socket.emit('auth', { userId });
    }
  }

  joinRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('join', room);
    }
  }

  leaveRoom(room) {
    if (this.socket && this.connected) {
      this.socket.emit('leave', room);
    }
  }

  sendMessage(threadId, recipientId, message) {
    if (this.socket && this.connected) {
      this.socket.emit('message:send', { threadId, recipientId, message });
    }
  }

  startTyping(threadId, recipientId) {
    if (this.socket && this.connected) {
      this.socket.emit('typing:start', { threadId, recipientId });
    }
  }

  stopTyping(threadId, recipientId) {
    if (this.socket && this.connected) {
      this.socket.emit('typing:stop', { threadId, recipientId });
    }
  }

  showNotification(notification) {
    // Use the existing toast notification system if available
    if (typeof showToast === 'function') {
      showToast(notification.message, notification.type || 'info');
    } else {
      // Fallback to browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title || 'EventFlow', {
          body: notification.message,
          icon: '/favicon.svg',
        });
      }
    }
  }

  getCurrentUser() {
    // Use centralized auth state if available
    const authState = window.__authState || window.AuthStateManager;
    if (authState && typeof authState.getUser === 'function') {
      return authState.getUser();
    }
    // Fallback for backwards compatibility
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (err) {
      console.error('Error getting current user:', err);
    }
    return null;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketClient;
}
