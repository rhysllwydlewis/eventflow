/**
 * JadeAssist Widget Initialization
 * Initializes the JadeAssist chat widget with EventFlow branding
 * Enhanced with UX improvements: avatar, positioning, teaser, larger hit area
 */

(function () {
  'use strict';

  // Configuration
  const MAX_RETRIES = 50; // Maximum retry attempts (5 seconds with 100ms interval)
  const RETRY_INTERVAL = 100; // Retry interval in milliseconds
  const INIT_DELAY = 1000; // Delay before initializing widget (1 second)
  const TEASER_DELAY = 500; // Delay before showing teaser after init (500ms)
  const TEASER_STORAGE_KEY = 'jadeassist-teaser-dismissed';
  const TEASER_EXPIRY_DAYS = 1; // Teaser dismissal persists for 1 day

  // State tracking
  let initialized = false;
  let retryCount = 0;
  let warningLogged = false;
  let teaserElement = null;

  /**
   * Check if teaser was recently dismissed
   */
  function isTeaserDismissed() {
    try {
      const dismissed = localStorage.getItem(TEASER_STORAGE_KEY);
      if (!dismissed) {
        return false;
      }

      const dismissedTime = parseInt(dismissed, 10);
      const now = Date.now();
      const expiryTime = TEASER_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      if (now - dismissedTime > expiryTime) {
        localStorage.removeItem(TEASER_STORAGE_KEY);
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Mark teaser as dismissed
   */
  function dismissTeaser() {
    try {
      localStorage.setItem(TEASER_STORAGE_KEY, Date.now().toString());
    } catch (e) {
      console.warn('Could not save teaser dismissal state');
    }

    if (teaserElement) {
      teaserElement.style.opacity = '0';
      teaserElement.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (teaserElement && teaserElement.parentNode) {
          teaserElement.parentNode.removeChild(teaserElement);
        }
        teaserElement = null;
      }, 300);
    }
  }

  /**
   * Open the chat widget
   */
  function openChat() {
    if (window.JadeWidget && typeof window.JadeWidget.open === 'function') {
      window.JadeWidget.open();
    }
  }

  /**
   * Create and show teaser message bubble
   */
  function showTeaser() {
    if (isTeaserDismissed()) {
      return;
    }

    // Create teaser bubble
    teaserElement = document.createElement('div');
    teaserElement.className = 'jade-teaser';
    teaserElement.innerHTML = `
      <div class="jade-teaser-content">
        <span class="jade-teaser-text">Hi, I'm Jade — want help finding venues and trusted suppliers?</span>
        <button class="jade-teaser-close" aria-label="Dismiss message">×</button>
      </div>
    `;

    document.body.appendChild(teaserElement);

    // Add event listeners
    const closeBtn = teaserElement.querySelector('.jade-teaser-close');
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      dismissTeaser();
    });

    teaserElement.addEventListener('click', () => {
      dismissTeaser();
      openChat();
    });

    // Animate in
    setTimeout(() => {
      if (teaserElement) {
        teaserElement.classList.add('jade-teaser-visible');
      }
    }, 50);
  }

  /**
   * Apply custom styles for enhanced UX
   */
  function applyCustomStyles() {
    // Check if styles already applied
    if (document.getElementById('jade-custom-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'jade-custom-styles';
    style.textContent = `
      /* Enhanced hit area for floating button */
      #jade-widget-container {
        /* Position below back-to-top button (at 5rem) with 5rem additional spacing = 10rem total */
        bottom: 10rem !important;
        right: 1.5rem !important;
        z-index: 999 !important;
      }

      #jade-widget-button {
        position: relative;
      }

      /* Larger click/tap target using pseudo-element */
      #jade-widget-button::before {
        content: '';
        position: absolute;
        top: -12px;
        left: -12px;
        right: -12px;
        bottom: -12px;
        border-radius: 50%;
        /* Invisible but clickable area */
      }

      /* Teaser bubble styles */
      .jade-teaser {
        position: fixed;
        bottom: 13rem; /* Above widget */
        right: 1.5rem;
        max-width: 280px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        padding: 0;
        z-index: 998;
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
        cursor: pointer;
      }

      .jade-teaser-visible {
        opacity: 1;
        transform: translateY(0);
      }

      .jade-teaser-content {
        padding: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .jade-teaser-text {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
        color: #0B1220;
        font-weight: 500;
      }

      .jade-teaser-close {
        flex-shrink: 0;
        background: none;
        border: none;
        font-size: 20px;
        line-height: 1;
        color: #667085;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background 0.2s ease, color 0.2s ease;
      }

      .jade-teaser-close:hover {
        background: #F3F4F6;
        color: #0B1220;
      }

      /* Add a little arrow pointing to the button */
      .jade-teaser::after {
        content: '';
        position: absolute;
        bottom: -8px;
        right: 24px;
        width: 16px;
        height: 16px;
        background: white;
        transform: rotate(45deg);
        box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
      }

      /* Mobile adjustments */
      @media (max-width: 768px) {
        #jade-widget-container {
          /* Ensure it's above mobile footer nav (56px) + back-to-top */
          bottom: 11rem !important; /* Footer (3.5rem) + back-to-top (5rem) + spacing (2.5rem) */
          right: 1rem !important;
        }

        .jade-teaser {
          bottom: 14rem;
          right: 1rem;
          max-width: calc(100vw - 2rem);
        }
      }

      /* Ensure button maintains floating animation */
      @keyframes jade-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }

      /* Handle safe area insets for iOS */
      @supports (padding: env(safe-area-inset-bottom)) {
        #jade-widget-container {
          bottom: calc(10rem + env(safe-area-inset-bottom)) !important;
        }

        .jade-teaser {
          bottom: calc(13rem + env(safe-area-inset-bottom));
        }

        @media (max-width: 768px) {
          #jade-widget-container {
            bottom: calc(11rem + env(safe-area-inset-bottom)) !important;
          }

          .jade-teaser {
            bottom: calc(14rem + env(safe-area-inset-bottom));
          }
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize the JadeAssist widget with EventFlow brand colors
   */
  function initJadeWidget() {
    if (initialized) {
      console.log('JadeAssist widget already initialized');
      return;
    }

    if (typeof window.JadeWidget === 'undefined' || typeof window.JadeWidget.init !== 'function') {
      if (!warningLogged) {
        console.warn('JadeWidget not yet available, will retry...');
        warningLogged = true;
      }
      return;
    }

    try {
      // Apply custom styles first
      applyCustomStyles();

      // Initialize with configuration
      window.JadeWidget.init({
        primaryColor: '#00B2A9',
        accentColor: '#008C85',
        assistantName: 'Jade',
        greetingText: "Hi! I'm Jade. Ready to plan your event?",
        // Avatar served from EventFlow domain for better performance and control
        avatarUrl: '/assets/images/jade-avatar.svg',
      });

      initialized = true;
      console.log('JadeAssist widget initialized successfully');

      // Show teaser after delay
      setTimeout(showTeaser, TEASER_DELAY);
    } catch (error) {
      console.error('Failed to initialize JadeAssist widget:', error);
    }
  }

  /**
   * Wait for the widget script to load and then initialize
   */
  function waitForWidget() {
    if (typeof window.JadeWidget !== 'undefined' && typeof window.JadeWidget.init === 'function') {
      initJadeWidget();
    } else if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(waitForWidget, RETRY_INTERVAL);
    } else {
      console.warn('JadeAssist widget failed to load after maximum retries');
    }
  }

  /**
   * Start initialization with delay
   */
  function startInitialization() {
    // Delay initialization by ~1 second to let page render first
    setTimeout(waitForWidget, INIT_DELAY);
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInitialization);
  } else {
    startInitialization();
  }
})();
