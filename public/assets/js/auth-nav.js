/**
 * Legacy navbar compatibility shim
 *
 * Many pages use the "legacy" header markup:
 *   - Burger button:   #burger
 *   - Drawer menu:     .nav-menu
 *   - Auth links:      #nav-auth, #nav-dashboard, #nav-signout
 *
 * This file intentionally keeps scope minimal:
 *   - Toggle the menu open/closed
 *   - Do a single auth check on load and update legacy auth links
 *   - Provide a basic logout handler (POST /api/auth/logout) if present
 *
 * It must not interfere with the newer EF header system (ef-mobile-toggle / ef-mobile-menu).
 */
(function () {
  'use strict';

  // If the EF header system is present, do nothing.
  if (document.getElementById('ef-mobile-toggle') || document.getElementById('ef-mobile-menu')) {
    return;
  }

  const burger = document.getElementById('burger');
  const menu = document.querySelector('.nav-menu');

  // Legacy auth links
  const navAuth = document.getElementById('nav-auth');
  const navDashboard = document.getElementById('nav-dashboard');
  const navSignout = document.getElementById('nav-signout');

  function setMenuOpen(isOpen) {
    document.body.classList.toggle('nav-open', isOpen);
    if (menu) {
      menu.classList.toggle('nav-menu--open', isOpen);
    }
    if (burger) {
      burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  }

  function toggleMenu() {
    const isOpen =
      document.body.classList.contains('nav-open') ||
      (menu && menu.classList.contains('nav-menu--open'));
    setMenuOpen(!isOpen);
  }

  if (burger && menu) {
    burger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenuOpen(false);
    });

    document.addEventListener('click', function (e) {
      if (!document.body.classList.contains('nav-open')) return;
      const target = e.target;
      if (!target) return;
      if (menu.contains(target) || burger.contains(target)) return;
      setMenuOpen(false);
    });
  }

  function dashboardUrlForUser(user) {
    if (!user || !user.role) return '/dashboard.html';
    if (user.role === 'admin') return '/admin.html';
    if (user.role === 'supplier') return '/dashboard-supplier.html';
    return '/dashboard-customer.html';
  }

  function updateLegacyAuthLinks(user) {
    if (user) {
      if (navAuth) navAuth.style.display = 'none';
      if (navDashboard) {
        navDashboard.style.display = '';
        navDashboard.href = dashboardUrlForUser(user);
      }
      if (navSignout) navSignout.style.display = '';
    } else {
      if (navAuth) navAuth.style.display = '';
      if (navDashboard) navDashboard.style.display = 'none';
      if (navSignout) navSignout.style.display = 'none';
    }
  }

  async function fetchCsrfToken() {
    try {
      const resp = await fetch('/api/csrf-token', { credentials: 'include' });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && data.csrfToken) {
        window.__CSRF_TOKEN__ = data.csrfToken;
        return data.csrfToken;
      }
    } catch (_e) {}
    return null;
  }

  async function fetchMe() {
    try {
      const resp = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data && data.user ? data.user : null;
    } catch (_e) {
      return null;
    }
  }

  Promise.resolve().then(fetchMe).then(updateLegacyAuthLinks).catch(function () {});

  if (navSignout) {
    navSignout.addEventListener('click', async function (e) {
      e.preventDefault();

      const token = window.__CSRF_TOKEN__ || (await fetchCsrfToken());
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-CSRF-Token': token },
          });
        } catch (_e) {}
      }

      try {
        localStorage.removeItem('user');
        localStorage.removeItem('eventflow_onboarding_new');
      } catch (_e) {}

      window.location.href = `/?t=${Date.now()}`;
    });
  }
})();
