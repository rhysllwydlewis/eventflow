/**
 * Legacy Auth Navigation Handler
 * Minimal compatibility shim for legacy pages with "header/nav-menu" pattern
 * 
 * Responsibilities:
 * 1. Toggle mobile navigation menu (#burger + .nav-menu)
 * 2. Show/hide auth elements (#nav-auth, #nav-dashboard, #nav-signout) based on auth state
 * 3. Handle logout clicks if logout element exists
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

    // Initialize burger menu toggle
    initBurgerMenu();

    // Initialize auth state visibility
    initAuthState();
  }

  /**
   * Toggle legacy burger menu
   * Only operates on legacy #burger and .nav-menu elements
   */
  function initBurgerMenu() {
    const burger = document.getElementById('burger');
    const navMenu = document.querySelector('.nav-menu');

    // Fail silently if elements don't exist
    if (!burger || !navMenu) {
      return;
    }

    burger.addEventListener('click', e => {
      e.preventDefault();
      const isExpanded = burger.getAttribute('aria-expanded') === 'true';
      const newState = !isExpanded;

      burger.setAttribute('aria-expanded', String(newState));

      if (newState) {
        navMenu.classList.add('open');
        document.body.style.overflow = 'hidden';
      } else {
        navMenu.classList.remove('open');
        document.body.style.overflow = '';
      }
    });

    // Close menu when clicking on a link
    const menuLinks = navMenu.querySelectorAll('a');
    menuLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close menu on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /**
   * Show/hide legacy auth navigation elements based on current auth state
   * Performs single initial check only - no polling or background updates
   */
  function initAuthState() {
    const navAuth = document.getElementById('nav-auth');
    const navDashboard = document.getElementById('nav-dashboard');
    const navSignout = document.getElementById('nav-signout');

    // Fail silently if no legacy auth elements exist
    if (!navAuth && !navDashboard && !navSignout) {
      return;
    }

    // Use AuthStateManager if available, otherwise check directly
    if (window.AuthStateManager) {
      window.AuthStateManager.init().then(result => {
        updateAuthUI(result.user);
      });
    } else {
      checkAuthStatus();
    }

    // Setup logout handler if element exists
    if (navSignout) {
      navSignout.addEventListener('click', handleLogout);
    }

    function updateAuthUI(user) {
      if (user) {
        // User is authenticated
        if (navAuth) {
          navAuth.style.display = 'none';
        }
        if (navDashboard) {
          navDashboard.style.display = '';
          if (user.role === 'supplier') {
            navDashboard.href = '/dashboard-supplier.html';
          } else if (user.role === 'admin') {
            navDashboard.href = '/admin.html';
          } else {
            navDashboard.href = '/dashboard.html';
          }
        }
        if (navSignout) {
          navSignout.style.display = '';
        }
      } else {
        // User is not authenticated
        if (navAuth) {
          navAuth.style.display = '';
        }
        if (navDashboard) {
          navDashboard.style.display = 'none';
        }
        if (navSignout) {
          navSignout.style.display = 'none';
        }
      }
    }

    function checkAuthStatus() {
      fetch('/api/auth/me', {
        credentials: 'include',
      })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          return { user: null };
        })
        .then(data => {
          updateAuthUI(data.user);
        })
        .catch(() => {
          updateAuthUI(null);
        });
    }

    function handleLogout(e) {
      e.preventDefault();

      fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
        },
      })
        .then(response => {
          if (response.ok) {
            // Clear auth state if manager available
            if (window.AuthStateManager) {
              window.AuthStateManager.logout();
            }
            // Redirect to home
            window.location.href = '/';
          }
        })
        .catch(error => {
          console.error('Logout failed:', error);
        });
    }
  }
})();
