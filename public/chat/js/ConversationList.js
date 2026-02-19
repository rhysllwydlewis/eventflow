'use strict';

/**
 * ConversationList Component
 * Renders and manages the conversation list on the left sidebar
 */
class ConversationList {
  /**
   * @param {HTMLElement} container - Container element for the conversation list
   * @param {ChatState} chatState - ChatState instance
   */
  constructor(container, chatState) {
    this.container = container;
    this.chatState = chatState;
    this.conversations = [];
    this.activeConversationId = null;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.isLoading = false;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Listen to ChatState events
    this.chatState.on('conversations:updated', (conversations) => {
      this.conversations = conversations;
      this.render();
    });

    this.chatState.on('filter:changed', (filter) => {
      this.currentFilter = filter;
      this.render();
    });

    this.chatState.on('search:changed', (query) => {
      this.searchQuery = query.toLowerCase();
      this.render();
    });

    this.chatState.on('conversation:active', (conversationId) => {
      this.activeConversationId = conversationId;
      this.render();
    });

    // Delegate click events on conversation items
    this.container.addEventListener('click', (e) => {
      const conversationItem = e.target.closest('.conversation-item');
      if (conversationItem && !conversationItem.classList.contains('skeleton')) {
        const conversationId = conversationItem.dataset.conversationId;
        if (conversationId) {
          this.selectConversation(conversationId);
        }
      }
    });
  }

  /**
   * Select a conversation
   * @param {string} conversationId
   */
  selectConversation(conversationId) {
    this.chatState.setActiveConversation(conversationId);
  }

  /**
   * Filter conversations based on current filter and search
   * @returns {Array} Filtered conversations
   */
  getFilteredConversations() {
    let filtered = [...this.conversations];

    // Apply filter
    switch (this.currentFilter) {
      case 'unread':
        filtered = filtered.filter(c => c.unreadCount > 0);
        break;
      case 'pinned':
        filtered = filtered.filter(c => c.pinned);
        break;
      case 'archived':
        filtered = filtered.filter(c => c.archived);
        break;
      case 'all':
      default:
        filtered = filtered.filter(c => !c.archived);
        break;
    }

    // Apply search
    if (this.searchQuery) {
      filtered = filtered.filter(c => {
        const name = (c.name || '').toLowerCase();
        const lastMessage = (c.lastMessage?.content || '').toLowerCase();
        return name.includes(this.searchQuery) || lastMessage.includes(this.searchQuery);
      });
    }

    // Sort by pinned first, then by last message time
    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const timeA = a.lastMessage?.timestamp || a.createdAt || 0;
      const timeB = b.lastMessage?.timestamp || b.createdAt || 0;
      return new Date(timeB) - new Date(timeA);
    });

    return filtered;
  }

  /**
   * Format timestamp for display
   * @param {string|Date} timestamp
   * @returns {string}
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return dayNames[date.getDay()];
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
   * Truncate text
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  truncate(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /**
   * Render loading skeletons
   * @returns {string}
   */
  renderSkeletons() {
    const skeletons = Array(5).fill(0).map(() => `
      <div class="conversation-item skeleton">
        <div class="conversation-avatar skeleton-avatar"></div>
        <div class="conversation-content">
          <div class="skeleton-line" style="width: 60%;"></div>
          <div class="skeleton-line" style="width: 80%; margin-top: 8px;"></div>
        </div>
      </div>
    `).join('');

    return skeletons;
  }

  /**
   * Render empty state
   * @returns {string}
   */
  renderEmptyState() {
    let message = 'No conversations yet';
    let icon = '💬';

    if (this.searchQuery) {
      message = 'No conversations found';
      icon = '🔍';
    } else if (this.currentFilter === 'unread') {
      message = 'No unread messages';
      icon = '✓';
    } else if (this.currentFilter === 'pinned') {
      message = 'No pinned conversations';
      icon = '📌';
    } else if (this.currentFilter === 'archived') {
      message = 'No archived conversations';
      icon = '📦';
    }

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-text">${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  /**
   * Render a single conversation item
   * @param {Object} conversation
   * @returns {string}
   */
  renderConversation(conversation) {
    const isActive = conversation.id === this.activeConversationId;
    const unreadBadge = conversation.unreadCount > 0 
      ? `<span class="unread-badge">${conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>` 
      : '';
    const lastMessageText = conversation.lastMessage?.content || 'No messages yet';
    const timestamp = this.formatTimestamp(conversation.lastMessage?.timestamp || conversation.createdAt);
    const avatar = conversation.avatar || this.getInitialsAvatar(conversation.name);
    const pinnedIndicator = conversation.pinned ? '<span class="pinned-indicator">📌</span>' : '';

    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-conversation-id="${conversation.id}">
        <div class="conversation-avatar">
          <img src="${this.escapeHtml(avatar)}" alt="${this.escapeHtml(conversation.name)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22%239ca3af%22/><text x=%2250%%22 y=%2250%%22 font-size=%2216%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22>${this.escapeHtml(conversation.name?.charAt(0) || '?')}</text></svg>'">
          ${conversation.online ? '<span class="online-indicator"></span>' : ''}
        </div>
        <div class="conversation-content">
          <div class="conversation-header">
            <span class="conversation-name">${this.escapeHtml(conversation.name)}</span>
            <span class="conversation-time">${this.escapeHtml(timestamp)}</span>
          </div>
          <div class="conversation-preview">
            <span class="last-message">${this.escapeHtml(this.truncate(lastMessageText))}</span>
            ${unreadBadge}
            ${pinnedIndicator}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get initials avatar as data URL
   * @param {string} name
   * @returns {string}
   */
  getInitialsAvatar(name) {
    const initials = (name || '?').charAt(0).toUpperCase();
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    const color = colors[Math.abs(this.hashCode(name)) % colors.length];
    
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${color}"/><text x="50%" y="50%" font-size="16" text-anchor="middle" dy=".3em" fill="white">${initials}</text></svg>`;
  }

  /**
   * Simple hash function for consistent colors
   * @param {string} str
   * @returns {number}
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.isLoading = true;
    this.render();
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.isLoading = false;
    this.render();
  }

  /**
   * Render the conversation list
   */
  render() {
    if (this.isLoading && this.conversations.length === 0) {
      this.container.innerHTML = this.renderSkeletons();
      return;
    }

    const filtered = this.getFilteredConversations();

    if (filtered.length === 0) {
      this.container.innerHTML = this.renderEmptyState();
      return;
    }

    const html = filtered.map(conversation => this.renderConversation(conversation)).join('');
    this.container.innerHTML = html;
  }

  /**
   * Destroy the component
   */
  destroy() {
    this.chatState.off('conversations:updated');
    this.chatState.off('filter:changed');
    this.chatState.off('search:changed');
    this.chatState.off('conversation:active');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationList;
}
