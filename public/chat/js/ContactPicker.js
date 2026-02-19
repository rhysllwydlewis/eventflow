'use strict';

/**
 * ContactPicker Component
 * Shows a modal/dialog for starting a new conversation
 */
class ContactPicker {
  /**
   * @param {ChatState} chatState - ChatState instance
   * @param {ChatAPI} chatAPI - ChatAPI instance
   */
  constructor(chatState, chatAPI) {
    this.chatState = chatState;
    this.chatAPI = chatAPI;
    this.contacts = [];
    this.filteredContacts = [];
    this.searchQuery = '';
    this.isOpen = false;
    this.isLoading = false;
    
    this.modal = null;
    this.searchInput = null;
    this.contactsList = null;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.createModal();
    this.bindEvents();
  }

  /**
   * Create modal DOM
   */
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'contact-picker-modal';
    modal.style.display = 'none';
    
    modal.innerHTML = `
      <div class="contact-picker-overlay"></div>
      <div class="contact-picker-content">
        <div class="contact-picker-header">
          <h2>New Conversation</h2>
          <button class="contact-picker-close" aria-label="Close">×</button>
        </div>
        <div class="contact-picker-search">
          <input type="text" placeholder="Search contacts..." class="contact-search-input">
        </div>
        <div class="contact-picker-list"></div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modal = modal;
    this.searchInput = modal.querySelector('.contact-search-input');
    this.contactsList = modal.querySelector('.contact-picker-list');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Close button
    const closeBtn = this.modal.querySelector('.contact-picker-close');
    closeBtn.addEventListener('click', () => this.close());

    // Overlay click
    const overlay = this.modal.querySelector('.contact-picker-overlay');
    overlay.addEventListener('click', () => this.close());

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Search input
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.filterContacts();
      });
    }

    // Contact click (delegated)
    if (this.contactsList) {
      this.contactsList.addEventListener('click', (e) => {
        const contactItem = e.target.closest('.contact-item');
        if (contactItem && !contactItem.classList.contains('skeleton')) {
          const userId = contactItem.dataset.userId;
          if (userId) {
            this.selectContact(userId);
          }
        }
      });
    }
  }

  /**
   * Open the modal
   */
  async open() {
    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.searchQuery = '';
    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchInput.focus();
    }

    // Load contacts
    await this.loadContacts();
  }

  /**
   * Close the modal
   */
  close() {
    this.isOpen = false;
    this.modal.style.display = 'none';
    this.contacts = [];
    this.filteredContacts = [];
    this.searchQuery = '';
  }

  /**
   * Load contacts from API
   */
  async loadContacts() {
    this.isLoading = true;
    this.renderLoading();

    try {
      this.contacts = await this.chatAPI.getContacts();
      this.filterContacts();
    } catch (error) {
      console.error('Failed to load contacts:', error);
      this.renderError();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Filter contacts based on search query
   */
  filterContacts() {
    if (!this.searchQuery) {
      this.filteredContacts = [...this.contacts];
    } else {
      this.filteredContacts = this.contacts.filter(contact => {
        const name = (contact.name || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        return name.includes(this.searchQuery) || email.includes(this.searchQuery);
      });
    }

    this.render();
  }

  /**
   * Select a contact and create conversation
   * @param {string} userId
   */
  async selectContact(userId) {
    try {
      // Check if conversation already exists
      const existingConversation = this.chatState.conversations.find(c => 
        c.participants && c.participants.includes(userId)
      );

      if (existingConversation) {
        // Just activate the existing conversation
        this.chatState.setActiveConversation(existingConversation.id);
        this.close();
        return;
      }

      // Create new conversation
      const conversation = await this.chatAPI.createConversation(userId);
      
      // Add to state
      this.chatState.addConversation(conversation);
      
      // Activate it
      this.chatState.setActiveConversation(conversation.id);
      
      this.close();
      
    } catch (error) {
      console.error('Failed to create conversation:', error);
      this.showError('Failed to start conversation');
    }
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
   * Get initials avatar
   * @param {string} name
   * @returns {string}
   */
  getInitialsAvatar(name) {
    const initials = (name || '?').charAt(0).toUpperCase();
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
    const color = colors[Math.abs(this.hashCode(name)) % colors.length];
    
    return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="${color}"/><text x="50%" y="50%" font-size="20" text-anchor="middle" dy=".3em" fill="white">${initials}</text></svg>`;
  }

  /**
   * Hash code for consistent colors
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
   * Render a contact item
   * @param {Object} contact
   * @returns {string}
   */
  renderContact(contact) {
    const avatar = contact.avatar || this.getInitialsAvatar(contact.name);
    const subtitle = contact.email || contact.role || '';

    return `
      <div class="contact-item" data-user-id="${contact.id}">
        <div class="contact-avatar">
          <img src="${this.escapeHtml(avatar)}" alt="${this.escapeHtml(contact.name)}" onerror="this.src='${this.getInitialsAvatar(contact.name)}'">
          ${contact.online ? '<span class="online-indicator"></span>' : ''}
        </div>
        <div class="contact-info">
          <div class="contact-name">${this.escapeHtml(contact.name)}</div>
          ${subtitle ? `<div class="contact-subtitle">${this.escapeHtml(subtitle)}</div>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render loading skeletons
   */
  renderLoading() {
    if (!this.contactsList) return;

    const skeletons = Array(5).fill(0).map(() => `
      <div class="contact-item skeleton">
        <div class="skeleton-avatar"></div>
        <div class="contact-info">
          <div class="skeleton-line" style="width: 60%;"></div>
          <div class="skeleton-line" style="width: 80%; margin-top: 8px;"></div>
        </div>
      </div>
    `).join('');

    this.contactsList.innerHTML = skeletons;
  }

  /**
   * Render error state
   */
  renderError() {
    if (!this.contactsList) return;

    this.contactsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-text">Failed to load contacts</div>
        <button class="btn-primary" onclick="this.closest('.contact-picker-modal').__instance.loadContacts()">Retry</button>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    if (!this.contactsList) return;

    const message = this.searchQuery ? 'No contacts found' : 'No contacts available';
    const icon = this.searchQuery ? '🔍' : '👥';

    this.contactsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <div class="empty-state-text">${this.escapeHtml(message)}</div>
      </div>
    `;
  }

  /**
   * Render the contact list
   */
  render() {
    if (!this.contactsList) return;

    if (this.filteredContacts.length === 0) {
      this.renderEmpty();
      return;
    }

    const html = this.filteredContacts.map(contact => this.renderContact(contact)).join('');
    this.contactsList.innerHTML = html;
  }

  /**
   * Show error message
   * @param {string} message
   */
  showError(message) {
    console.error(message);
    // You can implement a toast notification here
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContactPicker;
}
