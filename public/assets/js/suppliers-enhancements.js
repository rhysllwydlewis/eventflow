/**
 * Suppliers Page Enhancements
 * Applies P3 features to supplier listings
 */

(function () {
  'use strict';

  /**
   * Enhance supplier cards with P3 features
   */
  function enhanceSupplierCards() {
    // Wait for suppliers to be loaded
    const observer = new MutationObserver(() => {
      const supplierCards = document.querySelectorAll('.supplier-card, [data-supplier-id]');
      
      if (supplierCards.length > 0) {
        supplierCards.forEach(card => {
          // Add new badge if supplier is new
          const createdAt = card.dataset.createdAt || card.dataset.supplierCreated;
          if (createdAt && typeof addNewBadgeIfApplicable === 'function') {
            addNewBadgeIfApplicable(card, createdAt);
          }

          // Add photo click handlers for carousel
          const photos = card.querySelectorAll('img[data-supplier-photo]');
          photos.forEach(photo => {
            photo.classList.add('gallery-image');
          });
        });

        // Stop observing once cards are enhanced
        observer.disconnect();
      }
    });

    // Start observing
    const container = document.querySelector('#suppliers-list, .suppliers-container, #results-container');
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
    }

    // Also try immediate enhancement in case cards are already loaded
    setTimeout(() => {
      const cards = document.querySelectorAll('.supplier-card, [data-supplier-id]');
      cards.forEach(card => {
        // Check if badge already exists
        if (card.querySelector('.new-badge')) {
          return;
        }
        
        const createdAt = card.dataset.createdAt || card.dataset.supplierCreated;
        if (createdAt && typeof addNewBadgeIfApplicable === 'function') {
          addNewBadgeIfApplicable(card, createdAt);
        }
      });
    }, 1000);
  }

  /**
   * Add breadcrumbs to suppliers page
   */
  function addBreadcrumbs() {
    // Check if we're on a specific category page
    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');

    const breadcrumbs = [
      { label: 'Home', url: '/' },
      { label: 'Suppliers', url: '/suppliers' },
    ];

    if (category) {
      breadcrumbs.push({ label: category, url: `/suppliers?category=${category}` });
    }

    // Only render if more than 2 items
    if (breadcrumbs.length > 2 && typeof renderBreadcrumbs === 'function') {
      // Create container if it doesn't exist
      let container = document.getElementById('breadcrumb-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'breadcrumb-container';
        
        const mainContent = document.querySelector('main, #main-content, .container');
        if (mainContent) {
          mainContent.insertBefore(container, mainContent.firstChild);
        }
      }
      
      renderBreadcrumbs(breadcrumbs);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      enhanceSupplierCards();
      addBreadcrumbs();
    });
  } else {
    enhanceSupplierCards();
    addBreadcrumbs();
  }
})();
