(async function () {
  // --- CSRF Token Management ---
  let csrfToken = null;
  
  // Fetch CSRF token on page load
  async function fetchCsrfToken() {
    try {
      const response = await fetch('/api/csrf-token');
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
  
  // --- Nav (burger + scroll behaviour) ---
  function initNavToggle() {
    const navMenu = document.querySelector('.nav.nav-menu');
    if (!navMenu) return;

    const body = document.body;

    // Defer setup so any inline burger scripts run first.
    setTimeout(() => {
      const original = document.getElementById('burger');
      if (!original) return;

      // Clone the burger to remove any previously-attached click handlers
      const burger = original.cloneNode(true);
      original.parentNode.replaceChild(burger, original);

      const closeNav = () => {
        body.classList.remove('nav-open');
        burger.setAttribute('aria-expanded', 'false');
      };

      const openNav = () => {
        body.classList.add('nav-open');
        burger.setAttribute('aria-expanded', 'true');
      };

      burger.addEventListener('click', () => {
        const isOpen = body.classList.contains('nav-open');
        if (isOpen) {
          closeNav();
        } else {
          openNav();
        }
      });

      // Close nav when a menu link is clicked (on mobile)
      navMenu.addEventListener('click', (event) => {
        const target = event.target;
        if (target && target.tagName === 'A') {
          closeNav();
        }
      });

      // Close nav if the viewport is resized up to desktop
      window.addEventListener('resize', () => {
        if (window.innerWidth > 720) {
          closeNav();
        }
      });
    }, 0);
  }

  // --- Header scroll hide / show ---
  function initHeaderScroll() {
    const header = document.querySelector('.header');
    if (!header) return;

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
      const r = await fetch('/api/auth/me');
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
      if (auth) auth.style.display = 'none';
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
        signout.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } catch (_) {}
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
        inlineLogin.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } catch (_) {}
          location.href = '/';
        });
      }
    } else {
      // Not signed in
      if (auth) auth.style.display = '';
      if (dash) dash.style.display = 'none';
      if (signout) signout.style.display = 'none';

      if (inlineLogin) {
        // 👇 This keeps the top-right link as a single word on one line
        inlineLogin.textContent = 'Login';
        inlineLogin.href = '/auth.html';
      }
      if (inlineNav) {
        const dashInline = inlineNav.querySelector('.nav-main-dashboard');
        if (dashInline) dashInline.remove();
      }
    }
  }

  // Initialise UI pieces that don't depend on auth
  initNavToggle();
  initHeaderScroll();

  // Then check auth and wire up auth-aware nav
  const user = await me();
  initAuthNav(user);
})();
