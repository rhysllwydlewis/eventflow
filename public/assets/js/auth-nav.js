/**
 * EventFlow Top Navigation - Gold Standard Implementation
 * World-class navbar with exceptional UX/UI, accessibility, and performance
 * Inspired by industry leaders: Stripe, Apple, Airbnb
 * 
 * Features:
 * - Smooth micro-interactions and animations
 * - WCAG 2.1 AA compliant accessibility
 * - Progressive enhancement approach
 * - Performance-optimized scroll handling
 * - Advanced state management
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
    scrollDirection: null,
    lastScrollY: 0,
    scrollThreshold: 5,
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
  // HEADER SCROLL BEHAVIOR - ENHANCED
  // ==========================================

  function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) {
      return;
    }

    let ticking = false;

    const updateHeaderState = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - state.lastScrollY;

      // Determine scroll direction with threshold to avoid jitter
      if (Math.abs(scrollDelta) > state.scrollThreshold) {
        state.scrollDirection = scrollDelta > 0 ? 'down' : 'up';
      }

      // Enhanced header behavior with smooth transitions
      if (currentScrollY > 100) {
        // Add elevated/compact state when scrolled
        header.classList.add('header--scrolled');

        if (state.scrollDirection === 'down' && currentScrollY > 150) {
          // Hide header on scroll down
          header.classList.add('header--hidden');
        } else if (state.scrollDirection === 'up' || currentScrollY < 100) {
          // Show header on scroll up or near top
          header.classList.remove('header--hidden');
        }
      } else {
        // At top of page - show full header
        header.classList.remove('header--scrolled', 'header--hidden');
      }

      state.lastScrollY = currentScrollY;
      ticking = false;
    };

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          window.requestAnimationFrame(updateHeaderState);
          ticking = true;
        }
      },
      { passive: true }
    );

    // Initial state
    state.lastScrollY = window.scrollY;
    updateHeaderState();
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
  // MICRO-INTERACTIONS & VISUAL FEEDBACK
  // ==========================================

  function initMicroInteractions() {
    // Add ripple effect to navigation links
    const navLinks = document.querySelectorAll('.nav-link, .nav-main, .admin-nav-btn');

    navLinks.forEach(link => {
      link.addEventListener('click', function (e) {
        // Create ripple element
        const ripple = document.createElement('span');
        ripple.className = 'nav-ripple';

        // Position ripple at click point
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';

        this.appendChild(ripple);

        // Remove ripple after animation
        setTimeout(() => ripple.remove(), 600);
      });
    });

    // Add smooth hover effects with scale
    const hoverElements = document.querySelectorAll(
      '.nav-main, .icon-button, .nav-toggle, .footer-nav-link'
    );

    hoverElements.forEach(element => {
      element.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
      });

      element.addEventListener('mouseleave', function () {
        this.style.transform = '';
      });
    });

    // Enhanced focus indicators for keyboard navigation
    document.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
      }
    });

    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-nav');
    });
  }

  // ==========================================
  // SEARCH ENHANCEMENT (if search exists)
  // ==========================================

  function initSearchEnhancement() {
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]');
    if (!searchInput) return;

    // Add search icon animation on focus
    searchInput.addEventListener('focus', () => {
      const searchIcon = searchInput.parentElement.querySelector('.search-icon, [class*="search"]');
      if (searchIcon) {
        searchIcon.style.transform = 'scale(1.1)';
      }
    });

    searchInput.addEventListener('blur', () => {
      const searchIcon = searchInput.parentElement.querySelector('.search-icon, [class*="search"]');
      if (searchIcon) {
        searchIcon.style.transform = '';
      }
    });
  }

  // ==========================================
  // PERFORMANCE MONITORING
  // ==========================================

  function initPerformanceMonitoring() {
    // Monitor navigation timing
    if (window.performance && window.performance.mark) {
      performance.mark('nav-init-start');

      window.addEventListener('load', () => {
        performance.mark('nav-init-end');
        try {
          performance.measure('nav-initialization', 'nav-init-start', 'nav-init-end');
          const measure = performance.getEntriesByName('nav-initialization')[0];

          // Log only in development
          if (window.location.hostname === 'localhost') {
            console.log(`Navigation initialized in ${measure.duration.toFixed(2)}ms`);
          }
        } catch (error) {
          // Silently fail
        }
      });
    }
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

    // Start performance monitoring
    initPerformanceMonitoring();

    // Initialize visual and interaction features
    initBrandAnimation();
    initMobileMenu();
    initHeaderScroll();
    initMicroInteractions();
    initSearchEnhancement();

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
