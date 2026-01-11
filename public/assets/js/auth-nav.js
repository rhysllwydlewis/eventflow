/**
 * Legacy Auth Navigation Handler
 * Provides burger menu toggle and auth state management for legacy pages
 * that use the "header/nav-menu" pattern
 */

(function () {
  'use strict';

  // Prevent double initialization
  if (window.__authNavInitialized) {
    return;
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    window.__authNavInitialized = true;

    // Initialize burger menu
    initBurgerMenu();

    // Initialize auth state management
    initAuthState();
  }

  /**
   * Burger Menu Toggle
   * Handles mobile navigation menu open/close
   */
  function initBurgerMenu() {
    const burger = document.getElementById('burger');
    const navMenu = document.querySelector('.nav-menu');

    if (!burger || !navMenu) {
      return;
    }

    burger.addEventListener('click', function (e) {
      e.preventDefault();
      const isExpanded = burger.getAttribute('aria-expanded') === 'true';
      const newState = !isExpanded;

      // Toggle aria-expanded
      burger.setAttribute('aria-expanded', String(newState));

      // Toggle menu visibility
      if (newState) {
        navMenu.classList.add('open');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
      } else {
        navMenu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    // Close menu when clicking on a link
    const menuLinks = navMenu.querySelectorAll('a');
    menuLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        navMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close menu on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /**
   * Auth State Management
   * Updates navigation links based on authentication status
   */
  function initAuthState() {
    const navAuth = document.getElementById('nav-auth');
    const navDashboard = document.getElementById('nav-dashboard');
    const navSignout = document.getElementById('nav-signout');

    // If auth state manager is available, use it
    if (window.AuthStateManager) {
      window.AuthStateManager.init().then(function (result) {
        updateAuthUI(result.user);
      });

      // Subscribe to auth state changes
      window.AuthStateManager.subscribe(function (state) {
        updateAuthUI(state.user);
      });
    } else {
      // Fallback: check auth status directly
      checkAuthStatus();
    }

    // Setup signout handler
    if (navSignout) {
      navSignout.addEventListener('click', handleSignout);
    }

    function updateAuthUI(user) {
      if (!navAuth) return;

      if (user) {
        // User is authenticated
        if (navAuth) navAuth.style.display = 'none';
        if (navDashboard) {
          navDashboard.style.display = '';
          // Set dashboard link based on user role
          if (user.role === 'supplier') {
            navDashboard.href = '/dashboard-supplier.html';
          } else if (user.role === 'admin') {
            navDashboard.href = '/admin.html';
          } else {
            navDashboard.href = '/dashboard.html';
          }
        }
        if (navSignout) navSignout.style.display = '';
      } else {
        // User is not authenticated
        if (navAuth) navAuth.style.display = '';
        if (navDashboard) navDashboard.style.display = 'none';
        if (navSignout) navSignout.style.display = 'none';
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
          updateAuthUI(data.user);
        })
        .catch(function () {
          updateAuthUI(null);
        });
    }

    function handleSignout(e) {
      e.preventDefault();

      fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
      })
        .then(function (response) {
          if (response.ok) {
            // Clear auth state
            if (window.AuthStateManager) {
              window.AuthStateManager.logout();
            }
            // Redirect to home
            window.location.href = '/';
          }
        })
        .catch(function (error) {
          console.error('Logout failed:', error);
        });
    }
  }
})();
