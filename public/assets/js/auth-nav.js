/**
 * EventFlow Top Navigation - Complete Rebuild
 * Modern, clean architecture for navbar functionality
 * Handles authentication state, mobile menu, and user interactions
 */

(function () {
  'use strict';

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================

  const state = {
    user: null,
    csrfToken: null,
    isInitialized: false,
  };

  // ==========================================
  // CSRF TOKEN
  // ==========================================

  async function initCsrfToken() {
    try {
      const response = await fetch('/api/csrf-token', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        state.csrfToken = data.csrfToken;
        window.__CSRF_TOKEN__ = data.csrfToken;
      }
    } catch (error) {
      // Silently fail - not critical
    }
  }

  // ==========================================
  // AUTH MANAGEMENT
  // ==========================================

  async function fetchCurrentUser() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.user || null;
    } catch (error) {
      return null;
    }
  }

  async function logout() {
    // Clear local state
    try {
      localStorage.removeItem('eventflow_onboarding_new');
      localStorage.removeItem('user');
      sessionStorage.clear();
    } catch (error) {
      // Ignore storage errors
    }

    // Call logout API - only if CSRF token is available
    if (state.csrfToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'X-CSRF-Token': state.csrfToken },
          credentials: 'include',
        });
      } catch (error) {
        // Ignore API errors
      }
    }

    // Notify components and reload
    state.user = null;
    dispatchAuthChange(null);
    window.location.href = `/?t=${Date.now()}`;
  }

  function dispatchAuthChange(user) {
    window.dispatchEvent(
      new CustomEvent('auth-state-changed', {
        detail: { user },
      })
    );
  }

  // ==========================================
  // MOBILE MENU
  // ==========================================

  function initMobileMenu() {
    const burger = document.getElementById('burger');
    const navMenu = document.querySelector('.nav-menu');

    if (!burger || !navMenu) {
      return;
    }

    // Prevent duplicate initialization
    if (burger.dataset.navInitialized === 'true') {
      return;
    }
    burger.dataset.navInitialized = 'true';

    // Set up accessibility
    if (!navMenu.id) {
      navMenu.id = 'primary-nav-menu';
    }
    burger.setAttribute('aria-controls', navMenu.id);
    burger.setAttribute('aria-expanded', 'false');

    // Toggle function
    const toggle = () => {
      const isOpen = document.body.classList.contains('nav-open');

      if (isOpen) {
        // Close menu
        document.body.classList.remove('nav-open');
        navMenu.classList.remove(
          'nav-menu--open',
          'is-open',
          'nav-menu--from-top',
          'nav-menu--from-bottom'
        );
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      } else {
        // Open menu
        document.body.classList.add('nav-open');
        navMenu.classList.add('nav-menu--open', 'is-open', 'nav-menu--from-top');
        burger.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
      }
    };

    // Event listeners
    burger.addEventListener('click', toggle);

    burger.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });

    // Close on link click
    navMenu.addEventListener('click', event => {
      if (event.target.tagName === 'A') {
        toggle();
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) {
        toggle();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', event => {
      if (document.body.classList.contains('nav-open')) {
        if (!burger.contains(event.target) && !navMenu.contains(event.target)) {
          toggle();
        }
      }
    });
  }

  // ==========================================
  // HEADER SCROLL BEHAVIOR
  // ==========================================

  function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) {
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const shouldHide = currentScrollY > lastScrollY && currentScrollY > 80;
          header.classList.toggle('header--hidden', shouldHide);
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ==========================================
  // BRAND ANIMATION
  // ==========================================

  function initBrandAnimation() {
    const brandText = document.querySelector('.brand-text');
    if (!brandText || brandText.dataset.animated === 'true') {
      return;
    }

    brandText.dataset.animated = 'true';
    brandText.style.display = 'inline-block';
    brandText.style.whiteSpace = 'nowrap';
    brandText.style.overflow = 'hidden';

    const initialWidth = brandText.offsetWidth;
    brandText.style.width = `${initialWidth}px`;
    brandText.style.transition = 'opacity 0.45s ease, width 0.45s ease, margin 0.45s ease';

    setTimeout(() => {
      brandText.style.opacity = '0';
      brandText.style.width = '0';
      brandText.style.marginLeft = '0';
    }, 3000);
  }

  // ==========================================
  // AUTH UI UPDATES
  // ==========================================

  function updateAuthUI(user) {
    // Mobile nav elements
    const mobileAuth = document.getElementById('nav-auth');
    const mobileDash = document.getElementById('nav-dashboard');
    const mobileSignout = document.getElementById('nav-signout');

    // Desktop inline nav
    const inlineNav = document.querySelector('.nav-inline');
    const inlineLogin = inlineNav?.querySelector('.nav-main-login');

    // Notification bell
    const notificationBell = document.getElementById('notification-bell');

    if (user) {
      // Logged in state
      const dashboardUrl =
        user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';

      // Mobile nav
      if (mobileAuth) {
        mobileAuth.style.display = 'none';
      }
      if (mobileDash) {
        mobileDash.style.display = '';
        mobileDash.href = dashboardUrl;
      }
      if (mobileSignout) {
        mobileSignout.style.display = '';
        const newSignout = mobileSignout.cloneNode(true);
        mobileSignout.parentNode.replaceChild(newSignout, mobileSignout);
        newSignout.addEventListener('click', e => {
          e.preventDefault();
          logout();
        });
      }

      // Desktop inline nav
      if (inlineLogin) {
        inlineLogin.textContent = 'Log out';
        inlineLogin.href = '#';
        const newInlineLogin = inlineLogin.cloneNode(true);
        inlineLogin.parentNode.replaceChild(newInlineLogin, inlineLogin);
        newInlineLogin.addEventListener('click', e => {
          e.preventDefault();
          logout();
        });
      }

      // Add dashboard link to desktop nav if not exists
      if (inlineNav && !inlineNav.querySelector('.nav-main-dashboard')) {
        const dashLink = document.createElement('a');
        dashLink.className = 'nav-link nav-main nav-main-dashboard';
        dashLink.textContent = 'Dashboard';
        dashLink.href = dashboardUrl;
        if (inlineLogin) {
          inlineNav.insertBefore(dashLink, inlineLogin);
        } else {
          inlineNav.appendChild(dashLink);
        }
      }

      // Show notification bell
      if (notificationBell) {
        notificationBell.style.display = 'flex';
      }
    } else {
      // Logged out state
      if (mobileAuth) {
        mobileAuth.style.display = '';
      }
      if (mobileDash) {
        mobileDash.style.display = 'none';
      }
      if (mobileSignout) {
        mobileSignout.style.display = 'none';
      }

      if (inlineLogin) {
        inlineLogin.textContent = 'Log in';
        inlineLogin.href = '/auth.html';
        const newInlineLogin = inlineLogin.cloneNode(true);
        inlineLogin.parentNode.replaceChild(newInlineLogin, inlineLogin);
      }

      // Remove dashboard link
      const dashboardLink = inlineNav?.querySelector('.nav-main-dashboard');
      if (dashboardLink) {
        dashboardLink.remove();
      }

      // Hide notification bell
      if (notificationBell) {
        notificationBell.style.display = 'none';
      }
    }

    // Normalize "Plan" label
    const firstNavItem = inlineNav?.querySelector('.nav-main');
    if (firstNavItem) {
      const text = firstNavItem.textContent.trim();
      if (text === 'Plan an Event' || text === 'Plan an event') {
        firstNavItem.textContent = 'Plan';
      }
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  async function init() {
    if (state.isInitialized) {
      return;
    }
    state.isInitialized = true;

    // Initialize non-auth features
    initBrandAnimation();
    initMobileMenu();
    initHeaderScroll();

    // Fetch CSRF token
    await initCsrfToken();

    // Fetch current user and update UI
    state.user = await fetchCurrentUser();
    updateAuthUI(state.user);

    // Dispatch initial auth state
    dispatchAuthChange(state.user);

    // Expose logout globally
    window.__eventflow_logout = logout;
    window.addEventListener('logout-requested', logout);

    // Watch for auth changes in other tabs
    window.addEventListener('storage', async event => {
      if (event.key === 'user' && event.newValue === null) {
        state.user = await fetchCurrentUser();
        updateAuthUI(state.user);
        dispatchAuthChange(state.user);
      }
    });

    // Periodic auth verification
    setInterval(async () => {
      const currentUser = await fetchCurrentUser();
      const wasLoggedIn = !!state.user;
      const isLoggedIn = !!currentUser;

      // Check if auth state changed
      if (wasLoggedIn !== isLoggedIn) {
        state.user = currentUser;
        updateAuthUI(currentUser);
        dispatchAuthChange(currentUser);
      } else if (currentUser && state.user) {
        // Check if role changed (edge case)
        if (currentUser.role !== state.user.role) {
          state.user = currentUser;
          updateAuthUI(currentUser);
          dispatchAuthChange(currentUser);
        }
      }
    }, 30000);
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
