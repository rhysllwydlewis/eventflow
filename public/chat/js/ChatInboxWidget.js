/**
 * Chat Inbox Widget (v5)
 * Compact inbox widget for dashboards showing recent conversations
 */

'use strict';

class ChatInboxWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.options = {
      maxConversations: options.maxConversations || 5,
      showUnreadOnly: options.showUnreadOnly || false,
      ...options,
    };

    this.api = new ChatAPI();
    this.conversations = [];
    this.unreadCount = 0;
    this.refreshInterval = null;

    this.init();
  }

  /**
   * Initialize the widget
   */
  async init() {
    this.render();
    await this.loadConversations();
    await this.loadUnreadCount();
    
    // Refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, 30000);
  }

  /**
   * Load conversations
   */
  async loadConversations() {
    try {
      const result = await this.api.getConversations({
        unreadOnly: this.options.showUnreadOnly,
        limit: this.options.maxConversations,
      });
      
      this.conversations = result.conversations || [];
      this.renderConversations();
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.renderError();
    }
  }

  /**
   * Load unread count
   */
  async loadUnreadCount() {
    try {
      const result = await this.api.getUnreadCount();
      this.unreadCount = result.unreadCount || 0;
      this.renderUnreadBadge();
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }

  /**
   * Refresh data
   */
  async refresh() {
    await Promise.all([
      this.loadConversations(),
      this.loadUnreadCount(),
    ]);
  }

  /**
   * Initial render
   */
  render() {
    this.container.innerHTML = `
      <div class="chat-inbox-widget">
        <div class="widget-header">
          <h3 class="widget-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 8px;">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Messages
            <span class="unread-badge-widget" id="widgetUnreadBadge" style="display: none;"></span>
          </h3>
          <a href="/chat/" class="widget-view-all">View All</a>
        </div>
        <div class="widget-content" id="widgetContent">
          <!-- Conversations will be inserted here -->
        </div>
      </div>
    `;
  }

  /**
   * Render conversations list
   */
  renderConversations() {
    const content = this.container.querySelector('#widgetContent');
    if (!content) return;

    if (this.conversations.length === 0) {
      content.innerHTML = `
        <div class="widget-empty">
          <p>No messages</p>
        </div>
      `;
      return;
    }

    content.innerHTML = this.conversations.map(conv => {
      const participant = this.getOtherParticipant(conv);
      const lastMessage = conv.lastMessage || {};
      const unreadCount = this.getUnreadCount(conv);
      
      return `
        <a href="/chat/?conversation=${conv._id}" class="widget-conversation ${unreadCount > 0 ? 'unread' : ''}">
          <div class="widget-avatar">
            ${participant.avatar 
              ? `<img src="${this.escapeHtml(participant.avatar)}" alt="${this.escapeHtml(participant.displayName)}">` 
              : `<span>${this.getInitials(participant.displayName)}</span>`
            }
          </div>
          <div class="widget-info">
            <div class="widget-name">${this.escapeHtml(participant.displayName)}</div>
            <div class="widget-preview">${this.escapeHtml(lastMessage.content || 'No messages yet')}</div>
          </div>
          <div class="widget-meta">
            <div class="widget-time">${this.formatTime(lastMessage.sentAt || conv.updatedAt)}</div>
            ${unreadCount > 0 ? `<div class="widget-unread-count">${unreadCount}</div>` : ''}
          </div>
        </a>
      `;
    }).join('');
  }

  /**
   * Render error state
   */
  renderError() {
    const content = this.container.querySelector('#widgetContent');
    if (!content) return;

    content.innerHTML = `
      <div class="widget-error">
        <p>Unable to load messages</p>
        <button onclick="chatInboxWidget.refresh()" class="widget-retry-btn">Retry</button>
      </div>
    `;
  }

  /**
   * Render unread badge in header
   */
  renderUnreadBadge() {
    const badge = this.container.querySelector('#widgetUnreadBadge');
    if (!badge) return;

    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Get other participant (not current user)
   */
  getOtherParticipant(conversation) {
    // TODO: Get current user ID from cookie/session
    // For now, return first participant
    return conversation.participants && conversation.participants.length > 0
      ? conversation.participants[0]
      : { displayName: 'Unknown', avatar: null };
  }

  /**
   * Get unread count for current user
   */
  getUnreadCount(conversation) {
    // TODO: Get current user ID
    const participant = conversation.participants && conversation.participants.length > 0
      ? conversation.participants[0]
      : null;
    return participant ? participant.unreadCount || 0 : 0;
  }

  /**
   * Get initials from name
   */
  getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  /**
   * Format timestamp
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the widget
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.container.innerHTML = '';
  }
}

// CSS for the widget (inject dynamically)
if (!document.getElementById('chat-inbox-widget-styles')) {
  const style = document.createElement('style');
  style.id = 'chat-inbox-widget-styles';
  style.textContent = `
    .chat-inbox-widget {
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    }
    
    .widget-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    }
    
    .widget-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a202c;
      display: flex;
      align-items: center;
    }
    
    .unread-badge-widget {
      display: inline-block;
      min-width: 18px;
      height: 18px;
      padding: 0 6px;
      border-radius: 9999px;
      background: #0B8073;
      color: white;
      font-size: 11px;
      font-weight: 600;
      text-align: center;
      line-height: 18px;
      margin-left: 8px;
    }
    
    .widget-view-all {
      color: #0B8073;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: color 0.15s;
    }
    
    .widget-view-all:hover {
      color: #0A6B5F;
      text-decoration: underline;
    }
    
    .widget-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .widget-conversation {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid rgba(0, 0, 0, 0.04);
      text-decoration: none;
      color: inherit;
      transition: all 0.15s;
    }
    
    .widget-conversation:hover {
      background: rgba(255, 255, 255, 0.9);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    
    .widget-conversation.unread {
      border-left: 3px solid #0B8073;
    }
    
    .widget-avatar {
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: linear-gradient(135deg, #0B8073, #13B6A2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      flex-shrink: 0;
    }
    
    .widget-avatar img {
      width: 100%;
      height: 100%;
      border-radius: 9999px;
      object-fit: cover;
    }
    
    .widget-info {
      flex: 1;
      min-width: 0;
    }
    
    .widget-name {
      font-weight: 600;
      font-size: 14px;
      color: #1a202c;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .widget-preview {
      font-size: 13px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .widget-conversation.unread .widget-preview {
      font-weight: 500;
      color: #1a202c;
    }
    
    .widget-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      flex-shrink: 0;
    }
    
    .widget-time {
      font-size: 11px;
      color: #9ca3af;
    }
    
    .widget-unread-count {
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9999px;
      background: #0B8073;
      color: white;
      font-size: 10px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .widget-empty, .widget-error {
      padding: 32px 16px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    
    .widget-retry-btn {
      margin-top: 12px;
      padding: 8px 16px;
      border: none;
      border-radius: 9999px;
      background: #0B8073;
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .widget-retry-btn:hover {
      background: #0A6B5F;
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatInboxWidget;
}
