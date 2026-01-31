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
      const statsSection = document.querySelector('.dashboard-stats, #stats-section, .dashboard-content');
      
      if (!statsSection) return;
      
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
   */
  function setupPlanCreationConfetti() {
    // Listen for plan creation success
    const createPlanBtn = document.querySelector('#create-plan-btn, [data-action="create-plan"]');
    if (createPlanBtn) {
      createPlanBtn.addEventListener('click', () => {
        // Wait for the success response
        setTimeout(() => {
          // Check if this is the first plan (basic heuristic)
          const plansList = document.querySelectorAll('.plan-card, [data-plan-id]');
          if (plansList.length === 1 && typeof triggerSuccessConfetti === 'function') {
            triggerSuccessConfetti();
          }
        }, 1500);
      });
    }
  }

  /**
   * Trigger confetti on profile completion
   */
  function setupProfileCompletionConfetti() {
    // Check if profile was just completed
    const params = new URLSearchParams(window.location.search);
    if (params.get('profile_completed') === 'true' && typeof triggerSuccessConfetti === 'function') {
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
