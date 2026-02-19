/**
 * NotificationBridgeV4 Component
 * Syncs messenger unread count to site bell badges and the browser tab title.
 * Also manages desktop (Web Notifications API) notifications.
 */

'use strict';

class NotificationBridgeV4 {
  constructor(options = {}) {
    this.options = {
      bellSelector: '#notificationBadge',
      titlePrefix: 'EventFlow',
      ...options,
    };

    this._unreadCount = 0;
    this._originalTitle = document.title;
    this._permission = Notification?.permission || 'default';

    // Badge element selectors to keep in sync
    this._badgeSelectors = [
      this.options.bellSelector,
      '#headerNotificationBadge',
      '#notificationBadge',
      '.messenger-unread-badge',
    ];

    // Bound handlers
    this._onUnreadCount = this._onUnreadCount.bind(this);

    this.init();
  }

  init() {
    window.addEventListener('messenger:unread-count', this._onUnreadCount);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Update the unread count everywhere: bell badges + tab title.
   * @param {number} count
   */
  setUnreadCount(count) {
    this._unreadCount = Math.max(0, count);
    this._updateBadges();
    this._updateTabTitle();
  }

  /**
   * Request desktop notification permission from the browser.
   * @returns {Promise<string>} Permission state: 'granted' | 'denied' | 'default'
   */
  async requestPermission() {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';

    try {
      const result = await Notification.requestPermission();
      this._permission = result;
      return result;
    } catch (err) {
      console.warn('[NotificationBridgeV4] Permission request failed:', err);
      return 'denied';
    }
  }

  /**
   * Show a desktop notification.
   * Silently skips if permission is not granted or Notifications are unsupported.
   * @param {string} title
   * @param {string} body
   * @param {Object} opts - Optional Notification API options (icon, tag, etc.)
   * @returns {Notification|null}
   */
  notify(title, body, opts = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return null;

    try {
      const notification = new Notification(title, {
        body,
        icon: opts.icon || '/img/logo-192.png',
        tag: opts.tag || 'messenger-v4',
        ...opts,
      });

      notification.addEventListener('click', () => {
        window.focus();
        notification.close();
        if (opts.conversationId) {
          window.dispatchEvent(new CustomEvent('messenger:conversation-selected', {
            detail: { id: opts.conversationId },
          }));
        }
      });

      // Auto-close after 5 s
      setTimeout(() => notification.close(), 5000);
      return notification;
    } catch (err) {
      console.warn('[NotificationBridgeV4] Failed to show notification:', err);
      return null;
    }
  }

  /** Remove event listeners. */
  destroy() {
    window.removeEventListener('messenger:unread-count', this._onUnreadCount);
    // Restore original tab title
    document.title = this._originalTitle;
    // Clear all badges
    this.setUnreadCount(0);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  _onUnreadCount(e) {
    const count = e.detail?.count ?? e.detail ?? 0;
    this.setUnreadCount(count);
  }

  _updateBadges() {
    const count = this._unreadCount;
    // De-duplicate selectors to avoid double-updating the same element
    const seen = new Set();
    this._badgeSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        if (count > 0) {
          el.textContent = count > 99 ? '99+' : String(count);
          el.style.display = '';
          el.setAttribute('aria-label', `${count} unread message${count !== 1 ? 's' : ''}`);
        } else {
          el.textContent = '';
          el.style.display = 'none';
          el.removeAttribute('aria-label');
        }
      });
    });
  }

  _updateTabTitle() {
    const base = this.options.titlePrefix;
    if (this._unreadCount > 0) {
      document.title = `(${this._unreadCount}) ${base}`;
    } else {
      document.title = base;
    }
  }
}

if (typeof window !== 'undefined') {
  window.NotificationBridgeV4 = NotificationBridgeV4;
}
