/**
 * EventFlow Footer Navigation Component
 * Fixed footer bar with quick navigation links and theme toggle
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
        <button id="footer-theme-toggle" class="footer-theme-icon-btn" type="button" aria-label="Toggle dark mode" title="Toggle dark mode">
          <svg class="theme-icon-light" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
          <svg class="theme-icon-dark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(footerNav);

    // Initialize theme toggle in footer
    initFooterThemeToggle();
  }

  // Initialize theme toggle functionality in footer
  function initFooterThemeToggle() {
    const btn = document.getElementById('footer-theme-toggle');
    if (!btn) return;

    const root = document.documentElement;
    const THEME_KEY = 'ef-theme';

    // Sync with current theme
    const syncAria = () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        isDark ? 'Switch to light mode' : 'Switch to dark mode'
      );
    };

    syncAria();

    // Listen for theme changes from header toggle or system preference
    const observer = new MutationObserver(() => {
      syncAria();
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // Toggle theme on click
    btn.addEventListener('click', () => {
      const isDark = root.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      
      if (next === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else {
        root.removeAttribute('data-theme');
      }

      try {
        if (window.localStorage) localStorage.setItem(THEME_KEY, next);
      } catch (_) {}
      
      syncAria();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFooterNav);
  } else {
    createFooterNav();
  }
})();
