/**
 * P3-15: Recommended Suppliers Widget
 * Display recommended suppliers based on user preferences
 */

(function () {
  'use strict';

  /**
   * Initialize recommendations widget
   */
  async function initRecommendations() {
    const widget = document.getElementById('recommendations-widget');
    if (!widget) {
      return;
    }

    // Get user preferences from data attributes or localStorage
    const category = widget.dataset.category || localStorage.getItem('preferredCategory');
    const location = widget.dataset.location || localStorage.getItem('preferredLocation');
    const budget = widget.dataset.budget;
    const eventType = widget.dataset.eventType;

    try {
      const recommendations = await fetchRecommendations({
        category,
        location,
        budget,
        eventType,
      });

      renderRecommendations(widget, recommendations);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      widget.style.display = 'none';
    }
  }

  /**
   * Fetch recommendations from API
   */
  async function fetchRecommendations(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.category) {
      queryParams.append('category', params.category);
    }
    if (params.location) {
      queryParams.append('location', params.location);
    }
    if (params.budget) {
      queryParams.append('budget', params.budget);
    }
    if (params.eventType) {
      queryParams.append('eventType', params.eventType);
    }

    const response = await fetch(`/api/public/recommendations?${queryParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch recommendations');
    }

    const data = await response.json();
    return data.recommendations || [];
  }

  /**
   * Render recommendations in widget
   */
  function renderRecommendations(widget, recommendations) {
    if (!recommendations || recommendations.length === 0) {
      widget.style.display = 'none';
      return;
    }

    widget.innerHTML = `
      <div class="recommendations-header">
        <h3 class="recommendations-title">Recommended for You</h3>
        <a href="/suppliers" class="recommendations-view-all">View All →</a>
      </div>
      <div class="recommendations-grid">
        ${recommendations
          .map(
            supplier => `
          <div class="recommendation-card" onclick="window.location.href='/supplier?id=${supplier.id}'">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
              ${
                supplier.logo
                  ? `<img src="${supplier.logo}" alt="${supplier.businessName}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">`
                  : `<div style="width: 50px; height: 50px; border-radius: 50%; background: var(--accent, #13B6A2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.25rem;">${(supplier.businessName || 'S').charAt(0).toUpperCase()}</div>`
              }
              <div style="flex: 1;">
                <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: #1f2937;">${supplier.businessName || 'Supplier'}</h4>
                <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">${supplier.category || ''}</p>
              </div>
            </div>
            ${supplier.location ? `<p style="margin: 0 0 0.5rem; font-size: 0.875rem; color: #6b7280;">📍 ${supplier.location}</p>` : ''}
            ${supplier.averageRating ? `<p style="margin: 0; font-size: 0.875rem; color: #6b7280;">⭐ ${supplier.averageRating.toFixed(1)} (${supplier.reviewCount || 0} reviews)</p>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `;

    console.log(`✓ Rendered ${recommendations.length} recommendations`);
  }

  /**
   * Create and insert recommendations widget
   */
  function createRecommendationsWidget(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    const widget = document.createElement('div');
    widget.id = 'recommendations-widget';
    widget.className = 'recommendations-widget';

    if (options.category) {
      widget.dataset.category = options.category;
    }
    if (options.location) {
      widget.dataset.location = options.location;
    }
    if (options.budget) {
      widget.dataset.budget = options.budget;
    }
    if (options.eventType) {
      widget.dataset.eventType = options.eventType;
    }

    container.appendChild(widget);

    return initRecommendations();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecommendations);
  } else {
    initRecommendations();
  }

  // Export for use in other scripts
  if (typeof window !== 'undefined') {
    window.RecommendationsWidget = {
      init: initRecommendations,
      create: createRecommendationsWidget,
      fetch: fetchRecommendations,
    };
  }
})();
