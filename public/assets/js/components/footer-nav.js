/**
 * EventFlow Footer Navigation - Complete Rebuild
 * Modern bottom navigation bar with scroll-based visibility
 * Syncs with top navbar for consistent user experience
 */

(function () {
  'use strict';

  // ==========================================
  // STATE
  // ==========================================
  
  const state = {
    isInitialized: false,
    threshold: 80
  };

  // ==========================================
  // DOM CREATION
  // ==========================================
  
  function createFooterNav() {
    if (document.querySelector('.footer-nav')) return;
    if (state.isInitialized) return;
    state.isInitialized = true;

    const footerNav = document.createElement('div');
    footerNav.className = 'footer-nav footer-nav--hidden';
    footerNav.setAttribute('role', 'navigation');
    footerNav.setAttribute('aria-label', 'Quick navigation');
    
    footerNav.innerHTML = `
      <div class="footer-nav-content">
        <div class="footer-nav-links">
          <a href="/start.html" class="footer-nav-link">Plan</a>
          <a href="/suppliers.html" class="footer-nav-link">Suppliers</a>
          <a href="/blog.html" class="footer-nav-link">Guides</a>
          <a href="/dashboard.html" class="footer-nav-link footer-nav-dashboard" style="display: none">Dashboard</a>
          <button id="footer-notification-bell" class="footer-nav-icon-button" type="button" aria-label="Notifications" style="display: none">
            <span class="notification-icon">🔔</span>
            <span class="footer-notification-badge" style="display: none">0</span>
          </button>
          <a href="/auth.html" class="footer-nav-link footer-nav-auth">Log in</a>
          <button id="footer-burger" class="footer-nav-burger" type="button" aria-label="Toggle navigation" aria-expanded="false">
            <span class="footer-nav-burger-bar"></span>
            <span class="footer-nav-burger-bar"></span>
            <span class="footer-nav-burger-bar"></span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(footerNav);
    document.body.classList.add('has-footer-nav');

    initScrollBehavior(footerNav);
    initBurgerSync();
    initNotificationSync();

    // Listen for auth changes
    window.addEventListener('auth-state-changed', (event) => {
      updateAuthState(event.detail.user);
    });
  }

  // ==========================================
  // SCROLL BEHAVIOR
  // ==========================================
  
  function initScrollBehavior(footerNav) {
    const header = document.querySelector('.header');
    if (header) {
      state.threshold = header.offsetHeight || 80;
    }

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const shouldShow = window.scrollY > state.threshold;
          footerNav.classList.toggle('footer-nav--visible', shouldShow);
          footerNav.classList.toggle('footer-nav--hidden', !shouldShow);
          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      if (header) {
        state.threshold = header.offsetHeight || 80;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Initial check
    setTimeout(handleScroll, 50);
  }

  // ==========================================
  // BURGER MENU SYNC
  // ==========================================
  
  function initBurgerSync() {
    const footerBurger = document.getElementById('footer-burger');
    if (!footerBurger) return;

    // Wait for top burger initialization
    const setupSync = () => {
      const topBurger = document.getElementById('burger');
      if (!topBurger || topBurger.dataset.navInitialized !== 'true') {
        return false;
      }

      // Sync state function
      const syncState = (isExpanded) => {
        footerBurger.setAttribute('aria-expanded', String(isExpanded));
        footerBurger.classList.toggle('footer-nav-burger--open', isExpanded);
      };

      // Click handler - trigger top burger
      footerBurger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
          navMenu.classList.remove('nav-menu--from-top');
          navMenu.classList.add('nav-menu--from-bottom');
        }

        topBurger.click();

        requestAnimationFrame(() => {
          const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
          syncState(isExpanded);
        });
      });

      // Watch for top burger changes
      const observer = new MutationObserver(() => {
        const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
        syncState(isExpanded);
      });

      observer.observe(topBurger, {
        attributes: true,
        attributeFilter: ['aria-expanded']
      });

      // Initial sync
      const isExpanded = topBurger.getAttribute('aria-expanded') === 'true';
      syncState(isExpanded);

      return true;
    };

    // Try multiple times with delays
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
  
  function initNotificationSync() {
    const footerBell = document.getElementById('footer-notification-bell');
    if (!footerBell) return;

    const topBell = document.getElementById('notification-bell');
    const topBadge = document.querySelector('.notification-badge');
    const footerBadge = document.querySelector('.footer-notification-badge');

    const syncBell = () => {
      if (topBell && topBell.style.display !== 'none') {
        footerBell.style.display = 'flex';
        
        if (topBadge && footerBadge) {
          footerBadge.style.display = topBadge.style.display;
          footerBadge.textContent = topBadge.textContent;
        }
      } else {
        footerBell.style.display = 'none';
      }
    };

    // Initial sync
    syncBell();

    // Watch for changes
    if (topBell) {
      const observer = new MutationObserver(syncBell);
      observer.observe(topBell, {
        attributes: true,
        attributeFilter: ['style']
      });
    }

    // Listen for auth changes
    window.addEventListener('auth-state-changed', () => {
      setTimeout(syncBell, 50);
    });

    // Click handler
    footerBell.addEventListener('click', () => {
      window.location.href = '/dashboard.html#notifications';
    });
  }

  // ==========================================
  // AUTH STATE UPDATES
  // ==========================================
  
  function updateAuthState(user) {
    const footerAuth = document.querySelector('.footer-nav-auth');
    const footerDashboard = document.querySelector('.footer-nav-dashboard');
    const footerBell = document.getElementById('footer-notification-bell');

    if (!footerAuth) return;

    // Clean clone helper
    const cleanClone = (element) => {
      const clone = element.cloneNode(true);
      element.parentNode.replaceChild(clone, element);
      return clone;
    };

    if (user) {
      // Logged in
      const dashboardUrl = user.role === 'admin' ? '/admin.html'
        : user.role === 'supplier' ? '/dashboard-supplier.html'
        : '/dashboard-customer.html';

      const newAuth = cleanClone(footerAuth);
      newAuth.textContent = 'Log out';
      newAuth.href = '#';
      newAuth.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('logout-requested'));
      });

      if (footerDashboard) {
        footerDashboard.style.display = '';
        footerDashboard.href = dashboardUrl;
      }

      if (footerBell) {
        footerBell.style.display = 'flex';
      }

    } else {
      // Logged out
      const newAuth = cleanClone(footerAuth);
      newAuth.textContent = 'Log in';
      newAuth.href = '/auth.html';

      if (footerDashboard) {
        footerDashboard.style.display = 'none';
      }

      if (footerBell) {
        footerBell.style.display = 'none';
      }
    }
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFooterNav);
  } else {
    createFooterNav();
  }
})();
