(async function () {
  // --- CSRF Token Management ---
  let csrfToken = null;

  // Fetch CSRF token on page load
  async function fetchCsrfToken() {
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        csrfToken = data.csrfToken;
        // Store in window for access by other scripts
        window.__CSRF_TOKEN__ = csrfToken;
      }
    } catch (e) {
      console.error('Failed to fetch CSRF token', e);
    }
  }

  // Fetch token immediately
  await fetchCsrfToken();

  // --- Brand wordmark animation ---
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

  // --- Nav (burger + scroll behaviour) ---
  function initNavToggle() {
    const navMenu = document.querySelector('.nav.nav-menu');
    if (!navMenu) {
      return;
    }

    const body = document.body;

    // Defer setup so any inline burger scripts run first.
    setTimeout(() => {
      const original = document.getElementById('burger');
      if (!original) {
        return;
      }

      // Prevent re-initialization
      if (original.dataset.navInitialized === 'true') {
        return;
      }

      // Clone the burger to remove any previously-attached click handlers
      const burger = original.cloneNode(true);
      original.parentNode.replaceChild(burger, original);

      // Mark as initialized
      burger.dataset.navInitialized = 'true';

      // Add aria-controls if nav menu has an id
      if (!navMenu.id) {
        navMenu.id = 'primary-nav-menu';
      }
      burger.setAttribute('aria-controls', navMenu.id);

      const closeNav = () => {
        body.classList.remove('nav-open');
        navMenu.classList.remove('nav-menu--open');
        burger.setAttribute('aria-expanded', 'false');
        // Restore background scrolling
        body.style.overflow = '';
      };

      const openNav = () => {
        body.classList.add('nav-open');
        navMenu.classList.add('nav-menu--open');
        burger.setAttribute('aria-expanded', 'true');
        // Prevent background scrolling when menu is open
        body.style.overflow = 'hidden';
      };

      const toggleNav = () => {
        const isOpen = body.classList.contains('nav-open');
        if (isOpen) {
          closeNav();
        } else {
          openNav();
        }
      };

      burger.addEventListener('click', toggleNav);
      burger.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleNav();
        }
      });

      // Close nav when a menu link is clicked
      navMenu.addEventListener('click', event => {
        const target = event.target;
        if (target && target.tagName === 'A') {
          closeNav();
        }
      });

      // Close nav on ESC key press
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && body.classList.contains('nav-open')) {
          closeNav();
        }
      });

      // Close nav when clicking outside
      document.addEventListener('click', event => {
        const isOpen = body.classList.contains('nav-open');
        if (!isOpen) {
          return;
        }
        // Check if click is outside burger and nav menu
        if (!burger.contains(event.target) && !navMenu.contains(event.target)) {
          closeNav();
        }
      });
    }, 0);
  }

  // --- Header scroll hide / show ---
  function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) {
      return;
    }

    let lastY = window.scrollY;
    let ticking = false;

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const goingDown = currentY > lastY && currentY > 80;
          header.classList.toggle('header--hidden', goingDown);
          lastY = currentY;
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // --- Auth helper ---
  async function me() {
    try {
      const r = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      const data = await r.json();
      return data.user || null;
    } catch (_) {
      return null;
    }
  }

  // --- Auth-aware nav (and normalising labels) ---
  function initAuthNav(user) {
    const auth = document.getElementById('nav-auth');
    const dash = document.getElementById('nav-dashboard');
    const signout = document.getElementById('nav-signout');

    const inlineNav = document.querySelector('.nav.nav-inline');
    const inlineLogin = inlineNav ? inlineNav.querySelector('.nav-main-login') : null;
    const firstNavItem = inlineNav ? inlineNav.querySelector('.nav-main') : null;

    // Normalise top-left "Plan" label everywhere:
    // "Plan an Event" -> "Plan"
    if (firstNavItem) {
      const text = firstNavItem.textContent.trim();
      if (text === 'Plan an Event' || text === 'Plan an event') {
        firstNavItem.textContent = 'Plan';
      }
    }

    if (user) {
      // Mobile nav
      if (auth) {
        auth.style.display = 'none';
      }
      const dashHref =
        user.role === 'admin'
          ? '/admin.html'
          : user.role === 'supplier'
            ? '/dashboard-supplier.html'
            : '/dashboard-customer.html';

      if (dash) {
        dash.style.display = '';
        dash.href = dashHref;
      }
      if (signout) {
        signout.style.display = '';
        signout.addEventListener('click', async e => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { 'X-CSRF-Token': window.__CSRF_TOKEN__ || '' },
              credentials: 'include',
            });
          } catch (_) {
            /* Ignore logout errors */
          }
          location.href = '/';
        });
      }

      // Inline nav (top-right on desktop)
      let dashInline = inlineNav ? inlineNav.querySelector('.nav-main-dashboard') : null;
      if (inlineNav) {
        if (!dashInline) {
          dashInline = document.createElement('a');
          dashInline.className = 'nav-link nav-main nav-main-dashboard';
          dashInline.textContent = 'Dashboard';
          // Insert before login link if present, otherwise append
          if (inlineLogin && inlineLogin.parentNode === inlineNav) {
            inlineNav.insertBefore(dashInline, inlineLogin);
          } else {
            inlineNav.appendChild(dashInline);
          }
        }
        dashInline.href = dashHref;
      }

      if (inlineLogin) {
        inlineLogin.textContent = 'Log out';
        inlineLogin.href = '#';
        inlineLogin.addEventListener('click', async e => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { 'X-CSRF-Token': window.__CSRF_TOKEN__ || '' },
              credentials: 'include',
            });
          } catch (_) {
            /* Ignore logout errors */
          }
          location.href = '/';
        });
      }
    } else {
      // Not signed in
      if (auth) {
        auth.style.display = '';
      }
      if (dash) {
        dash.style.display = 'none';
      }
      if (signout) {
        signout.style.display = 'none';
      }

      if (inlineLogin) {
        inlineLogin.textContent = 'Log in';
        inlineLogin.href = '/auth.html';
      }
      if (inlineNav) {
        const dashInline = inlineNav.querySelector('.nav-main-dashboard');
        if (dashInline) {
          dashInline.remove();
        }
      }
    }
  }

  // Initialise UI pieces that don't depend on auth
  initBrandAnimation();
  initNavToggle();
  initHeaderScroll();

  // Then check auth and wire up auth-aware nav
  const user = await me();
  initAuthNav(user);
})();
