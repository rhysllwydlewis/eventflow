/**
 * ContactPicker Component
 * Modal for starting new conversations with user search
 */

'use strict';

class ContactPicker {
  constructor(modalElement, state, api) {
    this.modal = modalElement;
    this.state = state;
    this.api = api;
    this.contacts = [];
    this.filteredContacts = [];
    this.selectedContact = null;
    
    this.searchInput = null;
    this.contactList = null;
    this.closeButton = null;
    this.overlay = null;
    
    this.searchDebounceTimer = null;
    this.isLoading = false;
    
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    if (!this.modal) {
      console.error('ContactPicker: Modal element not found');
      return;
    }

    // Get DOM elements
    this.searchInput = this.modal.querySelector('#contactSearch');
    this.contactList = this.modal.querySelector('#contactList');
    this.closeButton = this.modal.querySelector('#closeContactPicker');
    this.overlay = this.modal.querySelector('.messenger-modal__overlay');

    if (!this.searchInput || !this.contactList) {
      console.error('ContactPicker: Required elements not found');
      return;
    }

    this.attachEventListeners();
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => this.close());
    }

    // Overlay click to close
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }

    // Search input
    this.searchInput.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });

    // Keyboard shortcuts
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  /**
   * Handle search with debouncing
   */
  handleSearch(query) {
    // Clear previous timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // Debounce search (300ms)
    this.searchDebounceTimer = setTimeout(async () => {
      if (query.trim().length === 0) {
        this.filteredContacts = this.contacts;
        this.renderContacts();
        return;
      }

      if (query.trim().length < 2) {
        // Require at least 2 characters
        return;
      }

      // Search via API
      await this.searchContacts(query.trim());
    }, 300);
  }

  /**
   * Search contacts via API
   */
  async searchContacts(query) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      const response = await this.api.searchContacts(query);
      
      if (response && response.contacts) {
        this.filteredContacts = response.contacts;
        this.renderContacts();
      }
    } catch (error) {
      console.error('Error searching contacts:', error);
      this.showError('Failed to search contacts. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load initial contacts
   */
  async loadContacts() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      const response = await this.api.searchContacts('');
      
      if (response && response.contacts) {
        this.contacts = response.contacts;
        this.filteredContacts = response.contacts;
        this.renderContacts();
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      this.showError('Failed to load contacts. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render contacts list
   */
  renderContacts() {
    if (!this.contactList) return;

    if (this.filteredContacts.length === 0) {
      this.contactList.innerHTML = `
        <div class="messenger-empty-state messenger-empty-state--small">
          <p>No contacts found</p>
          <p class="messenger-empty-state__subtitle">Try a different search term</p>
        </div>
      `;
      return;
    }

    const html = this.filteredContacts.map(contact => this.renderContactItem(contact)).join('');
    this.contactList.innerHTML = html;

    // Attach click handlers to contact items
    this.contactList.querySelectorAll('.messenger-contact-item').forEach(item => {
      item.addEventListener('click', () => {
        const userId = item.dataset.userId;
        const contact = this.filteredContacts.find(c => c._id === userId || c.id === userId);
        if (contact) {
          this.selectContact(contact);
        }
      });
    });
  }

  /**
   * Render a single contact item
   */
  renderContactItem(contact) {
    const userId = contact._id || contact.id;
    const displayName = contact.displayName || contact.name || 'Unknown User';
    const role = contact.role || 'user';
    const avatar = this.getAvatar(contact);
    const isOnline = contact.isOnline || false;

    return `
      <div class="messenger-contact-item" data-user-id="${this.escapeHtml(userId)}" role="button" tabindex="0">
        <div class="messenger-contact-item__avatar">
          ${avatar}
          ${isOnline ? '<span class="messenger-contact-item__status messenger-contact-item__status--online"></span>' : ''}
        </div>
        <div class="messenger-contact-item__info">
          <div class="messenger-contact-item__name">${this.escapeHtml(displayName)}</div>
          <div class="messenger-contact-item__role">${this.escapeHtml(this.formatRole(role))}</div>
        </div>
        <svg class="messenger-contact-item__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>
    `;
  }

  /**
   * Get avatar for contact
   */
  getAvatar(contact) {
    if (contact.avatar) {
      return `<img src="${this.escapeHtml(contact.avatar)}" alt="${this.escapeHtml(contact.displayName || 'User')}" class="messenger-avatar__image">`;
    }
    
    const initial = (contact.displayName || contact.name || '?').charAt(0).toUpperCase();
    return `<span class="messenger-avatar__text">${initial}</span>`;
  }

  /**
   * Format role for display
   */
  formatRole(role) {
    const roleMap = {
      customer: 'Customer',
      supplier: 'Supplier',
      admin: 'Admin',
      user: 'User',
    };
    return roleMap[role] || role;
  }

  /**
   * Select a contact and start conversation
   */
  async selectContact(contact) {
    this.selectedContact = contact;
    const userId = contact._id || contact.id;

    try {
      // Check if conversation already exists
      const existingConversation = this.findExistingConversation(userId);
      
      if (existingConversation) {
        // Open existing conversation
        this.state.setActiveConversation(existingConversation._id);
        this.close();
        return;
      }

      // Create new conversation
      const response = await this.api.createConversation({
        type: 'direct',
        participantIds: [userId],
        context: null,
        metadata: {},
      });

      if (response && response.conversation) {
        // Add to state and open
        this.state.addConversation(response.conversation);
        this.state.setActiveConversation(response.conversation._id);
        this.close();
        
        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('messenger:conversation-created', {
          detail: { conversation: response.conversation },
        }));
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      this.showError('Failed to start conversation. Please try again.');
    }
  }

  /**
   * Find existing conversation with user
   */
  findExistingConversation(userId) {
    const conversations = this.state.getConversations();
    return conversations.find(conv => {
      if (conv.type !== 'direct') return false;
      return conv.participants.some(p => p.userId === userId);
    });
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.contactList) return;
    
    this.contactList.innerHTML = `
      <div class="messenger-loading">
        <div class="messenger-spinner"></div>
        <p>Loading contacts...</p>
      </div>
    `;
  }

  /**
   * Show error message
   */
  showError(message) {
    if (!this.contactList) return;
    
    this.contactList.innerHTML = `
      <div class="messenger-error-state">
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Open the modal
   */
  async open() {
    if (!this.modal) return;

    // Reset state
    this.selectedContact = null;
    this.searchInput.value = '';
    
    // Show modal
    this.modal.style.display = 'flex';
    
    // Load contacts
    await this.loadContacts();
    
    // Focus search input
    setTimeout(() => {
      this.searchInput.focus();
    }, 100);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('messenger:contact-picker-opened'));
  }

  /**
   * Close the modal
   */
  close() {
    if (!this.modal) return;

    this.modal.style.display = 'none';
    this.selectedContact = null;
    this.searchInput.value = '';
    this.filteredContacts = this.contacts;

    // Dispatch event
    window.dispatchEvent(new CustomEvent('messenger:contact-picker-closed'));
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    if (this.closeButton) {
      this.closeButton.removeEventListener('click', this.close);
    }

    if (this.overlay) {
      this.overlay.removeEventListener('click', this.close);
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ContactPicker = ContactPicker;
}
