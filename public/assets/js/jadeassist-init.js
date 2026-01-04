/**
 * JadeAssist Widget Initialization
 * Initializes the JadeAssist chat widget with EventFlow branding
 */

(function () {
  'use strict';

  // Flag to prevent double initialization
  let initialized = false;

  /**
   * Initialize the JadeAssist widget with EventFlow brand colors
   */
  function initJadeWidget() {
    if (initialized) {
      console.log('JadeAssist widget already initialized');
      return;
    }

    if (typeof window.JadeWidget === 'undefined' || typeof window.JadeWidget.init !== 'function') {
      console.warn('JadeWidget not yet available, will retry...');
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
    } else {
      // Retry after a short delay
      setTimeout(waitForWidget, 100);
    }
  }

  // Start waiting for the widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForWidget);
  } else {
    waitForWidget();
  }
})();
