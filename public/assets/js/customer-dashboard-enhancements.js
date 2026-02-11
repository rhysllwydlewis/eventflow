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
    }
  }

  /**
   * Trigger confetti on first plan creation
   * NOTE: Disabled - customer dashboard has no plan creation trigger elements
   */
  function setupPlanCreationConfetti() {
    // Customer dashboard doesn't have #create-plan-btn or [data-action="create-plan"]
    // Plan creation happens on a different page (/start or /plan.html)
    // Confetti should be triggered there, not here
    return;
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
        triggerSuccessConfetti();
        // Remove param from URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 500);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      addRecommendationsWidget();
      setupPlanCreationConfetti();
      setupProfileCompletionConfetti();
    });
  } else {
    addRecommendationsWidget();
    setupPlanCreationConfetti();
    setupProfileCompletionConfetti();
  }
})();
