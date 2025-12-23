/**
 * EventFlow Notifications - Notification system with toast and notification center
 * Handles real-time notifications, toast messages, and notification persistence
 */

// Notification Manager
class NotificationManager {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.storageKey = 'ef_notifications';
    this.maxNotifications = 50;
    this.loadFromStorage();
  }

  // Add a new notification
  add(notification) {
    const newNotification = {
      id: this.generateId(),
      type: notification.type || 'info',
      title: notification.title || '',
      message: notification.message || '',
      timestamp: Date.now(),
      read: false,
      link: notification.link || null,
    };

    this.notifications.unshift(newNotification);

    // Limit stored notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    this.unreadCount++;
    this.saveToStorage();
    this.updateBadge();

    // Also show as toast if requested
    if (notification.showToast !== false && typeof Toast !== 'undefined') {
      Toast.show({
        type: newNotification.type,
        title: newNotification.title,
        message: newNotification.message,
      });
    }

    return newNotification;
  }

  // Mark notification as read
  markAsRead(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount--;
      this.saveToStorage();
      this.updateBadge();
    }
  }

  // Mark all as read
  markAllAsRead() {
    this.notifications.forEach(n => (n.read = true));
    this.unreadCount = 0;
    this.saveToStorage();
    this.updateBadge();
  }

  // Delete notification
  delete(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      const notification = this.notifications[index];
      if (!notification.read) {
        this.unreadCount--;
      }
      this.notifications.splice(index, 1);
      this.saveToStorage();
      this.updateBadge();
    }
  }

  // Clear all notifications
  clearAll() {
    this.notifications = [];
    this.unreadCount = 0;
    this.saveToStorage();
    this.updateBadge();
  }

  // Get all notifications
  getAll() {
    return this.notifications;
  }

  // Get unread notifications
  getUnread() {
    return this.notifications.filter(n => !n.read);
  }

  // Get notifications by type
  getByType(type) {
    return this.notifications.filter(n => n.type === type);
  }

  // Generate unique ID
  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Save to localStorage
  saveToStorage() {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          notifications: this.notifications,
          unreadCount: this.unreadCount,
        })
      );
    } catch (e) {
      console.error('Failed to save notifications:', e);
    }
  }

  // Load from localStorage
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.notifications = parsed.notifications || [];
        this.unreadCount = parsed.unreadCount || 0;
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
      this.notifications = [];
      this.unreadCount = 0;
    }
  }

  // Update notification badge
  updateBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      badge.textContent = this.unreadCount;
      badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
    }
  }
}

// Notification Center UI Component
class NotificationCenter {
  constructor(manager) {
    this.manager = manager;
    this.container = null;
    this.panel = null;
    this.isOpen = false;
    this.init();
  }

  init() {
    this.createButton();
    this.createPanel();
    this.manager.updateBadge();
  }

  createButton() {
    // Find header actions or create notification button
    const headerActions = document.querySelector('.header-actions');
    if (!headerActions) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'icon-button notification-button';
    button.setAttribute('aria-label', 'Notifications');
    button.innerHTML = `
      <span style="position: relative; display: inline-block;">
        🔔
        <span class="notification-badge" style="
          position: absolute;
          top: -6px;
          right: -6px;
          background: #EF4444;
          color: white;
          border-radius: 999px;
          min-width: 18px;
          height: 18px;
          display: none;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          padding: 0 4px;
        ">0</span>
      </span>
    `;

    button.addEventListener('click', e => {
      e.stopPropagation();
      this.toggle();
    });

    // Add notification button to header
    headerActions.appendChild(button);
  }

  createPanel() {
    const panel = document.createElement('div');
    panel.className = 'notification-panel';
    panel.style.cssText = `
      position: fixed;
      top: 70px;
      right: 1rem;
      width: 380px;
      max-width: calc(100vw - 2rem);
      max-height: 500px;
      background: var(--bg, #fff);
      border: 1px solid var(--border, #E7EAF0);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.3s ease-out;
      z-index: 1000;
      display: flex;
      flex-direction: column;
    `;

    panel.innerHTML = `
      <div style="padding: 1rem; border-bottom: 1px solid var(--border, #E7EAF0); display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">Notifications</h3>
        <div style="display: flex; gap: 0.5rem;">
          <button class="notification-mark-all" style="background: none; border: none; color: var(--ink, #0B8073); font-size: 0.75rem; cursor: pointer; padding: 0.25rem 0.5rem;">
            Mark all read
          </button>
          <button class="notification-clear" style="background: none; border: none; color: var(--muted, #667085); font-size: 0.75rem; cursor: pointer; padding: 0.25rem 0.5rem;">
            Clear all
          </button>
        </div>
      </div>
      <div class="notification-list" style="flex: 1; overflow-y: auto; padding: 0.5rem;"></div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;

    // Event listeners
    panel.querySelector('.notification-mark-all').addEventListener('click', () => {
      this.manager.markAllAsRead();
      this.render();
    });

    panel.querySelector('.notification-clear').addEventListener('click', () => {
      this.manager.clearAll();
      this.render();
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (this.isOpen && !panel.contains(e.target) && !e.target.closest('.notification-button')) {
        this.close();
      }
    });

    this.render();
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.panel.style.opacity = '1';
    this.panel.style.visibility = 'visible';
    this.panel.style.transform = 'translateY(0)';
    this.isOpen = true;
    this.render();
  }

  close() {
    this.panel.style.opacity = '0';
    this.panel.style.visibility = 'hidden';
    this.panel.style.transform = 'translateY(-10px)';
    this.isOpen = false;
  }

  render() {
    const listContainer = this.panel.querySelector('.notification-list');
    const notifications = this.manager.getAll();

    if (notifications.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--muted, #667085);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔔</div>
          <div style="font-size: 0.875rem;">No notifications yet</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = notifications
      .map(n => {
        const timeAgo = this.formatTimeAgo(n.timestamp);
        const icons = {
          success: '✓',
          error: '✕',
          warning: '⚠',
          info: 'ℹ',
        };
        const escapedId = this.escapeHtml(String(n.id));
        const isRead = Boolean(n.read);
        const readBg = isRead ? 'transparent' : 'rgba(11, 128, 115, 0.05)';
        const readBorder = isRead ? 'transparent' : 'rgba(11, 128, 115, 0.1)';

        return `
        <div class="notification-item" data-id="${escapedId}" data-read="${isRead}" style="
          padding: 0.75rem;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          cursor: pointer;
          background: ${readBg};
          border: 1px solid ${readBorder};
          transition: background 0.2s ease-out;
        ">
          <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <div style="
              width: 24px;
              height: 24px;
              flex-shrink: 0;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              background: ${this.getTypeColor(n.type)};
              color: white;
            ">${icons[n.type] || icons.info}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: ${n.read ? '400' : '600'}; font-size: 0.875rem; color: var(--text, #0B1220); margin-bottom: 0.25rem;">
                ${this.escapeHtml(n.title)}
              </div>
              <div style="font-size: 0.8rem; color: var(--muted, #667085); margin-bottom: 0.25rem;">
                ${this.escapeHtml(n.message)}
              </div>
              <div style="font-size: 0.7rem; color: var(--muted, #667085);">
                ${timeAgo}
              </div>
            </div>
            ${!n.read ? '<div style="width: 8px; height: 8px; border-radius: 50%; background: var(--ink, #0B8073); flex-shrink: 0;"></div>' : ''}
          </div>
        </div>
      `;
      })
      .join('');

    // Add click and hover handlers
    listContainer.querySelectorAll('.notification-item').forEach(item => {
      const isRead = item.dataset.read === 'true';
      const defaultBg = isRead ? 'transparent' : 'rgba(11, 128, 115, 0.05)';
      const hoverBg = 'rgba(11, 128, 115, 0.08)';

      // Hover effect
      item.addEventListener('mouseenter', () => {
        item.style.background = hoverBg;
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = defaultBg;
      });

      // Click handler
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.manager.markAsRead(id);
        this.render();

        const notification = this.manager.notifications.find(n => n.id === id);
        if (notification && notification.link) {
          window.location.href = notification.link;
        }
      });
    });
  }

  getTypeColor(type) {
    const colors = {
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#0B8073',
    };
    return colors[type] || colors.info;
  }

  formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

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
    return new Date(timestamp).toLocaleDateString();
  }

  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
      return '';
    }
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global notification manager instance
let notificationManager = null;
let notificationCenter = null;

// Initialize on DOM load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    notificationManager = new NotificationManager();
    notificationCenter = new NotificationCenter(notificationManager);

    // Make globally available
    window.Notifications = notificationManager;
  });
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NotificationManager, NotificationCenter };
}
