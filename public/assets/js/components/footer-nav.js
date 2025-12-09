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
        <button id="footer-theme-toggle" class="footer-theme-btn" type="button" aria-label="Toggle dark mode">
          <span class="theme-icon-sun" aria-hidden="true">☀</span>
          <span class="theme-icon-moon" aria-hidden="true">🌙</span>
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
