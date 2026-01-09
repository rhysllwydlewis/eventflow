/**
 * EventFlow Footer Navigation - Simplified Implementation
 * Works with pre-rendered HTML footer nav
 * Uses centralized auth state for updates
 */

(function () {
  'use strict';

  // ==========================================
  // STATE
  // ==========================================

  const state = {
    isInitialized: false,
  };

  // Get centralized auth state manager
  const getAuthState = () => window.__authState || window.AuthStateManager;

  // ==========================================
  // INITIALIZATION
  // ==========================================

  function init() {
    if (state.isInitialized) {
      return;
    }
    state.isInitialized = true;

    // Mark body as having footer nav
    document.body.classList.add('has-footer-nav');

    // Initialize components
    initAuthListener();
    initBurgerSync();
    initNotificationBellSync();
  }

  // ==========================================
  // AUTH STATE LISTENER
  // ==========================================

  function initAuthListener() {
    const authState = getAuthState();
    if (authState) {
      authState.onchange(updateAuthUI);
    }
  }

  function updateAuthUI(user) {
    const footerAuth = document.querySelector('.footer-nav-auth');
    const footerDashboard = document.querySelector('.footer-nav-dashboard');
    const footerBell = document.getElementById('footer-notification-bell');

    if (!footerAuth) {
      return;
    }

    if (user) {
      // Logged in
      const dashboardUrl = user.role === 'admin'
        ? '/admin.html'
        : user.role === 'supplier'
          ? '/dashboard-supplier.html'
          : '/dashboard-customer.html';

      // Update auth link to logout
      footerAuth.textContent = 'Log out';
      footerAuth.href = '#';
      
      // Remove old event listeners by cloning
      const newAuth = footerAuth.cloneNode(true);
      footerAuth.parentNode.replaceChild(newAuth, footerAuth);
      
      newAuth.addEventListener('click', async (e) => {
        e.preventDefault();
        if (window.__eventflow_logout) {
          window.__eventflow_logout();
        } else {
          window.dispatchEvent(new CustomEvent('logout-requested'));
        }
      });

      // Show dashboard link
      if (footerDashboard) {
        footerDashboard.href = dashboardUrl;
        footerDashboard.style.display = '';
      }

      // Show notification bell
      if (footerBell) {
        footerBell.style.display = 'flex';
      }
    } else {
      // Logged out
      footerAuth.textContent = 'Log in';
      footerAuth.href = '/auth.html';
      
      // Remove old event listeners by cloning
      const newAuth = footerAuth.cloneNode(true);
      footerAuth.parentNode.replaceChild(newAuth, footerAuth);

      // Hide dashboard link
      if (footerDashboard) {
        footerDashboard.style.display = 'none';
      }

      // Hide notification bell
      if (footerBell) {
        footerBell.style.display = 'none';
      }
    }
  }

  // ==========================================
  // BURGER MENU SYNC
  // ==========================================

  function initBurgerSync() {
    const footerBurger = document.getElementById('footer-burger');
    if (!footerBurger) {
      return;
    }

    // Wait for top burger initialization
    const setupSync = () => {
      const topBurger = document.getElementById('burger');
      if (!topBurger) {
        return false;
      }

      // Sync state function
      const syncState = isExpanded => {
        footerBurger.setAttribute('aria-expanded', String(isExpanded));
        footerBurger.classList.toggle('footer-nav-burger--open', isExpanded);
      };

      // Click handler - trigger top burger
      footerBurger.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        topBurger.click();
      });

      // Watch for top burger changes using MutationObserver
      const observer = new MutationObserver(() => {
        const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
        syncState(isExpanded);
      });

      observer.observe(topBurger, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
      });

      // Initial sync
      const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
      syncState(isExpanded);

      return true;
    };

    // Try multiple times with delays to ensure top burger is initialized
    if (!setupSync()) {
      setTimeout(() => {
        if (!setupSync()) {
          setTimeout(setupSync, 500);
        }
      }, 100);
    }
  }

  // ==========================================
  // NOTIFICATION BELL SYNC
  // ==========================================

  function initNotificationBellSync() {
    const footerBell = document.getElementById('footer-notification-bell');
    if (!footerBell) {
      return;
    }

    const topBell = document.getElementById('notification-bell');
    if (!topBell) {
      return;
    }

    const topBadge = document.querySelector('.notification-badge');
    const footerBadge = document.querySelector('.footer-notification-badge');

    const syncBell = () => {
      // Sync visibility
      footerBell.style.display = topBell.style.display;

      // Sync badge
      if (topBadge && footerBadge) {
        footerBadge.style.display = topBadge.style.display;
        footerBadge.textContent = topBadge.textContent;
      }
    };

    // Initial sync
    syncBell();

    // Watch for changes using MutationObserver
    const observer = new MutationObserver(syncBell);
    observer.observe(topBell, {
      attributes: true,
      attributeFilter: ['style'],
    });

    // Click handler
    footerBell.addEventListener('click', () => {
      window.location.href = '/dashboard-customer.html#notifications';
    });
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
