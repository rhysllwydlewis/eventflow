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

  // Cache current user state
  let currentUser = null;

  function init() {
    window.__authNavInitialized = true;

    // Initialize burger menu
    initBurgerMenu();

    // Initialize auth state management
    initAuthState();

    // Periodic auth state validation (every 30 seconds)
    setInterval(() => {
      checkAuthStatus(true);
    }, 30000);

    // Cross-tab auth state synchronization
    window.addEventListener('storage', e => {
      if (e.key === 'ef_logout_event') {
        // Logout detected in another tab
        if (window.AuthStateManager) {
          window.AuthStateManager.logout();
        }
        updateAuthState(null);
        // Redirect to home after a short delay
        setTimeout(() => {
          window.location.href = `/?t=${Date.now()}`;
        }, 500);
      }
    });
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

    burger.addEventListener('click', e => {
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
   * Auth State Management
   * Updates navigation links based on authentication status
   */
  function initAuthState() {
    const navAuth = document.getElementById('nav-auth');
    const navDashboard = document.getElementById('nav-dashboard');
    const navSignout = document.getElementById('nav-signout');

    // If auth state manager is available, use it
    if (window.AuthStateManager) {
      window.AuthStateManager.init().then(result => {
        currentUser = result.user;
        updateAuthState(result.user);
      });

      // Subscribe to auth state changes
      window.AuthStateManager.subscribe(state => {
        // Auth state changed - check if user actually changed
        const newUser = state.user;
        if (JSON.stringify(newUser) !== JSON.stringify(currentUser)) {
          currentUser = newUser;
          updateAuthState(newUser);
        }
      });
    } else {
      // Fallback: check auth status directly
      checkAuthStatus();
    }

    // Setup signout handler using cloneNode to prevent duplicate handlers
    if (navSignout) {
      const newSignout = navSignout.cloneNode(true);
      navSignout.parentNode.replaceChild(newSignout, navSignout);
      newSignout.addEventListener('click', handleLogout);
    }

    function updateAuthState(user) {
      if (!navAuth) {
        return;
      }

      if (user) {
        // User is authenticated
        if (navAuth) {
          navAuth.style.display = 'none';
        }
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

    async function checkAuthStatus(isPeriodicCheck = false) {
      // Add cache-busting to /api/auth/me calls
      const timestamp = Date.now();
      try {
        const response = await fetch(`/api/auth/me?t=${timestamp}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        let newUser = null;
        if (response.ok) {
          const data = await response.json();
          newUser = data.user || null;
        }

        // If this is a periodic check and user changed, update state
        if (isPeriodicCheck && JSON.stringify(newUser) !== JSON.stringify(currentUser)) {
          currentUser = newUser;
          updateAuthState(newUser);
        } else if (!isPeriodicCheck) {
          currentUser = newUser;
          updateAuthState(newUser);
        }
      } catch (error) {
        if (!isPeriodicCheck) {
          updateAuthState(null);
        }
      }
    }

    async function me() {
      const timestamp = Date.now();
      const response = await fetch(`/api/auth/me?t=${timestamp}`, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data.user || null;
      }
      return null;
    }

    async function handleLogout(e) {
      e.preventDefault();

      try {
        // Call logout API
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': window.__CSRF_TOKEN__ || '',
          },
        });

        if (response.ok) {
          // Update navbar immediately to show logged-out state
          initAuthNav(null);

          // Clear auth state
          if (window.AuthStateManager) {
            window.AuthStateManager.logout();
          }

          // Notify other tabs about logout
          try {
            localStorage.setItem('ef_logout_event', String(Date.now()));
            localStorage.removeItem('ef_logout_event');
          } catch (err) {
            // Ignore localStorage errors
          }

          // Re-check auth state to verify logout completed
          let retries = 0;
          const maxRetries = 3;
          let logoutVerified = false;

          while (retries < maxRetries && !logoutVerified) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const currentUser = await me();
            if (!currentUser) {
              logoutVerified = true;
            } else {
              console.warn('Logout verification failed, retrying...');
              retries++;
            }
          }

          // Redirect with cache-busting
          window.location.href = `/?t=${Date.now()}`;
        }
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }

    // Helper function to update navbar (used by handleLogout)
    function initAuthNav(user) {
      updateAuthState(user);
    }
  }
})();
