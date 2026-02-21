/**
 * Chat Trigger (v5)
 * Universal button component for initiating conversations from any page
 */

'use strict';

class ChatTrigger {
  /**
   * Initialize a chat trigger button
   * @param {Object} options - Configuration options
   * @param {string} options.recipientId - ID of the user to message
   * @param {string} options.recipientName - Name of the user to message
   * @param {string} options.recipientAvatar - Avatar URL of the user
   * @param {string} options.recipientRole - Role of the recipient (customer, supplier, admin)
   * @param {string} options.conversationType - Type of conversation (direct, marketplace, enquiry, support)
   * @param {Object} options.context - Context object (type, entityId, entityName, entityImage)
   * @param {string} options.buttonText - Custom button text (default: "Send Message")
   * @param {string} options.buttonClass - Additional CSS classes for the button
   * @param {boolean} options.showIcon - Show message icon (default: true)
   */
  static createButton(options = {}) {
    const {
      recipientId,
      recipientName,
      recipientAvatar = null,
      recipientRole = 'customer',
      conversationType = 'direct',
      context = null,
      buttonText = 'Send Message',
      buttonClass = '',
      showIcon = true,
    } = options;

    if (!recipientId || !recipientName) {
      console.error('ChatTrigger: recipientId and recipientName are required');
      return null;
    }

    const button = document.createElement('button');
    button.className = `chat-trigger-btn ${buttonClass}`;
    button.setAttribute('data-recipient-id', recipientId);
    button.setAttribute('data-recipient-name', recipientName);
    if (recipientAvatar) {
      button.setAttribute('data-recipient-avatar', recipientAvatar);
    }
    button.setAttribute('data-recipient-role', recipientRole);
    button.setAttribute('data-conversation-type', conversationType);
    if (context) {
      button.setAttribute('data-context', JSON.stringify(context));
    }

    button.innerHTML = `
      ${
        showIcon
          ? `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 6px;">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `
          : ''
      }
      <span>${buttonText}</span>
    `;

    button.addEventListener('click', () => {
      ChatTrigger.handleClick(button);
    });

    return button;
  }

  /**
   * Handle button click
   */
  static async handleClick(button) {
    try {
      const recipientId = button.getAttribute('data-recipient-id');
      const conversationType = button.getAttribute('data-conversation-type');
      const contextStr = button.getAttribute('data-context');
      const context = contextStr ? JSON.parse(contextStr) : null;

      // Show loading state
      button.disabled = true;
      const originalContent = button.innerHTML;
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
        <span style="margin-left: 6px;">Opening...</span>
      `;

      // Get current user
      const currentUser = await ChatTrigger.getCurrentUser();
      if (!currentUser) {
        ChatTrigger.showError('Please log in to send messages');
        button.disabled = false;
        button.innerHTML = originalContent;
        return;
      }

      // Create conversation
      const api = new ChatAPI();
      const result = await api.createConversation({
        type: conversationType,
        participantIds: [recipientId],
        context,
        metadata: {},
      });

      if (result.success && result.conversation) {
        // Redirect to chat page with conversation ID
        window.location.href = `/chat/?conversation=${result.conversation._id}`;
      } else {
        throw new Error('Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      ChatTrigger.showError('Failed to start conversation. Please try again.');
      button.disabled = false;
      button.innerHTML = originalContent;
    }
  }

  /**
   * Get current user from API or cookie
   */
  static async getCurrentUser() {
    try {
      // Try to get from API
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        return data.user;
      }

      // Fallback: try to parse from cookie
      const userCookie = document.cookie.split('; ').find(row => row.startsWith('user='));

      if (userCookie) {
        const userData = decodeURIComponent(userCookie.split('=')[1]);
        return JSON.parse(userData);
      }

      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Show error message
   */
  static showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'chat-trigger-toast error';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  /**
   * Initialize all triggers on the page
   * Looks for elements with data-chat-trigger attribute
   */
  static initializeAll() {
    const triggers = document.querySelectorAll('[data-chat-trigger]');
    triggers.forEach(element => {
      const recipientId = element.getAttribute('data-recipient-id');
      const recipientName = element.getAttribute('data-recipient-name');

      if (!recipientId || !recipientName) {
        console.warn('Chat trigger missing required attributes:', element);
        return;
      }

      element.addEventListener('click', () => {
        ChatTrigger.handleClick(element);
      });
    });
  }
}

// CSS for the trigger button and toast (inject dynamically)
if (!document.getElementById('chat-trigger-styles')) {
  const style = document.createElement('style');
  style.id = 'chat-trigger-styles';
  style.textContent = `
    .chat-trigger-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 24px;
      border: none;
      border-radius: 9999px;
      background: #0B8073;
      color: white;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(11, 128, 115, 0.2);
    }
    
    .chat-trigger-btn:hover:not(:disabled) {
      background: #0A6B5F;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(11, 128, 115, 0.3);
    }
    
    .chat-trigger-btn:active:not(:disabled) {
      transform: translateY(0);
    }
    
    .chat-trigger-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .chat-trigger-btn.secondary {
      background: transparent;
      border: 2px solid #0B8073;
      color: #0B8073;
    }
    
    .chat-trigger-btn.secondary:hover:not(:disabled) {
      background: rgba(11, 128, 115, 0.1);
    }
    
    .chat-trigger-btn.small {
      padding: 8px 16px;
      font-size: 14px;
    }
    
    .chat-trigger-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      color: #1a202c;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      max-width: 400px;
    }
    
    .chat-trigger-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .chat-trigger-toast.error {
      border-color: #ef4444;
      background: rgba(254, 242, 242, 0.95);
      color: #dc2626;
    }
    
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ChatTrigger.initializeAll();
  });
} else {
  ChatTrigger.initializeAll();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatTrigger;
}
