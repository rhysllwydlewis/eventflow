/**
 * UnreadBadgeManager
 * Centralized manager for all unread message count badges
 * Ensures consistency across dashboard, mobile nav, and inbox
 */
class UnreadBadgeManager {
  constructor() {
    // All possible badge element selectors
    this.badgeSelectors = [
      '#unreadMessageBadge',          // Dashboard widget (customer/supplier)
      '#ef-bottom-dashboard-badge',   // Bottom nav (mobile)
      '#inboxCount',                  // Messages page inbox tab
      '.supplier-unread-badge',       // Supplier dashboard alternate
      '.notification-badge',          // Any generic notification badge
    ];
    
    this.currentCount = 0;
    
    // Listen to unread count updates from messaging system
    this.setupListeners();
  }
  
  setupListeners() {
    // Listen to custom event from MessagingManager
    window.addEventListener('unreadCountUpdated', (e) => {
      this.updateAll(e.detail.count);
    });
    
    // Listen to WebSocket events if messaging system is available
    if (window.messagingSystem) {
      const tryListenToSocket = () => {
        if (window.messagingSystem.socket) {
          window.messagingSystem.socket.on('unread:update', (data) => {
            this.updateAll(data.count);
          });
        } else {
          // Retry after a short delay if socket not ready
          setTimeout(tryListenToSocket, 500);
        }
      };
      tryListenToSocket();
    }
  }
  
  /**
   * Update all badge instances with new count
   * @param {number} count - Unread message count
   */
  updateAll(count) {
    if (typeof count !== 'number' || count < 0) {
      console.warn('[UnreadBadgeManager] Invalid unread count:', count);
      return;
    }
    
    this.currentCount = count;
    
    this.badgeSelectors.forEach(selector => {
      const badges = document.querySelectorAll(selector);
      badges.forEach(badge => {
        if (!badge) return;
        
        if (count > 0) {
          // Show badge with count
          badge.textContent = count > 99 ? '99+' : count.toString();
          badge.style.display = 'inline-flex';
          badge.setAttribute('aria-label', `${count} unread message${count === 1 ? '' : 's'}`);
        } else {
          // Hide badge when zero
          badge.style.display = 'none';
          badge.setAttribute('aria-label', 'No unread messages');
        }
      });
    });
    
    // Also update page title if on messages page
    this.updatePageTitle(count);
    
    // Log for debugging
    console.debug(`[UnreadBadgeManager] Updated ${this.badgeSelectors.length} badge types to count: ${count}`);
  }
  
  /**
   * Update page title with unread count (e.g., "(3) Messages - EventFlow")
   * @param {number} count - Unread count
   */
  updatePageTitle(count) {
    if (window.location.pathname.includes('messages.html')) {
      const baseTitle = 'Messages - EventFlow';
      document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
    }
  }
  
  /**
   * Manually refresh count from API
   */
  async refresh() {
    try {
      const response = await fetch('/api/v2/messages/unread', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const count = data.count || data.unreadCount || 0;
      
      this.updateAll(count);
      
      return count;
    } catch (error) {
      console.error('[UnreadBadgeManager] Failed to refresh count:', error);
      // Don't update badges on error, keep current state
      return this.currentCount;
    }
  }
  
  /**
   * Get current count
   */
  getCount() {
    return this.currentCount;
  }
}

// Create singleton instance
window.unreadBadgeManager = new UnreadBadgeManager();
