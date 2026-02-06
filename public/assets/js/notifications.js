/**
 * EventFlow Notification System - Client
 * Real-time notification handling with WebSocket and desktop notifications
 *
 * Features:
 * - Real-time notifications via WebSocket
 * - Desktop notifications (with permission)
 * - Notification bell UI with unread count
 * - Notification dropdown/panel
 * - Mark as read/dismiss functionality
 * - Sound notifications
 * - Grouped notifications
 */

(function () {
  'use strict';

  // ==========================================
  // STATE
  // ==========================================

  const state = {
    notifications: [],
    unreadCount: 0,
    socket: null,
    isConnected: false,
    hasDesktopPermission: false,
    soundEnabled: localStorage.getItem('ef_notification_sound_enabled') !== 'false',
  };

  // ==========================================
  // WEBSOCKET CONNECTION
  // ==========================================

  function initWebSocket() {
    // Load Socket.IO from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
    script.onload = () => {
      connectWebSocket();
    };
    script.onerror = () => {
      console.error('Failed to load Socket.IO');
    };
    document.head.appendChild(script);
  }

  function connectWebSocket() {
    if (!window.io) {
      console.error('Socket.IO not loaded');
      return;
    }

    // Connect to WebSocket server
    state.socket = window.io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    state.socket.on('connect', () => {
      state.isConnected = true;
      console.log('WebSocket connected');

      // Authenticate with user ID if available
      const user = getUserFromStorage();
      if (user && user.id) {
        state.socket.emit('auth', { userId: user.id });
      }
    });

    state.socket.on('disconnect', () => {
      state.isConnected = false;
      console.log('WebSocket disconnected');
    });

    state.socket.on('auth:success', data => {
      console.log('WebSocket authenticated:', data.userId);
    });

    // Listen for real-time notifications
    state.socket.on('notification', notification => {
      handleRealtimeNotification(notification);
    });

    // Listen for auth state changes
    window.addEventListener('auth-state-changed', event => {
      const user = event.detail.user;
      if (user && user.id) {
        state.socket.emit('auth', { userId: user.id });
      } else {
        // User logged out, disconnect
        if (state.socket) {
          state.socket.close();
        }
      }
    });
  }

  // ==========================================
  // NOTIFICATION API
  // ==========================================

  async function fetchNotifications(options = {}) {
    try {
      const query = new URLSearchParams({
        limit: options.limit || 50,
        skip: options.skip || 0,
        unreadOnly: options.unreadOnly || false,
      });

      const response = await fetch(`/api/notifications?${query}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      state.notifications = data.notifications;
      state.unreadCount = data.unreadCount;

      updateUI();
      return data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return null;
    }
  }

  async function markAsRead(notificationId) {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        // Update local state
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
        }

        state.unreadCount = Math.max(0, state.unreadCount - 1);
        updateUI();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  async function markAllAsRead() {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        // Update all local notifications
        state.notifications.forEach(n => {
          n.isRead = true;
          n.readAt = new Date().toISOString();
        });

        state.unreadCount = 0;
        updateUI();
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }

  async function dismissNotification(notificationId) {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        // Remove from local state
        state.notifications = state.notifications.filter(n => n.id !== notificationId);
        updateUI();
      }
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  }

  async function deleteNotification(notificationId) {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // Remove from local state
        const notification = state.notifications.find(n => n.id === notificationId);
        if (notification && !notification.isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }

        state.notifications = state.notifications.filter(n => n.id !== notificationId);
        updateUI();
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  // ==========================================
  // REAL-TIME NOTIFICATION HANDLING
  // ==========================================

  function handleRealtimeNotification(notification) {
    // Add to state
    state.notifications.unshift(notification);
    state.unreadCount++;

    // Update UI
    updateUI();

    // Show desktop notification if permitted
    if (state.hasDesktopPermission) {
      showDesktopNotification(notification);
    }

    // Play sound if enabled
    if (state.soundEnabled) {
      playNotificationSound();
    }

    // Show in-app toast notification
    showToastNotification(notification);
  }

  // ==========================================
  // DESKTOP NOTIFICATIONS
  // ==========================================

  function requestDesktopPermission() {
    if (!('Notification' in window)) {
      console.log('Desktop notifications not supported');
      return;
    }

    if (Notification.permission === 'granted') {
      state.hasDesktopPermission = true;
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        state.hasDesktopPermission = permission === 'granted';
      });
    }
  }

  function showDesktopNotification(notification) {
    if (!state.hasDesktopPermission) {
      return;
    }

    try {
      const desktopNotif = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
        silent: !state.soundEnabled,
      });

      desktopNotif.onclick = () => {
        window.focus();
        if (notification.actionUrl) {
          window.location.href = notification.actionUrl;
        }
        desktopNotif.close();
      };
    } catch (error) {
      console.error('Error showing desktop notification:', error);
    }
  }

  // ==========================================
  // SOUND NOTIFICATIONS
  // ==========================================

  function playNotificationSound() {
    try {
      // Check if notification sounds are enabled
      const soundEnabled = localStorage.getItem('ef_notification_sound_enabled');
      if (soundEnabled === 'false') {
        return; // Don't play sound if disabled
      }

      // Get volume from settings (default 30%)
      const volumePercent = parseInt(localStorage.getItem('ef_notification_volume') || '30', 10);
      const volume = volumePercent / 100;

      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Clean up AudioContext after playback to prevent resource leaks
      oscillator.onended = function () {
        audioContext.close();
      };
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================

  function showToastNotification(notification) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `
      <div class="notification-toast-icon">${notification.icon || '🔔'}</div>
      <div class="notification-toast-content">
        <div class="notification-toast-title">${escapeHtml(notification.title)}</div>
        <div class="notification-toast-message">${escapeHtml(notification.message)}</div>
      </div>
      <button class="notification-toast-close" aria-label="Close">×</button>
    `;

    // Add close handler
    const closeBtn = toast.querySelector('.notification-toast-close');
    closeBtn.addEventListener('click', () => {
      toast.classList.add('notification-toast--hiding');
      setTimeout(() => toast.remove(), 300);
    });

    // Add click handler for whole toast
    toast.addEventListener('click', e => {
      if (e.target === closeBtn) {
        return;
      }

      markAsRead(notification.id);

      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }

      toast.classList.add('notification-toast--hiding');
      setTimeout(() => toast.remove(), 300);
    });

    // Add to page
    let container = document.getElementById('notification-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notification-toast-container';
      document.body.appendChild(container);
    }

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('notification-toast--hiding');
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }

  // ==========================================
  // UI UPDATES
  // ==========================================

  function updateUI() {
    updateBellBadge();
    updateDropdown();
  }

  function updateBellBadge() {
    // Support both old and new notification bell IDs
    const badge = document.querySelector('.notification-badge, #ef-notification-badge, .ef-badge');
    if (badge) {
      if (state.unreadCount > 0) {
        badge.textContent = state.unreadCount > 99 ? '99+' : state.unreadCount;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  function updateDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) {
      return;
    }

    const list = dropdown.querySelector('.notification-list');
    if (!list) {
      return;
    }

    if (state.notifications.length === 0) {
      list.innerHTML = '<div class="notification-empty">No notifications</div>';
      return;
    }

    list.innerHTML = state.notifications
      .slice(0, 10)
      .map(
        n => `
      <div class="notification-item ${n.isRead ? '' : 'notification-item--unread'}" 
           data-id="${n.id}">
        <div class="notification-item-icon">${n.icon || '🔔'}</div>
        <div class="notification-item-content">
          <div class="notification-item-title">${escapeHtml(n.title)}</div>
          <div class="notification-item-message">${escapeHtml(n.message)}</div>
          <div class="notification-item-time">${formatTimeAgo(n.createdAt)}</div>
        </div>
        ${
          !n.isRead
            ? '<button class="notification-item-mark-read" data-action="mark-read" aria-label="Mark as read">✓</button>'
            : ''
        }
        <button class="notification-item-dismiss" data-action="dismiss" aria-label="Dismiss">×</button>
      </div>
    `
      )
      .join('');

    // Add event listeners
    list.querySelectorAll('.notification-item').forEach(item => {
      const id = item.dataset.id;

      item.addEventListener('click', e => {
        if (e.target.dataset.action) {
          return;
        } // Let button handlers deal with it

        const notification = state.notifications.find(n => n.id === id);
        if (notification) {
          markAsRead(id);
          if (notification.actionUrl) {
            window.location.href = notification.actionUrl;
          }
        }
      });

      const markReadBtn = item.querySelector('[data-action="mark-read"]');
      if (markReadBtn) {
        markReadBtn.addEventListener('click', e => {
          e.stopPropagation();
          markAsRead(id);
        });
      }

      const dismissBtn = item.querySelector('[data-action="dismiss"]');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', e => {
          e.stopPropagation();
          dismissNotification(id);
        });
      }
    });
  }

  // ==========================================
  // DROPDOWN TOGGLE
  // ==========================================

  function initDropdown() {
    // Support both old and new notification bell IDs
    const bell =
      document.getElementById('notification-bell') ||
      document.getElementById('ef-notification-btn');
    if (!bell) {
      console.warn('Notification bell button not found');
      return;
    }

    // Position dropdown below bell - FIXED: Re-query DOM to avoid stale reference
    const positionDropdown = dropdown => {
      // Always get fresh reference to avoid stale DOM reference after cloning
      const currentBell =
        document.getElementById('ef-notification-btn') ||
        document.getElementById('notification-bell');
      if (!currentBell) {
        console.warn('Bell not found during positioning');
        // Fallback positioning if bell not found
        dropdown.style.top = '64px';
        dropdown.style.right = '16px';
        return;
      }

      const rect = currentBell.getBoundingClientRect();

      // Fallback positioning if getBoundingClientRect returns 0/0 (detached element)
      if (rect.bottom === 0 && rect.right === 0) {
        console.warn('Bell element appears detached, using fallback positioning');
        dropdown.style.top = '64px';
        dropdown.style.right = '16px';
        return;
      }

      dropdown.style.top = `${rect.bottom + 8}px`;
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
    };

    // Create dropdown if it doesn't exist
    let dropdown = document.getElementById('notification-dropdown');
    let isNewDropdown = false;

    if (!dropdown) {
      isNewDropdown = true;
      dropdown = document.createElement('div');
      dropdown.id = 'notification-dropdown';
      dropdown.className = 'notification-dropdown';
      dropdown.innerHTML = `
        <div class="notification-header">
          <h3>Notifications</h3>
          <button class="notification-mark-all" id="notification-mark-all-read">
            Mark all as read
          </button>
        </div>
        <div class="notification-list"></div>
        <div class="notification-footer">
          <a href="/notifications.html" class="notification-view-all">View all</a>
        </div>
      `;

      document.body.appendChild(dropdown);
    }

    // Remove any existing click listeners by cloning and replacing the button
    // This prevents duplicate event listeners if init is called multiple times
    const newBell = bell.cloneNode(true);
    bell.parentNode.replaceChild(newBell, bell);

    // Toggle dropdown - attach to the new button element
    newBell.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      const isOpen = dropdown.classList.toggle('notification-dropdown--open');

      if (isOpen) {
        positionDropdown(dropdown);
        fetchNotifications();
      }
    });

    // Close on outside click (only attach once for new dropdowns)
    if (isNewDropdown) {
      document.addEventListener('click', e => {
        // Re-query bell to avoid stale reference
        const currentBell =
          document.getElementById('ef-notification-btn') ||
          document.getElementById('notification-bell');
        if (currentBell && !currentBell.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.remove('notification-dropdown--open');
        }
      });

      // Close on escape key
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && dropdown.classList.contains('notification-dropdown--open')) {
          dropdown.classList.remove('notification-dropdown--open');
        }
      });

      // Mark all as read handler
      const markAllBtn = dropdown.querySelector('#notification-mark-all-read');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', markAllAsRead);
      }
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  function getUserFromStorage() {
    // Use centralized auth state if available
    const authState = window.__authState || window.AuthStateManager;
    if (authState && typeof authState.getUser === 'function') {
      return authState.getUser();
    }
    // Fallback
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) {
      return 'Just now';
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ago`;
    }
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}h ago`;
    }
    if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)}d ago`;
    }
    return date.toLocaleDateString();
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  function init() {
    try {
      const user = getUserFromStorage();
      if (!user) {
        // Not logged in, don't initialize notifications
        console.log('Notification system: User not logged in, skipping initialization');
        return;
      }

      console.log('Notification system: Initializing for user', user.id);

      // Initialize WebSocket
      initWebSocket();

      // Initialize dropdown
      initDropdown();

      // Fetch initial notifications
      fetchNotifications();

      // Request desktop notification permission after a delay
      setTimeout(() => {
        requestDesktopPermission();
      }, 5000);

      // Expose methods for external use
      window.__notificationSystem = {
        fetch: fetchNotifications,
        markAsRead,
        markAllAsRead,
        dismiss: dismissNotification,
        delete: deleteNotification,
        toggleSound: () => {
          state.soundEnabled = !state.soundEnabled;
          // Sync with localStorage so settings page stays in sync
          localStorage.setItem('ef_notification_sound_enabled', state.soundEnabled);
          return state.soundEnabled;
        },
        // Expose reinit for debugging
        reinit: initDropdown,
      };

      console.log('Notification system: Initialization complete');
    } catch (error) {
      console.error('Notification system: Initialization failed', error);
    }
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
