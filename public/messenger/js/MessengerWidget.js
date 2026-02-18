/**
 * MessengerWidget Component
 * Dashboard widget for recent conversations
 */

'use strict';

(function() {
  // Configuration constants
  const DEFAULT_MAX_ITEMS = 5;
  const DEFAULT_REFRESH_INTERVAL = 60000; // 1 minute

  /**
   * HTML escape utility
   */
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
  }

  /**
   * Format relative timestamp
   */
  function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    // Format as date for older messages
    return date.toLocaleDateString();
  }

  /**
   * Get avatar color based on name
   */
  function getAvatarColor(name) {
    if (!name) return '#0B8073';
    const colors = ['#0B8073', '#0D9488', '#10B981', '#059669', '#14B8A6', '#0891B2'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  /**
   * Truncate text to max length
   */
  function truncate(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '...';
  }

  /**
   * MessengerWidget class
   */
  class MessengerWidget {
    constructor(containerId, options = {}) {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        console.error(`MessengerWidget: Container #${containerId} not found`);
        return;
      }

      this.options = {
        maxItems: options.maxItems || DEFAULT_MAX_ITEMS,
        showUnreadBadge: options.showUnreadBadge !== false,
        refreshInterval: options.refreshInterval || DEFAULT_REFRESH_INTERVAL
      };

      this.conversations = [];
      this.unreadCount = 0;
      this.refreshTimer = null;
      this.wsConnected = false;

      this.init();
    }

    /**
     * Initialize widget
     */
    async init() {
      this.injectStyles();
      this.render();
      await this.fetchConversations();
      this.setupWebSocket();
      this.setupAutoRefresh();
    }

    /**
     * Inject scoped CSS styles
     */
    injectStyles() {
      if (document.getElementById('messenger-widget-styles')) return;

      const style = document.createElement('style');
      style.id = 'messenger-widget-styles';
      style.textContent = `
        .messenger-widget {
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(11, 128, 115, 0.1);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(11, 128, 115, 0.08);
        }
        .messenger-widget-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(11, 128, 115, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .messenger-widget-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
        }
        .messenger-widget-badge {
          background: #0B8073;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 600;
          min-width: 20px;
          text-align: center;
        }
        .messenger-widget-view-all {
          color: #0B8073;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        .messenger-widget-view-all:hover {
          opacity: 0.7;
        }
        .messenger-widget-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .messenger-widget-item {
          padding: 14px 20px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .messenger-widget-item:last-child {
          border-bottom: none;
        }
        .messenger-widget-item:hover {
          background: rgba(11, 128, 115, 0.04);
        }
        .messenger-widget-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0B8073, #0D9488);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          flex-shrink: 0;
        }
        .messenger-widget-content {
          flex: 1;
          min-width: 0;
        }
        .messenger-widget-name {
          font-weight: 600;
          color: #1f2937;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .messenger-widget-preview {
          color: #6b7280;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .messenger-widget-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .messenger-widget-time {
          color: #9ca3af;
          font-size: 12px;
        }
        .messenger-widget-unread-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #0B8073;
          animation: messengerWidgetPulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @-webkit-keyframes messengerWidgetPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes messengerWidgetPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          .messenger-widget-unread-dot {
            animation: none;
          }
        }
        .messenger-widget-empty {
          padding: 40px 20px;
          text-align: center;
          color: #6b7280;
        }
        .messenger-widget-empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .messenger-widget-empty-text {
          font-size: 14px;
          margin: 0;
        }
        .messenger-widget-loading {
          padding: 40px 20px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
      `;
      document.head.appendChild(style);
    }

    /**
     * Render widget HTML
     */
    render() {
      const unreadBadge = this.options.showUnreadBadge && this.unreadCount > 0
        ? `<span class="messenger-widget-badge">${this.unreadCount}</span>`
        : '';

      const conversationsHtml = this.conversations.length > 0
        ? this.conversations.map(conv => this.renderConversationItem(conv)).join('')
        : '';

      const emptyState = this.conversations.length === 0 ? `
        <div class="messenger-widget-empty">
          <div class="messenger-widget-empty-icon">💬</div>
          <p class="messenger-widget-empty-text">No conversations yet</p>
        </div>
      ` : '';

      this.container.innerHTML = `
        <div class="messenger-widget">
          <div class="messenger-widget-header">
            <h3 class="messenger-widget-title">
              💬 Messages
              ${unreadBadge}
            </h3>
            <a href="/messenger/" class="messenger-widget-view-all">View All →</a>
          </div>
          ${conversationsHtml ? `<ul class="messenger-widget-list">${conversationsHtml}</ul>` : emptyState}
        </div>
      `;

      // Attach click handlers
      this.attachClickHandlers();
    }

    /**
     * Render a single conversation item
     */
    renderConversationItem(conv) {
      const otherParticipant = conv.otherParticipant || {};
      const name = otherParticipant.name || 'Unknown User';
      const initial = name.charAt(0).toUpperCase();
      const avatarColor = getAvatarColor(name);
      const preview = truncate(conv.lastMessage?.content || conv.lastMessagePreview || 'No messages', 50);
      const time = formatRelativeTime(conv.lastMessageAt || conv.updatedAt);
      const isUnread = conv.unreadCount > 0;
      const unreadDot = isUnread ? '<div class="messenger-widget-unread-dot"></div>' : '';

      return `
        <li class="messenger-widget-item" data-conversation-id="${escapeHtml(conv._id || conv.id)}">
          <div class="messenger-widget-avatar" style="background: ${avatarColor}">
            ${escapeHtml(initial)}
          </div>
          <div class="messenger-widget-content">
            <div class="messenger-widget-name">${escapeHtml(name)}</div>
            <div class="messenger-widget-preview">${escapeHtml(preview)}</div>
          </div>
          <div class="messenger-widget-meta">
            <div class="messenger-widget-time">${escapeHtml(time)}</div>
            ${unreadDot}
          </div>
        </li>
      `;
    }

    /**
     * Attach click handlers to conversation items
     */
    attachClickHandlers() {
      const items = this.container.querySelectorAll('.messenger-widget-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const conversationId = item.getAttribute('data-conversation-id');
          if (conversationId) {
            window.location.href = `/messenger/?conversation=${encodeURIComponent(conversationId)}`;
          }
        });
      });
    }

    /**
     * Fetch conversations from API
     */
    async fetchConversations() {
      try {
        const response = await fetch(`/api/v3/messenger/conversations?limit=${this.options.maxItems}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }

        const data = await response.json();
        this.conversations = data.conversations || [];
        this.unreadCount = this.conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
        this.render();
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    }

    /**
     * Setup WebSocket for real-time updates
     */
    setupWebSocket() {
      // Listen for Socket.IO events if available
      if (window.io && typeof window.io === 'function') {
        try {
          const socket = window.io();
          socket.on('messenger:new-message', () => {
            this.fetchConversations();
          });
          this.wsConnected = true;
        } catch (error) {
          console.log('Socket.IO not available, using polling instead');
        }
      }

      // Also listen for custom events
      window.addEventListener('messenger:notification', () => {
        this.fetchConversations();
      });
    }

    /**
     * Setup auto-refresh interval
     */
    setupAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }

      this.refreshTimer = setInterval(() => {
        this.fetchConversations();
      }, this.options.refreshInterval);
    }

    /**
     * Destroy widget and cleanup
     */
    destroy() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
      }
      if (this.container) {
        this.container.innerHTML = '';
      }
    }
  }

  // Export to window
  window.MessengerWidget = MessengerWidget;
})();
