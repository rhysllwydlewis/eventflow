/**
 * P3-04: Typing Indicator for Messages
 * WebSocket-based typing indicator
 */

(function () {
  'use strict';

  let typingTimeout = null;
  let typingIndicatorElement = null;
  const TYPING_TIMEOUT = 3000; // 3 seconds

  /**
   * Initialize typing indicator for conversation page
   */
  function initTypingIndicator() {
    // Only run on conversation page
    if (!window.location.pathname.includes('conversation')) {
      return;
    }

    createTypingIndicatorElement();

    // Hook into message input
    const messageInput = document.querySelector('#message-input, .message-input, textarea[name="message"]');
    if (messageInput) {
      messageInput.addEventListener('input', handleTypingInput);
      messageInput.addEventListener('blur', handleTypingStop);
    }

    // Listen for WebSocket typing events
    if (window.socket) {
      setupWebSocketListeners();
    } else {
      // Wait for socket to be initialized
      setTimeout(() => {
        if (window.socket) {
          setupWebSocketListeners();
        }
      }, 1000);
    }

    console.log('✓ Typing indicator initialized');
  }

  /**
   * Create typing indicator HTML element
   */
  function createTypingIndicatorElement() {
    const messagesContainer = document.querySelector('.messages-container, .chat-messages, #messages-container');
    if (!messagesContainer) return;

    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'typing-indicator';
    indicator.style.display = 'none';
    indicator.innerHTML = `
      <span class="typing-text">Typing</span>
      <span class="typing-dots">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </span>
    `;

    messagesContainer.appendChild(indicator);
    typingIndicatorElement = indicator;
  }

  /**
   * Handle typing input event
   */
  function handleTypingInput() {
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Emit typing start event
    emitTypingStart();

    // Set timeout to emit typing stop
    typingTimeout = setTimeout(() => {
      emitTypingStop();
    }, TYPING_TIMEOUT);
  }

  /**
   * Handle typing stop
   */
  function handleTypingStop() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    emitTypingStop();
  }

  /**
   * Emit typing start event via WebSocket
   */
  function emitTypingStart() {
    if (!window.socket || !window.currentThreadId) return;

    window.socket.emit('typing:start', {
      threadId: window.currentThreadId,
      recipientId: window.currentRecipientId,
    });
  }

  /**
   * Emit typing stop event via WebSocket
   */
  function emitTypingStop() {
    if (!window.socket || !window.currentThreadId) return;

    window.socket.emit('typing:stop', {
      threadId: window.currentThreadId,
      recipientId: window.currentRecipientId,
    });
  }

  /**
   * Setup WebSocket listeners for typing events
   */
  function setupWebSocketListeners() {
    if (!window.socket) return;

    // Listen for typing started
    window.socket.on('typing:started', data => {
      if (data.threadId === window.currentThreadId) {
        showTypingIndicator();
      }
    });

    // Listen for typing stopped
    window.socket.on('typing:stopped', data => {
      if (data.threadId === window.currentThreadId) {
        hideTypingIndicator();
      }
    });
  }

  /**
   * Show typing indicator
   */
  function showTypingIndicator() {
    if (!typingIndicatorElement) return;
    
    typingIndicatorElement.style.display = 'inline-flex';
    
    // Auto-hide after timeout
    setTimeout(() => {
      hideTypingIndicator();
    }, TYPING_TIMEOUT);

    // Scroll to bottom if needed
    const container = typingIndicatorElement.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Hide typing indicator
   */
  function hideTypingIndicator() {
    if (!typingIndicatorElement) return;
    typingIndicatorElement.style.display = 'none';
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTypingIndicator);
  } else {
    initTypingIndicator();
  }

  // Export for use in other scripts
  if (typeof window !== 'undefined') {
    window.TypingIndicator = {
      init: initTypingIndicator,
      show: showTypingIndicator,
      hide: hideTypingIndicator,
    };
  }
})();
