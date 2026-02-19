/**
 * Messenger API Client
 * Handles all HTTP requests to the messenger v4 API
 */

'use strict';

class MessengerAPI {
  constructor() {
    this.baseUrl = '/api/v4/messenger';
    this.csrfToken = this.getCsrfToken();
  }

  /**
   * Get CSRF token from cookies or meta tag
   */
  getCsrfToken() {
    // Try cookie first (EventFlow pattern)
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf' || name === 'csrfToken') {
        return decodeURIComponent(value);
      }
    }

    // Fallback to meta tag
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.content : '';
  }

  /**
   * Make authenticated request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    };

    // Add CSRF token to POST/PATCH/DELETE requests
    if (['POST', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase())) {
      config.headers['X-CSRF-Token'] = this.csrfToken;
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(recipientId, context = null, initialMessage = null, metadata = {}) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({
        recipientId,
        context,
        initialMessage,
        metadata,
      }),
    });
  }

  /**
   * Get conversations list
   */
  async getConversations(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.unreadOnly) params.append('unreadOnly', 'true');
    if (filters.pinned) params.append('pinned', 'true');
    if (filters.archived) params.append('archived', 'true');
    if (filters.search) params.append('search', filters.search);

    const queryString = params.toString();
    return this.request(`/conversations${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Get a specific conversation
   */
  async getConversation(conversationId) {
    return this.request(`/conversations/${conversationId}`);
  }

  /**
   * Update conversation (pin, mute, archive)
   */
  async updateConversation(conversationId, updates) {
    return this.request(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete (archive) conversation
   */
  async deleteConversation(conversationId) {
    return this.request(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Send a message
   */
  async sendMessage(conversationId, content, attachments = [], replyToId = null) {
    // If we have attachments, use FormData
    if (attachments.length > 0) {
      const formData = new FormData();
      formData.append('message', content || '');
      if (replyToId) formData.append('replyToId', replyToId);
      
      attachments.forEach((file, index) => {
        formData.append('attachments', file);
      });

      // For FormData, don't set headers - let browser set Content-Type with boundary
      const url = `${this.baseUrl}/conversations/${conversationId}/messages`;
      const config = {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // Note: Don't set Content-Type header for FormData
        // Browser will automatically set it with correct boundary
      };
      
      // Add CSRF token as custom header
      config.headers = {
        'X-CSRF-Token': this.csrfToken,
      };

      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(error.error || error.message || 'Request failed');
        }

        return await response.json();
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    }

    // Otherwise use JSON
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        message: content,
        replyToId,
      }),
    });
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, before = null, limit = 50) {
    const params = new URLSearchParams();
    if (before) params.append('before', before);
    if (limit) params.append('limit', limit);

    const queryString = params.toString();
    return this.request(`/conversations/${conversationId}/messages${queryString ? '?' + queryString : ''}`);
  }

  /**
   * Edit a message
   */
  async editMessage(messageId, newContent) {
    return this.request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content: newContent,
      }),
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(messageId) {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId) {
    return this.request(`/conversations/${conversationId}/read`, {
      method: 'POST',
    });
  }

  /**
   * Toggle reaction on a message
   */
  async toggleReaction(messageId, emoji) {
    return this.request(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  /**
   * Search messages
   */
  async searchMessages(query, conversationId = null) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (conversationId) params.append('conversationId', conversationId);

    return this.request(`/search?${params.toString()}`);
  }

  /**
   * Get contacts for new conversation
   */
  async getContacts(searchQuery = '') {
    const params = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
    return this.request(`/contacts${params}`);
  }

  /**
   * Search contacts (alias for getContacts)
   */
  async searchContacts(query = '') {
    return this.getContacts(query);
  }

  /**
   * Get unread count
   */
  async getUnreadCount() {
    return this.request('/unread-count');
  }

  /**
   * Send typing indicator
   */
  async sendTyping(conversationId, isTyping) {
    return this.request(`/conversations/${conversationId}/typing`, {
      method: 'POST',
      body: JSON.stringify({ isTyping }),
    });
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MessengerAPI = MessengerAPI;
}
