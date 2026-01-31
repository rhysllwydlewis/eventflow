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
    // Wait for dashboard to load
    setTimeout(() => {
      // Look for a good place to insert the widget
      const statsSection = document.querySelector('.dashboard-stats, #stats-section, .dashboard-content');
      
      if (!statsSection) return;
      
      // Check if widget already exists
      if (document.getElementById('recommendations-widget')) return;

      // Create widget container
      const widgetContainer = document.createElement('div');
      widgetContainer.id = 'recommendations-widget';
      widgetContainer.className = 'recommendations-widget';
      widgetContainer.style.display = 'none'; // Will be shown by the widget script if recommendations exist

      // Insert after stats section
      statsSection.insertAdjacentElement('afterend', widgetContainer);

      // Initialize the widget
      if (window.RecommendationsWidget) {
        window.RecommendationsWidget.init();
      }
    }, 2000);
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
