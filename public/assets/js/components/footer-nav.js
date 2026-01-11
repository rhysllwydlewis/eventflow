/**
 * Legacy Footer Navigation Handler
 * Placeholder script for legacy pages that reference footer-nav.js
 * Provides minimal mobile footer navigation synchronization if needed
 */

(function () {
  'use strict';

  // Prevent double initialization
  if (window.__footerNavInitialized) {
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    window.__footerNavInitialized = true;

    // Check if bottom navigation exists
    const bottomNav = document.querySelector('.ef-bottom-nav');
    if (!bottomNav) {
      // No bottom navigation on this page, nothing to do
      return;
    }

    // Sync auth state with bottom nav if needed
    syncBottomNavAuth();
  }

  /**
   * Sync authentication state with bottom navigation
   * Updates dashboard link visibility based on auth status
   */
  function syncBottomNavAuth() {
    const bottomDashboard = document.getElementById('ef-bottom-dashboard');
    const bottomMenu = document.getElementById('ef-bottom-menu');

    if (!bottomDashboard && !bottomMenu) {
      return;
    }

    // If auth state manager is available, use it
    if (window.AuthStateManager) {
      window.AuthStateManager.init().then(function (result) {
        updateBottomNavUI(result.user);
      });

      // Subscribe to auth state changes
      window.AuthStateManager.subscribe(function (state) {
        updateBottomNavUI(state.user);
      });
    } else {
      // Fallback: check auth status directly
      checkAuthStatus();
    }

    function updateBottomNavUI(user) {
      if (user) {
        // User is authenticated
        if (bottomDashboard) {
          bottomDashboard.style.display = '';
          // Set dashboard link based on user role
          if (user.role === 'supplier') {
            bottomDashboard.href = '/dashboard-supplier.html';
          } else if (user.role === 'admin') {
            bottomDashboard.href = '/admin.html';
          } else {
            bottomDashboard.href = '/dashboard.html';
          }
        }
      } else {
        // User is not authenticated
        if (bottomDashboard) {
          bottomDashboard.style.display = 'none';
        }
      }
    }

    function checkAuthStatus() {
      fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
        .then(function (response) {
          if (response.ok) {
            return response.json();
          }
          return { user: null };
        })
        .then(function (data) {
          updateBottomNavUI(data.user);
        })
        .catch(function () {
          updateBottomNavUI(null);
        });
    }
  }
})();
