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
  const MOBILE_BREAKPOINT = 768; // px - matches CSS media query breakpoint
  const RESIZE_DEBOUNCE_MS = 250; // Debounce delay for resize events

  // Shadow DOM selectors for avatar element (in order of priority)
  // These target the launcher button's image element within the widget's shadow DOM
  const AVATAR_SELECTORS = [
    'button[aria-label*="chat" i] img',
    '.jade-launcher-button img',
    '.jade-avatar-button img',
    '.jade-widget-button img',
    'button img',
    'img', // Fallback: any img in shadow root
  ];

  // State tracking
  let initialized = false;
  let retryCount = 0;
  let warningLogged = false;
  let teaserElement = null;
  let resizeAbortController = null; // For cleanup of resize listener

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
   * Apply shadow DOM-safe positioning
   * Directly manipulates the widget container inside shadow DOM
   */
  function applyShadowDOMPositioning() {
    const widgetRoot = document.querySelector('.jade-widget-root');
    if (!widgetRoot) {
      console.warn('⚠️ Widget root not found, cannot apply positioning');
      return false;
    }

    // Check if we're on mobile
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const bottom = isMobile ? '4.5rem' : '5rem';
    const left = isMobile ? '1rem' : '1.5rem';

    // Try to access shadow DOM and set positioning
    if (widgetRoot.shadowRoot) {
      const container = widgetRoot.shadowRoot.querySelector('.jade-widget-container');
      if (container) {
        container.style.bottom = bottom;
        container.style.left = left;
        container.style.right = 'auto'; // Override any right positioning
        console.log('✅ Applied shadow DOM positioning:', { bottom, left });
        return true;
      }
    }

    // Fallback: apply to widget root itself
    widgetRoot.style.bottom = bottom;
    widgetRoot.style.left = left;
    widgetRoot.style.right = 'auto';
    console.log('✅ Applied root-level positioning:', { bottom, left });
    return true;
  }

  /**
   * Apply custom avatar to widget launcher
   * Works with shadow DOM to set the avatar image
   */
  function applyAvatarToLauncher(avatarUrl) {
    const widgetRoot = document.querySelector('.jade-widget-root');
    if (!widgetRoot || !widgetRoot.shadowRoot) {
      console.warn('⚠️ Widget root or shadow DOM not found, cannot apply avatar');
      return false;
    }

    // Try multiple selectors to find the launcher button/icon
    let avatarImg = null;
    for (const selector of AVATAR_SELECTORS) {
      avatarImg = widgetRoot.shadowRoot.querySelector(selector);
      if (avatarImg) {
        console.log('✅ Found avatar element with selector:', selector);
        break;
      }
    }

    if (avatarImg) {
      avatarImg.src = avatarUrl;
      avatarImg.alt = 'Jade Assistant';
      console.log('✅ Applied custom avatar:', avatarUrl);
      return true;
    } else {
      console.warn('⚠️ Could not find avatar image element in shadow DOM');
      return false;
    }
  }

  /**
   * Apply custom styles for enhanced UX
   * Includes teaser styles and fallback positioning CSS
   */
  function applyCustomStyles() {
    // Check if styles already applied
    if (document.getElementById('jade-custom-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'jade-custom-styles';
    style.textContent = `
      /* Fallback widget positioning (in case shadow DOM manipulation doesn't work) */
      .jade-widget-root {
        /* Desktop: align with back-to-top at bottom: 5rem */
        bottom: 5rem !important;
        left: 1.5rem !important;
        right: auto !important;
      }

      @media (max-width: ${MOBILE_BREAKPOINT}px) {
        .jade-widget-root {
          /* Mobile: align with back-to-top at bottom: 4.5rem */
          bottom: 4.5rem !important;
          left: 1rem !important;
          right: auto !important;
        }
      }

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

      /* Ensure button maintains floating animation */
      @keyframes jade-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
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

    console.log('JadeAssist avatar URL:', avatarUrl);
    return avatarUrl;
  }

  /**
   * Check if avatar image loads successfully
   */
  function checkAvatarLoad(avatarUrl) {
    const img = new Image();
    img.onload = function () {
      console.log('✅ JadeAssist avatar loaded successfully');
    };
    img.onerror = function () {
      console.warn(
        '⚠️ JadeAssist avatar failed to load. Check that the image exists at:',
        avatarUrl
      );
    };
    img.src = avatarUrl;
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

      // Get avatar URL with subpath support
      const avatarUrl = getAvatarUrl();

      // Check if avatar loads (diagnostic)
      checkAvatarLoad(avatarUrl);

      // Initialize with configuration
      // Note: avatarUrl, offsetBottom, offsetLeft are not supported by this widget version
      // They are applied manually via shadow DOM manipulation below
      window.JadeWidget.init({
        primaryColor: '#00B2A9',
        accentColor: '#008C85',
        assistantName: 'Jade',
        greetingText: "Hi! I'm Jade. Ready to plan your event?",
        greetingTooltipText: '👋 Hi! Need help planning your event?',
        scale: 0.85, // 15% smaller for better mobile UX
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

      // Apply positioning via shadow DOM (more reliable than CSS overrides)
      setTimeout(() => {
        const positioningSuccess = applyShadowDOMPositioning();
        if (!positioningSuccess) {
          console.warn('⚠️ Could not apply shadow DOM positioning, relying on CSS fallback');
        }

        // Apply custom avatar to launcher
        const avatarSuccess = applyAvatarToLauncher(avatarUrl);
        if (!avatarSuccess) {
          console.warn('⚠️ Could not apply custom avatar, will retry after delay');
          // Retry avatar application after another delay
          setTimeout(() => {
            const retrySuccess = applyAvatarToLauncher(avatarUrl);
            if (!retrySuccess) {
              console.error('❌ Failed to apply custom avatar after retry');
            }
          }, 1000);
        }

        // Diagnostic: Report final positioning
        const widgetRoot = document.querySelector('.jade-widget-root');
        if (widgetRoot) {
          const rootStyles = window.getComputedStyle(widgetRoot);
          const shadowContainer = widgetRoot.shadowRoot?.querySelector('.jade-widget-container');

          console.log('📊 JadeAssist Widget Diagnostics:');
          console.log('   Root element:', {
            position: rootStyles.position,
            bottom: rootStyles.bottom,
            left: rootStyles.left,
            right: rootStyles.right,
          });

          if (shadowContainer) {
            const containerStyles = window.getComputedStyle(shadowContainer);
            console.log('   Shadow container:', {
              position: containerStyles.position,
              bottom: containerStyles.bottom,
              left: containerStyles.left,
              right: containerStyles.right,
            });
          } else {
            console.log('   Shadow container: not accessible');
          }
        } else {
          console.warn('⚠️ Widget root element (.jade-widget-root) not found in DOM');
        }
      }, 500);

      // Re-apply positioning on window resize for responsive behavior
      // Debounced to avoid excessive calls during resize
      // Uses AbortController for proper cleanup
      resizeAbortController = new AbortController();
      let resizeTimeout;
      window.addEventListener(
        'resize',
        () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            applyShadowDOMPositioning();
          }, RESIZE_DEBOUNCE_MS);
        },
        { signal: resizeAbortController.signal }
      );

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
