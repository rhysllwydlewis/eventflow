/**
 * MessengerTrigger Component
 * Universal "Message" button trigger for any page
 * Handles [data-messenger-action] buttons across the entire site
 */

'use strict';

(function() {
  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>}
   */
  async function checkAuth() {
    try {
      // Check AuthState first (most reliable)
      if (window.AuthState && window.AuthState.isAuthenticated) {
        return true;
      }

      // Fallback: check via API
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  /**
   * Handle new conversation button click
   * @param {HTMLElement} button
   */
  async function handleNewConversation(button) {
    // Check authentication
    const isAuthenticated = await checkAuth();
    
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const currentUrl = encodeURIComponent(window.location.href);
      window.location.href = `/auth.html?redirect=${currentUrl}`;
      return;
    }

    // Build messenger URL with query params
    const params = new URLSearchParams();
    params.set('new', 'true');

    const recipientId = button.getAttribute('data-recipient-id');
    if (recipientId) {
      params.set('recipientId', recipientId);
    }

    const contextType = button.getAttribute('data-context-type');
    if (contextType) {
      params.set('contextType', contextType);
    }

    const contextId = button.getAttribute('data-context-id');
    if (contextId) {
      params.set('contextId', contextId);
    }

    const contextTitle = button.getAttribute('data-context-title');
    if (contextTitle) {
      params.set('contextTitle', contextTitle);
    }

    const prefill = button.getAttribute('data-prefill');
    if (prefill) {
      params.set('prefill', prefill);
    }

    // Navigate to messenger
    window.location.href = `/messenger/?${params.toString()}`;
  }

  /**
   * Handle open conversation button click
   * @param {HTMLElement} button
   */
  async function handleOpenConversation(button) {
    // Check authentication
    const isAuthenticated = await checkAuth();
    
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const currentUrl = encodeURIComponent(window.location.href);
      window.location.href = `/auth.html?redirect=${currentUrl}`;
      return;
    }

    const conversationId = button.getAttribute('data-conversation-id');
    if (!conversationId) {
      console.error('Missing data-conversation-id attribute');
      return;
    }

    // Navigate to specific conversation
    window.location.href = `/messenger/?conversation=${encodeURIComponent(conversationId)}`;
  }

  /**
   * Attach click handler to a messenger action button
   * @param {HTMLElement} button
   */
  function attachHandler(button) {
    // Avoid duplicate handlers
    if (button.hasAttribute('data-messenger-initialized')) {
      return;
    }
    button.setAttribute('data-messenger-initialized', 'true');

    const action = button.getAttribute('data-messenger-action');

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      
      try {
        if (action === 'new-conversation') {
          await handleNewConversation(button);
        } else if (action === 'open-conversation') {
          await handleOpenConversation(button);
        } else {
          console.warn('Unknown messenger action:', action);
        }
      } catch (error) {
        console.error('Error handling messenger action:', error);
        // Silently fail - navigation errors shouldn't break the page
      }
    });
  }

  /**
   * Initialize all messenger trigger buttons on the page
   */
  function initializeButtons() {
    const buttons = document.querySelectorAll('[data-messenger-action]');
    buttons.forEach(attachHandler);
  }

  /**
   * Set up MutationObserver to watch for dynamically added buttons
   */
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check added nodes
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is a messenger action button
            if (node.hasAttribute && node.hasAttribute('data-messenger-action')) {
              attachHandler(node);
            }
            // Check if the node contains messenger action buttons
            if (node.querySelectorAll) {
              const buttons = node.querySelectorAll('[data-messenger-action]');
              buttons.forEach(attachHandler);
            }
          }
        });
      });
    });

    // Observe the entire document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Store observer reference for cleanup
  let mutationObserver = null;

  /**
   * Initialize MessengerTrigger on DOMContentLoaded
   */
  function init() {
    initializeButtons();
    mutationObserver = setupMutationObserver();
  }

  /**
   * Cleanup and disconnect observer
   */
  function destroy() {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded
    init();
  }

  // Export for manual initialization if needed
  window.MessengerTrigger = {
    init,
    initializeButtons,
    attachHandler,
    destroy
  };
})();
