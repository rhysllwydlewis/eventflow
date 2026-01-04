/**
 * JadeAssist Widget Initialization
 * Initializes the JadeAssist chat widget with EventFlow branding
 */

(function () {
  'use strict';

  // Configuration
  const MAX_RETRIES = 50; // Maximum retry attempts (5 seconds with 100ms interval)
  const RETRY_INTERVAL = 100; // Retry interval in milliseconds

  // State tracking
  let initialized = false;
  let retryCount = 0;
  let warningLogged = false;

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
      window.JadeWidget.init({
        primaryColor: '#00B2A9',
        accentColor: '#008C85',
        assistantName: 'Jade',
        greetingText: "Hi! I'm Jade. Ready to plan your event?",
      });

      initialized = true;
      console.log('JadeAssist widget initialized successfully');
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

  // Start waiting for the widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForWidget);
  } else {
    waitForWidget();
  }
})();
