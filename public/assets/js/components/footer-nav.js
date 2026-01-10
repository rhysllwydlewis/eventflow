/**
 * Footer Navigation
 * Manages mobile bottom navigation bar
 */
(function() {
  'use strict';

  function init() {
    const authState = window.AuthStateManager || window.__authState;
    
    if (!authState) {
      console.error('Auth state manager not found');
      return;
    }

    // Watch auth state and update UI
    authState.onchange(updateAuthUI);
    
    // Sync burger with header burger
    initBurgerSync();
  }

  function updateAuthUI(user) {
    const footerAuth = document.querySelector('.footer-nav-auth');
    const footerDashboard = document.querySelector('.footer-nav-dashboard');
    const footerBell = document.getElementById('footer-notification-bell');

    if (!footerAuth) return; // Footer nav doesn't exist

    if (user) {
      // Logged in
      const dashboardUrl = user.role === 'admin'
        ? '/admin.html'
        : user.role === 'supplier'
          ? '/dashboard-supplier.html'
          : '/dashboard-customer.html';

      footerAuth.textContent = 'Log out';
      footerAuth.href = '#';
      footerAuth.onclick = (e) => {
        e.preventDefault();
        handleLogout();
      };

      if (footerDashboard) {
        footerDashboard.style.display = '';
        footerDashboard.href = dashboardUrl;
      }

      if (footerBell) {
        footerBell.style.display = 'flex';
      }
    } else {
      // Logged out
      footerAuth.textContent = 'Log in';
      footerAuth.href = '/auth.html';
      footerAuth.onclick = null;

      if (footerDashboard) {
        footerDashboard.style.display = 'none';
      }

      if (footerBell) {
        footerBell.style.display = 'none';
      }
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-CSRF-Token': window.__CSRF_TOKEN__ || '' },
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }

    const authState = window.AuthStateManager || window.__authState;
    if (authState) {
      authState.logout();
    }

    window.location.href = '/?t=' + Date.now();
  }

  function initBurgerSync() {
    const headerBurger = document.getElementById('burger');
    const footerBurger = document.getElementById('footer-burger');

    if (!headerBurger || !footerBurger) return;

    // Footer burger clicks header burger
    footerBurger.addEventListener('click', () => {
      headerBurger.click();
    });

    // Watch header burger and sync footer
    const observer = new MutationObserver(() => {
      const isOpen = headerBurger.getAttribute('aria-expanded') === 'true';
      footerBurger.setAttribute('aria-expanded', String(isOpen));
      footerBurger.classList.toggle('footer-nav-burger--open', isOpen);
    });

    observer.observe(headerBurger, {
      attributes: true,
      attributeFilter: ['aria-expanded']
    });
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
