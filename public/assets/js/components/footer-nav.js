/**
 * EventFlow Footer Navigation Component
 * Fixed footer bar with quick navigation links
 * Shows/hides based on scroll position (visible when scrolled past top nav)
 */

(function () {
  'use strict';

  // Create and inject footer navigation HTML
  function createFooterNav() {
    // Check if footer nav already exists
    if (document.querySelector('.footer-nav')) {
      return;
    }

    const footerNav = document.createElement('div');
    footerNav.className = 'footer-nav footer-nav--hidden';
    footerNav.setAttribute('role', 'navigation');
    footerNav.setAttribute('aria-label', 'Quick navigation');
    footerNav.innerHTML = `
      <div class="footer-nav-content">
        <div class="footer-nav-links">
          <a href="/start.html" class="footer-nav-link">Plan</a>
          <a href="/suppliers.html" class="footer-nav-link">Suppliers</a>
          <a href="/plan.html" class="footer-nav-link">My Plan</a>
          <a href="/settings.html" class="footer-nav-link">Settings</a>
        </div>
      </div>
    `;

    document.body.appendChild(footerNav);
    
    // Add body padding class
    document.body.classList.add('has-footer-nav');
    
    // Initialize scroll behavior after a short delay to ensure DOM is ready
    setTimeout(() => {
      initScrollBehavior(footerNav);
    }, 100);
  }

  // Initialize scroll-based show/hide behavior
  function initScrollBehavior(footerNav) {
    // Get the top navigation element
    const topNav = document.querySelector('.header');
    if (!topNav) {
      // If no top nav found, keep footer nav hidden by default
      return;
    }

    // Calculate the threshold (height of top nav + some buffer)
    const getScrollThreshold = () => {
      return topNav.offsetHeight || 80;
    };

    let ticking = false;
    let threshold = getScrollThreshold();

    // Update threshold on resize
    const handleResize = () => {
      threshold = getScrollThreshold();
    };

    // Scroll handler with requestAnimationFrame for better performance
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          // Show footer nav when scrolled past the top nav
          if (currentScrollY > threshold) {
            footerNav.classList.remove('footer-nav--hidden');
            footerNav.classList.add('footer-nav--visible');
          } else {
            // Hide footer nav when at top of page
            footerNav.classList.remove('footer-nav--visible');
            footerNav.classList.add('footer-nav--hidden');
          }

          ticking = false;
        });

        ticking = true;
      }
    };

    // Add event listeners with passive flag for better performance
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check on page load
    handleScroll();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFooterNav);
  } else {
    createFooterNav();
  }
})();
