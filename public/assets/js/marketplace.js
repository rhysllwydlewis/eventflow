/**
 * EventFlow Marketplace - Interactive features
 * Handles map, filters, search, and view toggling
 */

(function () {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initMap();
    initFilters();
    initViewToggle();
    initQuickActions();
    updateResultCount();
  }

  // Initialize map functionality
  function initMap() {
    const useLocationBtn = document.getElementById('marketplace-map-use-location');
    const postcodeForm = document.getElementById('marketplace-map-postcode-form');
    const postcodeInput = document.getElementById('marketplace-map-postcode');
    const mapIframe = document.getElementById('marketplace-map');
    const mapStatus = document.getElementById('marketplace-map-status');

    if (!useLocationBtn || !postcodeForm || !mapIframe) {
      return;
    }

    // Use current location
    useLocationBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showMapStatus('Geolocation is not supported by your browser', 'error');
        return;
      }

      showMapStatus('Getting your location...', 'loading');
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          const query = `event+marketplace+items+near+${latitude},${longitude}`;
          mapIframe.src = `https://www.google.com/maps?q=${query}&output=embed`;
          showMapStatus(`Showing items near your location`, 'success');
        },
        error => {
          showMapStatus('Unable to get your location. Please try entering a postcode.', 'error');
          console.error('Geolocation error:', error);
        }
      );
    });

    // Search by postcode
    postcodeForm.addEventListener('submit', e => {
      e.preventDefault();
      const postcode = postcodeInput.value.trim();

      if (!postcode) {
        showMapStatus('Please enter a postcode', 'error');
        return;
      }

      showMapStatus(`Searching near ${postcode}...`, 'loading');
      const query = `event+marketplace+items+near+${encodeURIComponent(postcode)}+UK`;
      mapIframe.src = `https://www.google.com/maps?q=${query}&output=embed`;
      showMapStatus(`Showing items near ${postcode}`, 'success');
    });

    function showMapStatus(message, type) {
      if (!mapStatus) {
        return;
      }
      mapStatus.textContent = message;
      mapStatus.style.color =
        type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#6b7280';
      mapStatus.style.marginTop = '8px';
    }
  }

  // Initialize filters
  function initFilters() {
    const categoryFilter = document.getElementById('marketplace-filter-category');
    const priceFilter = document.getElementById('marketplace-filter-price');
    const conditionFilter = document.getElementById('marketplace-filter-condition');
    const radiusFilter = document.getElementById('marketplace-filter-radius');
    const queryInput = document.getElementById('marketplace-filter-query');
    const sortSelect = document.getElementById('marketplace-sort');

    // Add change listeners
    [categoryFilter, priceFilter, conditionFilter, radiusFilter, sortSelect].forEach(element => {
      if (element) {
        element.addEventListener('change', applyFilters);
      }
    });

    if (queryInput) {
      // Debounce search input
      let searchTimeout;
      queryInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
      });
    }

    function applyFilters() {
      // In a real implementation, this would filter the displayed items
      // For now, we'll just update the result count
      updateResultCount();

      // Show filtering feedback
      const tips = document.getElementById('marketplace-results-tips');
      if (tips && hasActiveFilters()) {
        tips.style.display = 'none';
      } else if (tips) {
        tips.style.display = 'block';
      }
    }

    function hasActiveFilters() {
      return (
        (categoryFilter && categoryFilter.value) ||
        (priceFilter && priceFilter.value) ||
        (conditionFilter && conditionFilter.value) ||
        (radiusFilter && radiusFilter.value) ||
        (queryInput && queryInput.value.trim())
      );
    }
  }

  // Initialize view toggle (grid/list)
  function initViewToggle() {
    const toggleBtn = document.getElementById('marketplace-view-toggle');
    const resultsContainer = document.getElementById('marketplace-results');
    const viewIcon = document.getElementById('view-icon');

    if (!toggleBtn || !resultsContainer) {
      return;
    }

    let isGridView = true;

    toggleBtn.addEventListener('click', () => {
      isGridView = !isGridView;

      if (isGridView) {
        resultsContainer.className = 'marketplace-grid';
        if (viewIcon) {
          viewIcon.textContent = '⊞';
        }
        toggleBtn.textContent = '';
        const icon = document.createElement('span');
        icon.id = 'view-icon';
        icon.textContent = '⊞';
        toggleBtn.appendChild(icon);
        toggleBtn.appendChild(document.createTextNode(' Grid View'));
      } else {
        resultsContainer.className = 'marketplace-list';
        if (viewIcon) {
          viewIcon.textContent = '☰';
        }
        toggleBtn.textContent = '';
        const icon = document.createElement('span');
        icon.id = 'view-icon';
        icon.textContent = '☰';
        toggleBtn.appendChild(icon);
        toggleBtn.appendChild(document.createTextNode(' List View'));
      }
    });
  }

  // Initialize quick action buttons
  function initQuickActions() {
    // Quick search buttons
    const searchButtons = document.querySelectorAll('[data-marketplace-search]');
    searchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const searchTerm = btn.getAttribute('data-marketplace-search');
        const queryInput = document.getElementById('marketplace-filter-query');
        if (queryInput) {
          queryInput.value = searchTerm;
          queryInput.dispatchEvent(new Event('input'));
        }
      });
    });

    // Quick category buttons
    const categoryButtons = document.querySelectorAll('[data-marketplace-category]');
    categoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-marketplace-category');
        const categoryFilter = document.getElementById('marketplace-filter-category');
        if (categoryFilter) {
          categoryFilter.value = category;
          categoryFilter.dispatchEvent(new Event('change'));
        }
      });
    });

    // Save item buttons
    const saveButtons = document.querySelectorAll('.marketplace-save-btn');
    saveButtons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); // Prevent card click
        btn.classList.toggle('saved');
        btn.textContent = btn.classList.contains('saved') ? '♥' : '♡';

        // Show feedback
        if (btn.classList.contains('saved')) {
          showToast('Item saved to favourites');
        } else {
          showToast('Item removed from favourites');
        }
      });
    });

    // Sell item button
    const sellBtn = document.getElementById('sell-item-btn');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        showToast('Listing feature coming soon! Sign up to be notified.');
      });
    }

    // Item card clicks
    const itemCards = document.querySelectorAll('.marketplace-item-card');
    itemCards.forEach(card => {
      card.addEventListener('click', e => {
        // Don't trigger if clicking save button
        if (e.target.closest('.marketplace-save-btn')) {
          return;
        }
        showToast('Item details coming soon!');
      });
    });
  }

  // Update result count
  function updateResultCount() {
    const resultCount = document.getElementById('marketplace-result-count');
    const itemCards = document.querySelectorAll('.marketplace-item-card');

    if (resultCount && itemCards.length > 0) {
      resultCount.textContent = `Showing ${itemCards.length} example listings`;
    }
  }

  // Show toast notification
  function showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'marketplace-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    @keyframes slideDown {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
    }
  `;
  document.head.appendChild(style);
})();
