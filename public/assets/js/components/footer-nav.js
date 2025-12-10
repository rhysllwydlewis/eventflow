/**
 * EventFlow Footer Navigation Component
 * Fixed footer bar with quick navigation links
 */

(function() {
  'use strict';

  // Create and inject footer navigation HTML
  function createFooterNav() {
    // Check if footer nav already exists
    if (document.querySelector('.footer-nav')) {
      return;
    }

    const footerNav = document.createElement('div');
    footerNav.className = 'footer-nav';
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
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFooterNav);
  } else {
    createFooterNav();
  }
})();
