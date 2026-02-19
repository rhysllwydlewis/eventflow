/**
 * Chat API Client (v5)
 * Handles all HTTP requests to /api/v5/chat
 */

'use strict';

class ChatAPI {
  constructor() {
    this.baseURL = '/api/v5/chat';
    this.csrfToken = this.getCSRFToken();
  }

  /**
   * Get CSRF token from cookie
   */
  getCSRFToken() {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Make an API request with retry logic
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.csrfToken && { 'X-CSRF-Token': this.csrfToken }),
      },
      credentials: 'include',
    };

    const finalOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
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
  async createConversation({ type, participantIds, context, metadata }) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ type, participantIds, context, metadata }),
    });
  }

  /**
   * Get user's conversations
   */
  async getConversations({ status, unreadOnly, pinned, archived, search, limit, skip } = {}) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (unreadOnly) params.append('unreadOnly', 'true');
    if (pinned !== undefined) params.append('pinned', pinned.toString());
    if (archived !== undefined) params.append('archived', archived.toString());
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit.toString());
    if (skip) params.append('skip', skip.toString());

    const query = params.toString();
    return this.request(`/conversations${query ? `?${query}` : ''}`);
  }

  /**
   * Get a single conversation
   */
  async getConversation(conversationId) {
    return this.request(`/conversations/${conversationId}`);
  }

  /**
   * Update conversation settings
   */
  async updateConversation(conversationId, updates) {
    return this.request(`/conversations/${conversationId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId) {
    return this.request(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Send a message
   */
  async sendMessage(conversationId, { content, type, attachments, replyTo }) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type, attachments, replyTo }),
    });
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, { before, limit } = {}) {
    const params = new URLSearchParams();
    if (before) params.append('before', before);
    if (limit) params.append('limit', limit.toString());

    const query = params.toString();
    return this.request(`/conversations/${conversationId}/messages${query ? `?${query}` : ''}`);
  }

  /**
   * Edit a message
   */
  async editMessage(messageId, content) {
    return this.request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
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
   * Toggle emoji reaction
   */
  async toggleReaction(messageId, emoji) {
    return this.request(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  /**
   * Get contacts
   */
  async getContacts({ search, limit } = {}) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit.toString());

    const query = params.toString();
    return this.request(`/contacts${query ? `?${query}` : ''}`);
  }

  /**
   * Get unread count
   */
  async getUnreadCount() {
    return this.request('/unread-count');
  }

  /**
   * Search messages
   */
  async searchMessages(query, { limit } = {}) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (limit) params.append('limit', limit.toString());

    return this.request(`/search?${params.toString()}`);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatAPI;
}
