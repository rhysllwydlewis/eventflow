/**
 * JadeAssist Widget Initialization
 * Initializes the JadeAssist chat widget with EventFlow branding
 * Enhanced with UX improvements: avatar, positioning, teaser, larger hit area
 * Updated to use JadeAssist PR #10 native config API which adds support for:
 * - debug mode, offsetBottom/Left positioning, mobile positioning overrides
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
  const MOBILE_BREAKPOINT = 768; // px - matches CSS media query breakpoint

  // Positioning constants (now passed to widget config)
  // These values align the widget with the back-to-top button:
  // - Widget is positioned on the left (offsetLeft)
  // - Back-to-top button is positioned on the right (at same bottom offset)
  // - Both share the same baseline: 5rem desktop, 4.5rem mobile
  const DESKTOP_OFFSET_BOTTOM = '5rem';
  const DESKTOP_OFFSET_LEFT = '1.5rem';
  const MOBILE_OFFSET_BOTTOM = '4.5rem';
  const MOBILE_OFFSET_LEFT = '1rem';

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
   * Apply custom styles for teaser UX
   * Note: Widget positioning is now handled via config API, not CSS overrides
   */
  function applyCustomStyles() {
    // Check if styles already applied
    if (document.getElementById('jade-custom-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'jade-custom-styles';
    style.textContent = `
      /* Teaser bubble styles */
      .jade-teaser {
        position: fixed;
        bottom: 8rem; /* Above widget (widget at 5rem + 3rem spacing) */
        left: 1.5rem;
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
        left: 24px;
        width: 16px;
        height: 16px;
        background: white;
        transform: rotate(45deg);
        box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
      }

      /* Mobile adjustments for teaser */
      @media (max-width: ${MOBILE_BREAKPOINT}px) {
        .jade-teaser {
          bottom: 7.5rem; /* Above widget on mobile (widget at 4.5rem + 3rem spacing) */
          left: 1rem;
          max-width: calc(100vw - 2rem);
        }
      }

      /* Handle safe area insets for teaser on iOS */
      @supports (padding: env(safe-area-inset-bottom)) {
        .jade-teaser {
          bottom: calc(8rem + env(safe-area-inset-bottom));
        }

        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          .jade-teaser {
            bottom: calc(7.5rem + env(safe-area-inset-bottom));
          }
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Get the avatar URL, resolving relative paths for subpath deployments
   */
  function getAvatarUrl() {
    // Get the base path from the current page's base tag or use root
    const baseElement = document.querySelector('base');
    const basePath = baseElement ? baseElement.getAttribute('href') : '/';
    const avatarPath = 'assets/images/jade-avatar.png';

    // Construct the full avatar URL
    let avatarUrl;
    if (basePath === '/' || !basePath) {
      avatarUrl = `/${avatarPath}`;
    } else {
      // Remove trailing slash from basePath if present
      const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      avatarUrl = `${cleanBasePath}/${avatarPath}`;
    }

    return avatarUrl;
  }

  /**
   * Determine if debug mode should be enabled
   * Enable debug on non-production hostnames or via query param
   * 
   * Troubleshooting tip: Append ?jade-debug to the URL to enable diagnostic logs
   * in the console, including avatar loading status and widget initialization details.
   */
  function shouldEnableDebug() {
    // Check for debug query parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('jade-debug')) {
      return true;
    }

    // Enable on localhost and common dev domains
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('.local') ||
      hostname.includes('dev.') ||
      hostname.includes('staging.')
    );
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
      // Apply custom styles for teaser
      applyCustomStyles();

      // Get avatar URL with subpath support
      const avatarUrl = getAvatarUrl();

      // Determine debug mode
      const debug = shouldEnableDebug();

      // Initialize with configuration using new API
      window.JadeWidget.init({
        // Brand colors
        primaryColor: '#00B2A9',
        accentColor: '#008C85',

        // Assistant configuration
        assistantName: 'Jade',
        greetingText: "Hi! I'm Jade. Ready to plan your event?",
        greetingTooltipText: '👋 Hi! Need help planning your event?',

        // Avatar (supported by JadeAssist PR #10 API)
        // Points to /assets/images/jade-avatar.png
        avatarUrl: avatarUrl,

        // Desktop positioning (supported by JadeAssist PR #10 API)
        // Aligns with back-to-top button on opposite side (both at bottom: 5rem)
        offsetBottom: DESKTOP_OFFSET_BOTTOM,
        offsetLeft: DESKTOP_OFFSET_LEFT,

        // Mobile positioning (supported by JadeAssist PR #10 API)
        // Aligns with back-to-top button on opposite side (both at bottom: 4.5rem)
        offsetBottomMobile: MOBILE_OFFSET_BOTTOM,
        offsetLeftMobile: MOBILE_OFFSET_LEFT,

        // Size and debug
        scale: 0.85, // 15% smaller for better mobile UX
        debug: debug, // Enable diagnostic logs on dev environments or with ?jade-debug
      });

      initialized = true;
      console.log('JadeAssist widget initialized successfully');

      // Ensure chat is closed on initialization (defensive)
      setTimeout(() => {
        if (window.JadeWidget && typeof window.JadeWidget.close === 'function') {
          window.JadeWidget.close();
          console.log('JadeAssist chat ensured closed on load');
        }
      }, 100);

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
