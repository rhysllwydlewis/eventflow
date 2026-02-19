/**
 * Customer Dashboard Enhancements
 * Adds recommendations widget and other P3 features
 */

(function () {
  'use strict';

  /**
   * Add recommendations widget to dashboard
   */
  function addRecommendationsWidget() {
    // Check if widget already exists
    if (document.getElementById('recommendations-widget')) {
      return;
    }

    // Use MutationObserver instead of setTimeout
    const observer = new MutationObserver(() => {
      const statsSection = document.querySelector('#customer-stats-grid');

      if (!statsSection) {
        return;
      }

      // Double-check widget doesn't exist
      if (document.getElementById('recommendations-widget')) {
        observer.disconnect();
        return;
      }

      // Create widget container
      const widgetContainer = document.createElement('div');
      widgetContainer.id = 'recommendations-widget';
      widgetContainer.className = 'recommendations-widget';
      widgetContainer.style.display = 'none';

      // Insert after stats section
      statsSection.insertAdjacentElement('afterend', widgetContainer);

      // Initialize the widget
      if (window.RecommendationsWidget) {
        window.RecommendationsWidget.init();
      }

      observer.disconnect();
    });

    // Start observing
    const main = document.querySelector('main, #main-content, body');
    if (main) {
      observer.observe(main, { childList: true, subtree: true });

      // Disconnect after 10 seconds if the target element never appears
      setTimeout(() => {
        observer.disconnect();
        console.warn('addRecommendationsWidget: #customer-stats-grid not found within 10 seconds. Observer disconnected.');
      }, 10000);
    }
  }

  /**
   * Trigger confetti on profile completion
   */
  function setupProfileCompletionConfetti() {
    // Check if profile was just completed
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('profile_completed') === 'true' &&
      typeof triggerSuccessConfetti === 'function'
    ) {
      // Small delay for page to load
      setTimeout(() => {
        try {
          triggerSuccessConfetti();
        } catch (err) {
          console.warn('setupProfileCompletionConfetti: confetti call failed (canvas-confetti may not have loaded):', err);
        }
        // Remove param from URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 500);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addRecommendationsWidget();
      setupProfileCompletionConfetti();
    });
  } else {
    addRecommendationsWidget();
    setupProfileCompletionConfetti();
  }
})();
