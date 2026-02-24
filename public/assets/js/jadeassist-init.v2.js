/**
 * JadeAssist Widget Initialization
 * Initializes the JadeAssist chat widget with EventFlow branding
 * Enhanced with UX improvements: avatar, positioning, teaser, larger hit area
 * Updated to use JadeAssist PR #10 native config API which adds support for:
 * - debug mode, offsetBottom/Left positioning, mobile positioning overrides
 */

const isDevelopment =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
(function () {
  'use strict';

  // Global initialization guard - prevent double-init if script loads twice
  if (window.__JADE_WIDGET_INITIALIZED__) {
    console.warn('[JadeAssist] Widget already initialized, skipping duplicate init');
    return;
  }
  window.__JADE_WIDGET_INITIALIZED__ = true;

  // Configuration
  const MAX_RETRIES = 50; // Maximum retry attempts (5 seconds with 100ms interval)
  const RETRY_INTERVAL = 100; // Retry interval in milliseconds
  const INIT_DELAY = 2000; // Delay before initializing widget (2 seconds - prioritize page content first)

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
   * Verify avatar loads correctly (for debug mode)
   */
  function verifyAvatarLoad(avatarUrl) {
    const img = new Image();
    img.onload = () => {
      if (isDevelopment) {
        console.log('[JadeAssist] Avatar loaded successfully:', avatarUrl);
      }
    };
    img.onerror = () => {
      console.warn('[JadeAssist] Avatar failed to load, widget will use default');
      // Widget has built-in fallback to emoji, this just logs the issue
    };
    img.src = avatarUrl;
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
    // Determine debug mode
    const debug = shouldEnableDebug();

    if (initialized) {
      if (debug) {
        if (isDevelopment) {
          console.log('[JadeAssist] Widget already initialized');
        }
      }
      return;
    }

    if (typeof window.JadeWidget === 'undefined' || typeof window.JadeWidget.init !== 'function') {
      if (debug || !warningLogged) {
        console.warn('[JadeAssist] Widget not yet available, will retry...');
        warningLogged = true;
      }
      return;
    }

    try {
      // Get avatar URL with subpath support
      const avatarUrl = getAvatarUrl();

      // Verify avatar loads in debug mode
      if (debug) {
        verifyAvatarLoad(avatarUrl);
      }

      // Initialize with configuration using new API
      window.JadeWidget.init({
        // Brand colors
        primaryColor: '#00B2A9',
        accentColor: '#008C85',

        // Assistant configuration
        assistantName: 'Jade',
        greetingText: "Hi! I'm Jade. Ready to plan your event?",
        greetingTooltipText:
          'Hi! I am Jade, your virtual event planner. Can I help you plan your event?',

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
      if (debug) {
        if (isDevelopment) {
          console.log('[JadeAssist] Widget initialized successfully');
        }
      }

      // Ensure chat is closed on initialization (defensive)
      setTimeout(() => {
        if (window.JadeWidget && typeof window.JadeWidget.close === 'function') {
          window.JadeWidget.close();
          if (debug) {
            if (isDevelopment) {
              console.log('[JadeAssist] Chat ensured closed on load');
            }
          }
        }
      }, 100);

      // Custom teaser removed - using widget's built-in greetingTooltipText instead
      // This eliminates duplicate teasers and uses the widget's native, functional greeting
    } catch (error) {
      console.error('[JadeAssist] Failed to initialize widget:', error);
    }
  }

  /**
   * Wait for the widget script to load and then initialize
   */
  function waitForWidget() {
    const debug = shouldEnableDebug();

    if (typeof window.JadeWidget !== 'undefined' && typeof window.JadeWidget.init === 'function') {
      initJadeWidget();
    } else if (retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(waitForWidget, RETRY_INTERVAL);
    } else {
      if (debug) {
        console.warn('[JadeAssist] Widget failed to load after maximum retries');
      }
    }
  }

  /**
   * Start initialization with delay
   */
  function startInitialization() {
    // Delay initialization by 2 seconds to prioritize page content
    setTimeout(waitForWidget, INIT_DELAY);
  }

  // Start initialization when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startInitialization);
  } else {
    startInitialization();
  }
})();
